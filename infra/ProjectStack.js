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
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
class ProjectSite extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName
        });
        const certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
        const siteBucket = s3.Bucket.fromBucketAttributes(this, "StaticWebSitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region
        });
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: `OAC for ${props.type || 'project'} ${props.projectName}`,
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });
        const originPath = props.type === 'template' ? `/templates/${props.projectName}` : `/${props.projectName}`;
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originPath: originPath,
            originAccessControl: oac,
        });
        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'CorsPolicy', {
                    corsBehavior: {
                        accessControlAllowCredentials: false,
                        accessControlAllowHeaders: ['*'],
                        accessControlAllowMethods: ['GET', 'HEAD'],
                        accessControlAllowOrigins: ['https://editor.e-info.click'],
                        accessControlExposeHeaders: [],
                        accessControlMaxAge: cdk.Duration.seconds(3600), // 1 hour cache
                        originOverride: true,
                    },
                }),
            },
            domainNames: [props.domainName],
            defaultRootObject: "index.html",
            certificate: certificate,
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
            comment: `CloudFront distribution for ${props.type || 'project'} ${props.projectName}`,
        });
        // No need for individual bucket policies since the bucket stack handles access for all distributions
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
        // Output the distribution details
        new cdk.CfnOutput(this, "DistributionId", {
            value: distribution.distributionId,
            description: `CloudFront distribution ID for ${props.type || 'project'} ${props.projectName}`,
        });
        new cdk.CfnOutput(this, "DistributionDomainName", {
            value: distribution.distributionDomainName,
            description: `CloudFront distribution domain name for ${props.type || 'project'} ${props.projectName}`,
        });
        new cdk.CfnOutput(this, "WebsiteURL", {
            value: `https://${props.domainName}`,
            description: `Website URL for ${props.type || 'project'} ${props.projectName}`,
        });
    }
}
exports.ProjectSite = ProjectSite;
