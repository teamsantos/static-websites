import AWS from "aws-sdk";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { generateIdempotencyKey, withIdempotency } from "@app/shared/idempotency";
import { createLogger, logMetric } from "@app/shared/logger";
import { addBreadcrumb, captureException, initSentry } from "@app/shared/sentry";
import { validatePaymentSessionRequest } from "@app/shared/validators";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Helper function to check if a project name already exists in the S3 bucket (case-insensitive).
 * @param {string} projectName - Name of the project to check.
 * @returns {boolean} - True if the project name exists, otherwise false.
 */
async function projectNameExists(logger, s3, bucketName, projectName) {
    const lowerCaseProjectName = projectName.toLowerCase(); // Ensure case-insensitive comparison
    let exists = false; // Initialize the `exists` variable to avoid being undefined
    try {
        await s3.headObject({
            Bucket: bucketName,
            Key: `projects/${lowerCaseProjectName}/index.html`
        }).promise();

        exists = true; // Set `exists` to true because the object exists
        logger.info("S3 project file found", { projectName, exists });
        return true;
    } catch (error) {
        if (error.code === 'NotFound' || error.statusCode === 404) {
            exists = false; // Set `exists` to false because the object does not exist
            logger.info("S3 project file not found", { projectName, exists });
            return false;
        } else {
            // Some other error occurred (permissions, network, etc.)
            logger.error("S3 headObject error", { projectName, error });
            throw error;
        }
    }
}

/**
 * Normalize image paths to canonical /projects/<project>/images/<...> shape.
 * Leaves http(s) and data URLs untouched.
 * Handles temporary uploads (temp-uploads/) by mapping them to final project paths.
 */
function normalizeImagesForProject(images = {}, projectName) {
    const normalized = {};
    const tempImageMoves = {};

    for (const [k, v] of Object.entries(images || {})) {
        if (typeof v !== 'string') {
            normalized[k] = v;
            continue;
        }

        const lower = v.toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:')) {
            normalized[k] = v;
            continue;
        }

        // Handle temporary uploads from S3
        if (v.startsWith('temp-uploads/')) {
             // Format: temp-uploads/UUID-filename.ext
             // We want to extract the original filename.
             // The key structure is: temp-uploads/<36-char-uuid>-<original-filename>
             
             const parts = v.split('/');
             const filenameWithUuid = parts.length > 1 ? parts[1] : parts[0];
             
             // Extract filename: UUID is 36 chars + 1 hyphen = 37 chars prefix
             let filename = filenameWithUuid;
             if (filenameWithUuid.length > 37) {
                 filename = filenameWithUuid.substring(37);
             }
             
             // Ensure clean filename
             filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
             
             const finalKey = `projects/${projectName}/images/${filename}`;
             const finalPath = `/${finalKey}`; 
             
             normalized[k] = finalPath;
             tempImageMoves[v] = finalKey;
             continue;
        }

        if (v.startsWith('/projects/')) {
            normalized[k] = v;
            continue;
        }
        if (v.startsWith('projects/')) {
            normalized[k] = `/${v}`;
            continue;
        }

        // Clean relative prefixes and leading slashes
        let cleaned = v.replace(/^(?:\.\/|\.\.\/)+/, '').replace(/^\/+/, '');
        if (cleaned.startsWith('images/')) cleaned = cleaned.replace(/^images\//, '');
        if (!cleaned) {
            normalized[k] = v;
            continue;
        }

        normalized[k] = `/projects/${projectName}/images/${cleaned}`;
    }
    return { normalized, tempImageMoves };
}
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const SEND_EMAIL_FUNCTION = process.env.SEND_EMAIL_FUNCTION || "send-email";

// Keep S3 for backwards compatibility if needed
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "teamsantos-static-websites";

export { projectNameExists };

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
    // Check if the project name exists in S3
    let projectExists;
    try {
        projectExists = await projectNameExists(logger, s3, BUCKET_NAME, projectName);
    } catch (err) {
        logger.error("Error occurred during project name validation", { error: err.message });
        return {
            statusCode: 500,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Failed to validate project name" }),
        };
    }

    if (projectExists) {
        logger.warn('Project name already exists in S3', { projectName });
        return {
            statusCode: 409, // Conflict
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Project name already exists" }),
        };
    }

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

            // ✅ Normalize images and save metadata to DynamoDB
            const { normalized: normalizedImages, tempImageMoves } = normalizeImagesForProject(images || {}, projectName);
            
            await saveMetadata(logger, operationKey, {
                email,
                projectName,
                images: Object.keys(normalizedImages).length > 0 ? normalizedImages : (images || {}),
                tempImageMoves, // Save the moves mapping for generation step
                langs: cleanedLangs,
                textColors,
                sectionBackgrounds,
                templateId,
                createdAt: new Date().toISOString(),
                paymentSessionId: session.id,
                status: "pending",
            });

            // ✅ Send payment confirmation email (async, don't wait for it)
            // await sendPaymentConfirmationEmail(logger, email, projectName, priceId, operationKey).catch(err => {
            //     logger.warn('Failed to send payment confirmation email', { error: err.message, email });
            // });

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
