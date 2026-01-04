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
    var request = event.request;
    var hostHeader = request.headers['host'];
    
    // Check if host header exists and has a value
    if (!hostHeader || !hostHeader.value) {
        return request;
    }
    
    var host = hostHeader.value;
    
    // Extract project name from subdomain
    var projectName = host.split('.')[0];
    
    // Rewrite URI
    if (request.uri === '/' || request.uri === '') {
        request.uri = '/' + projectName + '/index.html';
    } else {
        request.uri = '/' + projectName + request.uri;
    }
    
    return request;
}`),
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
            certificate: certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: [],
            comment: "Multi-tenant CloudFront distribution for static websites",
            // Logging is configured manually via AWS CLI with proper bucket permissions
            // To enable logging:
            // 1. S3 bucket teamsantos-static-websites-cf-logs must exist in us-east-1
            // 2. Bucket must have ACL: log-delivery-write
            // 3. Bucket policy must grant cloudfront.amazonaws.com s3:GetBucketAcl and s3:PutBucketAcl
            // Once manually configured, uncomment below and redeploy
            // enableLogging: true,
            // logBucket: logBucket,
            // logFilePrefix: "cloudfront-logs/",
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

        new cdk.CfnOutput(this, "FunctionLogsInstructions", {
            value: `CloudFront Function logs are available in CloudWatch. Look for log streams in /aws/cloudfront/function/PathRewriteFunction`,
            description: "Instructions for accessing CloudFront Function logs",
        });

        new cdk.CfnOutput(this, "CloudFrontLogsSetup", {
            value: "CloudFront access logs are configured to write to teamsantos-static-websites-cf-logs bucket in us-east-1. Logs appear in cloudfront-logs/ prefix.",
            description: "CloudFront logs configuration",
        });
    }
}
