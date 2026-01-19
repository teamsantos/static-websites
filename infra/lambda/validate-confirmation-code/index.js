import AWS from "aws-sdk";
import { createLogger, logMetric } from "./shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "./shared/sentry.js";
import { apiResponse, corsHeaders } from "./shared/auth.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const CODES_TABLE = process.env.DYNAMODB_CODES_TABLE;

export const handler = async (event, context) => {
    initSentry('validate-confirmation-code', context);
    const logger = createLogger('validate-confirmation-code', context);
    const origin = event.headers?.origin || event.headers?.Origin;

    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: "",
        };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const { templateId, code } = body;

        if (!templateId || !code) {
            return apiResponse(400, { error: "Missing templateId or code" }, origin);
        }

        logger.info('Validate confirmation code request', { templateId });

        // 1. Get code from DynamoDB
        const result = await dynamodb.get({
            TableName: CODES_TABLE,
            Key: {
                templateId: templateId
            }
        }).promise();

        if (!result.Item) {
            logger.warn('No active code found', { templateId });
            return apiResponse(400, { error: "Invalid or expired code" }, origin);
        }

        const storedCode = result.Item.code;
        const expiresAt = result.Item.expiresAt;
        const now = Math.floor(Date.now() / 1000);

        // 2. Validate code and expiration
        if (storedCode !== code) {
            logger.warn('Code mismatch', { templateId });
            return apiResponse(400, { error: "Invalid code" }, origin);
        }

        if (now > expiresAt) {
            logger.warn('Code expired', { templateId, expiresAt, now });
            return apiResponse(400, { error: "Code expired" }, origin);
        }

        logger.info('Code validated successfully', { templateId });

        // Optional: Delete code after successful use to prevent replay
        // For now we keep it until TTL, or we could delete it here.
        // Let's delete it to be safe.
        await dynamodb.delete({
            TableName: CODES_TABLE,
            Key: { templateId: templateId }
        }).promise();

        return apiResponse(200, { valid: true }, origin);

    } catch (error) {
        logger.error('Failed to validate confirmation code', {
            error: error.message,
            stack: error.stack
        });
        captureException(error);
        return apiResponse(500, { error: "Internal server error" }, origin);
    }
};
