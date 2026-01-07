import AWS from "aws-sdk";
import { createLogger, logMetric } from "../../shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "../../shared/sentry.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();
const cloudwatch = new AWS.CloudWatch();

const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

/**
 * Health Check Endpoint
 *
 * Provides comprehensive system health status for monitoring
 * Checks:
 * - DynamoDB connectivity and performance
 * - SQS queue status and backlog
 * - Lambda execution status
 * - Recent error rates
 *
 * Returns 200 OK with detailed health info if system is healthy
 * Returns 503 Service Unavailable if critical services are down
 */
export const handler = async (event, context) => {
    initSentry('health-check', context);
    const logger = createLogger('health-check', context);
    
    const health = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        checks: {},
        errors: []
    };

    try {
        logger.info('Health check started');

        // Check DynamoDB
        await checkDynamoDB(logger, health);

        // Check SQS Queue
        await checkSQSQueue(logger, health);

        // Check CloudWatch Metrics (error rates)
        await checkErrorMetrics(logger, health);

        // Determine overall status
        if (health.errors.length > 0) {
            health.status = health.errors.some(e => e.severity === "critical") ? "unhealthy" : "degraded";
        }

        const statusCode = health.status === "unhealthy" ? 503 : 200;

        logger.info('Health check completed', { 
            status: health.status, 
            errorCount: health.errors.length 
        });

        return {
            statusCode,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
            body: JSON.stringify(health),
        };
    } catch (error) {
        logger.error("Health check error", { error: error.message, stack: error.stack }, { severity: 'error' });
        
        captureException(error, {
            operation: 'health_check'
        });

        addBreadcrumb({
            category: 'error',
            message: 'Health check failed',
            level: 'error',
            data: { error: error.message }
        });

        return {
            statusCode: 503,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message,
            }),
        };
    }
};

/**
 * Check DynamoDB connectivity and basic performance
 */
async function checkDynamoDB(logger, health) {
    try {
        await logMetric(logger, 'health_check_dynamodb', async () => {
            const startTime = Date.now();

            // Try to scan a single item from the metadata table
            await dynamodb.query({
                TableName: METADATA_TABLE,
                Limit: 1,
                KeyConditionExpression: "operationId = :pk",
                ExpressionAttributeValues: {
                    ":pk": "health-check"
                }
            }).promise();

            return Date.now() - startTime;
        });

        const startTime = Date.now();
        await dynamodb.query({
            TableName: METADATA_TABLE,
            Limit: 1,
            KeyConditionExpression: "operationId = :pk",
            ExpressionAttributeValues: {
                ":pk": "health-check"
            }
        }).promise();
        const latency = Date.now() - startTime;

        health.checks.dynamodb = {
            status: "healthy",
            latency: `${latency}ms`,
            table: METADATA_TABLE
        };

        if (latency > 1000) {
            health.errors.push({
                service: "DynamoDB",
                message: `High latency: ${latency}ms`,
                severity: "warning"
            });
        }
    } catch (error) {
        health.checks.dynamodb = {
            status: "unhealthy",
            error: error.message
        };
        health.errors.push({
            service: "DynamoDB",
            message: error.message,
            severity: "critical"
        });
        logger.error('DynamoDB health check failed', { error: error.message });
    }
}

/**
 * Check SQS queue status and message backlog
 */
async function checkSQSQueue(logger, health) {
    try {
        if (!QUEUE_URL) {
            health.checks.sqs = {
                status: "not-configured",
                message: "SQS_QUEUE_URL not set"
            };
            return;
        }

        // Get queue attributes
        const attrs = await logMetric(logger, 'health_check_sqs', async () => {
            return sqs.getQueueAttributes({
                QueueUrl: QUEUE_URL,
                AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"]
            }).promise();
        });

        const visibleMessages = parseInt(attrs.Attributes.ApproximateNumberOfMessages);
        const invisibleMessages = parseInt(attrs.Attributes.ApproximateNumberOfMessagesNotVisible);
        const totalMessages = visibleMessages + invisibleMessages;

        health.checks.sqs = {
            status: "healthy",
            visibleMessages,
            processingMessages: invisibleMessages,
            totalBacklog: totalMessages
        };

        // Alert if backlog is growing
        if (totalMessages > 100) {
            health.errors.push({
                service: "SQS",
                message: `Queue backlog high: ${totalMessages} messages`,
                severity: "warning"
            });
        }

        if (totalMessages > 500) {
            health.errors.push({
                service: "SQS",
                message: `Queue backlog critical: ${totalMessages} messages`,
                severity: "critical"
            });
        }
    } catch (error) {
        health.checks.sqs = {
            status: "unhealthy",
            error: error.message
        };
        health.errors.push({
            service: "SQS",
            message: error.message,
            severity: "critical"
        });
        logger.error('SQS health check failed', { error: error.message });
    }
}

/**
 * Check Lambda error metrics from CloudWatch
 */
async function checkErrorMetrics(logger, health) {
    try {
        // Get Lambda error count from last 5 minutes
        const endTime = new Date();
        const startTime = new Date(endTime - 5 * 60 * 1000);

        const errorMetrics = await logMetric(logger, 'health_check_lambda_metrics', async () => {
            return cloudwatch.getMetricStatistics({
                Namespace: "AWS/Lambda",
                MetricName: "Errors",
                StartTime: startTime,
                EndTime: endTime,
                Period: 300, // 5 minute period
                Statistics: ["Sum"],
                Dimensions: [
                    {
                        Name: "FunctionName",
                        Value: "generate-website"
                    }
                ]
            }).promise();
        });

        const errorCount = errorMetrics.Datapoints.reduce((sum, dp) => sum + dp.Sum, 0);

        health.checks.lambdaErrors = {
            status: "healthy",
            errors5min: errorCount
        };

        if (errorCount > 10) {
            health.errors.push({
                service: "Lambda",
                message: `High error rate: ${errorCount} errors in 5 minutes`,
                severity: "warning"
            });
        }
    } catch (error) {
        // Non-critical: CloudWatch metrics might not be available immediately
        health.checks.lambdaErrors = {
            status: "unknown",
            message: error.message
        };
        logger.warn('Lambda error metrics check unavailable', { error: error.message });
    }
}
