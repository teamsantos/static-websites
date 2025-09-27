const { Octokit } = require("@octokit/rest");
const AWS = require("aws-sdk");

const ses = new AWS.SES({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));

    // Handle CORS preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
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

    // Check origin for security - only restrict in production
    const stage = event.requestContext?.stage || 'prod';
    const origin = event.headers?.origin || event.headers?.Origin;
    const allowedOrigin = 'https://editor.e-info.click';

    console.log(`Stage: ${stage}, Origin: ${origin}, Allowed origin: ${allowedOrigin}`);

    // In production, only allow requests from the editor
    // In test/dev stages, allow all origins
    const isProduction = stage === 'prod';
    const isTestEnvironment = stage === 'test' || stage === 'dev' || !event.requestContext?.stage;

    console.log(`Is production: ${isProduction}, Is test environment: ${isTestEnvironment}`);

    if (isProduction && origin && !origin.startsWith(allowedOrigin)) {
        console.log('Forbidden: Origin not allowed in production');
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
        console.log('Parsed request body successfully');
    } catch (error) {
        console.error('Failed to parse request body:', error);
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

    console.log(`Request data - HTML length: ${html?.length}, Email: ${email}, Project name: ${projectName}`);

    if (!html || !email || !projectName) {
        console.log('Missing required fields');
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

    console.log('Initializing GitHub client');
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    console.log(`GitHub config - Owner: ${owner}, Repo: ${repo}`);

    try {
        console.log(`Checking if project ${projectName} already exists`);
        // Check if project exists
        const path = `projects/${projectName}`;
        await octokit.repos.getContent({
            owner,
            repo,
            path,
        });

        console.log('Project already exists');
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
            console.error('Error checking project existence:', error);
            throw error;
        }
        console.log('Project does not exist, proceeding with creation');
        // 404 means not exists, proceed
    }

    console.log('Creating project files on GitHub');
    // Create index.html
    console.log('Creating index.html file');
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/index.html`,
        message: `Add ${projectName} project`,
        content: Buffer.from(html).toString('base64'),
    });
    console.log('index.html created successfully');

    // Create .email file
    console.log('Creating .email file');
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/.email`,
        message: `Add email for ${projectName}`,
        content: Buffer.from(email).toString('base64'),
    });
    console.log('.email file created successfully');

    console.log('Sending confirmation email');
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

    console.log(`Sending email from ${process.env.FROM_EMAIL} to ${email}`);
    await ses.sendEmail(params).promise();
    console.log('Email sent successfully');

    console.log('Project creation completed successfully');
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