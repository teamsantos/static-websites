import AWS from "aws-sdk";
import Stripe from "stripe";
import crypto from "crypto";
import { createLogger, logMetric } from "@app/shared/logger";
import { initSentry, captureException, addBreadcrumb } from "@app/shared/sentry";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// Keep S3 for backwards compatibility if needed
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "teamsantos-static-websites";
const METADATA_KEY = "metadata.json";

/**
 * Stripe Webhook Handler
 * 
 * This lambda handles Stripe webhook events:
 * - charge.succeeded: Update metadata status to "paid"
 * - charge.failed: Update metadata status to "failed"
 * 
 * Critical: Verify webhook signature to prevent spoofed events
 */
export const handler = async (event, context) => {
    initSentry('stripe-webhook', context);
    const logger = createLogger('stripe-webhook', context);
    
    try {
        // Verify Stripe webhook signature
        const signature = event.headers['stripe-signature'];
        
        if (!signature) {
            logger.warn('Missing Stripe signature header');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing Stripe signature' }),
            };
        }

        const rawBody = event.body;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let stripeEvent;
        try {
            stripeEvent = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret
            );
        } catch (err) {
            logger.error('Webhook signature verification failed', { error: err.message }, { severity: 'security' });
            
            captureException(err, {
                operation: 'webhook_signature_verification'
            }, {
                level: 'warning',
                tags: { webhook_type: 'stripe' }
            });

            addBreadcrumb({
                category: 'stripe_webhook',
                message: 'Signature verification failed',
                level: 'error'
            });

            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Webhook signature verification failed' }),
            };
        }

        logger.info('Processing Stripe event', { eventType: stripeEvent.type, eventId: stripeEvent.id });

        addBreadcrumb({
            category: 'stripe_webhook',
            message: `Processing ${stripeEvent.type} event`,
            level: 'info',
            data: { eventId: stripeEvent.id }
        });

        // Handle specific event types
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                logger.info('Checkout session completed', { sessionId: session.id, paymentStatus: session.payment_status });
                
                if (session.payment_status === 'paid') {
                    // Find operationId by payment session ID
                    const operationId = await findOperationIdBySessionId(logger, session.id);
                    
                    if (operationId) {
                        // Update metadata status to "paid" immediately
                        await updateMetadataStatus(logger, operationId, 'paid', session.id);
                        
                        // Enqueue for website generation (async processing)
                        await enqueueWebsiteGeneration(logger, operationId);
                    } else {
                        logger.error('Could not find operationId for session', { sessionId: session.id }, { severity: 'warning' });
                    }
                }
                break;
            }

            case 'charge.failed': {
                const charge = stripeEvent.data.object;
                logger.warn('Charge failed', { chargeId: charge.id, failureMessage: charge.failure_message });
                
                // Find operationId by charge
                const sessionId = charge.payment_intent;
                const operationId = await findOperationIdBySessionId(logger, sessionId);
                
                if (operationId) {
                    await updateMetadataStatus(logger, operationId, 'failed', charge.failure_message || 'Payment failed');
                }
                break;
            }

            default:
                logger.debug('Unhandled event type', { eventType: stripeEvent.type });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, received: true }),
        };
    } catch (error) {
        logger.error('Error processing Stripe webhook', { error: error.message, stack: error.stack }, { severity: 'error' });
        
        captureException(error, {
            operation: 'process_stripe_webhook'
        });

        addBreadcrumb({
            category: 'error',
            message: 'Error processing webhook',
            level: 'error',
            data: { error: error.message }
        });

        // Return 200 to prevent Stripe retries on unexpected errors
        // but log the error for manual review
        return {
            statusCode: 200,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};

/**
 * Find operationId by Stripe session ID
 * @param {object} logger - Logger instance
 * @param {string} sessionId - Stripe checkout session ID
 * @returns {Promise<string|null>} - operationId if found, null otherwise
 */
async function findOperationIdBySessionId(logger, sessionId) {
    try {
        // Query DynamoDB GSI by paymentSessionId
        const result = await logMetric(logger, 'query_operationid_by_sessionid', async () => {
            return dynamodb.query({
                TableName: METADATA_TABLE,
                IndexName: "paymentSessionId-index",
                KeyConditionExpression: "paymentSessionId = :sessionId",
                ExpressionAttributeValues: {
                    ":sessionId": sessionId
                },
                Limit: 1
            }).promise();
        });

        if (result.Items && result.Items.length > 0) {
            logger.cache('operationId_lookup', true, { sessionId });
            return result.Items[0].operationId;
        }

        logger.cache('operationId_lookup', false, { sessionId });
        return null;
    } catch (error) {
        logger.error("Error finding operationId", { error: error.message, sessionId, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}

/**
 * Update metadata status for an operation
 * @param {object} logger - Logger instance
 * @param {string} operationId - UUID of the operation
 * @param {string} status - New status ('paid', 'failed', 'pending', etc)
 * @param {string} detail - Additional detail (session ID or error message)
 */
async function updateMetadataStatus(logger, operationId, status, detail) {
    try {
        // Update via DynamoDB UpdateItem (atomic)
        const updateParams = {
            TableName: METADATA_TABLE,
            Key: { operationId },
            UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": status,
                ":updatedAt": new Date().toISOString()
            }
        };

        if (status === 'paid') {
            updateParams.UpdateExpression += ", paidAt = :paidAt";
            updateParams.ExpressionAttributeValues[":paidAt"] = new Date().toISOString();
        } else if (status === 'failed') {
            updateParams.UpdateExpression += ", failureReason = :failureReason";
            updateParams.ExpressionAttributeValues[":failureReason"] = detail;
        }

        await logMetric(logger, 'update_metadata_status', async () => {
            return dynamodb.update(updateParams).promise();
        });

        logger.database('update', METADATA_TABLE, 0, { operationId, status });
    } catch (error) {
        logger.error("Error updating metadata status", { error: error.message, operationId, status, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}

/**
 * Enqueue website generation job to SQS
 * @param {object} logger - Logger instance
 * @param {string} operationId - UUID of the operation
 */
async function enqueueWebsiteGeneration(logger, operationId) {
    try {
        if (!QUEUE_URL) {
            logger.warn("SQS_QUEUE_URL not configured, skipping queue enqueue");
            return;
        }

        const messageParams = {
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({
                operationId,
                timestamp: new Date().toISOString(),
            }),
            MessageAttributes: {
                operationId: {
                    StringValue: operationId,
                    DataType: "String",
                },
                source: {
                    StringValue: "stripe-webhook",
                    DataType: "String",
                },
            },
        };

        await logMetric(logger, 'enqueue_website_generation', async () => {
            return sqs.sendMessage(messageParams).promise();
        });

        logger.info('Enqueued website generation', { operationId });
    } catch (error) {
        logger.error("Error enqueuing website generation", { error: error.message, operationId, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}
