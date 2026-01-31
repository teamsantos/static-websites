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
exports.GitHubWebhookStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const aws_certificatemanager_1 = require("aws-cdk-lib/aws-certificatemanager");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
/**
 * GitHub Webhook Stack
 *
 * Receives push events from GitHub and tracks successful deployments
 * Updates website status to "deployed" when code is pushed to master
 *
 * Workflow:
 * - GitHub push to master → GitHub webhook → API Gateway → Lambda
 * - Lambda extracts project name from commit
 * - Lambda finds operationId in DynamoDB
 * - Lambda updates status to "deployed" with commit SHA and timestamp
 */
class GitHubWebhookStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const domain = props?.domain || "e-info.click";
        const hostedZone = route53.HostedZone.fromLookup(this, "GitHubWebhookHostedZone", {
            domainName: domain,
        });
        const certificate = new aws_certificatemanager_1.DnsValidatedCertificate(this, "GitHubWebhookCertificate", {
            domainName: `webhooks.${domain}`,
            hostedZone: hostedZone,
            region: "us-east-1",
        });
        // Lambda for GitHub webhook
        const webhookFunction = new lambda.Function(this, "GitHubWebhookFunction", {
            functionName: 'github-webhook',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("lambda/github-webhook"),
            handler: "index.handler",
            environment: {
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
                GITHUB_WEBHOOK_SECRET: props.githubWebhookSecret || "",
            },
            timeout: cdk.Duration.seconds(30),
        });
        this.githubWebhookFunctionName = webhookFunction.functionName;
        // Set CloudWatch log retention
        new logs.LogRetention(this, "GitHubWebhookLogRetention", {
            logGroupName: webhookFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.TWO_WEEKS,
        });
        // Grant DynamoDB permissions
        if (props.metadataTable) {
            props.metadataTable.grantReadWriteData(webhookFunction);
        }
        // API Gateway setup
        const api = new apigateway.RestApi(this, "GitHubWebhookApi", {
            restApiName: "github-webhook-api",
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "X-Hub-Signature-256"],
            },
        });
        // Custom domain for webhook API
        const apiDomain = new apigateway.DomainName(this, "GitHubWebhookDomain", {
            domainName: `webhooks.${domain}`,
            certificate: certificate,
            endpointType: apigateway.EndpointType.EDGE,
        });
        new apigateway.BasePathMapping(this, "GitHubWebhookApiMapping", {
            domainName: apiDomain,
            restApi: api,
        });
        new route53.ARecord(this, "GitHubWebhookAliasRecord", {
            zone: hostedZone,
            recordName: `webhooks.${domain}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
        });
        // /github endpoint for GitHub webhooks
        const githubResource = api.root.addResource("github");
        githubResource.addMethod("POST", new apigateway.LambdaIntegration(webhookFunction, {
            integrationResponses: [
                { statusCode: "200" },
                { statusCode: "400" },
                { statusCode: "403" },
                { statusCode: "500" },
            ],
        }), {
            methodResponses: [
                { statusCode: "200" },
                { statusCode: "400" },
                { statusCode: "403" },
                { statusCode: "500" },
            ],
        });
        new cdk.CfnOutput(this, "GitHubWebhookUrl", {
            value: `https://webhooks.${domain}/github`,
            description: "GitHub webhook URL to configure in repository settings",
            exportName: "GitHubWebhookUrl",
        });
    }
}
exports.GitHubWebhookStack = GitHubWebhookStack;
