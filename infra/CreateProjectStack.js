"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProjectStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const custom_resources_1 = require("aws-cdk-lib/custom-resources");
class CreateProjectStack extends cdk.Stack {
    constructor(scope, id, props) {
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
            logRetention: logs.RetentionDays.ONE_WEEK,
            tracing: lambda.Tracing.ACTIVE,
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
        // Grant CloudWatch Logs permissions
        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
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
        new custom_resources_1.AwsCustomResource(this, 'ListSecrets', {
            onCreate: {
                service: 'SecretsManager',
                action: 'listSecrets',
                parameters: {},
                physicalResourceId: custom_resources_1.PhysicalResourceId.of('ListSecrets'),
            },
            policy: custom_resources_1.AwsCustomResourcePolicy.fromSdkCalls({
                resources: custom_resources_1.AwsCustomResourcePolicy.ANY_RESOURCE,
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
exports.CreateProjectStack = CreateProjectStack;
