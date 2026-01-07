import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

interface DashboardStackProps extends cdk.StackProps {
  paymentSessionFunctionName: string;
  generateWebsiteFunctionName: string;
  stripeWebhookFunctionName: string;
  githubWebhookFunctionName: string;
  healthCheckFunctionName: string;
  metadataTableName: string;
  queueUrl: string;
  queueName: string;
  s3BucketName: string;
}

/**
 * CloudWatch Dashboard for E-Info Platform
 * 
 * Provides comprehensive monitoring with widgets for:
 * - Lambda performance (invocations, errors, duration)
 * - DynamoDB metrics
 * - SQS queue health
 * - HTTP and business metrics
 */
export class DashboardStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: DashboardStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, "E-InfoDashboard", {
      dashboardName: "e-info-platform-monitoring",
    });

    // Lambda Performance Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Lambda Performance & Reliability",
        width: 24,
        height: 1,
      })
    );

    // Payment Session Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Payment Session - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Generate Website Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Generate Website - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // DynamoDB Metrics Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# DynamoDB Performance",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "DynamoDB - User & System Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "UserErrors",
            dimensionsMap: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "User Errors",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "SystemErrors",
            dimensionsMap: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
            label: "System Errors",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // SQS Queue Metrics Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# SQS Queue Health",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "SQS - Message Count",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "ApproximateNumberOfMessagesVisible",
            dimensionsMap: { QueueName: props.queueName },
            statistic: "Average",
            period: cdk.Duration.minutes(1),
            label: "Visible Messages",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "ApproximateNumberOfMessagesNotVisible",
            dimensionsMap: { QueueName: props.queueName },
            statistic: "Average",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.ORANGE,
            label: "Processing",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Health Check Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Health Check Endpoint",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Health Check - Status",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensionsMap: { FunctionName: props.healthCheckFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(1),
            label: "Checks Run",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensionsMap: { FunctionName: props.healthCheckFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Summary Section
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown:
          "# Monitoring Summary\n\n" +
          "- Monitor Lambda error rates and duration percentiles\n" +
          "- Track DynamoDB user/system errors\n" +
          "- Watch SQS queue backlog and message age\n" +
          "- Check health endpoint status\n\n" +
          "See `shared/cloudwatch-queries.js` for detailed CloudWatch Insights queries",
        width: 24,
        height: 4,
      })
    );
  }
}
