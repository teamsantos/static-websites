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
        const certDomain = props.subDomain
            ? `${props.subDomain}.${baseDomain}`
            : baseDomain;
        const wildcardDomain = `*.${certDomain}`;
        const parameterPath = props.parameterPath || `/acm/certificates/${certDomain}`;
        // Try to lookup existing certificate ARN from SSM during synthesis
        let existingCertArn;
        try {
            // This uses cdk.context.json to cache the lookup
            const lookupValue = ssm.StringParameter.valueFromLookup(this, parameterPath);
            // Check if it's a real ARN (not a dummy value from first synth)
            if (lookupValue &&
                lookupValue.startsWith('arn:aws:acm:') &&
                !lookupValue.includes('dummy-value-for')) {
                existingCertArn = lookupValue;
            }
        }
        catch (error) {
            // Parameter doesn't exist yet
            existingCertArn = undefined;
        }
        let certificate;
        if (existingCertArn) {
            // Use existing certificate
            certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', existingCertArn);
            new cdk.CfnOutput(this, 'CertificateSource', {
                value: 'Existing (from Parameter Store)',
                description: 'Certificate source'
            });
        }
        else {
            // Create new certificate
            certificate = this.createNewCertificate(wildcardDomain, certDomain, props.hostedZone, parameterPath);
        }
        this.certificate = certificate;
        this.certificateArn = certificate.certificateArn;
        new cdk.CfnOutput(this, 'CertificateArn', {
            value: this.certificateArn,
            description: `ACM Certificate ARN for ${wildcardDomain}`,
        });
    }
    createNewCertificate(wildcardDomain, domainName, hostedZone, parameterPath) {
        const newCertificate = new acm.Certificate(this, 'WildcardCertificate', {
            domainName: wildcardDomain,
            subjectAlternativeNames: [domainName],
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
        return newCertificate;
    }
}
exports.CertificateManager = CertificateManager;
