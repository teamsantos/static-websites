import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";

interface ProjectSiteProps extends cdk.StackProps {
    projectName: string;
    domainName: string;
    hostedZone: route53.IHostedZone;
    s3Bucket: string;
    region: string;
}

export class ProjectSite extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: ProjectSiteProps) {
        super(scope, id, props);

        const siteBucket = s3.Bucket.fromBucketAttributes(
            this,
            "StaticWebsitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region,
        }
        );

        const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
            comment: `OAI for ${props.projectName}`,
        });

        siteBucket.grantRead(oai);

        const certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(props.hostedZone),
        });

        try {
            siteBucket.addToResourcePolicy(new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                resources: [siteBucket.arnForObjects(`${props.projectName}/*`)],
                principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
            }));
        } catch (error) {
            console.warn(`Could not add policy to existing bucket: ${error}`);
        }

        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: new origins.S3Origin(siteBucket, {
                    originAccessIdentity: oai,
                    originPath: `/${props.projectName}`,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            domainNames: [props.domainName],
            defaultRootObject: "index.html",
            certificate: certificate,
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
        });

        new route53.ARecord(this, "AliasRecord", {
            zone: props.hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(
                new targets.CloudFrontTarget(distribution)
            ),
        });

        new cdk.CfnOutput(this, `${props.projectName}BucketName`, {
            value: props.s3Bucket,
            exportName: `${props.projectName}-bucket`,
        });

        new cdk.CfnOutput(this, `${props.projectName}DistributionId`, {
            value: distribution.distributionId,
            exportName: `${props.projectName}-distribution`,
        });
    }
}
