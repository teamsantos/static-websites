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
const aws_certificatemanager_1 = require("aws-cdk-lib/aws-certificatemanager");
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const path = __importStar(require("path"));
class CreateProjectStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.contactFormFunctionName = "";
        this.paymentSessionFunctionName = "";
        this.stripeWebhookFunctionName = "";
        this.githubWebhookFunctionName = "";
        this.healthCheckFunctionName = "";
        this.getProjectsFunctionName = "";
        this.deleteProjectFunctionName = "";
        this.sendConfirmationCodeFunctionName = "";
        this.validateConfirmationCodeFunctionName = "";
        const domain = props?.domain || 'e-info.click';
        const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domain,
        });
        const certificate = new aws_certificatemanager_1.DnsValidatedCertificate(this, 'ApiCertificate', {
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
                FROM_EMAIL: 'noreply@e-info.click',
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
        const contactFormFunction = new lambda.Function(this, 'ContactFormFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/contact-form'),
            handler: 'index.handler',
            environment: {
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecret.secretName,
                GITHUB_CONFIG_SECRET_NAME: githubConfigSecret.secretName,
                FROM_EMAIL: 'noreply@e-info.click',
                AWS_SES_REGION: props?.ses_region || "us-east-1",
            },
            timeout: cdk.Duration.seconds(15),
            memorySize: 256,
            description: 'Handles contact form submissions from generated websites',
        });
        this.contactFormFunctionName = contactFormFunction.functionName;
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
            const logGroup = new logs.LogGroup(this, "ProjectManagementLogs", {
                logGroupName: "/aws/lambda/project-management-api",
                retention: logs.RetentionDays.TWO_WEEKS,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            const getProjectsFunction = new lambda.Function(this, "GetProjectsFunction", {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/get-projects")),
                timeout: cdk.Duration.seconds(10),
                memorySize: 256,
                environment: {
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup,
            });
            this.getProjectsFunctionName = getProjectsFunction.functionName;
            props.metadataTable.grantReadData(getProjectsFunction);
            const deleteProjectFunction = new lambda.Function(this, "DeleteProjectFunction", {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/delete-project")),
                timeout: cdk.Duration.seconds(10),
                memorySize: 256,
                environment: {
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup,
            });
            this.deleteProjectFunctionName = deleteProjectFunction.functionName;
            props.metadataTable.grantReadWriteData(deleteProjectFunction);
            const sendConfirmationCodeFunction = new lambda.Function(this, "SendConfirmationCodeFunction", {
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
                logGroup,
            });
            this.sendConfirmationCodeFunctionName = sendConfirmationCodeFunction.functionName;
            props.metadataTable.grantReadData(sendConfirmationCodeFunction);
            props.confirmationCodesTable.grantWriteData(sendConfirmationCodeFunction);
            props.sendEmailFunction.grantInvoke(sendConfirmationCodeFunction);
            const validateConfirmationCodeFunction = new lambda.Function(this, "ValidateConfirmationCodeFunction", {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: "index.handler",
                code: lambda.Code.fromAsset(path.join(__dirname, "lambda/validate-confirmation-code")),
                timeout: cdk.Duration.seconds(30),
                memorySize: 256,
                environment: {
                    DYNAMODB_CODES_TABLE: props.confirmationCodesTable.tableName,
                    DYNAMODB_METADATA_TABLE: props.metadataTable.tableName,
                    GENERATE_WEBSITE_FUNCTION: generateWebsiteFunction.functionName,
                    SENTRY_DSN: process.env.SENTRY_DSN || "",
                },
                logGroup,
            });
            this.validateConfirmationCodeFunctionName = validateConfirmationCodeFunction.functionName;
            props.confirmationCodesTable.grantReadData(validateConfirmationCodeFunction);
            props.metadataTable.grantReadWriteData(validateConfirmationCodeFunction);
            generateWebsiteFunction.grantInvoke(validateConfirmationCodeFunction);
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
exports.CreateProjectStack = CreateProjectStack;
