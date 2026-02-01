import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "path";
// Import the compiled JS constant to avoid ts-node attempting to require the
// .ts file as CommonJS (which fails in ESM packages). Point to the .js file
// so runtime loads the JS module.
import { DEFAULT_SENDER_EMAIL } from "./constants";

interface CreateProjectProps extends cdk.StackProps {
    ses_region: string;
    domain?: string;
    certificateRegion?: string;
    s3Bucket?: string;
    metadataTable?: dynamodb.Table;
    idempotencyTable?: dynamodb.Table;
    confirmationCodesTable?: dynamodb.Table;
    sendEmailFunction?: lambda.Function;
    contactFormFunction?: lambda.Function;
    distributionId?: string;
}

export class CreateProjectStack extends cdk.Stack {
    public generateWebsiteFunction: lambda.Function;
    public generateWebsiteFunctionName: string;
    public contactFormFunctionName: string = "";
    public paymentSessionFunctionName: string = "";
    public stripeWebhookFunctionName: string = "";
    public githubWebhookFunctionName: string = "";
    public healthCheckFunctionName: string = "";
    public api: apigateway.RestApi;
    public getProjectsFunctionName: string = "";
    public deleteProjectFunctionName: string = "";
    public sendConfirmationCodeFunctionName: string = "";
    public validateConfirmationCodeFunctionName: string = "";

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
            functionName: 'create-project',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/create-project'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: DEFAULT_SENDER_EMAIL,
                AWS_SES_REGION: props?.ses_region || "us-east-1",
                S3_BUCKET_NAME: props?.s3Bucket || "teamsantos-static-websites",
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
                DYNAMODB_IDEMPOTENCY_TABLE: props.idempotencyTable?.tableName || "request-idempotency"
            },
            timeout: cdk.Duration.seconds(30),
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

        const hmacSecret = secretsmanager.Secret.fromSecretNameV2(this, 'HMACSecret', 'hmac-secret');

        const generateWebsiteFunction = new lambda.Function(this, 'GenerateWebsiteFunction', {
            functionName: 'generate-website',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/generate-website'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: DEFAULT_SENDER_EMAIL,
                AWS_SES_REGION: props?.ses_region || "us-east-1",
                S3_BUCKET_NAME: props?.s3Bucket || "teamsantos-static-websites",
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
                HMAC_SECRET_NAME: hmacSecret.secretName,
                CLOUDFORMATION_REGION: props?.certificateRegion || "us-east-1",
                DISTRIBUTION_ID: props.distributionId || ""
            },
            timeout: cdk.Duration.seconds(300), // 5 minutes - account for slow GitHub operations
        });

        // Export the function for use by QueueStack
        this.generateWebsiteFunction = generateWebsiteFunction;
        this.generateWebsiteFunctionName = generateWebsiteFunction.functionName;

        // Set CloudWatch log retention to 30 days
        new logs.LogRetention(this, 'GenerateWebsiteLogRetention', {
            logGroupName: generateWebsiteFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.ONE_MONTH,
        });

        // Grant permissions to generate-website Lambda
        hmacSecret.grantRead(generateWebsiteFunction);
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

        // Allow the function to describe the CloudFormation stack that exports the
        // CloudFront distribution ID. This is used by the runtime to look up the
        // distribution when creating invalidations.
        generateWebsiteFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['cloudformation:DescribeStacks'],
            resources: [`arn:aws:cloudformation:${props?.certificateRegion || 'us-east-1'}:${this.account}:stack/MultiTenantDistribution/*`],
        }));

        // Allow CloudFront invalidation operations for distributions in this account.
        // CloudFront ARNs include the account ID; restrict to the account where possible.
        generateWebsiteFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'cloudfront:CreateInvalidation',
                'cloudfront:GetDistribution',
                'cloudfront:GetDistributionConfig'
            ],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
        }));

        // Grant DynamoDB permissions for lambdas
        if (props.metadataTable) {
            props.metadataTable.grantReadWriteData(createProjectFunction);
            props.metadataTable.grantReadWriteData(generateWebsiteFunction);
        }

        // Grant idempotency table permissions
        if (props.idempotencyTable) {
            props.idempotencyTable.grantReadWriteData(createProjectFunction);
        }

        this.api = new apigateway.RestApi(this, 'CreateProjectApi', {
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
            restApi: this.api,
        });

        // Route53 A record for API domain
        new route53.ARecord(this, 'ApiAliasRecord', {
            zone: hostedZone,
            recordName: `api.${domain}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
        });

        const createProjectResource = this.api.root.addResource('create-project');
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

        const generateWebsiteResource = this.api.root.addResource('generate-website');
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

        // Contact Form Lambda - handles form submissions from generated websites
        let contactFormFunction = props.contactFormFunction;

        if (!contactFormFunction) {
            contactFormFunction = new lambda.Function(this, 'ContactFormFunction', {
                functionName: 'contact-form',
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset('lambda/contact-form'),
                handler: 'index.handler',
                environment: {
                    GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                    GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                    FROM_EMAIL: DEFAULT_SENDER_EMAIL,
                    AWS_SES_REGION: props?.ses_region || "us-east-1",
                },
                timeout: cdk.Duration.seconds(15),
                memorySize: 256,
                description: 'Handles contact form submissions from generated websites',
            });

            // Set CloudWatch log retention to 30 days
            new logs.LogRetention(this, 'ContactFormLogRetention', {
                logGroupName: contactFormFunction.logGroup.logGroupName,
                retention: logs.RetentionDays.ONE_MONTH,
            });

            // Grant permissions to read the secrets
            githubTokenSecret.grantRead(contactFormFunction);
            githubConfigSecret.grantRead(contactFormFunction);

            contactFormFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                resources: [`${githubTokenSecret.secretArn}-*`, `${githubConfigSecret.secretArn}-*`],
            }));

            contactFormFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: ['ses:SendEmail'],
                resources: ['*'],
            }));
        }

        this.contactFormFunctionName = contactFormFunction.functionName;

        // API Gateway endpoint for contact form
        const contactFormResource = this.api.root.addResource('contact');
        contactFormResource.addMethod('POST', new apigateway.LambdaIntegration(contactFormFunction, {
            integrationResponses: [
                { statusCode: '200' },
                { statusCode: '400' },
                { statusCode: '404' },
                { statusCode: '500' },
            ],
        }), {
                methodResponses: [
                    { statusCode: '200' },
                    { statusCode: '400' },
                    { statusCode: '404' },
                    { statusCode: '500' },
                ],
            });

        // ============================================================
        // Project Management Logic (Merged)
        // ============================================================

        if (props.metadataTable && props.confirmationCodesTable && props.sendEmailFunction) {

            // Define separate log groups for each function
            const getProjectsLogGroup = new logs.LogGroup(this, "GetProjectsLogGroup", {
                logGroupName: "/aws/lambda/get-projects",
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            const deleteProjectLogGroup = new logs.LogGroup(this, "DeleteProjectLogGroup", {
                logGroupName: "/aws/lambda/delete-project",
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            const sendCodeLogGroup = new logs.LogGroup(this, "SendCodeLogGroup", {
                logGroupName: "/aws/lambda/send-confirmation-code",
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            const validateCodeLogGroup = new logs.LogGroup(this, "ValidateCodeLogGroup", {
                logGroupName: "/aws/lambda/validate-confirmation-code",
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            const getProjectsFunction = new lambda.Function(this, "GetProjectsFunction", {
                functionName: 'get-projects',
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/get-projects")),
                timeout: cdk.Duration.seconds(10),
                memorySize: 256,
                environment: {
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup: getProjectsLogGroup,
            });
            this.getProjectsFunctionName = getProjectsFunction.functionName;
            props.metadataTable.grantReadData(getProjectsFunction);

            const deleteProjectFunction = new lambda.Function(this, "DeleteProjectFunction", {
                functionName: 'delete-project',
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/delete-project")),
                timeout: cdk.Duration.seconds(10),
                memorySize: 256,
                environment: {
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup: deleteProjectLogGroup,
            });
            this.deleteProjectFunctionName = deleteProjectFunction.functionName;
            props.metadataTable.grantReadWriteData(deleteProjectFunction);

            const sendConfirmationCodeFunction = new lambda.Function(this, "SendConfirmationCodeFunction", {
                functionName: 'send-confirmation-code',
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/send-confirmation-code")),
                timeout: cdk.Duration.seconds(10),
                memorySize: 256,
                environment: {
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    DYNAMODB_CODES_TABLE: props.confirmationCodesTable.tableName,
                    SEND_EMAIL_FUNCTION: props.sendEmailFunction.functionName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup: sendCodeLogGroup,
            });
            this.sendConfirmationCodeFunctionName = sendConfirmationCodeFunction.functionName;
            props.metadataTable.grantReadData(sendConfirmationCodeFunction);
            props.confirmationCodesTable.grantWriteData(sendConfirmationCodeFunction);
            props.sendEmailFunction.grantInvoke(sendConfirmationCodeFunction);

            const validateConfirmationCodeFunction = new lambda.Function(this, "ValidateConfirmationCodeFunction", {
                functionName: 'validate-confirmation-code',
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/validate-confirmation-code")),
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                environment: {
                    HMAC_SECRET_NAME: hmacSecret.secretName,
                    DYNAMODB_CODES_TABLE: props.confirmationCodesTable.tableName,
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    GENERATE_WEBSITE_FUNCTION: generateWebsiteFunction.functionName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup: validateCodeLogGroup,
            });
            this.validateConfirmationCodeFunctionName = validateConfirmationCodeFunction.functionName;
            props.confirmationCodesTable.grantReadWriteData(validateConfirmationCodeFunction);
            props.metadataTable.grantReadWriteData(validateConfirmationCodeFunction);
            generateWebsiteFunction.grantInvoke(validateConfirmationCodeFunction);

            hmacSecret.grantRead(validateConfirmationCodeFunction);

            // API Resources
            const projectsResource = this.api.root.addResource("projects");
            projectsResource.addMethod("GET", new apigateway.LambdaIntegration(getProjectsFunction));

            const projectIdResource = projectsResource.addResource("{id}");
            projectIdResource.addMethod("DELETE", new apigateway.LambdaIntegration(deleteProjectFunction));

            const authResource = this.api.root.addResource("auth");
            const sendCodeResource = authResource.addResource("send-code");
            sendCodeResource.addMethod("POST", new apigateway.LambdaIntegration(sendConfirmationCodeFunction));

            const validateCodeResource = authResource.addResource("validate-code");
            validateCodeResource.addMethod("POST", new apigateway.LambdaIntegration(validateConfirmationCodeFunction));
        }

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.api.url,
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
        new cdk.CfnOutput(this, 'ContactFormUrl', {
            value: `https://api.${domain}/contact`,
            description: 'Custom domain URL for contact form submissions',
        });

    }
}
