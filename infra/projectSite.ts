import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cr from "aws-cdk-lib/custom-resources";

interface ProjectSiteProps extends cdk.StackProps {
    projectName: string;
    domainName: string;
    hostedZoneDomainName: string;
    s3Bucket: string;
    region: string;
    useOAC?: boolean; // Flag to choose between OAI and OAC
}

export class ProjectSite extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;
    public readonly certificate: acm.Certificate;

    constructor(scope: cdk.App, id: string, props: ProjectSiteProps) {
        super(scope, id, props);

        // Look up the hosted zone within the Stack context
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });

        // Reference existing S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(
            this,
            "StaticWebsitesBucket",
            {
                bucketName: props.s3Bucket,
                region: props.region,
            }
        );

        // Create SSL certificate for CloudFront (must be in us-east-1)
        this.certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });

        let origin: cloudfront.IOrigin;

        if (props.useOAC) {
            // ========== OPTION 2: Using Origin Access Control (OAC) - Fully Automated ==========

            // Create Origin Access Control (OAC)
            const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
                description: `OAC for ${props.projectName}`,
                signing: cloudfront.Signing.SIGV4_ALWAYS,
            });

            // Create S3 origin with OAC (modern approach)
            origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
                originPath: `/${props.projectName}`,
                originAccessControl: oac,
            });

            // Create CloudFront distribution
            this.distribution = new cloudfront.Distribution(this, "Distribution", {
                defaultBehavior: {
                    origin: origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                    compress: true,
                },
                domainNames: [props.domainName],
                defaultRootObject: "index.html",
                certificate: this.certificate,
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
                errorResponses: [
                    {
                        httpStatus: 403,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(30),
                    },
                    {
                        httpStatus: 404,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(30),
                    }
                ],
                comment: `CloudFront distribution for ${props.projectName}`,
            });

            // Associate OAC with the CloudFront distribution - this might not be needed with the new origin approach
            // The S3BucketOrigin.withOriginAccessControl should handle this automatically
            // But if needed, you can still override:
            // const cfnDistribution = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
            // cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginAccessControlId', oac.originAccessControlId);

            // AUTOMATED BUCKET POLICY UPDATE using CDK Custom Resource
            const bucketPolicyDocument = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            Service: "cloudfront.amazonaws.com"
                        },
                        Action: "s3:GetObject",
                        Resource: `arn:aws:s3:::${props.s3Bucket}/${props.projectName}/*`,
                        Condition: {
                            StringEquals: {
                                "AWS:SourceArn": cdk.Stack.of(this).formatArn({
                                    service: 'cloudfront',
                                    region: '',
                                    resource: 'distribution',
                                    resourceName: this.distribution.distributionId,
                                })
                            }
                        }
                    }
                ]
            };

            // Use AwsCustomResource to automatically update bucket policy
            new cr.AwsCustomResource(this, 'BucketPolicyUpdater', {
                onCreate: {
                    service: 'S3',
                    action: 'putBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket,
                        Policy: JSON.stringify(bucketPolicyDocument)
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(`${props.projectName}-bucket-policy-${Date.now()}`)
                },
                onUpdate: {
                    service: 'S3',
                    action: 'putBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket,
                        Policy: JSON.stringify(bucketPolicyDocument)
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(`${props.projectName}-bucket-policy-${Date.now()}`)
                },
                onDelete: {
                    service: 'S3',
                    action: 'deleteBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket
                    }
                },
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                    resources: [`arn:aws:s3:::${props.s3Bucket}`, `arn:aws:s3:::${props.s3Bucket}/*`]
                })
            });

        } else {
            // ========== OPTION 1: Using Origin Access Identity (OAI) - Fully Automated ==========

            // Create Origin Access Identity for secure S3 access
            const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
                comment: `OAI for ${props.projectName}`,
            });

            // Create S3 origin with OAI (modern approach)
            origin = origins.S3BucketOrigin.withOriginAccessIdentity(siteBucket, {
                originAccessIdentity: oai,
                originPath: `/${props.projectName}`,
            });

            // Create CloudFront distribution
            this.distribution = new cloudfront.Distribution(this, "Distribution", {
                defaultBehavior: {
                    origin: origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                    compress: true,
                },
                domainNames: [props.domainName],
                defaultRootObject: "index.html",
                certificate: this.certificate,
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
                errorResponses: [
                    {
                        httpStatus: 403,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(30),
                    },
                    {
                        httpStatus: 404,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(30),
                    }
                ],
                comment: `CloudFront distribution for ${props.projectName}`,
            });

            // AUTOMATED BUCKET POLICY UPDATE using CDK Custom Resource
            const bucketPolicyDocument = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            AWS: `arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${oai.originAccessIdentityId}`
                        },
                        Action: "s3:GetObject",
                        Resource: `arn:aws:s3:::${props.s3Bucket}/${props.projectName}/*`
                    }
                ]
            };

            // Use AwsCustomResource to automatically update bucket policy
            new cr.AwsCustomResource(this, 'BucketPolicyUpdater', {
                onCreate: {
                    service: 'S3',
                    action: 'putBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket,
                        Policy: JSON.stringify(bucketPolicyDocument)
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(`${props.projectName}-bucket-policy-${Date.now()}`)
                },
                onUpdate: {
                    service: 'S3',
                    action: 'putBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket,
                        Policy: JSON.stringify(bucketPolicyDocument)
                    },
                    physicalResourceId: cr.PhysicalResourceId.of(`${props.projectName}-bucket-policy-${Date.now()}`)
                },
                onDelete: {
                    service: 'S3',
                    action: 'deleteBucketPolicy',
                    parameters: {
                        Bucket: props.s3Bucket
                    }
                },
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                    resources: [`arn:aws:s3:::${props.s3Bucket}`, `arn:aws:s3:::${props.s3Bucket}/*`]
                })
            });
        }

        // Create Route53 A record to point domain to CloudFront distribution
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(
                new targets.CloudFrontTarget(this.distribution)
            ),
        });

        // Output useful information
        new cdk.CfnOutput(this, `${props.projectName}BucketName`, {
            value: props.s3Bucket,
            exportName: `${props.projectName}-bucket-name`,
            description: `S3 bucket name for ${props.projectName}`,
        });

        new cdk.CfnOutput(this, `${props.projectName}DistributionId`, {
            value: this.distribution.distributionId,
            exportName: `${props.projectName}-distribution-id`,
            description: `CloudFront distribution ID for ${props.projectName}`,
        });

        new cdk.CfnOutput(this, `${props.projectName}DomainName`, {
            value: props.domainName,
            exportName: `${props.projectName}-domain-name`,
            description: `Domain name for ${props.projectName}`,
        });

        new cdk.CfnOutput(this, `${props.projectName}CloudFrontDomainName`, {
            value: this.distribution.distributionDomainName,
            exportName: `${props.projectName}-cloudfront-domain`,
            description: `CloudFront domain name for ${props.projectName}`,
        });

        // Output which method is being used
        new cdk.CfnOutput(this, `${props.projectName}AccessMethod`, {
            value: props.useOAC ? 'Origin Access Control (OAC) - Automated' : 'Origin Access Identity (OAI) - Automated',
            description: `Access method used for ${props.projectName} with automated bucket policy`,
        });
    }
}
