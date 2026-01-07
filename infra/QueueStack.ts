import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";

interface QueueStackProps extends cdk.StackProps {
  generateWebsiteLambda?: lambda.Function;
}

/**
 * SQS Queue Stack for Event-Driven Website Generation
 *
 * Implements reliable, asynchronous processing:
 * - Main queue: website-generation-queue (300 sec visibility timeout)
 * - DLQ: website-generation-dlq (for failed messages)
 * - Lambda polls queue with 3 automatic retries
 * - Failed messages → DLQ for manual review
 *
 * Flow:
 * Stripe webhook → SQS → Lambda (auto-retries 3x) → Success or DLQ
 *
 * Cost: ~$1/month for SQS
 */
export class QueueStack extends cdk.Stack {
  public queue: sqs.Queue;
  public dlq: sqs.Queue;

  constructor(scope: cdk.App, id: string, props?: QueueStackProps) {
    super(scope, id, props);

    // Dead Letter Queue for failed messages
    this.dlq = new sqs.Queue(this, "WebsiteGenerationDLQ", {
      queueName: "website-generation-dlq",
      retentionPeriod: cdk.Duration.days(14), // Keep for 2 weeks for investigation
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    // Main processing queue
    this.queue = new sqs.Queue(this, "WebsiteGenerationQueue", {
      queueName: "website-generation-queue",
      visibilityTimeout: cdk.Duration.seconds(300), // 5 minutes - match Lambda timeout
      retentionPeriod: cdk.Duration.days(4), // Keep messages for 4 days
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 3, // Retry up to 3 times before sending to DLQ
      },
    });

    // Lambda event source: process messages from queue
    if (props?.generateWebsiteLambda) {
      props.generateWebsiteLambda.addEventSource(
        new lambdaEventSources.SqsEventSource(this.queue, {
          batchSize: 1, // Process one message at a time
          maxConcurrency: 100, // Max concurrent invocations
          reportBatchItemFailures: true, // Return failed items to queue
        })
      );

      // Grant Lambda permissions to consume queue
      this.queue.grantConsumeMessages(props.generateWebsiteLambda);
      this.dlq.grantConsumeMessages(props.generateWebsiteLambda);
    }

    // CloudWatch Alarms for queue health

    // DLQ has messages (indicates processing failures)
    const dlqDepthAlarm = new cloudwatch.Alarm(this, "DLQDepthAlarm", {
      metric: this.dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Messages in DLQ indicate failed website generation",
      alarmName: "WebsiteGenerationDLQNotEmpty",
    });

    // Queue getting backed up
    const queueDepthAlarm = new cloudwatch.Alarm(this, "QueueDepthAlarm", {
      metric: this.queue.metricApproximateNumberOfMessagesVisible(),
      threshold: 100, // Alert if more than 100 messages waiting
      evaluationPeriods: 2,
      datapointsToAlarm: 1,
      alarmDescription: "Website generation queue is backing up",
      alarmName: "WebsiteGenerationQueueBacklog",
    });

    // Oldest message age (stuck messages)
    const oldestMessageAlarm = new cloudwatch.Alarm(this, "OldestMessageAgeAlarm", {
      metric: this.queue.metricApproximateAgeOfOldestMessage(),
      threshold: cdk.Duration.minutes(15).toSeconds(), // Alert if message older than 15 min
      evaluationPeriods: 1,
      alarmDescription: "Message stuck in queue (not being processed)",
      alarmName: "WebsiteGenerationQueueStuck",
    });

    // Outputs for other stacks
    new cdk.CfnOutput(this, "QueueUrl", {
      value: this.queue.queueUrl,
      description: "SQS queue URL for website generation",
      exportName: "WebsiteGenerationQueueUrl",
    });

    new cdk.CfnOutput(this, "QueueArn", {
      value: this.queue.queueArn,
      description: "SQS queue ARN for website generation",
      exportName: "WebsiteGenerationQueueArn",
    });

    new cdk.CfnOutput(this, "DLQUrl", {
      value: this.dlq.queueUrl,
      description: "Dead Letter Queue URL",
      exportName: "WebsiteGenerationDLQUrl",
    });
  }

  /**
   * Grant Lambda permissions to send messages to the queue
   * Used by Stripe webhook handler to enqueue generation jobs
   */
  grantSendMessages(role: iam.IRole) {
    this.queue.grantSendMessages(role);
  }
}
