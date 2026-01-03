import * as cdk from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from "aws-cdk-lib/aws-s3";

interface BucketStackProps extends cdk.StackProps {
    bucketName: string;
}

export class BucketStack extends cdk.Stack {
    public readonly bucket: s3.Bucket;

    constructor(scope: cdk.App, id: string, props: BucketStackProps) {
        super(scope, id, props);

        // Check if the bucket already exists and reference it instead of creating
        let bucket: s3.IBucket;

        try {
            // Try to reference the existing bucket
            bucket = s3.Bucket.fromBucketName(this, "ExistingStaticWebsitesBucket", props.bucketName);
            console.log(`Using existing S3 bucket: ${props.bucketName}`);
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
        }

        this.bucket = bucket as s3.Bucket;

        // Add bucket policy that allows CloudFront OAC to access objects
        // This policy allows any CloudFront OAC principal in the same account to access the bucket
        if (bucket instanceof s3.Bucket) {
            new s3.BucketPolicy(this, "CloudFrontOACPolicy", {
                bucket: bucket,
            }).document.addStatements(
                new iam.PolicyStatement({
                    sid: "AllowCloudFrontOACAccess",
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
                    actions: ["s3:GetObject"],
                    resources: [`${bucket.bucketArn}/*`],
                    conditions: {
                        StringEquals: {
                            "AWS:SourceAccount": cdk.Stack.of(this).account,
                        },
                    },
                })
            );
        } else {
            // For imported buckets, create a bucket policy construct
            new s3.BucketPolicy(this, "CloudFrontOACPolicyImported", {
                bucket: bucket,
            }).document.addStatements(
                new iam.PolicyStatement({
                    sid: "AllowCloudFrontOACAccessImported",
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
                    actions: ["s3:GetObject"],
                    resources: [`${bucket.bucketArn}/*`],
                    conditions: {
                        StringEquals: {
                            "AWS:SourceAccount": cdk.Stack.of(this).account,
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
