import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "aws-cdk-lib/custom-resources";


export class CreateProjectStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Lambda function with dynamic references
        const createProjectFunction = new lambda.Function(this, 'CreateProjectFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/create-project'),
            handler: 'index.handler',
            environment: {
                // CloudFormation will resolve these at deployment time and inject as env vars
                GITHUB_TOKEN: `{{resolve:secretsmanager:github-token:SecretString}}`,
                GITHUB_OWNER: `{{resolve:secretsmanager:github-config:SecretString:owner}}`,
                GITHUB_REPO: `{{resolve:secretsmanager:github-config:SecretString:repo}}`,
                FROM_EMAIL: 'noreply@e-info.click',
            },
            timeout: cdk.Duration.seconds(30),
        });

        // Still need to grant permissions even though we're using dynamic references
        const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');
        const githubConfigSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubConfig', 'github-config');

        githubTokenSecret.grantRead(createProjectFunction);
        githubConfigSecret.grantRead(createProjectFunction);

        // Grant SES permissions
        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail'],
            resources: ['*'],
        }));

        // API Gateway with CORS
        const api = new apigateway.RestApi(this, 'CreateProjectApi', {
            restApiName: 'create-project-api',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS, // Will be restricted in Lambda
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'Origin'],
            },
            deployOptions: {
                stageName: 'prod', // Default stage is prod
            },
        });

        // Create test stage
        const testDeployment = new apigateway.Deployment(this, 'TestDeployment', {
            api: api,
        });
        const testStage = new apigateway.Stage(this, 'TestStage', {
            deployment: testDeployment,
            stageName: 'test',
        });

        const createProjectResource = api.root.addResource('create-project');
        createProjectResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction), {
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
                    statusCode: '409',
                },
            ],
        });

        // Custom resource to list secrets for debugging
        new AwsCustomResource(this, 'ListSecrets', {
            onCreate: {
                service: 'SecretsManager',
                action: 'listSecrets',
                parameters: {},
                physicalResourceId: PhysicalResourceId.of('ListSecrets'),
            },
            policy: AwsCustomResourcePolicy.fromSdkCalls({
                resources: AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });

        // Output the API URLs
        new cdk.CfnOutput(this, 'ApiUrlProd', {
            value: api.url,
            description: 'Production API Gateway URL for creating projects (restricted to editor.e-info.click)',
        });

        new cdk.CfnOutput(this, 'ApiUrlTest', {
            value: `${api.url.replace('/prod/', '/test/')}`,
            description: 'Test API Gateway URL for creating projects (open to all origins)',
        });
    }
}
