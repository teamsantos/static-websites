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
exports.ContactFormStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class ContactFormStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.ContactFormStack = ContactFormStack;
