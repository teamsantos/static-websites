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
        // If subDomain is provided, create certificate for *.{subDomain}.{baseDomain}
        // Otherwise, create certificate for *.{baseDomain}
        const certDomain = props.subDomain
            ? `${props.subDomain}.${baseDomain}`
            : baseDomain;
        const wildcardDomain = `*.${certDomain}`;
        const parameterPath = props.parameterPath || `/acm/certificates/${certDomain}`;
        // Build the context key that CDK uses for SSM lookups
        const account = cdk.Stack.of(this).account;
        const region = cdk.Stack.of(this).region;
        const contextKey = `ssm:account=${account}:parameterName=${parameterPath}:region=${region}`;
        // Check if we already have this value in context (from cdk.context.json)
        const contextValue = this.node.tryGetContext(contextKey);
        let certificate;
        // If context exists and has a valid ARN (not an error object), use existing certificate
        if (contextValue &&
            typeof contextValue === 'string' &&
            contextValue.startsWith('arn:aws:acm:')) {
            // Use existing certificate from SSM parameter
            certificate = acm.Certificate.fromCertificateArn(this, 'ExistingCertificate', contextValue);
            new cdk.CfnOutput(this, 'CertificateSource', {
                value: 'Existing (from Parameter Store)',
                description: 'Certificate source'
            });
        }
        else {
            // Create new certificate (parameter doesn't exist or context not available)
            certificate = this.createNewCertificate(wildcardDomain, certDomain, props.hostedZone, parameterPath);
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
            subjectAlternativeNames: [domainName], // Include the root domain (e.g., template.e-info.click)
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
