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
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
class ProjectSite extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });
        // Create Route53 CNAME record pointing to the shared multi-tenant distribution
        // This is now instantaneous (no CloudFront distribution creation needed!)
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            target: route53.RecordTarget.fromAlias(new (require("aws-cdk-lib/aws-route53-targets").CloudFrontTarget)(props.multiTenantDistribution.distribution)),
            recordName: props.projectName,
        });
        // Output the website details
        new cdk.CfnOutput(this, "WebsiteURL", {
            value: `https://${props.domainName}`,
            description: `Website URL for ${props.type || 'project'} ${props.projectName}`,
            exportName: `${props.projectName}-WebsiteURL`,
        });
        new cdk.CfnOutput(this, "ProjectName", {
            value: props.projectName,
            description: `Project name`,
            exportName: `${props.projectName}-ProjectName`,
        });
        new cdk.CfnOutput(this, "S3Path", {
            value: `s3://teamsantos-static-websites/${props.projectName}/`,
            description: `S3 path for ${props.projectName}`,
            exportName: `${props.projectName}-S3Path`,
        });
    }
}
exports.ProjectSite = ProjectSite;
