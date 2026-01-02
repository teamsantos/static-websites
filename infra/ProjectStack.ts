import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
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

        const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.hostedZoneDomainName,
        });

        // Create Route53 CNAME record pointing to the shared multi-tenant distribution
        // This is now instantaneous (no CloudFront distribution creation needed!)
        new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            target: route53.RecordTarget.fromAlias(
                new (require("aws-cdk-lib/aws-route53-targets").CloudFrontTarget)(
                    props.multiTenantDistribution.distribution
                )
            ),
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
