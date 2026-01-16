import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface ContactFormStackProps extends cdk.StackProps {
    sesRegion?: string;
}

export class ContactFormStack extends cdk.Stack {
    public contactFormFunction: lambda.Function;

    constructor(scope: cdk.App, id: string, props?: ContactFormStackProps) {
        super(scope, id, props);

        // Reference the secrets (same as used by create-project)
        const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');
        const githubConfigSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubConfig', 'github-config');

        // Create the Lambda function for handling contact form submissions
        this.contactFormFunction = new lambda.Function(this, 'ContactFormFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/contact-form'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.sesRegion || "us-east-1",
            },
            timeout: cdk.Duration.seconds(15),
            memorySize: 256,
            description: 'Handles contact form submissions from generated websites',
        });

        // Set CloudWatch log retention to 30 days
        new logs.LogRetention(this, 'ContactFormLogRetention', {
            logGroupName: this.contactFormFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.ONE_MONTH,
        });

        // Grant permissions to read the secrets
        githubTokenSecret.grantRead(this.contactFormFunction);
        githubConfigSecret.grantRead(this.contactFormFunction);

        // Explicitly add Secrets Manager permissions
        this.contactFormFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            resources: [`${githubTokenSecret.secretArn}-*`, `${githubConfigSecret.secretArn}-*`],
        }));

        // Grant SES permissions
        this.contactFormFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail'],
            resources: ['*'],
        }));

        // Output the function ARN for reference
        new cdk.CfnOutput(this, 'ContactFormFunctionArn', {
            value: this.contactFormFunction.functionArn,
            description: 'Contact Form Lambda Function ARN',
        });
    }
}
