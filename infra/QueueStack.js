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
exports.QueueStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
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
class QueueStack extends cdk.Stack {
    constructor(scope, id, props) {
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
            props.generateWebsiteLambda.addEventSource(new lambdaEventSources.SqsEventSource(this.queue, {
                batchSize: 1, // Process one message at a time
                maxConcurrency: 100, // Max concurrent invocations
                reportBatchItemFailures: true, // Return failed items to queue
            }));
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
    grantSendMessages(role) {
        this.queue.grantSendMessages(role);
    }
}
exports.QueueStack = QueueStack;
