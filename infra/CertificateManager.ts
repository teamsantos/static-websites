import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface CertificateManagerProps {
    /**
     * The domain name (e.g., "example.com")
     * Will create a wildcard certificate for *.example.com
     */
    domainName: string;

    /**
     * The Route53 hosted zone for DNS validation
     */
    hostedZone: route53.IHostedZone;

    /**
     * Optional: Custom parameter store path
     * Default: /acm/certificates/{domainName}
     */
    parameterPath?: string;

    /**
     * Optional: Subdomain prefix for the wildcard certificate
     * If provided, creates a certificate for *.{subDomain}.{domainName}
     * e.g., subDomain: "template" with domainName: "e-info.click" creates *.template.e-info.click
     */
    subDomain?: string;
}

export class CertificateManager extends Construct {
    public readonly certificate: acm.ICertificate;
    public readonly certificateArn: string;

    constructor(scope: Construct, id: string, props: CertificateManagerProps) {
        super(scope, id);
        function getBaseDomain(domain: string): string {
            const parts = domain.split('.');
            if (parts.length <= 2) return domain;
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
        
        let certificate: acm.ICertificate;

        // If context exists and has a valid ARN (not an error object), use existing certificate
        if (contextValue && 
            typeof contextValue === 'string' && 
            contextValue.startsWith('arn:aws:acm:')) {
            // Use existing certificate from SSM parameter
            certificate = acm.Certificate.fromCertificateArn(
                this,
                'ExistingCertificate',
                contextValue
            );

            new cdk.CfnOutput(this, 'CertificateSource', {
                value: 'Existing (from Parameter Store)',
                description: 'Certificate source'
            });
        } else {
            // Create new certificate (parameter doesn't exist or context not available)
            certificate = this.createNewCertificate(
                wildcardDomain,
                certDomain,
                props.hostedZone,
                parameterPath
            );
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

    private createNewCertificate(
        wildcardDomain: string,
        domainName: string,
        hostedZone: route53.IHostedZone,
        parameterPath: string
    ): acm.Certificate {
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
