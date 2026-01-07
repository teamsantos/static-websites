import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ses from "aws-cdk-lib/aws-ses";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";

interface EmailTemplateStackProps extends cdk.StackProps {
  senderEmail: string;
  frontendUrl: string;
}

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
export class EmailTemplateStack extends cdk.Stack {
  public sendEmailFunction: lambda.Function;
  public sendEmailFunctionName: string;
  public sendEmailFunctionArn: string;

  constructor(scope: cdk.App, id: string, props: EmailTemplateStackProps) {
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
        SES_REGION: this.region,
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
    this.sendEmailFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
        ],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    // ============================================================
    // CloudWatch Permissions (for metrics)
    // ============================================================
    this.sendEmailFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudwatch:PutMetricData",
        ],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

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
  grantInvoke(grantable: iam.IGrantable) {
    return this.sendEmailFunction.grantInvoke(grantable);
  }
}
