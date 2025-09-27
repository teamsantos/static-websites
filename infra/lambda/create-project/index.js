const { Octokit } = require("@octokit/rest");
const AWS = require("aws-sdk");

const ses = new AWS.SES({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    const { html, email, name: projectName } = JSON.parse(event.body);

    if (!html || !email || !projectName) {
        return {
            statusCode: 400,
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
        body: JSON.stringify({ url: `${projectName}.e-info.click` }),
    };
};