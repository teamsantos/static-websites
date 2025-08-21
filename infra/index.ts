import * as cdk from "aws-cdk-lib";
import { ProjectSite } from "./projectSite";

const app = new cdk.App();

// Configuration
const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1", // CloudFront requirement
};

// Get projects from context parameter
const projectsParam = app.node.tryGetContext("projects") as string | undefined;

if (!projectsParam) {
    console.log("❌ No projects provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\"");
    // Don't exit in CDK app - just don't create any stacks
} else {
    const projects = projectsParam.split(",").map((p) => p.trim()).filter(Boolean);
    
    if (projects.length === 0) {
        console.log("❌ No valid projects found after parsing.");
    } else {
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
            
            new ProjectSite(app, `Site-${project}`, {
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
