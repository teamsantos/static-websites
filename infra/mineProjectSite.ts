import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cr from "aws-cdk-lib/custom-resources";

interface MineProjectSiteProps extends cdk.StackProps {
    projectName: string;
    domainName: string;
    hostedZoneDomainName: string;
    s3Bucket: string;
    region: string;
}

const existsRecord = (_this: cdk.Stack, hostedZone: route53.IHostedZone, recordName: string, recordType: string = 'A') => {
    return new cr.AwsCustomResource(_this, 'RecordExistsCheck', {
        onUpdate: {
            service: 'Route53',
            action: 'listResourceRecordSets',
            parameters: {
                HostedZoneId: hostedZone.hostedZoneId,
                StartRecordName: recordName.endsWith('.') ? recordName : `${recordName}.`,
                StartRecordType: recordType,
                MaxItems: '1'
            },
            physicalResourceId: cr.PhysicalResourceId.of(`RecordCheck-${recordName}-${recordType}`)
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [hostedZone.hostedZoneArn]
        })
    });
};

export class ProjectSite extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: MineProjectSiteProps) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName
        });
        if (existsRecord(this, hostedZone, props.domainName)) {
            console.log(`HostedZone record already exists(${props.domainName})`);
            return;
        }
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
