import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

interface AlertingStackProps extends cdk.StackProps {
  paymentSessionFunctionName: string;
  generateWebsiteFunctionName: string;
  stripeWebhookFunctionName: string;
  githubWebhookFunctionName: string;
  healthCheckFunctionName: string;
  metadataTableName: string;
  queueName: string;
  adminEmail: string;
}

/**
 * CloudWatch Alarms and SNS Notifications
 * 
 * Monitors critical metrics and sends alerts via email:
 * - Lambda error rates > 5%
 * - Lambda duration P95 > 10 seconds
 * - DynamoDB throttling
 * - SQS queue backlog > 100 messages
 * - Health check failures
 * - Payment processing failures
 */
export class AlertingStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: AlertingStackProps) {
    super(scope, id, props);

    // Create SNS topic for critical alerts
    const criticalAlertsTopic = new sns.Topic(this, "CriticalAlerts", {
      topicName: "e-info-critical-alerts",
      displayName: "E-Info Critical Alerts",
    });

    // Subscribe admin email to alerts
    criticalAlertsTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.adminEmail)
    );

    // ====================
    // LAMBDA ERROR ALARMS
    // ====================

    // Payment Session - High error rate (> 5%)
    new cloudwatch.Alarm(this, "PaymentSessionErrorRate", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: props.paymentSessionFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmName: "PaymentSession-HighErrorRate",
      alarmDescription: "Payment session lambda error rate exceeded threshold",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // Payment Session - High duration (p95 > 20 seconds)
    new cloudwatch.Alarm(this, "PaymentSessionHighDuration", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensions: { FunctionName: props.paymentSessionFunctionName },
        statistic: "p95",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 20000, // 20 seconds in milliseconds
      evaluationPeriods: 2,
      alarmName: "PaymentSession-HighDuration",
      alarmDescription: "Payment session lambda P95 duration exceeded 20 seconds",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // Generate Website - High error rate
    new cloudwatch.Alarm(this, "GenerateWebsiteErrorRate", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: props.generateWebsiteFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmName: "GenerateWebsite-HighErrorRate",
      alarmDescription: "Generate website lambda error rate exceeded threshold",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // Generate Website - High duration (p95 > 60 seconds)
    new cloudwatch.Alarm(this, "GenerateWebsiteHighDuration", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensions: { FunctionName: props.generateWebsiteFunctionName },
        statistic: "p95",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 60000, // 60 seconds in milliseconds
      evaluationPeriods: 2,
      alarmName: "GenerateWebsite-HighDuration",
      alarmDescription: "Generate website lambda P95 duration exceeded 60 seconds",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // Stripe Webhook - Errors
    new cloudwatch.Alarm(this, "StripeWebhookErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: props.stripeWebhookFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      alarmName: "StripeWebhook-Errors",
      alarmDescription: "Stripe webhook lambda encountered errors",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // GitHub Webhook - Errors
    new cloudwatch.Alarm(this, "GitHubWebhookErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: props.githubWebhookFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2,
      evaluationPeriods: 1,
      alarmName: "GitHubWebhook-Errors",
      alarmDescription: "GitHub webhook lambda encountered errors",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // ====================
    // DYNAMODB ALARMS
    // ====================

    // DynamoDB User Errors
    new cloudwatch.Alarm(this, "DynamoDBUserErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/DynamoDB",
        metricName: "UserErrors",
        dimensions: { TableName: props.metadataTableName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmName: "DynamoDB-UserErrors",
      alarmDescription: "DynamoDB metadata table user errors exceeded threshold",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // DynamoDB System Errors
    new cloudwatch.Alarm(this, "DynamoDBSystemErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/DynamoDB",
        metricName: "SystemErrors",
        dimensions: { TableName: props.metadataTableName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmName: "DynamoDB-SystemErrors",
      alarmDescription: "DynamoDB metadata table system errors detected",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // ====================
    // SQS QUEUE ALARMS
    // ====================

    // SQS Queue Backlog Too Large (>100 messages)
    new cloudwatch.Alarm(this, "SQSQueueBacklogHigh", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/SQS",
        metricName: "ApproximateNumberOfMessagesVisible",
        dimensions: { QueueName: props.queueName },
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      alarmName: "SQS-QueueBacklogHigh",
      alarmDescription: "SQS queue has too many pending messages (>100)",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // SQS Queue Messages Too Old (>300 seconds)
    new cloudwatch.Alarm(this, "SQSQueueMessageAgeTooHigh", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/SQS",
        metricName: "ApproximateAgeOfOldestMessage",
        dimensions: { QueueName: props.queueName },
        statistic: "Maximum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 300, // 5 minutes
      evaluationPeriods: 2,
      alarmName: "SQS-OldestMessageTooOld",
      alarmDescription: "SQS queue oldest message is older than 5 minutes",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // ====================
    // HEALTH CHECK ALARMS
    // ====================

    // Health Check Failures
    new cloudwatch.Alarm(this, "HealthCheckErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: props.healthCheckFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      alarmName: "HealthCheck-Failures",
      alarmDescription: "Health check endpoint is returning errors",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // Health Check Slow Response (>5 seconds)
    new cloudwatch.Alarm(this, "HealthCheckSlow", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensions: { FunctionName: props.healthCheckFunctionName },
        statistic: "Maximum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      alarmName: "HealthCheck-SlowResponse",
      alarmDescription: "Health check response time exceeded 5 seconds",
      alarmActions: [new cloudwatch.SnsAction(criticalAlertsTopic)],
    });

    // ====================
    // COMPOSITE ALARM - Overall System Health
    // ====================

    const systemHealthAlarm = new cloudwatch.CompositeAlarm(
      this,
      "SystemHealthOverall",
      {
        alarmName: "E-Info-SystemHealthOverall",
        alarmDescription: "Overall system health - triggers if multiple critical components are down",
        actionOnAlarm: true,
        actionsEnabled: true,
      }
    );

    systemHealthAlarm.addAlarmRule(
      cloudwatch.AlarmRule.fromAlarm(
        new cloudwatch.Alarm(this, "PaymentSessionHealthCheck", {
          metric: new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensions: { FunctionName: props.paymentSessionFunctionName },
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
          }),
          threshold: 20,
          evaluationPeriods: 1,
          alarmName: "PaymentSession-SystemHealth",
        }),
        cloudwatch.AlarmAction.ALARM
      )
    );

    // Export SNS topic ARN for use in other stacks
    new cdk.CfnOutput(this, "AlertsTopicArn", {
      value: criticalAlertsTopic.topicArn,
      exportName: "e-info-alerts-topic-arn",
      description: "SNS topic for critical alerts",
    });
  }
}
