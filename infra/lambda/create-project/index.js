const { Octokit } = require("@octokit/rest");
const AWS = require("aws-sdk");

const ses = new AWS.SES({ region: process.env.AWS_SES_REGION });

exports.handler = async (event) => {
    // Handle CORS preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: '',
        };
    }

    // Check origin for security - allow specific origins
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigins = [
        'https://editor.e-info.click',
        'https://ssh.e-info.click',
        'http://89.152.33.66',
        'https://89.152.33.66'
    ];

    const isAllowedOrigin = !origin || allowedOrigins.some(allowed =>
        origin === allowed || origin.startsWith(allowed)
    );

    if (!isAllowedOrigin) {
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

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
    }

    const { html, email, name: projectName } = requestBody;

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
