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

        // Use CertificateManager to get or create wildcard certificate
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

        // Create CloudFront Function to rewrite paths based on hostname and path
        // Supports both subdomain-based routing (generating.e-info.click/) 
        // and path-based routing (e-info.click/generating/)
        const pathRewriteFunction = new cloudfront.Function(
            this,
            "PathRewriteFunction",
            {
                code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const request = event.request;
    const host = request.headers.host.value;
    const baseDomain = '${props.hostedZoneDomainName}';
    
    let projectName = '';
    
    // Determine project name from either subdomain or path
    if (host === baseDomain) {
        // Base domain: e-info.click/generating/ → extract from path
        const pathParts = request.uri.split('/').filter(p => p);
        if (pathParts.length > 0) {
            projectName = pathParts[0];
        } else {
            // Root access: e-info.click/ → use default project
            projectName = 'default';
        }
    } else {
        // Subdomain: generating.e-info.click/ → extract from subdomain
        projectName = host.split('.')[0];
    }
    
    // Rewrite the URI to include the project name prefix
    // Handle trailing slashes and root access
    if (request.uri === '/' || request.uri === '') {
        request.uri = '/' + projectName + '/index.html';
    } else if (host === baseDomain) {
        // For path-based routing, remove the project name from path if it's there
        // e-info.click/generating/page.html → /generating/page.html
        // Keep as-is since it's already in the correct format
        if (!request.uri.startsWith('/' + projectName + '/')) {
            request.uri = '/' + projectName + request.uri;
        }
    } else {
        // For subdomain-based routing, just add project prefix
        request.uri = '/' + projectName + request.uri;
    }
    
    return request;
}
`),
            }
        );

        // Create CloudFront Function to handle error responses with project path rewriting
        // Works with both subdomain and path-based routing
        const errorHandlerFunction = new cloudfront.Function(
            this,
            "ErrorHandlerFunction",
            {
                code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    const response = event.response;
    const request = event.request;
    const baseDomain = '${props.hostedZoneDomainName}';
    const host = request.headers.host.value;
    
    // Only handle error responses
    if (response.status >= 400) {
        let projectName = '';
        
        // Determine project name from either subdomain or path
        if (host === baseDomain) {
            // Base domain: extract from path
            const pathParts = request.uri.split('/').filter(p => p);
            if (pathParts.length > 0) {
                projectName = pathParts[0];
            } else {
                projectName = 'default';
            }
        } else {
            // Subdomain: extract from subdomain
            projectName = host.split('.')[0];
        }
        
        // Redirect error responses to the project's index.html
        response.statusCode = 200;
        response.headers['content-type'] = {
            value: 'text/html; charset=UTF-8'
        };
        
        // Set the URI to serve the project's index.html
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
            domainNames: [props.hostedZoneDomainName, `*.${props.hostedZoneDomainName}`],
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

        // Create base domain Route53 record to route the base domain to CloudFront
        // This enables path-based routing (e.g., https://e-info.click/generating/)
        new route53.ARecord(this, "BaseDomainAliasRecord", {
            zone: hostedZone,
            recordName: props.hostedZoneDomainName,
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
