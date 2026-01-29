import AWS from "aws-sdk";
import { randomUUID } from "crypto";
import { apiResponse, corsHeaders } from "./shared/auth.js";
import { createLogger } from "./shared/logger.js";
import { captureException, initSentry } from "./shared/sentry.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const CODES_TABLE = process.env.DYNAMODB_CODES_TABLE;
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE;
const GENERATE_WEBSITE_FUNCTION = process.env.GENERATE_WEBSITE_FUNCTION || "generate-website";

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
        // templateId in the body is the Project Name (from the URL)
        const {
            templateId,
            code,
            sourceTemplateId, // Explicitly passed theme ID
            images,
            langs,
            textColors,
            sectionBackgrounds,
            icons,
            iconColors,
            iconStyles
        } = body;

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

        const storedCode = String(result.Item.code); // Ensure string
        const inputCode = String(code); // Ensure string
        const expiresAt = result.Item.expiresAt;
        const now = Math.floor(Date.now() / 1000);

        // 2. Validate code and expiration
        if (storedCode !== inputCode) {
            logger.warn('Code mismatch', { templateId });
            return apiResponse(400, { error: "Invalid code" }, origin);
        }

        if (now > expiresAt) {
            logger.warn('Code expired', { templateId, expiresAt, now });
            return apiResponse(400, { error: "Code expired" }, origin);
        }

        logger.info('Code validated successfully', { templateId });

        // 3. Trigger website regeneration
        // A. Fetch existing project metadata to get email
        let userEmail = "unknown@authenticated.user";
        // Default to the explicitly passed theme, or fallback
        let finalTemplateId = sourceTemplateId || "business";

        const metadataResult = await dynamodb.query({
            TableName: METADATA_TABLE,
            IndexName: "projectName-index",
            KeyConditionExpression: "projectName = :projectName",
            ExpressionAttributeValues: {
                ":projectName": templateId
            },
            Limit: 1,
            ScanIndexForward: false // Get the latest record (assuming sort key helps, or just best effort)
        }).promise();

        if (metadataResult.Items && metadataResult.Items.length > 0) {
            const projectData = metadataResult.Items[0];
            userEmail = projectData.email;

            // If we didn't get a sourceTemplateId from frontend, try to use the one from DB
            if (!sourceTemplateId && projectData.templateId) {
                finalTemplateId = projectData.templateId;
            }
        } else {
            logger.warn('Metadata not found for project, using defaults', { templateId });
        }

        // B. Create a new Operation Record in DynamoDB
        // This is required because generate-website expects an operationId to fetch data.
        const operationId = randomUUID();

        // Construct the update payload
        // We prioritize the new data from the request, falling back to existing data if needed.
        // Note: collectExportData from frontend returns 'templateId' as the source template ID.
        // But we overwrote 'templateId' in the body with 'projectName'. 
        // We should check if 'sourceTemplateId' or similar is passed, otherwise we rely on DB.

        const timestamp = new Date().toISOString();

        const metadataItem = {
            operationId: operationId,
            type: "update",
            status: "processing",
            projectName: templateId,
            email: userEmail,
            templateId: finalTemplateId,
            createdAt: timestamp,
            expiresAt: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL

            // The content to update
            images: images || {},
            langs: langs || {},
            textColors: textColors || {},
            sectionBackgrounds: sectionBackgrounds || {},
            icons: icons || {},
            iconColors: iconColors || {},
            iconStyles: iconStyles || {}
        };

        await dynamodb.put({
            TableName: METADATA_TABLE,
            Item: metadataItem
        }).promise();

        logger.info('Created update operation', { operationId, templateId });

        // C. Invoke generate-website with the operationId
        const params = {
            FunctionName: GENERATE_WEBSITE_FUNCTION,
            InvocationType: 'Event', // Async
            Payload: JSON.stringify({ operationId: operationId })
        };

        await lambda.invoke(params).promise();
        logger.info('Website generation triggered', { templateId, operationId });

        // 4. Delete code after successful use
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
