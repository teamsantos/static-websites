import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as custom from 'aws-cdk-lib/custom-resources';

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
            bucketCreated = true;
        }

        this.bucket = bucket;

        // Define the CloudFront bucket policy statement
        const cloudFrontPolicyStatement = new iam.PolicyStatement({
            sid: "AllowAllCloudFrontDistributionsInAccount",
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
            actions: ["s3:GetObject"],
            resources: [`${bucket.bucketArn}/*`],
            conditions: {
                StringEquals: {
                    "AWS:SourceAccount": "396913706953",
                },
                StringLike: {
                    "AWS:SourceArn": "arn:aws:cloudfront::396913706953:distribution/*",
                },
            },
        });

        // For newly created buckets, use the standard BucketPolicy construct
        if (bucket instanceof s3.Bucket) {
            new s3.BucketPolicy(this, "CloudFrontDistributionPolicy", {
                bucket: bucket,
            }).document.addStatements(cloudFrontPolicyStatement);
        } else {
            // For imported buckets with existing policies, use a custom resource
            // to update the policy since CDK's BucketPolicy construct fails when policy exists
            new custom.AwsCustomResource(this, "BucketPolicyUpdate", {
                onUpdate: {
                    service: "S3",
                    action: "putBucketPolicy",
                    parameters: {
                        Bucket: props.bucketName,
                        Policy: cdk.Fn.toJsonString({
                            Version: "2012-10-17",
                            Statement: [
                                {
                                    Sid: "AllowAllCloudFrontDistributionsInAccount",
                                    Effect: "Allow",
                                    Principal: {
                                        Service: "cloudfront.amazonaws.com",
                                    },
                                    Action: "s3:GetObject",
                                    Resource: `${bucket.bucketArn}/*`,
                                    Condition: {
                                        StringEquals: {
                                            "AWS:SourceAccount": "396913706953",
                                        },
                                        StringLike: {
                                            "AWS:SourceArn": "arn:aws:cloudfront::396913706953:distribution/*",
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
                installLatestAwsSdk: false,
            });
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
