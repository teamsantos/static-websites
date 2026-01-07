import AWS from "aws-sdk";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { validatePaymentSessionRequest } from "../../shared/validators.js";
import { generateIdempotencyKey, withIdempotency } from "../../shared/idempotency.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const dynamodb = new AWS.DynamoDB.DocumentClient();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";

// Keep S3 for backwards compatibility if needed
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "teamsantos-static-websites";

export const handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
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
        return {
            statusCode: 403,
            headers: corsHeaders("*"),
            body: JSON.stringify({ message: "Forbidden" }),
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
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
        console.warn(`Validation failed: ${validation.error}`);
        return {
            statusCode: 400,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: validation.error }),
        };
    }

    // IDEMPOTENCY: Generate key from request to prevent duplicates
    const idempotencyKey = generateIdempotencyKey({
        method: "POST",
        path: "/checkout-session",
        userId: email,
        body: { email, projectName, priceId, templateId }
    });

    try {
        // Use idempotency wrapper: returns cached result if request was already processed
        const result = await withIdempotency(idempotencyKey, async () => {
            const operationKey = uuidv4();

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

            // ✅ Save metadata to DynamoDB
            await saveMetadata(operationKey, {
                email,
                projectName,
                images,
                langs,
                textColors,
                sectionBackgrounds,
                templateId, 
                createdAt: new Date().toISOString(),
                paymentSessionId: session.id,
                status: "pending",
            });

            return {
                sessionId: session.id,
                sessionUrl: session.url,
            };
        }, 24); // Cache for 24 hours

        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify(result),
        };
    } catch (error) {
        console.error("Stripe session creation failed:", error);
        return {
            statusCode: 500,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Failed to create Stripe session" }),
        };
    }
};

async function saveMetadata(operationKey, entry) {
    try {
        // Calculate TTL: 7 days from now (Unix timestamp)
        const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

        // Save to DynamoDB (atomic write)
        await dynamodb.put({
            TableName: METADATA_TABLE,
            Item: {
                operationId: operationKey,
                ...entry,
                expiresAt: ttl, // DynamoDB TTL for auto-cleanup
            }
        }).promise();

        console.log(`Metadata saved to DynamoDB for operationId: ${operationKey}`);
    } catch (error) {
        console.error("Failed to store metadata:", error);
        throw error;
    }
}

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
});

