import AWS from "aws-sdk";
import { randomInt } from "crypto";
import { createLogger, logMetric } from "./shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "./shared/sentry.js";
import { apiResponse, corsHeaders } from "./shared/auth.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE;
const CODES_TABLE = process.env.DYNAMODB_CODES_TABLE;
const SEND_EMAIL_FUNCTION = process.env.SEND_EMAIL_FUNCTION;

export const handler = async (event, context) => {
    initSentry('send-confirmation-code', context);
    const logger = createLogger('send-confirmation-code', context);
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
        const { templateId } = body; // This is the projectName

        if (!templateId) {
            return apiResponse(400, { error: "Missing templateId" }, origin);
        }

        logger.info('Send confirmation code request', { templateId });

        // 1. Lookup project owner email
        const metadataResult = await dynamodb.query({
            TableName: METADATA_TABLE,
            IndexName: "projectName-index",
            KeyConditionExpression: "projectName = :projectName",
            ExpressionAttributeValues: {
                ":projectName": templateId
            },
            Limit: 1
        }).promise();

        if (!metadataResult.Items || metadataResult.Items.length === 0) {
            logger.warn('Project not found', { templateId });
            return apiResponse(404, { error: "Project not found" }, origin);
        }

        const project = metadataResult.Items[0];
        const email = project.email;

        // 2. Generate 6-digit code securely
        const code = randomInt(100000, 1000000).toString();
        const expiresAt = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes TTL

        // 3. Save code to DynamoDB
        await dynamodb.put({
            TableName: CODES_TABLE,
            Item: {
                templateId: templateId,
                code: code,
                expiresAt: expiresAt,
                createdAt: new Date().toISOString()
            }
        }).promise();

        logger.info('Confirmation code saved', { templateId, expiresAt });

        // 4. Send email (async)
        const params = {
            FunctionName: SEND_EMAIL_FUNCTION,
            InvocationType: 'Event',
            Payload: JSON.stringify({
                type: 'confirmation-code',
                email: email,
                data: {
                    projectName: templateId,
                    code: code
                }
            })
        };

        await lambda.invoke(params).promise();
        logger.info('Confirmation email queued', { email });

        return apiResponse(200, { message: "Confirmation code sent" }, origin);

    } catch (error) {
        logger.error('Failed to send confirmation code', {
            error: error.message,
            stack: error.stack
        });
        captureException(error);
        return apiResponse(500, { error: "Internal server error" }, origin);
    }
};
