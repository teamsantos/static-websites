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
exports.EmailTemplateStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const path = __importStar(require("path"));
/**
 * Email Template Stack - Phase 4.6
 *
 * Provides email notification system using AWS SES:
 * - SendEmail Lambda function
 * - SES configuration and permissions
 * - Email templates for all notification types
 *
 * Email Types:
 * - welcome: Welcome email for new users
 * - payment-confirmation: Order confirmation after payment
 * - generation-started: Notification when generation begins
 * - generation-complete: Website is ready to view
 * - generation-failed: Generation encountered an error
 * - deployment-complete: Website deployed and live
 *
 * The Lambda can be invoked:
 * - Directly from other Lambdas
 * - Via SQS messages
 * - Via SNS notifications
 */
class EmailTemplateStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Validate SES is in sending state
        // Note: In sandbox mode, only verified emails can send to verified emails
        // In production, remove sandbox restrictions
        // Create CloudWatch Log Group for Lambda
        const logGroup = new logs.LogGroup(this, "SendEmailLogs", {
            logGroupName: "/aws/lambda/send-email",
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ============================================================
        // Lambda: Send Email
        // ============================================================
        this.sendEmailFunction = new lambda.Function(this, "SendEmailFunction", {
            functionName: "send-email",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "lambda/send-email")),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                SENDER_EMAIL: props.senderEmail,
                FRONTEND_URL: props.frontendUrl,
                SES_REGION: props.sesRegion || this.region,
                SENTRY_DSN: process.env.SENTRY_DSN || "",
            },
            logGroup,
        });
        this.sendEmailFunctionName = this.sendEmailFunction.functionName;
        this.sendEmailFunctionArn = this.sendEmailFunction.functionArn;
        // ============================================================
        // SES Permissions
        // ============================================================
        // Grant SendEmail action to Lambda
        this.sendEmailFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                "ses:SendEmail",
                "ses:SendRawEmail",
            ],
            resources: ["*"],
            effect: iam.Effect.ALLOW,
        }));
        // ============================================================
        // CloudWatch Permissions (for metrics)
        // ============================================================
        this.sendEmailFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                "cloudwatch:PutMetricData",
            ],
            resources: ["*"],
            effect: iam.Effect.ALLOW,
        }));
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, "SendEmailFunctionNameOutput", {
            value: this.sendEmailFunction.functionName,
            description: "Send Email Lambda function name",
            exportName: "SendEmailFunctionName",
        });
        new cdk.CfnOutput(this, "SendEmailFunctionArnOutput", {
            value: this.sendEmailFunction.functionArn,
            description: "Send Email Lambda ARN",
            exportName: "SendEmailFunctionArn",
        });
        new cdk.CfnOutput(this, "SenderEmailOutput", {
            value: props.senderEmail,
            description: "Sender email address for SES",
            exportName: "SenderEmail",
        });
        // Print SES sandbox note
        new cdk.CfnOutput(this, "SESSandboxNote", {
            value: "Remember: SES starts in sandbox mode. Verify email addresses before sending!",
            description: "SES Configuration Reminder",
        });
    }
    /**
     * Grant this Lambda invoke permission to another Lambda
     * @param grantable - Lambda or other service to grant permission to
     */
    grantInvoke(grantable) {
        return this.sendEmailFunction.grantInvoke(grantable);
    }
}
exports.EmailTemplateStack = EmailTemplateStack;
