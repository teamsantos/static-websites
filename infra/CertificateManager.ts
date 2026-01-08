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

        // Try to get existing certificate ARN from Parameter Store
        let certificate: acm.ICertificate;

        try {
            // Attempt to lookup existing parameter
            const existingArn = ssm.StringParameter.valueFromLookup(
                this,
                parameterPath
            );

            // Check if we got a real ARN (not a placeholder)
            if (existingArn && existingArn.startsWith('arn:aws:acm:')) {
                // Use existing certificate
                certificate = acm.Certificate.fromCertificateArn(
                    this,
                    'ExistingCertificate',
                    existingArn
                );

                new cdk.CfnOutput(this, 'CertificateSource', {
                    value: 'Existing (from Parameter Store)',
                    description: 'Certificate source'
                });
            } else {
                // Create new certificate
                certificate = this.createNewCertificate(
                    wildcardDomain,
                    certDomain,
                    props.hostedZone,
                    parameterPath
                );
            }
        } catch (error) {
            // Parameter doesn't exist, create new certificate
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
