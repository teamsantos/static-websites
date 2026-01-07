import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
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
 * Monitors critical metrics and sends alerts via email
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

    const snsAction = new cloudwatch_actions.SnsAction(criticalAlertsTopic);

    // Payment Session - High error rate
    const paymentErrorAlarm = new cloudwatch.Alarm(this, "PaymentSessionErrorRate", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmName: "PaymentSession-HighErrorRate",
      alarmDescription: "Payment session lambda error rate exceeded threshold",
    });
    paymentErrorAlarm.addAlarmAction(snsAction);

    // Payment Session - High duration
    const paymentDurationAlarm = new cloudwatch.Alarm(this, "PaymentSessionHighDuration", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensionsMap: { FunctionName: props.paymentSessionFunctionName },
        statistic: "p95",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 20000,
      evaluationPeriods: 2,
      alarmName: "PaymentSession-HighDuration",
      alarmDescription: "Payment session lambda P95 duration exceeded 20 seconds",
    });
    paymentDurationAlarm.addAlarmAction(snsAction);

    // Generate Website - High error rate
    const generateErrorAlarm = new cloudwatch.Alarm(this, "GenerateWebsiteErrorRate", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmName: "GenerateWebsite-HighErrorRate",
      alarmDescription: "Generate website lambda error rate exceeded threshold",
    });
    generateErrorAlarm.addAlarmAction(snsAction);

    // Generate Website - High duration
    const generateDurationAlarm = new cloudwatch.Alarm(this, "GenerateWebsiteHighDuration", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensionsMap: { FunctionName: props.generateWebsiteFunctionName },
        statistic: "p95",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 60000,
      evaluationPeriods: 2,
      alarmName: "GenerateWebsite-HighDuration",
      alarmDescription: "Generate website lambda P95 duration exceeded 60 seconds",
    });
    generateDurationAlarm.addAlarmAction(snsAction);

    // Stripe Webhook - Errors
    const stripeErrorAlarm = new cloudwatch.Alarm(this, "StripeWebhookErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensionsMap: { FunctionName: props.stripeWebhookFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      alarmName: "StripeWebhook-Errors",
      alarmDescription: "Stripe webhook lambda encountered errors",
    });
    stripeErrorAlarm.addAlarmAction(snsAction);

    // GitHub Webhook - Errors
    const githubErrorAlarm = new cloudwatch.Alarm(this, "GitHubWebhookErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensionsMap: { FunctionName: props.githubWebhookFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2,
      evaluationPeriods: 1,
      alarmName: "GitHubWebhook-Errors",
      alarmDescription: "GitHub webhook lambda encountered errors",
    });
    githubErrorAlarm.addAlarmAction(snsAction);

    // DynamoDB User Errors
    const dynamoUserErrorAlarm = new cloudwatch.Alarm(this, "DynamoDBUserErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/DynamoDB",
        metricName: "UserErrors",
        dimensionsMap: { TableName: props.metadataTableName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmName: "DynamoDB-UserErrors",
      alarmDescription: "DynamoDB metadata table user errors exceeded threshold",
    });
    dynamoUserErrorAlarm.addAlarmAction(snsAction);

    // DynamoDB System Errors
    const dynamoSystemErrorAlarm = new cloudwatch.Alarm(this, "DynamoDBSystemErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/DynamoDB",
        metricName: "SystemErrors",
        dimensionsMap: { TableName: props.metadataTableName },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmName: "DynamoDB-SystemErrors",
      alarmDescription: "DynamoDB metadata table system errors detected",
    });
    dynamoSystemErrorAlarm.addAlarmAction(snsAction);

    // SQS Queue Backlog Too Large
    const sqsBacklogAlarm = new cloudwatch.Alarm(this, "SQSQueueBacklogHigh", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/SQS",
        metricName: "ApproximateNumberOfMessagesVisible",
        dimensionsMap: { QueueName: props.queueName },
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      alarmName: "SQS-QueueBacklogHigh",
      alarmDescription: "SQS queue has too many pending messages (>100)",
    });
    sqsBacklogAlarm.addAlarmAction(snsAction);

    // SQS Queue Messages Too Old
    const sqsAgeAlarm = new cloudwatch.Alarm(this, "SQSQueueMessageAgeTooHigh", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/SQS",
        metricName: "ApproximateAgeOfOldestMessage",
        dimensionsMap: { QueueName: props.queueName },
        statistic: "Maximum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 300,
      evaluationPeriods: 2,
      alarmName: "SQS-OldestMessageTooOld",
      alarmDescription: "SQS queue oldest message is older than 5 minutes",
    });
    sqsAgeAlarm.addAlarmAction(snsAction);

    // Health Check Failures
    const healthCheckErrorAlarm = new cloudwatch.Alarm(this, "HealthCheckErrors", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensionsMap: { FunctionName: props.healthCheckFunctionName },
        statistic: "Sum",
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      alarmName: "HealthCheck-Failures",
      alarmDescription: "Health check endpoint is returning errors",
    });
    healthCheckErrorAlarm.addAlarmAction(snsAction);

    // Health Check Slow Response
    const healthCheckSlowAlarm = new cloudwatch.Alarm(this, "HealthCheckSlow", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Duration",
        dimensionsMap: { FunctionName: props.healthCheckFunctionName },
        statistic: "Maximum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5000,
      evaluationPeriods: 2,
      alarmName: "HealthCheck-SlowResponse",
      alarmDescription: "Health check response time exceeded 5 seconds",
    });
    healthCheckSlowAlarm.addAlarmAction(snsAction);

    // Export SNS topic ARN for use in other stacks
    new cdk.CfnOutput(this, "AlertsTopicArn", {
      value: criticalAlertsTopic.topicArn,
      exportName: "e-info-alerts-topic-arn",
      description: "SNS topic for critical alerts",
    });
  }
}
