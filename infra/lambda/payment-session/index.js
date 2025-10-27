import { v4 as uuidv4 } from "uuid";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
                    quantity: 1
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/success?key=${operationKey}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel?key=${operationKey}`,
        });

        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: JSON.stringify({
                sessionId: session.id,
                sessionUrl: session.url
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

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
});

