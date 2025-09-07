import * as cdk from "aws-cdk-lib";
import { BucketStack } from "./bucketStack";
import { ProjectSite } from "./ProjectStack";

const app = new cdk.App();

const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1",
};

const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');

if (!account) {
    console.warn("Warning: No AWS account specified. Use CDK_DEFAULT_ACCOUNT env var or --profile");
}

new BucketStack(app, "StaticWebsitesBucket", {
    bucketName: config.s3Bucket,
    env: {
        account: account,
        region: config.region,
    },
    tags: {
        ManagedBy: "CDK",
        Environment: "production",
        Purpose: "StaticWebsiteHosting",
    },
});

const projectsParam = app.node.tryGetContext("projects") as string | undefined;
const templatesParam = app.node.tryGetContext("templates") as string | undefined;

if (!projectsParam && !templatesParam) {
    console.error("No projects or templates provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\" --context templates=\"template1,template2\"");
    console.log("You can specify either projects, templates, or both.");
} else {
    let totalStacks = 0;

    // Handle projects
    if (projectsParam) {
        const projects = projectsParam.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);

        if (projects.length > 0) {
            console.log(`Deploying ${projects.length} project(s): ${projects.join(", ")}`);

            projects.forEach((project) => {
                if (!/^[a-z0-9-]+$/.test(project)) {
                    console.warn(`Warning: Project name '${project}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }

                console.log(`Creating stack for project: ${project}.${config.domain}`);

                new ProjectSite(app, `Site-${project}`, {
                    s3Bucket: config.s3Bucket,
                    region: config.region,
                    projectName: project,
                    domainName: `${project}.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    type: 'project',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: project,
                        Type: 'project',
                        Domain: `${project}.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });

            totalStacks += projects.length;
        }
    }

    // Handle templates
    if (templatesParam) {
        const templates = templatesParam.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

        if (templates.length > 0) {
            console.log(`Deploying ${templates.length} template(s): ${templates.join(", ")}`);

            templates.forEach((template) => {
                if (!/^[a-z0-9-]+$/.test(template)) {
                    console.warn(`Warning: Template name '${template}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
                }

                console.log(`Creating stack for template: ${template}.${config.domain}`);

                new ProjectSite(app, `Site-template-${template}`, {
                    s3Bucket: config.s3Bucket,
                    region: config.region,
                    projectName: template,
                    domainName: `${template}.${config.domain}`,
                    hostedZoneDomainName: config.domain,
                    type: 'template',
                    env: {
                        account: account,
                        region: config.certificateRegion,
                    },
                    tags: {
                        Project: template,
                        Type: 'template',
                        Domain: `${template}.${config.domain}`,
                        ManagedBy: "CDK",
                        Environment: "production",
                    },
                });
            });

            totalStacks += templates.length;
        }
    }

    if (totalStacks > 0) {
        console.log(`Created ${totalStacks} stack(s) successfully`);
    } else {
        console.error("No valid projects or templates found after parsing.");
    }
}

app.synth();
