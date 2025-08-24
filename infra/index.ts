import * as cdk from "aws-cdk-lib";
import { ProjectSite } from "./mineProjectSite";

const app = new cdk.App();

const config = {
    region: "eu-south-2",
    domain: "e-info.click",
    s3Bucket: "teamsantos-static-websites",
    certificateRegion: "us-east-1",
};

const projectsParam = app.node.tryGetContext("projects") as string | undefined;

if (!projectsParam) {
    console.error("No projects provided.");
    console.log("Usage: cdk deploy --context projects=\"project1,project2\"");
} else {
    const projects = projectsParam.split(",").map((p) => p.trim()).filter(Boolean);

    if (projects.length === 0) {
        console.error("No valid projects found after parsing.");
    } else {
        console.log(`Deploying ${projects.length} project(s): ${projects.join(", ")}`);

        const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
        const region = config.certificateRegion;

        if (!account) {
            console.warn("Warning: No AWS account specified. Use CDK_DEFAULT_ACCOUNT env var or --profile");
        }

        projects.forEach((project) => {
            if (!/^[a-z0-9-]+$/.test(project)) {
                console.warn(`Warning: Project name '${project}' may not be DNS-safe. Use lowercase letters, numbers, and hyphens only.`);
            }

            console.log(`Creating stack for: ${project}.${config.domain}`);

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
                tags: {
                    Project: project,
                    Domain: `${project}.${config.domain}`,
                    ManagedBy: "CDK",
                    Environment: "production",
                },
            });
        });

        console.log(`Created ${projects.length} stack(s) successfully`);
    }
}

app.synth();
