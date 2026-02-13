"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudWatchLogsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class CloudWatchLogsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.CloudWatchLogsStack = CloudWatchLogsStack;
