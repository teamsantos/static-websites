import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
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

        // Use Custom Resource to look up SSM parameter at deployment time
        const parameterLookup = new cr.AwsCustomResource(this, 'ParameterLookup', {
            onUpdate: {
                service: 'SSM',
                action: 'getParameter',
                parameters: {
                    Name: parameterPath,
                },
                physicalResourceId: cr.PhysicalResourceId.of(`${parameterPath}-lookup`),
                ignoreErrorCodesMatching: 'ParameterNotFound',
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [
                    `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${parameterPath}`
                ],
            }),
        });

        // Get the parameter value from the custom resource
        const existingCertArn = parameterLookup.getResponseField('Parameter.Value');

        // Try to use existing certificate if parameter exists
        let certificate: acm.ICertificate;
        
        try {
            // Attempt to import existing certificate
            // If the parameter doesn't exist, this will fail and we'll create new
            certificate = acm.Certificate.fromCertificateArn(
                this,
                'Certificate',
                existingCertArn
            );

            new cdk.CfnOutput(this, 'CertificateSource', {
                value: 'Existing (from Parameter Store)',
                description: 'Certificate source'
            });
        } catch {
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
