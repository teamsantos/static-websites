const { Octokit } = require("@octokit/rest");
const AWS = require("aws-sdk");

const ses = new AWS.SES({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    // Check origin for security - only restrict in production
    const stage = event.requestContext?.stage || 'prod';
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigin = 'https://editor.e-info.click';

    // In production, only allow requests from the editor
    // In test/dev stages, allow all origins
    if (stage === 'prod' && origin && !origin.startsWith(allowedOrigin)) {
        return {
            statusCode: 403,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ message: 'Forbidden' }),
        };
    }

    const { html, email, name: projectName } = JSON.parse(event.body);

    if (!html || !email || !projectName) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Missing required fields: html, email, name' }),
        };
    }

    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    try {
        // Check if project exists
        const path = `projects/${projectName}`;
        await octokit.repos.getContent({
            owner,
            repo,
            path,
        });

        // If no error, project exists
        return {
            statusCode: 409,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Project already exists' }),
        };
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
        // 404 means not exists, proceed
    }

    // Create index.html
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/index.html`,
        message: `Add ${projectName} project`,
        content: Buffer.from(html).toString('base64'),
    });

    // Create .email file
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/.email`,
        message: `Add email for ${projectName}`,
        content: Buffer.from(email).toString('base64'),
    });

    // Send email
    const params = {
        Source: process.env.FROM_EMAIL,
        Destination: {
            ToAddresses: [email],
        },
        Message: {
            Subject: {
                Data: 'Your website is ready',
            },
            Body: {
                Text: {
                    Data: `Your website can be accessed via ${projectName}.e-info.click`,
                },
            },
        },
    };

    await ses.sendEmail(params).promise();

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ url: `${projectName}.e-info.click` }),
    };
};