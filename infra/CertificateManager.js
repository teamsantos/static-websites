"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateManager = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const ssm = __importStar(require("aws-cdk-lib/aws-ssm"));
const constructs_1 = require("constructs");
class CertificateManager extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        function getBaseDomain(domain) {
            const parts = domain.split('.');
            if (parts.length <= 2)
                return domain;
            parts.shift();
            return parts.join('.');
        }
        const baseDomain = getBaseDomain(props.domainName);
        const wildcardDomain = `*.${baseDomain}`;
        const parameterPath = props.parameterPath || `/acm/certificates/${baseDomain}`;
        // Try to get existing certificate ARN from Parameter Store
        let certificate;
        try {
            // Attempt to lookup existing parameter
            const existingArn = ssm.StringParameter.valueFromLookup(this, parameterPath);
            // Check if we got a real ARN (not a placeholder)
            if (existingArn && existingArn.startsWith('arn:aws:acm:')) {
                // Use existing certificate
                certificate = acm.Certificate.fromCertificateArn(this, 'ExistingCertificate', existingArn);
                new cdk.CfnOutput(this, 'CertificateSource', {
                    value: 'Existing (from Parameter Store)',
                    description: 'Certificate source'
                });
            }
            else {
                // Create new certificate
                certificate = this.createNewCertificate(wildcardDomain, baseDomain, props.hostedZone, parameterPath);
            }
        }
        catch (error) {
            // Parameter doesn't exist, create new certificate
            certificate = this.createNewCertificate(wildcardDomain, baseDomain, props.hostedZone, parameterPath);
        }
        this.certificate = certificate;
        this.certificateArn = certificate.certificateArn;
        // Output the certificate ARN
        new cdk.CfnOutput(this, 'CertificateArn', {
            value: this.certificateArn,
            description: `ACM Certificate ARN for ${wildcardDomain}`,
            exportName: `${cdk.Stack.of(this).stackName}-CertificateArn`
        });
    }
    createNewCertificate(wildcardDomain, domainName, hostedZone, parameterPath) {
        // Create new certificate that covers both wildcard and root domain
        const newCertificate = new acm.Certificate(this, 'WildcardCertificate', {
            domainName: wildcardDomain,
            subjectAlternativeNames: [domainName], // Include the root domain (e.g., e-info.click)
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
        // Store the certificate ARN in Parameter Store
        new ssm.StringParameter(this, 'CertificateParameter', {
            parameterName: parameterPath,
            stringValue: newCertificate.certificateArn,
            description: `ACM Certificate ARN for ${wildcardDomain}`,
            tier: ssm.ParameterTier.STANDARD,
        });
        new cdk.CfnOutput(this, 'CertificateSource', {
            value: 'Newly Created',
            description: 'Certificate source'
        });
        new cdk.CfnOutput(this, 'ParameterPath', {
            value: parameterPath,
            description: 'SSM Parameter Store path'
        });
        return newCertificate;
    }
}
exports.CertificateManager = CertificateManager;
