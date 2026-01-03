import * as cdk from "aws-cdk-lib";
import { MultiTenantDistributionStack } from "./MultiTenantDistributionStack";

interface ProjectSiteProps extends cdk.StackProps {
    projectName: string;
    domainName: string;
    hostedZoneDomainName: string;
    multiTenantDistribution: MultiTenantDistributionStack;
    type?: 'project' | 'template';
}

export class ProjectSite extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: ProjectSiteProps) {
        super(scope, id, props);

        // Note: No need to create individual Route53 records anymore!
        // The wildcard record in MultiTenantDistributionStack (*.e-info.click)
        // automatically routes all subdomains to CloudFront.

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
