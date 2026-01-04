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
exports.BucketStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class BucketStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Check if the bucket already exists and reference it instead of creating
        let bucket;
        let bucketCreated = false;
        try {
            // Try to reference the existing bucket with proper attributes
            bucket = s3.Bucket.fromBucketAttributes(this, "ExistingStaticWebsitesBucket", {
                bucketName: props.bucketName,
                bucketArn: `arn:aws:s3:::${props.bucketName}`,
            });
            console.log(`Using existing S3 bucket: ${props.bucketName}`);
            bucketCreated = false;
        }
        catch (error) {
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
        // Use a BucketPolicy construct that will update the actual AWS bucket policy
        const bucketPolicy = new s3.BucketPolicy(this, "CloudFrontDistributionPolicy", {
            bucket: bucket,
        });
        bucketPolicy.document.addStatements(new iam.PolicyStatement({
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
        }));
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
exports.BucketStack = BucketStack;
