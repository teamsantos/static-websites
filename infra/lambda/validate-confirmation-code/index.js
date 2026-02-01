import AWS from "aws-sdk";
import crypto from 'crypto';
import { apiResponse, corsHeaders } from "@app/shared/auth";
import { createLogger } from "@app/shared/logger";
import { captureException, initSentry } from "@app/shared/sentry";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const secretsManager = new AWS.SecretsManager();

const CODES_TABLE = process.env.DYNAMODB_CODES_TABLE;
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE;
const GENERATE_WEBSITE_FUNCTION = process.env.GENERATE_WEBSITE_FUNCTION || "generate-website";
let cachedHmacSecret = null;

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
            sourceTemplateId,
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

        const storedCode = String(result.Item.code);
        const inputCode = String(code);
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

        let userEmail;
        let finalTemplateId = sourceTemplateId;

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
        const operationId = crypto.randomUUID();

        // Compute HMAC signature over operationId so the downstream lambda can
        // verify that the operation was created by this function.
        let hmacSecret = cachedHmacSecret;
        try {
            if (!hmacSecret) {
                // Fall back to the conventional secret name if the env var isn't set.
                const secretName = process.env.HMAC_SECRET_NAME || 'hmac-secret';
                if (!process.env.HMAC_SECRET_NAME) {
                    logger.warn('HMAC_SECRET_NAME env var not set, falling back to default secret name', { fallback: secretName });
                }
                const secretResp = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
                hmacSecret = secretResp.SecretString;
                cachedHmacSecret = hmacSecret;
            }
        } catch (err) {
            logger.error('Failed to load HMAC secret from Secrets Manager', { error: err.message });
            throw err;
        }

        const signature = crypto.createHmac('sha256', hmacSecret).update(operationId).digest('hex');

        // Construct the update payload
        const timestamp = new Date().toISOString();

        const metadataItem = {
            operationId: operationId,
            type: "update",
            // Indicate the origin of this operation so downstream lambdas can
            // decide behavior based on the caller.
            source: "validate-confirmation-code",
            // HMAC signature proving the origin
            signature,
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
            InvocationType: 'Event',
            Payload: JSON.stringify({ operationId: operationId })
        };

        await lambda.invoke(params).promise();
        logger.info(`${GENERATE_WEBSITE_FUNCTION} triggered`, { templateId, operationId });

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
