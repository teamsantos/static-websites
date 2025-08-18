import * as cdk from "aws-cdk-lib";
import { ProjectSite } from "./projectSite";

const app = new cdk.App();
const region = "eu-south-2";
const domain = "e-info.link";
const s3Bucket = "teamsantos-static-websites"

const projectsParam = app.node.tryGetContext("projects") as string | undefined;

if (!projectsParam) {
    throw new Error(
        'No projects provided. Run with: cdk deploy -c projects="proj1,proj2"'
    );
}

const projects = projectsParam.split(",").map((p) => p.trim());

projects.forEach((project) => {
    // Create each ProjectSite as a separate Stack
    new ProjectSite(app, `Site-${project}`, {
        s3Bucket: s3Bucket,
        region: region,
        projectName: project,
        domainName: `${project}.${domain}`,
        hostedZoneDomainName: domain, // Pass domain name instead of hosted zone
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: "us-east-1", // CloudFront certs requirement (us-east-1)
        },
    });
});

app.synth();
