import AWS from "aws-sdk";
import { Octokit } from "octokit";

const ses = new AWS.SES({ region: process.env.AWS_SES_REGION || "us-east-1" });
const secretsManager = new AWS.SecretsManager();

// Cache secrets to avoid fetching on every invocation
let cachedGithubToken = null;
let cachedGithubConfig = null;

async function getSecrets() {
    if (!cachedGithubToken || !cachedGithubConfig) {
        const [tokenSecret, configSecret] = await Promise.all([
            secretsManager.getSecretValue({ SecretId: process.env.GITHUB_TOKEN_SECRET_NAME }).promise(),
            secretsManager.getSecretValue({ SecretId: process.env.GITHUB_CONFIG_SECRET_NAME }).promise()
        ]);

        cachedGithubToken = tokenSecret.SecretString;
        cachedGithubConfig = JSON.parse(configSecret.SecretString);
    }

    return {
        githubToken: cachedGithubToken,
        githubOwner: cachedGithubConfig.owner,
        githubRepo: cachedGithubConfig.repo
    };
}

/**
 * Get the owner email for a project from the .email file in the repo
 */
async function getProjectOwnerEmail(projectName, octokit, owner, repo) {
    try {
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: `projects/${projectName}/.email`,
        });
        return Buffer.from(response.data.content, 'base64').toString('utf8').trim();
    } catch (error) {
        if (error.status === 404) {
            console.log(`No .email file found for project ${projectName}`);
            return null;
        }
        throw error;
    }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize input to prevent injection attacks
 */
function sanitizeInput(input, maxLength = 1000) {
    if (typeof input !== 'string') return '';
    return input
        .slice(0, maxLength)
        .replace(/[<>]/g, '') // Remove HTML brackets
        .trim();
}

/**
 * Generate HTML email for contact form submission
 */
function generateContactEmail(projectName, senderName, senderEmail, message) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        .sender-info { background: #e8e8e8; padding: 15px; border-radius: 4px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Contact Form Submission</h1>
            <p>from ${projectName}</p>
        </div>
        <div class="content">
            <p>You have received a new message through your website's contact form:</p>
            
            <div class="message-box">
                <p style="white-space: pre-wrap;">${message}</p>
            </div>
            
            <div class="sender-info">
                <p><strong>From:</strong> ${senderName}</p>
                <p><strong>Email:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a></p>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
                You can reply directly to this email to respond to ${senderName}.
            </p>
        </div>
        <div class="footer">
            <p>This message was sent via your website's contact form on ${projectName}.e-info.click</p>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Generate plain text version of the email
 */
function generatePlainTextEmail(projectName, senderName, senderEmail, message) {
    return `
New Contact Form Submission
============================
Website: ${projectName}.e-info.click

From: ${senderName}
Email: ${senderEmail}

Message:
--------
${message}

---
You can reply directly to this email to respond to ${senderName}.
`.trim();
}

export const handler = async (event) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };

    // Handle CORS preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
    }

    const { projectName, name, email, message } = requestBody;

    // Validate required fields
    if (!projectName || !name || !email || !message) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Missing required fields',
                required: ['projectName', 'name', 'email', 'message']
            }),
        };
    }

    // Validate email format
    if (!isValidEmail(email)) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid email format' }),
        };
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name, 100);
    const sanitizedEmail = sanitizeInput(email, 254);
    const sanitizedMessage = sanitizeInput(message, 5000);
    const sanitizedProjectName = sanitizeInput(projectName, 100).replace(/[^a-zA-Z0-9-_]/g, '');

    if (!sanitizedName || !sanitizedMessage || !sanitizedProjectName) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid input data' }),
        };
    }

    try {
        // Get GitHub secrets to fetch owner email
        const { githubToken, githubOwner, githubRepo } = await getSecrets();
        
        const octokit = new Octokit({
            auth: githubToken,
        });

        // Get the project owner's email
        const ownerEmail = await getProjectOwnerEmail(sanitizedProjectName, octokit, githubOwner, githubRepo);

        if (!ownerEmail) {
            console.error(`No owner email found for project: ${sanitizedProjectName}`);
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Project not found or no contact email configured' }),
            };
        }

        // Send email via SES
        const htmlBody = generateContactEmail(sanitizedProjectName, sanitizedName, sanitizedEmail, sanitizedMessage);
        const textBody = generatePlainTextEmail(sanitizedProjectName, sanitizedName, sanitizedEmail, sanitizedMessage);

        const params = {
            Source: process.env.FROM_EMAIL || 'noreply@e-info.click',
            Destination: {
                ToAddresses: [ownerEmail],
            },
            ReplyToAddresses: [sanitizedEmail],
            Message: {
                Subject: {
                    Data: `New message from ${sanitizedName} via ${sanitizedProjectName}.e-info.click`,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: htmlBody,
                        Charset: 'UTF-8',
                    },
                    Text: {
                        Data: textBody,
                        Charset: 'UTF-8',
                    },
                },
            },
        };

        await ses.sendEmail(params).promise();

        console.log(`Contact form email sent successfully for project ${sanitizedProjectName} to ${ownerEmail}`);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: true,
                message: 'Your message has been sent successfully!'
            }),
        };

    } catch (error) {
        console.error('Error sending contact form email:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Failed to send message. Please try again later.'
            }),
        };
    }
};
