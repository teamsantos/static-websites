import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";

interface CloudWatchLogsStackProps extends cdk.StackProps {
    bucketName: string;
}

export class CloudWatchLogsStack extends cdk.Stack {
    public readonly logsBucket: s3.IBucket;

    constructor(scope: cdk.App, id: string, props: CloudWatchLogsStackProps) {
        super(scope, id, props);

        // Create S3 bucket for CloudWatch logs with lifecycle policy
        const logsBucket = new s3.Bucket(this, "CloudWatchLogsBucket", {
            bucketName: props.bucketName,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: false,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    // Transition logs to Glacier after 30 days
                    id: "TransitionToGlacier",
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                    // Optionally, delete logs after 90 days (3 months)
                    expiration: cdk.Duration.days(90),
                    enabled: true,
                },
            ],
        });

        this.logsBucket = logsBucket;

        // Output the bucket name for reference
        new cdk.CfnOutput(this, "LogsBucketName", {
            value: logsBucket.bucketName,
            description: "Name of the S3 bucket for CloudWatch logs archival",
            exportName: `${this.stackName}-LogsBucketName`,
        });

        new cdk.CfnOutput(this, "LogsBucketArn", {
            value: logsBucket.bucketArn,
            description: "ARN of the S3 bucket for CloudWatch logs archival",
            exportName: `${this.stackName}-LogsBucketArn`,
        });
    }
}
