import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

interface GenerateWebsiteProps extends cdk.StackProps {
    ses_region: string;
    s3Bucket?: string;
    apiGateway: apigateway.RestApi;
}

export class GenerateWebsiteStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: GenerateWebsiteProps) {
        super(scope, id, props);

        // Reference the secrets
        const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');
        const githubConfigSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubConfig', 'github-config');

        const generateWebsiteFunction = new lambda.Function(this, 'GenerateWebsiteFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/generate-website'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.ses_region || "us-east-1",
                S3_BUCKET_NAME: props?.s3Bucket || "teamsantos-static-websites"
            },
            timeout: cdk.Duration.seconds(60),
        });

        // Grant permissions to read the secrets
        githubTokenSecret.grantRead(generateWebsiteFunction);
        githubConfigSecret.grantRead(generateWebsiteFunction);

        // Explicitly add Secrets Manager permissions
        generateWebsiteFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            resources: [`${githubTokenSecret.secretArn}-*`, `${githubConfigSecret.secretArn}-*`],
        }));

        generateWebsiteFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail'],
            resources: ['*'],
        }));

        generateWebsiteFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject', 's3:PutObject'],
            resources: [`arn:aws:s3:::${props?.s3Bucket || "teamsantos-static-websites"}/*`],
        }));

        // Add the generate-website resource to the existing API Gateway
        const generateWebsiteResource = props.apiGateway.root.addResource('generate-website');
        generateWebsiteResource.addMethod('POST', new apigateway.LambdaIntegration(generateWebsiteFunction, {
            integrationResponses: [
                {
                    statusCode: '200',
                },
                {
                    statusCode: '400',
                },
                {
                    statusCode: '403',
                },
                {
                    statusCode: '500',
                },
            ],
        }), {
            methodResponses: [
                {
                    statusCode: '200',
                },
                {
                    statusCode: '400',
                },
                {
                    statusCode: '403',
                },
                {
                    statusCode: '500',
                },
            ],
        });

        new cdk.CfnOutput(this, 'GenerateWebsiteApiUrl', {
            value: `${props.apiGateway.url}generate-website`,
            description: 'API Gateway URL for generating websites',
        });
    }
}
