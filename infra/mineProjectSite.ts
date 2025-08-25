import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";

interface MineProjectSiteProps extends cdk.StackProps {
    projectName: string;
    domainName: string;
    hostedZoneDomainName: string;
    s3Bucket: string;
    region: string;
}

export class ProjectSite extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: MineProjectSiteProps) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName
        });
        const certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
        const siteBucket = s3.Bucket.fromBucketAttributes(
            this,
            "StaticWebSitesBucket",
            {
                bucketName: props.s3Bucket,
                region: props.region
            }
        );
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: `OAC for ${props.projectName}`,
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originPath: `/${props.projectName}`,
            originAccessControl: oac,
        });

        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
            },
            domainNames: [props.domainName],
            defaultRootObject: "index.html",
            certificate: certificate,
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

        const uniqueSid = `AllowCloudFrontServicePrincipal-${props.projectName}-${distribution.distributionId.substring(0, 8)}`;

        siteBucket.addToResourcePolicy(
            new iam.PolicyStatement({
                sid: uniqueSid,
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
                actions: ["s3:GetObject"],
                resources: [`${siteBucket.bucketArn}/${props.projectName}/*`],
                conditions: {
                    StringEquals: {
                        "AWS:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${distribution.distributionId}`
                    }
                }
            })
        );

        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(
                new route53Targets.CloudFrontTarget(distribution)
            ),
        });
    }
}
