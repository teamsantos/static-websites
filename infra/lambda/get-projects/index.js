import AWS from "aws-sdk";
import { validateEmailToken, corsHeaders, apiResponse } from "./shared/auth.js";
import { createLogger, logMetric } from "./shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "./shared/sentry.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";

/**
 * GET /projects
 *
 * Retrieve all projects/websites created by a user.
 *
 * Query Parameters:
 * - email: user@example.com (required)
 *
 * Headers:
 * - X-User-Email: user@example.com (alternative to query param)
 *
 * Response:
 * ```json
 * {
 *   "projects": [
 *     {
 *       "operationId": "uuid",
 *       "projectName": "My Website",
 *       "email": "user@example.com",
 *       "status": "completed|pending|failed",
 *       "createdAt": "2025-01-07T12:00:00Z",
 *       "templateId": "template-1",
 *       "deploymentUrl": "https://...",
 *       "deploymentStatus": "deployed|pending"
 *     }
 *   ]
 * }
 * ```
 */
export const handler = async (event, context) => {
    initSentry('get-projects', context);
    const logger = createLogger('get-projects', context);
    const origin = event.headers?.origin || event.headers?.Origin;

    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        logger.debug('CORS preflight request', { method: event.httpMethod });
        return {
            statusCode: 200,
            headers: corsHeaders(origin),
            body: "",
        };
    }

    try {
        // Validate email token
        const authResult = validateEmailToken(event);
        if (!authResult.valid) {
            logger.warn('Authentication failed', { error: authResult.error });
            addBreadcrumb({
                category: 'auth',
                message: 'Email token validation failed',
                level: 'warning',
                data: { error: authResult.error }
            });
            return apiResponse(401, { error: authResult.error }, origin);
        }

        const userEmail = authResult.email;
        logger.info('Get projects request', { email: userEmail });

        // Query DynamoDB using GSI: email-createdAt-index
        const result = await logMetric(logger, 'query_user_projects', async () => {
            return dynamodb.query({
                TableName: METADATA_TABLE,
                IndexName: "email-createdAt-index",
                KeyConditionExpression: "email = :email",
                ExpressionAttributeValues: {
                    ":email": userEmail,
                },
                // Sort by createdAt descending (most recent first)
                ScanIndexForward: false,
            }).promise();
        });

        // Transform items for response
        const projects = result.Items.map(item => ({
            operationId: item.operationId,
            projectName: item.projectName,
            email: item.email,
            status: item.status,
            createdAt: item.createdAt,
            templateId: item.templateId,
            deploymentUrl: item.deploymentUrl,
            deploymentStatus: item.deploymentStatus || 'pending',
            // Omit sensitive fields
        }));

        logger.info('Projects retrieved', {
            email: userEmail,
            projectCount: projects.length,
        });

        addBreadcrumb({
            category: 'query',
            message: 'User projects retrieved',
            level: 'info',
            data: { projectCount: projects.length }
        });

        logger.http('GET', '/projects', 200, result.Items.length, { email: userEmail });

        return apiResponse(200, {
            projects,
            count: projects.length,
        }, origin);

    } catch (error) {
        logger.error('Get projects failed', {
            error: error.message,
            stack: error.stack,
        }, { severity: 'error' });

        captureException(error, {
            operation: 'get_projects',
        });

        addBreadcrumb({
            category: 'error',
            message: 'Get projects failed',
            level: 'error',
            data: { error: error.message }
        });

        return apiResponse(500, { error: "Failed to retrieve projects" }, origin);
    }
};
