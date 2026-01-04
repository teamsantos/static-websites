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
        // Use CertificateManager to get or create wildcard certificate
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
        const pathRewriteFunction = new cloudfront.Function(this, "PathRewriteFunction", {
            code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const request = event.request;
    const host = request.headers.host.value;
    
    // Extract project name from subdomain (e.g., "generating" from "generating.e-info.click")
    const projectName = host.split('.')[0];
    
    // Rewrite the URI to include the project name prefix
    // <projectName>.e-info.click/ → /<projectName>/index.html
    // <projectName>.e-info.click/success?id=123 → /<projectName>/success?id=123
    if (request.uri === '/' || request.uri === '') {
        request.uri = '/' + projectName + '/index.html';
    } else {
        request.uri = '/' + projectName + request.uri;
    }
    
    return request;
}
`),
        });
        // Create CloudFront Function to handle error responses with project path rewriting
        const errorHandlerFunction = new cloudfront.Function(this, "ErrorHandlerFunction", {
            code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const response = event.response;
    const request = event.request;
    
    // Only handle error responses
    if (response.status >= 400) {
        const host = request.headers.host.value;
        const projectName = host.split('.')[0];
        
        // Redirect error responses to the project's index.html
        response.statusCode = 200;
        response.headers['content-type'] = {
            value: 'text/html; charset=UTF-8'
        };
        
        // Store the project name in a custom header for the origin to use
        response.headers['x-project-name'] = {
            value: projectName
        };
    }
    
    return response;
}
`),
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
                    {
                        function: errorHandlerFunction,
                        eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
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
            defaultRootObject: "index.html",
            certificate: certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(30),
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(30),
                },
            ],
            comment: "Multi-tenant CloudFront distribution for static websites",
            enableLogging: false,
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
        // Output distribution details
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
