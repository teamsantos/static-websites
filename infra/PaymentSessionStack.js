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
exports.StripeCheckoutStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const aws_certificatemanager_1 = require("aws-cdk-lib/aws-certificatemanager");
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
/**
 * Stripe Webhook Stack
 *
 * This stack contains ONLY the Stripe webhook endpoint which receives
 * callbacks from Stripe's servers. It should NOT have WAF origin validation
 * because Stripe's servers don't send Origin headers.
 *
 * The frontend-facing /checkout-session endpoint has been moved to
 * CreateProjectStack (api.e-info.click) to be protected by WAF.
 */
class StripeCheckoutStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const domain = props?.domain || "e-info.click";
        const hostedZone = route53.HostedZone.fromLookup(this, "StripeHostedZone", {
            domainName: domain,
        });
        const certificate = new aws_certificatemanager_1.DnsValidatedCertificate(this, "StripeApiCertificate", {
            domainName: `pay.${domain}`,
            hostedZone: hostedZone,
            region: "us-east-1",
        });
        // Lambda for Stripe Webhook ONLY (checkout-session moved to CreateProjectStack)
        const webhookFunction = new lambda.Function(this, "StripeWebhookFunction", {
            functionName: 'stripe-webhook',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("lambda/stripe-webhook"),
            handler: "index.handler",
            environment: {
                STRIPE_SECRET_KEY: props.stripeSecretKey,
                STRIPE_WEBHOOK_SECRET: props.stripeWebhookSecret || "",
                S3_BUCKET_NAME: props.s3Bucket || "teamsantos-static-websites",
                DYNAMODB_METADATA_TABLE: props.metadataTable?.tableName || "websites-metadata",
                SQS_QUEUE_URL: props.sqsQueueUrl || "",
            },
            timeout: cdk.Duration.seconds(30),
        });
        this.stripeWebhookFunctionName = webhookFunction.functionName;
        // Set CloudWatch log retention to 30 days
        new logs.LogRetention(this, 'StripeWebhookLogRetention', {
            logGroupName: webhookFunction.logGroup.logGroupName,
            retention: logs.RetentionDays.ONE_MONTH,
        });
        if (props.s3Bucket) {
            // Webhook needs S3 permissions
            webhookFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: ["s3:ListBucket"],
                resources: [`arn:aws:s3:::${props.s3Bucket}`],
            }));
            webhookFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: ["s3:GetObject", "s3:PutObject"],
                resources: [
                    `arn:aws:s3:::${props.s3Bucket}/metadata.json`,
                ],
            }));
        }
        // Grant DynamoDB permissions for webhook lambda
        if (props.metadataTable) {
            props.metadataTable.grantReadWriteData(webhookFunction);
        }
        // Grant SQS send permissions to webhook Lambda
        if (props.sqsQueueArn) {
            webhookFunction.addToRolePolicy(new iam.PolicyStatement({
                actions: ["sqs:SendMessage"],
                resources: [props.sqsQueueArn],
            }));
        }
        // API Gateway setup - ONLY for webhooks (NO WAF protection)
        const api = new apigateway.RestApi(this, "StripeWebhookApi", {
            restApiName: "stripe-webhook-api",
            description: "Stripe webhook endpoint (external access, no WAF)",
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                    "Origin",
                ],
            },
        });
        // Custom domain for API
        const apiDomain = new apigateway.DomainName(this, "StripeApiDomain", {
            domainName: `pay.${domain}`,
            certificate: certificate,
            endpointType: apigateway.EndpointType.EDGE,
        });
        new apigateway.BasePathMapping(this, "StripeApiMapping", {
            domainName: apiDomain,
            restApi: api,
        });
        new route53.ARecord(this, "StripeApiAliasRecord", {
            zone: hostedZone,
            recordName: `pay.${domain}`,
            target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(apiDomain)),
        });
        // /webhook endpoint for Stripe events ONLY
        const webhookResource = api.root.addResource("webhook");
        webhookResource.addMethod("POST", new apigateway.LambdaIntegration(webhookFunction, {
            integrationResponses: [
                { statusCode: "200" },
                { statusCode: "400" },
                { statusCode: "500" },
            ],
        }), {
            methodResponses: [
                { statusCode: "200" },
                { statusCode: "400" },
                { statusCode: "500" },
            ],
        });
    }
}
exports.StripeCheckoutStack = StripeCheckoutStack;
