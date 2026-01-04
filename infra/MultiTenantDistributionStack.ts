import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import { CertificateManager } from "./CertificateManager";

interface MultiTenantDistributionStackProps extends cdk.StackProps {
    domainName: string;
    hostedZoneDomainName: string;
    s3Bucket: string;
    region: string;
}

export class MultiTenantDistributionStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;
    public readonly distributionId: string;
    public readonly distributionDomainName: string;
    public readonly certificate: acm.ICertificate;
    public readonly oac: cloudfront.S3OriginAccessControl;

    constructor(scope: cdk.App, id: string, props: MultiTenantDistributionStackProps) {
        super(scope, id, props);

        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });

        // Use CertificateManager to get or create certificate that covers both wildcard and root domain
        const certManager = new CertificateManager(this, "CertManager", {
            domainName: props.domainName,
            hostedZone: hostedZone,
        });

        const certificate = certManager.certificate;

        // Import S3 bucket
        const siteBucket = s3.Bucket.fromBucketAttributes(
            this,
            "StaticWebsitesBucket",
            {
                bucketName: props.s3Bucket,
                region: props.region,
            }
        );

        // Create Origin Access Control for S3
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: "OAC for multi-tenant static websites",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });

        this.oac = oac;

        // Create CloudFront Function to rewrite paths based on hostname
        // Supports subdomain-based routing (generating.e-info.click/)
        const pathRewriteFunction = new cloudfront.Function(
            this,
            "PathRewriteFunction",
            {
                code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const request = event.request;
    const host = request.headers.host.value;
    
    // Extract project name from subdomain (e.g., "generating" from "generating.e-info.click")
    const projectName = host.split('.')[0];
    
    // Rewrite the URI to include the project name prefix
    // <projectName>.e-info.click/ → /<projectName>/index.html
    // <projectName>.e-info.click/page → /<projectName>/page
    if (request.uri === '/' || request.uri === '') {
        request.uri = '/' + projectName + '/index.html';
    } else {
        request.uri = '/' + projectName + request.uri;
    }
    
    return request;
}
`),
            }
        );

        // Create CloudFront Function to handle error responses
        // Redirects 4xx/5xx errors to the project's index.html for SPA routing
        const errorHandlerFunction = new cloudfront.Function(
            this,
            "ErrorHandlerFunction",
            {
                code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const response = event.response;
    const request = event.request;
    
    // Only handle error responses
    if (response.status >= 400) {
        const host = request.headers.host.value;
        // Extract project name from subdomain
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
            }
        );

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
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(
                    this,
                    "CorsPolicy",
                    {
                        corsBehavior: {
                            accessControlAllowCredentials: false,
                            accessControlAllowHeaders: ["*"],
                            accessControlAllowMethods: ["GET", "HEAD"],
                            accessControlAllowOrigins: ["https://editor.e-info.click"],
                            accessControlExposeHeaders: [],
                            accessControlMaxAge: cdk.Duration.seconds(3600),
                            originOverride: true,
                        },
                    }
                ),
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
            target: route53.RecordTarget.fromAlias(
                new route53Targets.CloudFrontTarget(this.distribution)
            ),
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
