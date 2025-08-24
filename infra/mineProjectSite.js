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
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const existsRecord = (_this, hostedZone, recordName, recordType = 'A') => {
    return new cr.AwsCustomResource(_this, 'RecordExistsCheck', {
        onUpdate: {
            service: 'Route53',
            action: 'listResourceRecordSets',
            parameters: {
                HostedZoneId: hostedZone.hostedZoneId,
                StartRecordName: recordName.endsWith('.') ? recordName : `${recordName}.`,
                StartRecordType: recordType,
                MaxItems: '1'
            },
            physicalResourceId: cr.PhysicalResourceId.of(`RecordCheck-${recordName}-${recordType}`)
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [hostedZone.hostedZoneArn]
        })
    });
};
class ProjectSite extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName
        });
        if (existsRecord(this, hostedZone, props.domainName)) {
            console.log(`HostedZone record already exists(${props.domainName})`);
            return;
        }
        const certificate = new acm.Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: acm.CertificateValidation.fromDns(hostedZone),
        });
        const siteBucket = s3.Bucket.fromBucketAttributes(this, "StaticWebSitesBucket", {
            bucketName: props.s3Bucket,
            region: props.region
        });
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            description: `OAC for ${props.projectName}`,
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });
        const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
            originPath: `/${props.projectName}`,
            originAccessControl: oac,
        });
        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                compress: true,
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
            comment: `CloudFront distribution for ${props.projectName}`,
        });
        const uniqueSid = `AllowCloudFrontServicePrincipal-${props.projectName}-${distribution.distributionId.substring(0, 8)}`;
        siteBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: uniqueSid,
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
            actions: ["s3:GetObject"],
            resources: [`${siteBucket.bucketArn}/${props.projectName}/*`],
            conditions: {
                StringEquals: {
                    "AWS:SourceArn": `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${distribution.distributionId}`
                }
            }
        }));
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: props.domainName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
    }
}
exports.ProjectSite = ProjectSite;
