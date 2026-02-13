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
exports.AlertingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const sns_subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
/**
 * CloudWatch Alarms and SNS Notifications
 *
 * Monitors critical metrics and sends alerts via email
 */
class AlertingStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create SNS topic for critical alerts
        const criticalAlertsTopic = new sns.Topic(this, "CriticalAlerts", {
            topicName: "e-info-critical-alerts",
            displayName: "E-Info Critical Alerts",
        });
        // Subscribe admin email to alerts
        criticalAlertsTopic.addSubscription(new sns_subscriptions.EmailSubscription(props.adminEmail));
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
exports.AlertingStack = AlertingStack;
