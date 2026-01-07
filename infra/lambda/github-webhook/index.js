import AWS from "aws-sdk";
import crypto from "crypto";
import { createLogger, logMetric } from "../../shared/logger.js";
import { initSentry, captureException, addBreadcrumb } from "../../shared/sentry.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

/**
 * GitHub Webhook Handler
 *
 * Listens for GitHub push events and tracks successful deployments
 * Updates metadata status to "deployed" when code is pushed to master
 *
 * Security: Verifies webhook signature (HMAC-SHA256) to prevent spoofed events
 */
export const handler = async (event, context) => {
    initSentry('github-webhook', context);
    const logger = createLogger('github-webhook', context);
    
    try {
        // Verify GitHub webhook signature
        const signature = event.headers['x-hub-signature-256'];
        
        if (!signature) {
            logger.warn('Missing GitHub signature header');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing GitHub signature' }),
            };
        }

        const body = event.body;
        
        // Verify signature: HMAC-SHA256
        const computed = "sha256=" + crypto
            .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
            .update(body)
            .digest("hex");

        if (!crypto.timingSafeEqual(signature, computed)) {
            logger.error('GitHub webhook signature verification failed', {}, { severity: 'security' });
            
            captureException(new Error('GitHub webhook signature verification failed'), {
                operation: 'webhook_signature_verification'
            }, {
                level: 'warning',
                tags: { webhook_type: 'github' }
            });

            addBreadcrumb({
                category: 'github_webhook',
                message: 'Signature verification failed',
                level: 'error'
            });

            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Signature verification failed' }),
            };
        }

        // Parse webhook payload
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (error) {
            logger.error('Failed to parse webhook payload', { error: error.message });
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid JSON payload' }),
            };
        }

        logger.info('GitHub webhook event received', { action: payload.action, ref: payload.ref });

        // Only process push events to master branch
        if (payload.ref === 'refs/heads/master' && payload.pusher) {
            // Extract project name from the commit message or repository
            const projectName = extractProjectNameFromCommit(payload);
            
            if (projectName) {
                logger.debug('Extracted project name from commit', { projectName });
                
                // Find operationId by project name
                const operationId = await findOperationIdByProjectName(logger, projectName);
                
                if (operationId) {
                    // Update status to "deployed"
                    await updateDeploymentStatus(logger, operationId, payload.after, payload.pusher.email);
                } else {
                    logger.warn('No operationId found for project', { projectName });
                }
            } else {
                logger.debug('Could not extract project name from commit');
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, received: true }),
        };
    } catch (error) {
        logger.error('Error processing GitHub webhook', { error: error.message, stack: error.stack }, { severity: 'error' });
        
        captureException(error, {
            operation: 'process_github_webhook'
        });

        addBreadcrumb({
            category: 'error',
            message: 'Error processing webhook',
            level: 'error',
            data: { error: error.message }
        });

        // Return 200 to prevent GitHub retries on unexpected errors
        return {
            statusCode: 200,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};

/**
 * Extract project name from git commit message
 * Looks for patterns like "Add projectname project" or "Update projectname project"
 * @param {object} payload - GitHub webhook payload
 * @returns {string|null} - Project name if found
 */
function extractProjectNameFromCommit(payload) {
    if (!payload.head_commit) {
        return null;
    }

    const message = payload.head_commit.message || "";
    
    // Pattern: "Add/Update {projectname} project"
    const match = message.match(/(?:Add|Update)\s+([a-z0-9-]+)\s+project/i);
    if (match) {
        return match[1].toLowerCase();
    }

    // Pattern: "projects/{projectname}"
    const pathMatch = message.match(/projects\/([a-z0-9-]+)/);
    if (pathMatch) {
        return pathMatch[1].toLowerCase();
    }

    return null;
}

/**
 * Find operationId by project name
 * @param {object} logger - Logger instance
 * @param {string} projectName - Name of the project
 * @returns {Promise<string|null>} - operationId if found
 */
async function findOperationIdByProjectName(logger, projectName) {
    try {
        // Query by project name (requires projectName attribute in table)
        // For now, we query by status=completed and filter by projectName
        const result = await logMetric(logger, 'query_operationid_by_projectname', async () => {
            return dynamodb.query({
                TableName: METADATA_TABLE,
                IndexName: "status-createdAt-index",
                KeyConditionExpression: "#status = :status",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":status": "completed",
                    ":projectName": projectName
                },
                FilterExpression: "projectName = :projectName",
                Limit: 1,
                ScanIndexForward: false, // Get most recent first
            }).promise();
        });

        if (result.Items && result.Items.length > 0) {
            logger.cache('operationId_by_projectname', true, { projectName });
            return result.Items[0].operationId;
        }

        logger.cache('operationId_by_projectname', false, { projectName });
        return null;
    } catch (error) {
        logger.error("Error finding operationId by projectName", { error: error.message, projectName, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}

/**
 * Update deployment status for an operation
 * @param {object} logger - Logger instance
 * @param {string} operationId - UUID of the operation
 * @param {string} commitSha - Git commit SHA
 * @param {string} email - Pusher email
 */
async function updateDeploymentStatus(logger, operationId, commitSha, email) {
    try {
        const updateParams = {
            TableName: METADATA_TABLE,
            Key: { operationId },
            UpdateExpression: "SET #status = :status, deployedAt = :deployedAt, deploymentCommitSha = :deploymentCommitSha, deployedByEmail = :deployedByEmail",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": "deployed",
                ":deployedAt": new Date().toISOString(),
                ":deploymentCommitSha": commitSha,
                ":deployedByEmail": email
            }
        };

        await logMetric(logger, 'update_deployment_status', async () => {
            return dynamodb.update(updateParams).promise();
        });

        logger.info('Updated deployment status', { operationId, commitSha, deployedByEmail: email });
    } catch (error) {
        logger.error("Error updating deployment status", { error: error.message, operationId, stack: error.stack }, { severity: 'error' });
        throw error;
    }
}
