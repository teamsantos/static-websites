import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";

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
 * Provides comprehensive monitoring and observability:
 * - Lambda performance metrics (invocations, errors, duration)
 * - DynamoDB metrics (read/write capacity, latency)
 * - SQS queue metrics (message count, processing time)
 * - HTTP error rates and status codes
 * - Business metrics (payments, websites generated, deployments)
 * - Cost tracking
 */
export class DashboardStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: DashboardStackProps) {
    super(scope, id, props);

    // Create main dashboard
    const dashboard = new cloudwatch.Dashboard(this, "E-InfoDashboard", {
      dashboardName: "e-info-platform-monitoring",
    });

    // ====================
    // SECTION 1: LAMBDA PERFORMANCE
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Lambda Performance & Reliability",
        width: 24,
        height: 1,
      })
    );

    // Payment Session Lambda
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Payment Session - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "Payment Session - Duration (p50, p95, p99)",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Average",
            period: cdk.Duration.minutes(5),
            label: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "p95",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
            label: "p95",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "p99",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "p99",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Generate Website Lambda
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Generate Website - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensions: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "Generate Website - Duration (p50, p95, p99)",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "Average",
            period: cdk.Duration.minutes(5),
            label: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "p95",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
            label: "p95",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.generateWebsiteFunctionName },
            statistic: "p99",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "p99",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ====================
    // SECTION 2: WEBHOOK HANDLERS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Webhook Handlers",
        width: 24,
        height: 1,
      })
    );

    // Stripe & GitHub Webhooks
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Stripe Webhook - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensions: { FunctionName: props.stripeWebhookFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.stripeWebhookFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "Errors",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "GitHub Webhook - Invocations & Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensions: { FunctionName: props.githubWebhookFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.githubWebhookFunctionName },
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

    // ====================
    // SECTION 3: DYNAMODB METRICS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# DynamoDB Performance",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "DynamoDB - User Errors & Throttles",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "UserErrors",
            dimensions: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "User Errors",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "SystemErrors",
            dimensions: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.DARK_RED,
            label: "System Errors",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "DynamoDB - Consumed Capacity Units",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "ConsumedReadCapacityUnits",
            dimensions: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Read Capacity",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "ConsumedWriteCapacityUnits",
            dimensions: { TableName: props.metadataTableName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
            label: "Write Capacity",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ====================
    // SECTION 4: SQS QUEUE METRICS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# SQS Queue Health",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "SQS Queue - Message Count & Age",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "ApproximateNumberOfMessagesVisible",
            dimensions: { QueueName: props.queueName },
            statistic: "Average",
            period: cdk.Duration.minutes(1),
            label: "Visible Messages",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "ApproximateNumberOfMessagesNotVisible",
            dimensions: { QueueName: props.queueName },
            statistic: "Average",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.ORANGE,
            label: "Processing",
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "ApproximateAgeOfOldestMessage",
            dimensions: { QueueName: props.queueName },
            statistic: "Maximum",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.RED,
            label: "Oldest Message Age (s)",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "SQS Queue - Receive/Send/Delete Rate",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "NumberOfMessagesSent",
            dimensions: { QueueName: props.queueName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Sent",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "NumberOfMessagesReceived",
            dimensions: { QueueName: props.queueName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.BLUE,
            label: "Received",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/SQS",
            metricName: "NumberOfMessagesDeleted",
            dimensions: { QueueName: props.queueName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.GREEN,
            label: "Deleted",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ====================
    // SECTION 5: HTTP & APPLICATION METRICS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# HTTP & Application Metrics",
        width: 24,
        height: 1,
      })
    );

    // Error rate metric (custom from CloudWatch Logs)
    const logGroup = logs.LogGroup.fromLogGroupName(
      this,
      "LogGroup",
      `/aws/lambda/${props.generateWebsiteFunctionName}`
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "All Lambdas - Total Invocations",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Total Invocations",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "All Lambdas - Total Errors & Error Rate",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Total Errors",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ====================
    // SECTION 6: HEALTH CHECK & STATUS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Health Check Endpoint",
        width: 24,
        height: 1,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Health Check - Availability & Status",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensions: { FunctionName: props.healthCheckFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(1),
            label: "Health Checks Run",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.healthCheckFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.RED,
            label: "Health Check Errors",
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: "Health Check - Duration",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.healthCheckFunctionName },
            statistic: "Average",
            period: cdk.Duration.minutes(1),
            label: "Average Duration",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensions: { FunctionName: props.healthCheckFunctionName },
            statistic: "Maximum",
            period: cdk.Duration.minutes(1),
            color: cloudwatch.Color.RED,
            label: "Max Duration",
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ====================
    // SECTION 7: BUSINESS METRICS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Business Metrics (from Logs Insights)",
        width: 24,
        height: 1,
      }),
      new cloudwatch.TextWidget({
        markdown:
          "Monitor these using CloudWatch Logs Insights queries. See `shared/cloudwatch-queries.js` for pre-built queries:\n" +
          "- Payment sessions created\n" +
          "- Website generation success rate\n" +
          "- Deployment success rate\n" +
          "- User activity patterns",
        width: 24,
        height: 3,
      })
    );

    // ====================
    // SECTION 8: ESTIMATED COSTS
    // ====================
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Cost Tracking",
        width: 24,
        height: 1,
      }),
      new cloudwatch.TextWidget({
        markdown:
          "Monitor costs using AWS Billing Dashboard and set up budget alerts.\n" +
          "Key cost drivers:\n" +
          "- Lambda invocations & duration\n" +
          "- DynamoDB on-demand billing\n" +
          "- S3 storage & data transfer\n" +
          "- SQS messages",
        width: 24,
        height: 4,
      })
    );
  }
}
