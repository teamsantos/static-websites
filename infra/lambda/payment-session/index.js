import AWS from "aws-sdk";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "teamsantos-static-websites";
const METADATA_KEY = "metadata.json";

export const handler = async (event) => {
    console.log(process.env.STRIPE_SECRET_KEY);
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

    const { email, name: projectName, html, priceId } = requestBody;

    if (!email || !projectName || !html || !priceId) {
        return {
            statusCode: 400,
            headers: corsHeaders(origin),
            body: JSON.stringify({ error: "Missing required fields: email, name, html, priceId" }),
        };
    }

    const operationKey = uuidv4();

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/success?operation_id=${operationKey}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel?operation_id=${operationKey}`,
        });

        // ✅ Save metadata to S3
        await saveMetadata(operationKey, {
            email,
            projectName,
            html,
            createdAt: new Date().toISOString(),
            paymentSessionId: session.id,
            status: "pending",
        });

        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify({
                sessionId: session.id,
                sessionUrl: session.url,
            }),
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
        // Try to fetch existing metadata.json
        let metadata = {};
        try {
            const existing = await s3.getObject({ Bucket: BUCKET_NAME, Key: METADATA_KEY }).promise();
            metadata = JSON.parse(existing.Body.toString("utf-8"));
        } catch (err) {
            if (err.code !== "NoSuchKey") {
                console.error("Error reading metadata.json:", err);
                throw err;
            }
        }

        // Add or update the new entry
        metadata[operationKey] = entry;

        // Upload updated JSON file
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: METADATA_KEY,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: "application/json",
        }).promise();

        console.log(`Stored metadata for operationKey: ${operationKey}`);
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

