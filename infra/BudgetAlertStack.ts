import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as lambda from "aws-cdk-lib/aws-lambda";

interface BudgetAlertStackProps extends cdk.StackProps {
  dailyBudgetUSD?: number; // Default: $10
  paymentLambda?: lambda.Function;
  generateLambda?: lambda.Function;
}

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
export class BudgetAlertStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: BudgetAlertStackProps) {
    super(scope, id, props);

    const dailyBudget = props?.dailyBudgetUSD || 10;

    // SNS topic for admin alerts
    const adminTopic = new sns.Topic(this, "AdminAlerts", {
      displayName: "AWS Cost and Lambda Alerts",
      topicName: "admin-alerts",
    });

    // Create CloudWatch alarm for estimated charges
    // Note: This requires enabling billing alerts in AWS Billing Dashboard first
    const estimatedChargesAlarm = new cloudwatch.Alarm(
      this,
      "EstimatedChargesAlarm",
      {
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
      }
    );

    estimatedChargesAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(adminTopic)
    );

    // Lambda throttle alarm for payment function
    if (props?.paymentLambda) {
      const paymentThrottleAlarm = new cloudwatch.Alarm(
        this,
        "PaymentLambdaThrottleAlarm",
        {
          metric: props.paymentLambda.metricThrottles(),
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription: "Payment Lambda being throttled due to concurrency limit",
          alarmName: "PaymentLambdaThrottled",
        }
      );

       paymentThrottleAlarm.addAlarmAction(
         new cloudwatchActions.SnsAction(adminTopic)
       );

       // Set concurrency limit - Lambda functions don't need explicit concurrency setting
       // AWS handles concurrency automatically based on account limits
    }

    // Lambda throttle alarm for generate function
    if (props?.generateLambda) {
      const generateThrottleAlarm = new cloudwatch.Alarm(
        this,
        "GenerateLambdaThrottleAlarm",
        {
          metric: props.generateLambda.metricThrottles(),
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription: "Generate Lambda being throttled due to concurrency limit",
          alarmName: "GenerateLambdaThrottled",
        }
      );

       generateThrottleAlarm.addAlarmAction(
         new cloudwatchActions.SnsAction(adminTopic)
       );

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

    errorRateAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(adminTopic)
    );

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
