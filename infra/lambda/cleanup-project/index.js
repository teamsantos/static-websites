import AWS from "aws-sdk";

const cloudformation = new AWS.CloudFormation({ region: "us-east-1" });
const s3 = new AWS.S3({ region: "eu-south-2" });

async function deleteStack(stackName) {
    console.log(`🗑️ Deleting CloudFormation stack: ${stackName}`);

    try {
        // Check if stack exists
        await cloudformation.describeStacks({ StackName: stackName }).promise();

        // Delete the stack
        await cloudformation.deleteStack({
            StackName: stackName,
            RetainResources: [] // Delete all resources
        }).promise();

        console.log(`✅ Initiated deletion of stack: ${stackName}`);

        // Wait for stack deletion to complete (with timeout)
        await waitForStackDeletion(stackName);

        return { success: true, stackName };
    } catch (error) {
        if (error.code === 'ValidationError' && error.message.includes('does not exist')) {
            console.log(`⚠️ Stack ${stackName} does not exist, skipping`);
            return { success: true, stackName, message: "Stack did not exist" };
        }
        console.error(`❌ Failed to delete stack ${stackName}:`, error);
        throw error;
    }
}

async function waitForStackDeletion(stackName, timeoutMs = 300000) { // 5 minutes timeout
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await cloudformation.describeStacks({ StackName: stackName }).promise();
            const status = response.Stacks[0].StackStatus;

            if (status === 'DELETE_COMPLETE') {
                console.log(`✅ Stack ${stackName} deleted successfully`);
                return;
            } else if (status.includes('DELETE_FAILED') || status.includes('DELETE_ROLLBACK')) {
                throw new Error(`Stack deletion failed with status: ${status}`);
            }

            console.log(`⏳ Stack ${stackName} status: ${status}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        } catch (error) {
            if (error.code === 'ValidationError' && error.message.includes('does not exist')) {
                console.log(`✅ Stack ${stackName} confirmed deleted`);
                return;
            }
            throw error;
        }
    }

    throw new Error(`Timeout waiting for stack ${stackName} deletion`);
}

async function cleanupS3Files(projectName) {
    console.log(`🧹 Cleaning up S3 files for project: ${projectName}`);

    try {
        const bucketName = 'teamsantos-static-websites';
        const prefix = `${projectName}/`;

        // List all objects with the project prefix
        const listResponse = await s3.listObjectsV2({
            Bucket: bucketName,
            Prefix: prefix
        }).promise();

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`ℹ️ No S3 files found for project: ${projectName}`);
            return;
        }

        // Delete all objects
        const deleteParams = {
            Bucket: bucketName,
            Delete: {
                Objects: listResponse.Contents.map(obj => ({ Key: obj.Key }))
            }
        };

        await s3.deleteObjects(deleteParams).promise();
        console.log(`✅ Deleted ${listResponse.Contents.length} S3 objects for project: ${projectName}`);

        // Continue deleting if there are more objects (pagination)
        let continuationToken = listResponse.NextContinuationToken;
        while (continuationToken) {
            const nextResponse = await s3.listObjectsV2({
                Bucket: bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken
            }).promise();

            if (nextResponse.Contents && nextResponse.Contents.length > 0) {
                const nextDeleteParams = {
                    Bucket: bucketName,
                    Delete: {
                        Objects: nextResponse.Contents.map(obj => ({ Key: obj.Key }))
                    }
                };
                await s3.deleteObjects(nextDeleteParams).promise();
                console.log(`✅ Deleted additional ${nextResponse.Contents.length} S3 objects for project: ${projectName}`);
            }

            continuationToken = nextResponse.NextContinuationToken;
        }

    } catch (error) {
        console.error(`❌ Failed to cleanup S3 files for ${projectName}:`, error);
        // Don't throw error for S3 cleanup failures - stack deletion is more important
    }
}

export const handler = async (event) => {
    console.log('🚀 Starting project cleanup process');
    console.log('Event:', JSON.stringify(event, null, 2));

    // Parse request body
    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
    }

    const { projects } = requestBody;

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
        const error = '❌ No projects specified for cleanup';
        console.error(error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error })
        };
    }

    const results = [];
    const errors = [];

    console.log(`📋 Processing cleanup for ${projects.length} project(s): ${projects.join(', ')}`);

    for (const project of projects) {
        try {
            console.log(`\n🔄 Starting cleanup for project: ${project}`);

            // Clean up S3 files first (optional, but good practice)
            await cleanupS3Files(project);

            // Delete the CloudFormation stack
            const stackResult = await deleteStack(`Site-${project}`);
            results.push(stackResult);

            console.log(`✅ Successfully completed cleanup for project: ${project}`);

        } catch (error) {
            const errorMsg = `Failed to cleanup project ${project}: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push({ project, error: error.message });
        }
    }

    const summary = {
        totalProjects: projects.length,
        successfulCleanups: results.length,
        failedCleanups: errors.length,
        results,
        errors
    };

    console.log('\n📊 Cleanup Summary:', JSON.stringify(summary, null, 2));

    if (errors.length > 0) {
        return {
            statusCode: 207, // Multi-status
            body: JSON.stringify({
                message: 'Cleanup completed with some failures',
                ...summary
            })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'All projects cleaned up successfully',
            ...summary
        })
    };
};