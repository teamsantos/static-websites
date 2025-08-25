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

        // Create the S3 bucket for static websites
        this.bucket = new s3.Bucket(this, "StaticWebsitesBucket", {
            bucketName: props.bucketName,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: false,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        // Add bucket policy that allows any CloudFront distribution in this account to get objects
        new s3.BucketPolicy(this, "CloudFrontAccessPolicy", {
            bucket: this.bucket,
        }).document.addStatements(
            new iam.PolicyStatement({
                sid: "AllowCloudFrontServicePrincipalForAccount",
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
                actions: ["s3:GetObject"],
                resources: [`${this.bucket.bucketArn}/*`],
                conditions: {
                    StringEquals: {
                        "AWS:SourceAccount": cdk.Stack.of(this).account,
                    },
                },
            })
        );

        // Output the bucket name for reference
        new cdk.CfnOutput(this, "BucketName", {
            value: this.bucket.bucketName,
            description: "Name of the S3 bucket for static websites",
            exportName: `${this.stackName}-BucketName`,
        });

        new cdk.CfnOutput(this, "BucketArn", {
            value: this.bucket.bucketArn,
            description: "ARN of the S3 bucket for static websites",
            exportName: `${this.stackName}-BucketArn`,
        });
    }
}
