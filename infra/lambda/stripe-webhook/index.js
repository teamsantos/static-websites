import AWS from "aws-sdk";
import Stripe from "stripe";
import crypto from "crypto";

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
export const handler = async (event) => {
    try {
        // Verify Stripe webhook signature
        const signature = event.headers['stripe-signature'];
        
        if (!signature) {
            console.warn('Missing Stripe signature header');
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
            console.error('Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Webhook signature verification failed' }),
            };
        }

        console.log(`Processing Stripe event: ${stripeEvent.type}, ID: ${stripeEvent.id}`);

        // Handle specific event types
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                console.log(`Checkout session completed: ${session.id}, payment_status: ${session.payment_status}`);
                
                if (session.payment_status === 'paid') {
                    // Find operationId by payment session ID
                    const operationId = await findOperationIdBySessionId(session.id);
                    
                    if (operationId) {
                        // Update metadata status to "paid" immediately
                        await updateMetadataStatus(operationId, 'paid', session.id);
                        console.log(`Updated operationId: ${operationId} to paid status`);
                        
                        // Enqueue for website generation (async processing)
                        await enqueueWebsiteGeneration(operationId);
                        console.log(`Enqueued website generation for operationId: ${operationId}`);
                    } else {
                        console.error(`Could not find operationId for session: ${session.id}`);
                    }
                }
                break;
            }

            case 'charge.failed': {
                const charge = stripeEvent.data.object;
                console.log(`Charge failed: ${charge.id}`);
                
                // Find operationId by charge
                const sessionId = charge.payment_intent;
                const operationId = await findOperationIdBySessionId(sessionId);
                
                if (operationId) {
                    await updateMetadataStatus(operationId, 'failed', charge.failure_message || 'Payment failed');
                    console.log(`Updated operationId: ${operationId} to failed status`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, received: true }),
        };
    } catch (error) {
        console.error('Error processing Stripe webhook:', error);
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
 * @param {string} sessionId - Stripe checkout session ID
 * @returns {Promise<string|null>} - operationId if found, null otherwise
 */
async function findOperationIdBySessionId(sessionId) {
    try {
        // Query DynamoDB GSI by paymentSessionId
        const result = await dynamodb.query({
            TableName: METADATA_TABLE,
            IndexName: "paymentSessionId-index",
            KeyConditionExpression: "paymentSessionId = :sessionId",
            ExpressionAttributeValues: {
                ":sessionId": sessionId
            },
            Limit: 1
        }).promise();

        if (result.Items && result.Items.length > 0) {
            return result.Items[0].operationId;
        }

        console.warn(`No operationId found for sessionId: ${sessionId}`);
        return null;
    } catch (error) {
        console.error("Error finding operationId:", error);
        throw error;
    }
}

/**
 * Update metadata status for an operation
 * @param {string} operationId - UUID of the operation
 * @param {string} status - New status ('paid', 'failed', 'pending', etc)
 * @param {string} detail - Additional detail (session ID or error message)
 */
async function updateMetadataStatus(operationId, status, detail) {
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

        await dynamodb.update(updateParams).promise();

        console.log(`Updated metadata for operationId: ${operationId}, new status: ${status}`);
    } catch (error) {
        console.error("Error updating metadata status:", error);
        throw error;
    }
}

/**
 * Enqueue website generation job to SQS
 * @param {string} operationId - UUID of the operation
 */
async function enqueueWebsiteGeneration(operationId) {
    try {
        if (!QUEUE_URL) {
            console.warn("SQS_QUEUE_URL not configured, skipping queue enqueue");
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

        await sqs.sendMessage(messageParams).promise();
        console.log(`Enqueued website generation for operationId: ${operationId}`);
    } catch (error) {
        console.error("Error enqueuing website generation:", error);
        throw error;
    }
}
