import AWS from "aws-sdk";
import crypto from "crypto";

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
export const handler = async (event) => {
    try {
        // Verify GitHub webhook signature
        const signature = event.headers['x-hub-signature-256'];
        
        if (!signature) {
            console.warn('Missing GitHub signature header');
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
            console.warn('GitHub webhook signature verification failed');
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
            console.error('Failed to parse webhook payload:', error);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid JSON payload' }),
            };
        }

        console.log(`GitHub webhook event: ${payload.action || 'unknown'}, ref: ${payload.ref || 'unknown'}`);

        // Only process push events to master branch
        if (payload.ref === 'refs/heads/master' && payload.pusher) {
            // Extract project name from the commit message or repository
            const projectName = extractProjectNameFromCommit(payload);
            
            if (projectName) {
                // Find operationId by project name
                const operationId = await findOperationIdByProjectName(projectName);
                
                if (operationId) {
                    // Update status to "deployed"
                    await updateDeploymentStatus(operationId, payload.after, payload.pusher.email);
                    console.log(`Marked operationId ${operationId} as deployed for project: ${projectName}`);
                } else {
                    console.warn(`No operationId found for project: ${projectName}`);
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, received: true }),
        };
    } catch (error) {
        console.error('Error processing GitHub webhook:', error);
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
 * @param {string} projectName - Name of the project
 * @returns {Promise<string|null>} - operationId if found
 */
async function findOperationIdByProjectName(projectName) {
    try {
        // Query by project name (requires projectName attribute in table)
        // For now, we query by status=completed and filter by projectName
        const result = await dynamodb.query({
            TableName: METADATA_TABLE,
            IndexName: "status-createdAt-index",
            KeyConditionExpression: "#status = :status",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": "completed"
            },
            FilterExpression: "projectName = :projectName",
            ExpressionAttributeValues: {
                ":projectName": projectName
            },
            Limit: 1,
            ScanIndexForward: false, // Get most recent first
        }).promise();

        if (result.Items && result.Items.length > 0) {
            return result.Items[0].operationId;
        }

        console.warn(`No operationId found for projectName: ${projectName}`);
        return null;
    } catch (error) {
        console.error("Error finding operationId by projectName:", error);
        throw error;
    }
}

/**
 * Update deployment status for an operation
 * @param {string} operationId - UUID of the operation
 * @param {string} commitSha - Git commit SHA
 * @param {string} email - Pusher email
 */
async function updateDeploymentStatus(operationId, commitSha, email) {
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

        await dynamodb.update(updateParams).promise();
        console.log(`Updated operationId: ${operationId} to deployed status`);
    } catch (error) {
        console.error("Error updating deployment status:", error);
        throw error;
    }
}
