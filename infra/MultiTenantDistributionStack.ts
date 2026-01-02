import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";

interface MultiTenantDistributionStackProps extends cdk.StackProps {
    domainName: string;
    hostedZoneDomainName: string;
    s3Bucket: string;
    region: string;
}

export class MultiTenantDistributionStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;
    public readonly distributionId: string;
    public readonly distributionDomainName: string;
    public readonly certificate: acm.ICertificate;

    constructor(scope: cdk.App, id: string, props: MultiTenantDistributionStackProps) {
        super(scope, id, props);

        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });

        // Get or create wildcard certificate
        const baseDomain = props.hostedZoneDomainName;
        const wildcardDomain = `*.${baseDomain}`;
        const certificateParameterPath = `/acm/certificates/${baseDomain}`;

        let certificate: acm.ICertificate;

        try {
            // Try to get existing certificate from Parameter Store
            const existingArn = ssm.StringParameter.valueFromLookup(
                this,
                certificateParameterPath
            );

            if (existingArn && existingArn.startsWith("arn:aws:acm:")) {
                // Use existing certificate
                certificate = acm.Certificate.fromCertificateArn(
                    this,
                    "ExistingWildcardCertificate",
                    existingArn
                );

                new cdk.CfnOutput(this, "CertificateSource", {
                    value: "Existing (from Parameter Store)",
                    description: "Certificate source",
                });
            } else {
                throw new Error("Invalid certificate ARN in Parameter Store");
            }
        } catch (error) {
            // Create new wildcard certificate
            const newCertificate = new acm.Certificate(this, "WildcardCertificate", {
                domainName: wildcardDomain,
                validation: acm.CertificateValidation.fromDns(hostedZone),
            });

            // Store the certificate ARN in Parameter Store
            new ssm.StringParameter(this, "CertificateParameter", {
                parameterName: certificateParameterPath,
                stringValue: newCertificate.certificateArn,
                description: `ACM Certificate ARN for ${wildcardDomain}`,
                tier: ssm.ParameterTier.STANDARD,
            });

            certificate = newCertificate;

            new cdk.CfnOutput(this, "CertificateSource", {
                value: "Newly Created",
                description: "Certificate source",
            });
        }

        // Import S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(
            this,
            "StaticWebsitesBucket",
            {
                bucketName: props.s3Bucket,
                region: props.region,
            }
        );

        // Create Origin Access Control for S3
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: "OAC for multi-tenant static websites",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });

        // Create CloudFront Function to rewrite paths based on hostname
        const pathRewriteFunction = new cloudfront.Function(
            this,
            "PathRewriteFunction",
            {
                code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const request = event.request;
    const host = request.headers.host.value;
    
    // Extract project name from subdomain (e.g., "brunodi4gay" from "brunodi4gay.e-info.click")
    const projectName = host.split('.')[0];
    
    // Rewrite the URI to include the project name prefix
    // Request: / → /brunodi4gay/
    // Request: /css/style.css → /brunodi4gay/css/style.css
    if (request.uri === '/') {
        request.uri = '/' + projectName + '/index.html';
    } else {
        request.uri = '/' + projectName + request.uri;
    }
    
    return request;
}
`),
            }
        );

        // Create S3 origin
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originAccessControl: oac,
        });

        // Create multi-tenant CloudFront distribution
        this.distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
                functionAssociations: [
                    {
                        function: pathRewriteFunction,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(
                    this,
                    "CorsPolicy",
                    {
                        corsBehavior: {
                            accessControlAllowCredentials: false,
                            accessControlAllowHeaders: ["*"],
                            accessControlAllowMethods: ["GET", "HEAD"],
                            accessControlAllowOrigins: ["https://editor.e-info.click"],
                            accessControlExposeHeaders: [],
                            accessControlMaxAge: cdk.Duration.seconds(3600),
                            originOverride: true,
                        },
                    }
                ),
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            domainNames: [wildcardDomain],
            defaultRootObject: "index.html",
            certificate: certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(30),
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(30),
                },
            ],
            comment: "Multi-tenant CloudFront distribution for static websites",
            enableLogging: false,
        });

        this.distributionId = this.distribution.distributionId;
        this.distributionDomainName = this.distribution.distributionDomainName;
        this.certificate = certificate;

        // Output distribution details
        new cdk.CfnOutput(this, "DistributionId", {
            value: this.distributionId,
            description: "CloudFront distribution ID",
            exportName: "MultiTenantDistributionId",
        });

        new cdk.CfnOutput(this, "DistributionDomainName", {
            value: this.distributionDomainName,
            description: "CloudFront distribution domain name",
            exportName: "MultiTenantDistributionDomainName",
        });

        new cdk.CfnOutput(this, "CertificateArn", {
            value: certificate.certificateArn,
            description: "ACM Certificate ARN",
            exportName: "WildcardCertificateArn",
        });
    }
}
