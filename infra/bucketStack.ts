import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as custom from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';

interface BucketStackProps extends cdk.StackProps {
    bucketName: string;
    distribution: cloudfront.Distribution;
    oac: cloudfront.S3OriginAccessControl;
}

export class BucketStack extends cdk.Stack {
    public readonly bucket: s3.IBucket;

    constructor(scope: cdk.App, id: string, props: BucketStackProps) {
        super(scope, id, props);

        // Check if the bucket already exists and reference it instead of creating
        let bucket: s3.IBucket;
        let bucketCreated = false;

        try {
            // Try to reference the existing bucket with proper attributes
            bucket = s3.Bucket.fromBucketAttributes(this, "ExistingStaticWebsitesBucket", {
                bucketName: props.bucketName,
                bucketArn: `arn:aws:s3:::${props.bucketName}`,
            });
            console.log(`Using existing S3 bucket: ${props.bucketName}`);
            bucketCreated = false;
        } catch (error) {
            // If the bucket doesn't exist, create it
            bucket = new s3.Bucket(this, "StaticWebsitesBucket", {
                bucketName: props.bucketName,
                blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
                encryption: s3.BucketEncryption.S3_MANAGED,
                versioned: false,
                removalPolicy: cdk.RemovalPolicy.RETAIN,
            });
            console.log(`Created new S3 bucket: ${props.bucketName}`);
            bucketCreated = true;
        }

        this.bucket = bucket;

        // For imported buckets with existing policies, we need to use a custom resource
        // to update the policy since CDK's BucketPolicy construct fails when policy exists
        if (!(bucket instanceof s3.Bucket)) {
            // This is an imported bucket - use custom resource to update policy
            const policyUpdateProvider = new custom.AwsCustomResource(this, "BucketPolicyUpdate", {
                onUpdate: {
                    service: "S3",
                    action: "putBucketPolicy",
                    parameters: {
                        Bucket: props.bucketName,
                        Policy: cdk.Fn.toJsonString({
                            Version: "2012-10-17",
                            Statement: [
                                {
                                    Sid: "AllowCloudFrontDistributionWithOAC",
                                    Effect: "Allow",
                                    Principal: {
                                        Service: "cloudfront.amazonaws.com",
                                    },
                                    Action: ["s3:GetObject", "s3:GetObjectVersion"],
                                    Resource: `${bucket.bucketArn}/*`,
                                    Condition: {
                                        StringEquals: {
                                            "AWS:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distribution.distributionId}`,
                                        },
                                    },
                                },
                            ],
                        }),
                    },
                    physicalResourceId: custom.PhysicalResourceId.of(`bucket-policy-${props.bucketName}`),
                },
                policy: custom.AwsCustomResourcePolicy.fromStatements([
                    new iam.PolicyStatement({
                        actions: ["s3:PutBucketPolicy"],
                        resources: [bucket.bucketArn],
                    }),
                ]),
                logRetention: logs.RetentionDays.ONE_DAY,
                installLatestAwsSdk: false,
            });
        } else {
            // For newly created buckets, use the standard BucketPolicy construct
            new s3.BucketPolicy(this, "CloudFrontDistributionPolicy", {
                bucket: bucket,
            }).document.addStatements(
                new iam.PolicyStatement({
                    sid: "AllowCloudFrontDistributionWithOAC",
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
                    actions: ["s3:GetObject", "s3:GetObjectVersion"],
                    resources: [`${bucket.bucketArn}/*`],
                    conditions: {
                        StringEquals: {
                            "AWS:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distribution.distributionId}`,
                        },
                    },
                })
            );
        }

        // Output the bucket name for reference
        new cdk.CfnOutput(this, "BucketName", {
            value: bucket.bucketName,
            description: "Name of the S3 bucket for static websites",
            exportName: `${this.stackName}-BucketName`,
        });

        new cdk.CfnOutput(this, "BucketArn", {
            value: bucket.bucketArn,
            description: "ARN of the S3 bucket for static websites",
            exportName: `${this.stackName}-BucketArn`,
        });
    }
}
