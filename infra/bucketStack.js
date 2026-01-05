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
const custom = __importStar(require("aws-cdk-lib/custom-resources"));
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
            bucketCreated = true;
        }
        this.bucket = bucket;
        // For imported buckets with existing policies, we need to use a custom resource
        // to update the policy since CDK's BucketPolicy construct fails when policy exists
        if (!(bucket instanceof s3.Bucket)) {
            // This is an imported bucket - use custom resource to update policy
            // The policy allows CloudFront to access objects when using OAC
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
            // For newly created buckets, use the standard BucketPolicy construct
            new s3.BucketPolicy(this, "CloudFrontDistributionPolicy", {
                bucket: bucket,
            }).document.addStatements(new iam.PolicyStatement({
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
            }));
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
exports.BucketStack = BucketStack;
