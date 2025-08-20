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
exports.ProjectSite = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class ProjectSite extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Look up the hosted zone within the Stack context
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });
        // Reference existing S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(this, "StaticWebsitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region,
        });
        // Create Origin Access Identity for secure S3 access
        const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
            comment: `OAI for ${props.projectName}`,
        });
        // Grant OAI read access to the bucket
        siteBucket.grantRead(oai);
        // Create SSL certificate for CloudFront (must be in us-east-1)
        this.certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
        // Add bucket policy to allow OAI access (with error handling for existing buckets)
        try {
            siteBucket.addToResourcePolicy(new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                resources: [siteBucket.arnForObjects(`${props.projectName}/*`)],
                principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
            }));
        }
        catch (error) {
            console.warn(`Could not modify bucket policy - ensure OAI has access to ${props.s3Bucket}/${props.projectName}/*: ${error}`);
        }
        // Create CloudFront distribution
        this.distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: new origins.S3Origin(siteBucket, {
                    originAccessIdentity: oai,
                    originPath: `/${props.projectName}`,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
            },
            domainNames: [props.domainName],
            defaultRootObject: "index.html",
            certificate: this.certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
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
            comment: `CloudFront distribution for ${props.projectName}`,
        });
        // Create Route53 A record to point domain to CloudFront distribution
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
        });
        // Output useful information
        new cdk.CfnOutput(this, `${props.projectName}BucketName`, {
            value: props.s3Bucket,
            exportName: `${props.projectName}-bucket-name`,
            description: `S3 bucket name for ${props.projectName}`,
        });
        new cdk.CfnOutput(this, `${props.projectName}DistributionId`, {
            value: this.distribution.distributionId,
            exportName: `${props.projectName}-distribution-id`,
            description: `CloudFront distribution ID for ${props.projectName}`,
        });
        new cdk.CfnOutput(this, `${props.projectName}DomainName`, {
            value: props.domainName,
            exportName: `${props.projectName}-domain-name`,
            description: `Domain name for ${props.projectName}`,
        });
        new cdk.CfnOutput(this, `${props.projectName}CloudFrontDomainName`, {
            value: this.distribution.distributionDomainName,
            exportName: `${props.projectName}-cloudfront-domain`,
            description: `CloudFront domain name for ${props.projectName}`,
        });
    }
}
exports.ProjectSite = ProjectSite;
