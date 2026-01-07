import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface CreateProjectProps extends cdk.StackProps {
    ses_region: string;
    domain?: string;
    certificateRegion?: string;
    s3Bucket?: string;
    metadataTable?: dynamodb.Table;
}

export class CreateProjectStack extends cdk.Stack {
    public generateWebsiteFunction: lambda.Function;

    constructor(scope: cdk.App, id: string, props: CreateProjectProps) {
        super(scope, id, props);

        const domain = props?.domain || 'e-info.click';

        const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domain,
        });

        const certificate = new DnsValidatedCertificate(this, 'ApiCertificate', {
            domainName: `api.${domain}`,
            hostedZone: hostedZone,
            region: 'us-east-1',
        });

        // Reference the secrets
        const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubToken', 'github-token');
        const githubConfigSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubConfig', 'github-config');

        const createProjectFunction = new lambda.Function(this, 'CreateProjectFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/create-project'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                // GITHUB_TOKEN_SECRET_ARN: githubTokenSecret.secretArn,
                // GITHUB_CONFIG_SECRET_ARN: githubConfigSecret.secretArn,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.ses_region || "us-east-1",
                S3_BUCKET_NAME: props?.s3Bucket || "teamsantos-static-websites",
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata"
            },
            timeout: cdk.Duration.seconds(30),
            reservedConcurrentExecutions: 100, // Cost control: limit concurrent executions
        });

        // Set CloudWatch log retention to 30 days
        new logs.LogRetention(this, 'CreateProjectLogRetention', {
            logGroupName: createProjectFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.ONE_MONTH,
        });

        // Grant permissions to read the secrets
        githubTokenSecret.grantRead(createProjectFunction);
        githubConfigSecret.grantRead(createProjectFunction);

        // Explicitly add Secrets Manager permissions (in case grantRead doesn't work properly)
        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            resources: [`${githubTokenSecret.secretArn}-*`, `${githubConfigSecret.secretArn}-*`],
        }));

        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail'],
            resources: ['*'],
        }));

        createProjectFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['s3:PutObject', 's3:GetObject'],
            resources: [`arn:aws:s3:::${props?.s3Bucket || "teamsantos-static-websites"}/*`],
        }));

        const generateWebsiteFunction = new lambda.Function(this, 'GenerateWebsiteFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/generate-website'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.ses_region || "us-east-1",
                S3_BUCKET_NAME: props?.s3Bucket || "teamsantos-static-websites",
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata"
            },
            timeout: cdk.Duration.seconds(300), // 5 minutes - account for slow GitHub operations
            reservedConcurrentExecutions: 100, // Cost control: limit concurrent executions
        });

        // Export the function for use by QueueStack
        this.generateWebsiteFunction = generateWebsiteFunction;

        // Set CloudWatch log retention to 30 days
        new logs.LogRetention(this, 'GenerateWebsiteLogRetention', {
            logGroupName: generateWebsiteFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.ONE_MONTH,
        });

        // Grant permissions to generate-website Lambda
        githubTokenSecret.grantRead(generateWebsiteFunction);
        githubConfigSecret.grantRead(generateWebsiteFunction);

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

        // Grant DynamoDB permissions for lambdas
        if (props.metadataTable) {
            props.metadataTable.grantReadWriteData(createProjectFunction);
            props.metadataTable.grantReadWriteData(generateWebsiteFunction);
        }

        const api = new apigateway.RestApi(this, 'CreateProjectApi', {
            restApiName: 'create-project-api',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'Origin'],
            },
        });

        // Custom domain for API
        const apiDomain = new apigateway.DomainName(this, 'ApiDomain', {
            domainName: `api.${domain}`,
            certificate: certificate,
            endpointType: apigateway.EndpointType.EDGE,
        });

        // Map domain to API
        new apigateway.BasePathMapping(this, 'ApiMapping', {
            domainName: apiDomain,
            restApi: api,
        });

        // Route53 A record for API domain
        new route53.ARecord(this, 'ApiAliasRecord', {
            zone: hostedZone,
            recordName: `api.${domain}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
        });

        const createProjectResource = api.root.addResource('create-project');
        createProjectResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction, {
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
                    statusCode: '409',
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
                    statusCode: '409',
                },
                {
                    statusCode: '500',
                },
            ],
        });

        const generateWebsiteResource = api.root.addResource('generate-website');
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

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL for creating projects (restricted to allowed origins)',
        });
        new cdk.CfnOutput(this, 'ApiCustomUrl', {
            value: `https://api.${domain}/create-project`,
            description: 'Custom domain URL for creating projects',
        });
        new cdk.CfnOutput(this, 'GenerateWebsiteUrl', {
            value: `https://api.${domain}/generate-website`,
            description: 'Custom domain URL for generating websites from S3 metadata',
        });

    }
}
