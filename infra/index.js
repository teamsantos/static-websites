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
const cdk = __importStar(require("aws-cdk-lib"));
const projectSite_1 = require("./projectSite");
const app = new cdk.App();
// Configuration
const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1", // CloudFront requirement
};
// Get projects from context parameter
const projectsParam = app.node.tryGetContext("projects");
if (!projectsParam) {
    console.log("❌ No projects provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\"");
    // Don't exit in CDK app - just don't create any stacks
}
else {
    const projects = projectsParam.split(",").map((p) => p.trim()).filter(Boolean);
    if (projects.length === 0) {
        console.log("❌ No valid projects found after parsing.");
    }
    else {
        console.log(`🚀 Deploying ${projects.length} project(s): ${projects.join(", ")}`);
        // Get AWS account and region from environment or CDK context
        const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
        const region = config.certificateRegion; // Always use us-east-1 for CloudFront certificates
        if (!account) {
            console.log("⚠️ Warning: No AWS account specified. Use CDK_DEFAULT_ACCOUNT env var or --profile");
        }
        // Create a stack for each project
        projects.forEach((project) => {
            // Validate project name (DNS-safe)
            if (!/^[a-z0-9-]+$/.test(project)) {
                console.warn(`⚠️ Warning: Project name '${project}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
            }
            console.log(`📦 Creating stack for: ${project}.${config.domain}`);
            new projectSite_1.ProjectSite(app, `Site-${project}`, {
                s3Bucket: config.s3Bucket,
                region: config.region,
                projectName: project,
                domainName: `${project}.${config.domain}`,
                hostedZoneDomainName: config.domain,
                env: {
                    account: account,
                    region: region,
                },
                // Add stack-specific tags
                tags: {
                    Project: project,
                    Domain: `${project}.${config.domain}`,
                    ManagedBy: "CDK",
                    Environment: "production",
                },
                useOAC: true
            });
        });
        console.log(`✅ Created ${projects.length} stack(s) successfully`);
    }
}
app.synth();
