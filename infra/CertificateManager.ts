import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface CertificateManagerProps {
    domainName: string;
    hostedZone: route53.IHostedZone;
    parameterPath?: string;
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
        const certDomain = props.subDomain 
            ? `${props.subDomain}.${baseDomain}` 
            : baseDomain;
        const wildcardDomain = `*.${certDomain}`;
        const parameterPath = props.parameterPath || `/acm/certificates/${certDomain}`;

        // Try to lookup existing certificate ARN from SSM during synthesis
        let existingCertArn: string | undefined;
        try {
            // This uses cdk.context.json to cache the lookup
            const lookupValue = ssm.StringParameter.valueFromLookup(this, parameterPath);
            
            // Check if it's a real ARN (not a dummy value from first synth)
            if (lookupValue && 
                lookupValue.startsWith('arn:aws:acm:') &&
                !lookupValue.includes('dummy-value-for')) {
                existingCertArn = lookupValue;
            }
        } catch (error) {
            // Parameter doesn't exist yet
            existingCertArn = undefined;
        }

        let certificate: acm.ICertificate;

        if (existingCertArn) {
            // Use existing certificate
            certificate = acm.Certificate.fromCertificateArn(
                this,
                'Certificate',
                existingCertArn
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

        this.certificate = certificate;
        this.certificateArn = certificate.certificateArn;

        new cdk.CfnOutput(this, 'CertificateArn', {
            value: this.certificateArn,
            description: `ACM Certificate ARN for ${wildcardDomain}`,
        });
    }

    private createNewCertificate(
        wildcardDomain: string,
        domainName: string,
        hostedZone: route53.IHostedZone,
        parameterPath: string
    ): acm.Certificate {
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
