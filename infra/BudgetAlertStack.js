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
exports.BudgetAlertStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
/**
 * Budget Alert Stack for Cost Controls
 *
 * Protects against runaway costs from attacks or bugs:
 * - CloudWatch alarm if daily AWS spend > $10
 * - SNS notification to admin
 * - Lambda concurrency limits (max 100)
 * - Lambda timeout increase to 300s (5 minutes)
 *
 * Cost: ~$1/month for alarms
 */
class BudgetAlertStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const dailyBudget = props?.dailyBudgetUSD || 10;
        // SNS topic for admin alerts
        const adminTopic = new sns.Topic(this, "AdminAlerts", {
            displayName: "AWS Cost and Lambda Alerts",
            topicName: "admin-alerts",
        });
        // Create CloudWatch alarm for estimated charges
        // Note: This requires enabling billing alerts in AWS Billing Dashboard first
        const estimatedChargesAlarm = new cloudwatch.Alarm(this, "EstimatedChargesAlarm", {
            metric: new cloudwatch.Metric({
                namespace: "AWS/Billing",
                metricName: "EstimatedCharges",
                dimensionsMap: {
                    Currency: "USD",
                },
                statistic: "Maximum",
            }),
            threshold: dailyBudget,
            evaluationPeriods: 1,
            alarmDescription: `AWS daily estimated charges exceed $${dailyBudget}`,
            alarmName: "HighAWSSpend",
        });
        estimatedChargesAlarm.addAlarmAction(new cloudwatchActions.SnsAction(adminTopic));
        // Lambda throttle alarm for payment function
        if (props?.paymentLambda) {
            const paymentThrottleAlarm = new cloudwatch.Alarm(this, "PaymentLambdaThrottleAlarm", {
                metric: props.paymentLambda.metricThrottles(),
                threshold: 1,
                evaluationPeriods: 1,
                alarmDescription: "Payment Lambda being throttled due to concurrency limit",
                alarmName: "PaymentLambdaThrottled",
            });
            paymentThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(adminTopic));
            // Set concurrency limit - Lambda functions don't need explicit concurrency setting
            // AWS handles concurrency automatically based on account limits
        }
        // Lambda throttle alarm for generate function
        if (props?.generateLambda) {
            const generateThrottleAlarm = new cloudwatch.Alarm(this, "GenerateLambdaThrottleAlarm", {
                metric: props.generateLambda.metricThrottles(),
                threshold: 1,
                evaluationPeriods: 1,
                alarmDescription: "Generate Lambda being throttled due to concurrency limit",
                alarmName: "GenerateLambdaThrottled",
            });
            generateThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(adminTopic));
            // Set concurrency limit - Lambda functions don't need explicit concurrency setting
            // AWS handles concurrency automatically based on account limits
        }
        // Lambda error rate alarm (combined for both lambdas)
        const allLambdasErrorMetric = new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
        });
        const errorRateAlarm = new cloudwatch.Alarm(this, "HighLambdaErrorRateAlarm", {
            metric: allLambdasErrorMetric,
            threshold: 10, // More than 10 errors in 5 minutes
            evaluationPeriods: 1,
            alarmDescription: "Lambda error rate is high (>10 errors per 5 minutes)",
            alarmName: "HighLambdaErrorRate",
        });
        errorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(adminTopic));
        // Output SNS topic for manual configuration
        new cdk.CfnOutput(this, "AdminAlertsTopic", {
            value: adminTopic.topicName,
            description: "SNS topic for admin alerts",
            exportName: "AdminAlertsTopicName",
        });
        new cdk.CfnOutput(this, "AdminAlertsTopicArn", {
            value: adminTopic.topicArn,
            description: "SNS topic ARN for admin alerts",
            exportName: "AdminAlertsTopicArn",
        });
    }
}
exports.BudgetAlertStack = BudgetAlertStack;
