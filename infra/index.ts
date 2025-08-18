import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import { ProjectSite } from "./projectSite";

const app = new cdk.App();
const region = "eu-south-2";
const domain = "e-info.link";
const s3Bucket = "teamsantos-static-websites"

const hostedZone = route53.HostedZone.fromLookup(app, "HostedZone", {
    domainName: domain,
});

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
        hostedZone,
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: "us-east-1", // CloudFront certs requirement (us-east-1)
        },
        stackName: `Site-${project}`, // Explicitly set stack name
    });
});

app.synth();
