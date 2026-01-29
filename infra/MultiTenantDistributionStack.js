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
exports.MultiTenantDistributionStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const CertificateManager_1 = require("./CertificateManager");
class MultiTenantDistributionStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });
        // Use CertificateManager to get or create certificate that covers both wildcard and root domain
        const certManager = new CertificateManager_1.CertificateManager(this, "CertManager", {
            domainName: props.domainName,
            hostedZone: hostedZone,
        });
        const certificate = certManager.certificate;
        // Import S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(this, "StaticWebsitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region,
        });
        // Create Origin Access Control for S3
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: "OAC for multi-tenant static websites",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });
        this.oac = oac;
        // Create CloudFront Function to rewrite paths based on hostname
        // Supports subdomain-based routing (generating.e-info.click/)
        // All projects are stored under /projects prefix in S3
        // Shared files (e.g., /shared/contact-form.js) are served from common location
        const pathRewriteFunction = new cloudfront.Function(this, "PathRewriteFunction", {
            code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    var request = event.request;
    var hostHeader = request.headers['host'];
    
    // Check if host header exists and has a value
    if (!hostHeader || !hostHeader.value) {
        return request;
    }
    
    var host = hostHeader.value;
    
    // Extract project name from subdomain
    var projectName = host.split('.')[0];
    
    // Normalize URI - remove duplicate slashes
    var uri = request.uri.replace(/\\/+/g, '/');
    
    // Shared files are served from common /shared/ folder in S3
    // e.g., /shared/contact-form.js -> /shared/contact-form.js (no project prefix)
    if (uri.indexOf('/shared/') === 0) {
        request.uri = uri;
        return request;
    }
    
    // Rewrite URI based on the path
    if (uri === '/' || uri === '') {
        // Root path -> /projects/projectName/index.html
        request.uri = '/projects/' + projectName + '/index.html';
    } else if (uri === '/success') {
        // /success path -> /projects/projectName/index.html (preserving query string)
        request.uri = '/projects/' + projectName + '/index.html';
    } else {
        // Other paths -> /projects/projectName + original path
        request.uri = '/projects/' + projectName + uri;
    }
    
    return request;
}`),
        });
        // Create S3 origin
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originAccessControl: oac,
        });
        // Create multi-tenant CloudFront distribution
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
            domainNames: [`*.${props.hostedZoneDomainName}`],
            certificate: certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: [],
            comment: "Multi-tenant CloudFront distribution for static websites",
        });
        this.distributionId = this.distribution.distributionId;
        this.distributionDomainName = this.distribution.distributionDomainName;
        this.certificate = certificate;
        // Create wildcard Route53 record to route all subdomains to CloudFront
        new route53.ARecord(this, "WildcardAliasRecord", {
            zone: hostedZone,
            recordName: `*.${props.hostedZoneDomainName}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
        });
        // Add SES CNAME records for domain verification
        new route53.CnameRecord(this, "SESVerificationRecord1", {
            zone: hostedZone,
            recordName: "tlo4lw6ugpyyyctfmc4owy7tsij3scqo._domainkey.e-info.click",
            domainName: "tlo4lw6ugpyyyctfmc4owy7tsij3scqo.dkim.amazonses.com",
            ttl: cdk.Duration.hours(1),
        });
        new route53.CnameRecord(this, "SESVerificationRecord2", {
            zone: hostedZone,
            recordName: "ebjhxt3lbu6sfocsdbbea4je7ieohq66._domainkey.e-info.click",
            domainName: "ebjhxt3lbu6sfocsdbbea4je7ieohq66.dkim.amazonses.com",
            ttl: cdk.Duration.hours(1),
        });
        new route53.CnameRecord(this, "SESVerificationRecord3", {
            zone: hostedZone,
            recordName: "u5r7ztbhdyru4xgdz7icdi2yoprp6wkx._domainkey.e-info.click",
            domainName: "u5r7ztbhdyru4xgdz7icdi2yoprp6wkx.dkim.amazonses.com",
            ttl: cdk.Duration.hours(1),
        });
        new cdk.CfnOutput(this, "DistributionId", {
            value: this.distributionId,
            description: "CloudFront distribution ID",
            exportName: "MultiTenantDistributionId",
        });
        new cdk.CfnOutput(this, "DistributionDomainName", {
            value: this.distributionDomainName,
            description: "CloudFront distribution domain name",
            exportName: "MultiTenantDistributionDomainName",
        });
        new cdk.CfnOutput(this, "CertificateArn", {
            value: certificate.certificateArn,
            description: "ACM Certificate ARN",
            exportName: "WildcardCertificateArn",
        });
    }
}
exports.MultiTenantDistributionStack = MultiTenantDistributionStack;
