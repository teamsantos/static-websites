import * as cdk from "aws-cdk-lib";
import { ProjectSite } from "./projectSite";

const app = new cdk.App();
const region = "eu-south-2";
const domain = "e-info.click";
const s3Bucket = "teamsantos-static-websites";

const projectsParam = app.node.tryGetContext("projects") as string | undefined;

if (!projectsParam) {
    console.log("No projects provided.");
} else {
    console.log(`Deploying projects: ${projectsParam}`);
    const projects = projectsParam.split(",").map((p) => p.trim());
    projects.forEach((project) => {
        new ProjectSite(app, `Site-${project}`, {
            s3Bucket: s3Bucket,
            region: region,
            projectName: project,
            domainName: `${project}.${domain}`,
            hostedZoneDomainName: domain,
            env: {
                account: process.env.CDK_DEFAULT_ACCOUNT,
                region: "us-east-1",
            },
        });
    });
}

app.synth();
