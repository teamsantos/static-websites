/**
 * Email Service Module
 *
 * Handles sending transactional emails via AWS SES.
 * Uses pre-compiled HTML templates stored in S3 or inline.
 *
 * Email Types:
 * - welcome: Welcome email to new users
 * - payment-confirmation: Confirmation after successful payment
 * - generation-started: Website generation has started
 * - generation-complete: Website is ready to view
 * - generation-failed: Generation encountered an error
 * - deployment-complete: Website deployed to production
 */

import AWS from "aws-sdk";

const SES = new AWS.SES({ region: process.env.SES_REGION || "us-east-1" });

const SENDER_EMAIL = process.env.SENDER_EMAIL || "noreply@e-info.click";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://editor.e-info.click";

/**
 * Send transactional email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} textBody - Plain text fallback
 * @returns {Promise<string>} Message ID
 */
export const sendEmail = async (to, subject, htmlBody, textBody) => {
    try {
        const params = {
            Source: SENDER_EMAIL,
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: htmlBody,
                        Charset: "UTF-8",
                    },
                    Text: {
                        Data: textBody || stripHtml(htmlBody),
                        Charset: "UTF-8",
                    },
                },
            },
        };

        const result = await SES.sendEmail(params).promise();
        return result.MessageId;
    } catch (error) {
        console.error("Failed to send email:", error);
        throw error;
    }
};

/**
 * Send welcome email to new user
 */
export const sendWelcomeEmail = async (email, userName) => {
    const htmlBody = getWelcomeTemplate(email, userName);
    const textBody = `Welcome to E-Info! Get started at ${FRONTEND_URL}`;

    return sendEmail(
        email,
        "Welcome to E-Info - Create Your Website Today",
        htmlBody,
        textBody
    );
};

/**
 * Send payment confirmation email
 */
export const sendPaymentConfirmationEmail = async (
    email,
    projectName,
    planName,
    price,
    operationId
) => {
    const htmlBody = getPaymentConfirmationTemplate(
        email,
        projectName,
        planName,
        price,
        operationId
    );
    const textBody = `Payment confirmed for ${projectName}. Check status: ${FRONTEND_URL}`;

    return sendEmail(
        email,
        `Payment Confirmed - ${projectName}`,
        htmlBody,
        textBody
    );
};

/**
 * Send generation started notification
 */
export const sendGenerationStartedEmail = async (email, projectName, operationId) => {
    const htmlBody = getGenerationStartedTemplate(email, projectName, operationId);
    const textBody = `Website generation started for ${projectName}`;

    return sendEmail(
        email,
        `Generation Started - ${projectName}`,
        htmlBody,
        textBody
    );
};

/**
 * Send generation complete notification
 */
export const sendGenerationCompleteEmail = async (
    email,
    projectName,
    deploymentUrl,
    operationId
) => {
    const htmlBody = getGenerationCompleteTemplate(
        email,
        projectName,
        deploymentUrl,
        operationId
    );
    const textBody = `Your website is ready! View it at: ${deploymentUrl}`;

    return sendEmail(
        email,
        `Your Website is Ready - ${projectName}`,
        htmlBody,
        textBody
    );
};

/**
 * Send generation failed notification
 */
export const sendGenerationFailedEmail = async (email, projectName, error, operationId) => {
    const htmlBody = getGenerationFailedTemplate(email, projectName, error, operationId);
    const textBody = `Generation failed for ${projectName}. Error: ${error}`;

    return sendEmail(
        email,
        `Generation Failed - ${projectName}`,
        htmlBody,
        textBody
    );
};

/**
 * Send deployment complete notification
 */
export const sendDeploymentCompleteEmail = async (
    email,
    projectName,
    deploymentUrl,
    operationId
) => {
    const htmlBody = getDeploymentCompleteTemplate(
        email,
        projectName,
        deploymentUrl,
        operationId
    );
    const textBody = `Deployment complete! View your site: ${deploymentUrl}`;

    return sendEmail(
        email,
        `Deployment Complete - ${projectName}`,
        htmlBody,
        textBody
    );
};

/**
 * Send confirmation code email
 */
export const sendConfirmationCodeEmail = async (email, code) => {
    const htmlBody = getConfirmationCodeTemplate(code);
    const textBody = `Your verification code is: ${code}`;

    return sendEmail(
        email,
        "Your Verification Code - E-Info",
        htmlBody,
        textBody
    );
};

// ============================================================
// HTML Email Templates
// ============================================================

const getWelcomeTemplate = (email, userName) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to E-Info! 🚀</h1>
        </div>
        <div class="content">
            <p>Hi ${userName || email},</p>
            <p>Welcome to E-Info! We're excited to help you create a beautiful, responsive website in minutes.</p>
            <h3>Here's what you can do:</h3>
            <ul>
                <li>Choose from professional templates</li>
                <li>Customize colors, images, and content</li>
                <li>Deploy instantly with a single click</li>
                <li>Get a live website URL in seconds</li>
            </ul>
            <p>Ready to get started?</p>
            <a href="${FRONTEND_URL}" class="button">Create Your Website</a>
            <p>If you have any questions, we're here to help!</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
            <p><a href="${FRONTEND_URL}">Visit our site</a></p>
        </div>
    </div>
</body>
</html>
`;

const getPaymentConfirmationTemplate = (email, projectName, planName, price, operationId) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .details { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Payment Confirmed</h1>
        </div>
        <div class="content">
            <p>Thank you for your purchase!</p>
            <div class="details">
                <p><strong>Project:</strong> ${projectName}</p>
                <p><strong>Plan:</strong> ${planName}</p>
                <p><strong>Amount:</strong> ${price}</p>
                <p><strong>Order ID:</strong> ${operationId}</p>
            </div>
            <p>Your website is now being generated. This usually takes 2-5 minutes.</p>
            <p>We'll notify you when it's ready!</p>
            <a href="${FRONTEND_URL}" class="button">Check Status</a>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const getGenerationStartedTemplate = (email, projectName, operationId) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .status { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚙️ Generation Started</h1>
        </div>
        <div class="content">
            <p>Your website generation has started!</p>
            <div class="status">
                <strong>Project:</strong> ${projectName}<br>
                <strong>Status:</strong> Generating...
            </div>
            <p>This usually takes 2-5 minutes. You can check the status anytime:</p>
            <a href="${FRONTEND_URL}" class="button">Check Status</a>
            <p>We'll send you another email when it's complete!</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const getGenerationCompleteTemplate = (email, projectName, deploymentUrl, operationId) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .success { background: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #28a745; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Your Website is Ready!</h1>
        </div>
        <div class="content">
            <div class="success">
                <strong>Project:</strong> ${projectName}<br>
                <strong>Status:</strong> ✓ Complete
            </div>
            <p>Congratulations! Your website has been generated and is ready to view.</p>
            <p>View your website here:</p>
            <a href="${deploymentUrl}" class="button">View Website</a>
            <p>Your website will be live on this URL. Share it with others!</p>
            <p>Need to make changes? Visit the editor to customize further.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const getGenerationFailedTemplate = (email, projectName, error, operationId) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .error { background: #f8d7da; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #dc3545; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✗ Generation Failed</h1>
        </div>
        <div class="content">
            <p>We encountered an issue generating your website.</p>
            <div class="error">
                <strong>Project:</strong> ${projectName}<br>
                <strong>Error:</strong> ${error}
            </div>
            <p>Don't worry! You can try again or contact support for help.</p>
            <a href="${FRONTEND_URL}" class="button">Try Again</a>
            <p>If this continues to happen, please reach out to our support team.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const getDeploymentCompleteTemplate = (email, projectName, deploymentUrl, operationId) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .success { background: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #28a745; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Deployment Complete</h1>
        </div>
        <div class="content">
            <div class="success">
                <strong>Project:</strong> ${projectName}<br>
                <strong>Status:</strong> ✓ Live
            </div>
            <p>Your website is now live and accessible to everyone!</p>
            <a href="${deploymentUrl}" class="button">Visit Your Website</a>
            <p><strong>Website URL:</strong></p>
            <p><code>${deploymentUrl}</code></p>
            <p>Share this URL with others to show them your new website.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const getConfirmationCodeTemplate = (code) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .code-box { background: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; font-family: monospace; }
        .footer { background: #e0e0e0; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Verification Code</h1>
        </div>
        <div class="content">
            <p>Please use the following code to complete your verification:</p>
            <div class="code-box">
                <div class="code">${code}</div>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this code, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 E-Info. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

/**
 * Strip HTML tags from string
 */
const stripHtml = (html) => {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
};
