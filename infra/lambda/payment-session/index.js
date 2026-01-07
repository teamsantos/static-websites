import AWS from "aws-sdk";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { validatePaymentSessionRequest } from "./shared/validators.js";
import { generateIdempotencyKey, withIdempotency } from "./shared/idempotency.js";
import { createLogger, logMetric } from "./shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "./shared/sentry.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const SEND_EMAIL_FUNCTION = process.env.SEND_EMAIL_FUNCTION || "send-email";

// Keep S3 for backwards compatibility if needed
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "teamsantos-static-websites";

export const handler = async (event, context) => {
    initSentry('payment-session', context);
    const logger = createLogger('payment-session', context);
    if (event.httpMethod === "OPTIONS") {
        logger.debug('CORS preflight request', { method: event.httpMethod });
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
            },
            body: "",
        };
    }

    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = [
        "https://editor.e-info.click",
        "https://ssh.e-info.click",
        "http://89.152.33.66",
        "https://89.152.33.66",
        "https://e-info.click"
    ];

    const isAllowedOrigin =
        !origin ||
        allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));

    if (!isAllowedOrigin) {
        logger.warn('CORS origin rejected', { origin, allowedOrigins });
        return {
            statusCode: 403,
            headers: corsHeaders("*"),
            body: JSON.stringify({ message: "Forbidden" }),
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
        logger.debug('Request body parsed', { email: requestBody.email, projectName: requestBody.projectName });
    } catch (error) {
        logger.warn('Invalid JSON in request body', { error: error.message });
        return {
            statusCode: 400,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Invalid JSON in request body" }),
        };
    }

    const { email, projectName, images, priceId, langs, textColors, sectionBackgrounds, templateId } = requestBody;

    // SECURITY: Comprehensive input validation
    const validation = validatePaymentSessionRequest(requestBody);
    if (!validation.valid) {
        logger.warn('Validation failed', { error: validation.error, email });
        addBreadcrumb({
            category: 'validation',
            message: 'Payment request validation failed',
            level: 'warning',
            data: { error: validation.error }
        });
        return {
            statusCode: 400,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: validation.error }),
        };
    }

    // Use cleaned language strings (empty values filtered out)
    const cleanedLangs = validation.cleanedLangs || langs;

    // IDEMPOTENCY: Generate key from request to prevent duplicates
    const idempotencyKey = generateIdempotencyKey({
        method: "POST",
        path: "/checkout-session",
        userId: email,
        body: { email, projectName, priceId, templateId }
    });

    try {
        // Use idempotency wrapper: returns cached result if request was already processed
        const result = await logMetric(logger, 'create_checkout_session', async () => {
            const operationKey = uuidv4();

            addBreadcrumb({
                category: 'stripe',
                message: 'Creating Stripe checkout session',
                level: 'info',
                data: { operationId: operationKey, email }
            });

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                mode: "subscription",
                customer_email: email,
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${process.env.FRONTEND_URL}/success?operation_id=${operationKey}`,
                cancel_url: `${process.env.FRONTEND_URL}/cancel?operation_id=${operationKey}`,
            });

            logger.info('Stripe session created', { sessionId: session.id, email, operationId: operationKey });

            addBreadcrumb({
                category: 'stripe',
                message: 'Stripe session created successfully',
                level: 'info',
                data: { sessionId: session.id, operationId: operationKey }
            });

            // ✅ Save metadata to DynamoDB
            await saveMetadata(logger, operationKey, {
                email,
                projectName,
                images,
                langs: cleanedLangs,
                textColors,
                sectionBackgrounds,
                templateId, 
                createdAt: new Date().toISOString(),
                paymentSessionId: session.id,
                status: "pending",
            });

            // ✅ Send payment confirmation email (async, don't wait for it)
            await sendPaymentConfirmationEmail(logger, email, projectName, priceId, operationKey).catch(err => {
                logger.warn('Failed to send payment confirmation email', { error: err.message, email });
                // Don't fail the request if email fails
            });

            return {
                sessionId: session.id,
                sessionUrl: session.url,
            };
        });

        const result2 = await withIdempotency(idempotencyKey, async () => result, 24);

        logger.http('POST', '/checkout-session', 200, 0, { email });
        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify(result2),
        };
    } catch (error) {
        logger.error('Stripe session creation failed', { error: error.message, email, stack: error.stack }, { severity: 'error' });
        
        captureException(error, {
            email,
            projectName,
            operation: 'create_checkout_session'
        });

        addBreadcrumb({
            category: 'error',
            message: 'Stripe session creation failed',
            level: 'error',
            data: { error: error.message }
        });

        return {
            statusCode: 500,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Failed to create Stripe session" }),
        };
    }
};

async function saveMetadata(logger, operationKey, entry) {
    try {
        // Calculate TTL: 7 days from now (Unix timestamp)
        const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

        // Save to DynamoDB (atomic write)
        await logMetric(logger, 'save_metadata_dynamodb', async () => {
            return dynamodb.put({
                TableName: METADATA_TABLE,
                Item: {
                    operationId: operationKey,
                    ...entry,
                    expiresAt: ttl, // DynamoDB TTL for auto-cleanup
                }
            }).promise();
        });

        logger.info('Metadata saved to DynamoDB', { operationId: operationKey, email: entry.email });
    } catch (error) {
        logger.error("Failed to store metadata", { error: error.message, operationKey, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
});

/**
 * Invoke send-email Lambda to send payment confirmation
 * This is async and doesn't block the response
 */
async function sendPaymentConfirmationEmail(logger, email, projectName, priceId, operationId) {
    try {
        // Map price ID to plan name (you may need to adjust this based on your Stripe setup)
        const planName = priceId.includes('yearly') ? 'Annual Plan' : 'Monthly Plan';
        const price = priceId.includes('yearly') ? '$99/year' : '$9.99/month';

        const params = {
            FunctionName: SEND_EMAIL_FUNCTION,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify({
                type: 'payment-confirmation',
                email,
                data: {
                    projectName,
                    planName,
                    price,
                    operationId,
                },
            }),
        };

        await lambda.invoke(params).promise();
        logger.info('Payment confirmation email queued', { email, projectName });
    } catch (error) {
        logger.warn('Failed to queue payment confirmation email', { error: error.message, email });
        // Don't throw - email failures shouldn't block payment flow
    }
}
