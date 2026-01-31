import AWS from "aws-sdk";
import { validateEmailToken, corsHeaders, apiResponse } from "@app/shared/auth";
import { createLogger, logMetric } from "@app/shared/logger";
import { initSentry, captureException, addBreadcrumb } from "@app/shared/sentry";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";

/**
 * DELETE /projects/{id}
 *
 * Delete a project/website and its associated metadata.
 *
 * Path Parameters:
 * - id: operationId (UUID)
 *
 * Query/Header/Body:
 * - email: user@example.com (required for authentication)
 *
 * Response:
 * ```json
 * {
 *   "message": "Project deleted successfully",
 *   "operationId": "uuid"
 * }
 * ```
 *
 * Security:
 * - Only the email that created the project can delete it
 * - Verifies ownership before deletion
 */
export const handler = async (event, context) => {
    initSentry('delete-project', context);
    const logger = createLogger('delete-project', context);
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
        // Extract operationId from path
        const operationId = event.pathParameters?.id;
        if (!operationId) {
            logger.warn('Missing operationId in path');
            return apiResponse(400, { error: "Missing operationId in path" }, origin);
        }

        logger.info('Delete project request', { operationId });

        // Validate email token
        const authResult = validateEmailToken(event);
        if (!authResult.valid) {
            logger.warn('Authentication failed', { error: authResult.error, operationId });
            addBreadcrumb({
                category: 'auth',
                message: 'Email token validation failed',
                level: 'warning',
                data: { error: authResult.error }
            });
            return apiResponse(401, { error: authResult.error }, origin);
        }

        const userEmail = authResult.email;

        // Fetch the project to verify ownership
        const projectResult = await logMetric(logger, 'get_project_for_deletion', async () => {
            return dynamodb.get({
                TableName: METADATA_TABLE,
                Key: { operationId },
            }).promise();
        });

        if (!projectResult.Item) {
            logger.warn('Project not found', { operationId, email: userEmail });
            addBreadcrumb({
                category: 'deletion',
                message: 'Project not found',
                level: 'warning',
                data: { operationId }
            });
            return apiResponse(404, { error: "Project not found" }, origin);
        }

        // Verify ownership: only the user who created the project can delete it
        if (projectResult.Item.email !== userEmail) {
            logger.warn('Unauthorized deletion attempt', {
                operationId,
                requestEmail: userEmail,
                ownerEmail: projectResult.Item.email,
            });
            addBreadcrumb({
                category: 'security',
                message: 'Unauthorized deletion attempt',
                level: 'warning',
                data: {
                    operationId,
                    requestEmail: userEmail,
                    ownerEmail: projectResult.Item.email,
                }
            });
            return apiResponse(403, { error: "Unauthorized: you can only delete your own projects" }, origin);
        }

        // Delete the project
        await logMetric(logger, 'delete_project', async () => {
            return dynamodb.delete({
                TableName: METADATA_TABLE,
                Key: { operationId },
            }).promise();
        });

        logger.info('Project deleted', {
            operationId,
            email: userEmail,
            projectName: projectResult.Item.projectName,
        });

        addBreadcrumb({
            category: 'deletion',
            message: 'Project deleted successfully',
            level: 'info',
            data: { operationId }
        });

        logger.http('DELETE', `/projects/${operationId}`, 200, 0, { email: userEmail });

        return apiResponse(200, {
            message: "Project deleted successfully",
            operationId,
        }, origin);

    } catch (error) {
        logger.error('Delete project failed', {
            error: error.message,
            stack: error.stack,
        }, { severity: 'error' });

        captureException(error, {
            operation: 'delete_project',
            operationId: event.pathParameters?.id,
        });

        addBreadcrumb({
            category: 'error',
            message: 'Delete project failed',
            level: 'error',
            data: { error: error.message }
        });

        return apiResponse(500, { error: "Failed to delete project" }, origin);
    }
};
