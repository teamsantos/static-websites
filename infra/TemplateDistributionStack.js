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
exports.TemplateDistributionStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const CertificateManager_1 = require("./CertificateManager");
class TemplateDistributionStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });
        // Use CertificateManager to get or create certificate for *.template.e-info.click
        const certManager = new CertificateManager_1.CertificateManager(this, "CertManager", {
            domainName: props.domainName,
            hostedZone: hostedZone,
            subDomain: "template", // Creates certificate for *.template.e-info.click
        });
        const certificate = certManager.certificate;
        // Import S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(this, "StaticWebsitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region,
        });
        // Create Origin Access Control for S3
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: "OAC for multi-tenant template websites",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });
        this.oac = oac;
        // Create CloudFront Function to rewrite paths based on hostname
        // Supports subdomain-based routing (<templateId>.template.e-info.click)
        // All templates are stored under /templates prefix in S3
        const pathRewriteFunction = new cloudfront.Function(this, "TemplatePathRewriteFunction", {
            code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    var request = event.request;
    var hostHeader = request.headers['host'];
    
    // Check if host header exists and has a value
    if (!hostHeader || !hostHeader.value) {
        return request;
    }
    
    var host = hostHeader.value;
    
    // Extract template ID from subdomain (e.g., "businesscard" from "businesscard.template.e-info.click")
    var templateId = host.split('.')[0];
    
    // Normalize URI - remove duplicate slashes
    var uri = request.uri.replace(/\\/+/g, '/');
    
    // Rewrite URI based on the path
    if (uri === '/' || uri === '') {
        // Root path -> /templates/templateId/index.html
        request.uri = '/templates/' + templateId + '/index.html';
    } else {
        // Other paths -> /templates/templateId + original path
        request.uri = '/templates/' + templateId + uri;
    }
    
    return request;
}`),
        });
        // Create S3 origin
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originAccessControl: oac,
        });
        // Create multi-tenant CloudFront distribution for templates
        this.distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
                functionAssociations: [
                    {
                        function: pathRewriteFunction,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, "CorsPolicy", {
                    corsBehavior: {
                        accessControlAllowCredentials: false,
                        accessControlAllowHeaders: ["*"],
                        accessControlAllowMethods: ["GET", "HEAD"],
                        accessControlAllowOrigins: ["https://editor.e-info.click"],
                        accessControlExposeHeaders: [],
                        accessControlMaxAge: cdk.Duration.seconds(3600),
                        originOverride: true,
                    },
                }),
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            domainNames: [`*.template.${props.hostedZoneDomainName}`],
            certificate: certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: [],
            comment: "Multi-tenant CloudFront distribution for template websites",
        });
        this.distributionId = this.distribution.distributionId;
        this.distributionDomainName = this.distribution.distributionDomainName;
        this.certificate = certificate;
        // Create wildcard Route53 record to route all template subdomains to CloudFront
        // e.g., *.template.e-info.click -> CloudFront
        new route53.ARecord(this, "TemplateWildcardAliasRecord", {
            zone: hostedZone,
            recordName: `*.template.${props.hostedZoneDomainName}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
        });
        // Output distribution details
        new cdk.CfnOutput(this, "DistributionId", {
            value: this.distributionId,
            description: "Template CloudFront distribution ID",
            exportName: "TemplateDistributionId",
        });
        new cdk.CfnOutput(this, "DistributionDomainName", {
            value: this.distributionDomainName,
            description: "Template CloudFront distribution domain name",
            exportName: "TemplateDistributionDomainName",
        });
        new cdk.CfnOutput(this, "CertificateArn", {
            value: certificate.certificateArn,
            description: "ACM Certificate ARN for templates",
            exportName: "TemplateCertificateArn",
        });
    }
}
exports.TemplateDistributionStack = TemplateDistributionStack;
