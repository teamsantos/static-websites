import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from "aws-cdk-lib/aws-s3";

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
            // Try to reference the existing bucket
            bucket = s3.Bucket.fromBucketName(this, "ExistingStaticWebsitesBucket", props.bucketName);
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

        // Add bucket policy for the specific CloudFront distribution with OAC
        const oacPrincipal = new iam.PrincipalWithConditions(
            new iam.ServicePrincipal("cloudfront.amazonaws.com"),
            {
                StringEquals: {
                    "AWS:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${props.distribution.distributionId}`,
                },
            }
        );

        if (bucket instanceof s3.Bucket) {
            // For managed buckets, we can directly add the policy
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
        } else {
            // For imported buckets, add the policy statement to the bucket's resource policy
            bucket.addToResourcePolicy(
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
