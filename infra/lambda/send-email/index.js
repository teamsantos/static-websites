import {
    sendWelcomeEmail,
    sendPaymentConfirmationEmail,
    sendGenerationStartedEmail,
    sendGenerationCompleteEmail,
    sendGenerationFailedEmail,
    sendDeploymentCompleteEmail,
    sendConfirmationCodeEmail,
} from "@app/shared/emailService";
import { createLogger, logMetric } from "@app/shared/logger";
import { initSentry, captureException, addBreadcrumb } from "@app/shared/sentry";

/**
 * SendEmail Lambda Handler
 *
 * Processes email requests from other services.
 *
 * Supported email types:
 * - welcome
 * - payment-confirmation
 * - generation-started
 * - generation-complete
 * - generation-failed
 * - deployment-complete
 *
 * Request format:
 * {
 *   "type": "payment-confirmation",
 *   "email": "user@example.com",
 *   "data": { ... email-specific data ... }
 * }
 */
export const handler = async (event, context) => {
    initSentry('send-email', context);
    const logger = createLogger('send-email', context);

    try {
        let request;
        
        // Handle both direct invocation and SQS/SNS events
        if (event.Records) {
            // SQS or SNS event
            const record = event.Records[0];
            const body = record.body || record.Sns?.Message || "{}";
            request = typeof body === "string" ? JSON.parse(body) : body;
        } else {
            // Direct Lambda invocation
            request = event;
        }

        logger.info('Email request received', { type: request.type, email: request.email });

        const { type, email, data } = request;

        // Validate required fields
        if (!type || !email || !data) {
            logger.warn('Missing required fields', { type, email, hasData: !!data });
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing type, email, or data" }),
            };
        }

        // Dispatch to appropriate email handler
        let messageId;
        switch (type) {
            case "welcome":
                messageId = await logMetric(logger, "send_welcome_email", async () => {
                    return sendWelcomeEmail(email, data.userName || email);
                });
                break;

            case "payment-confirmation":
                messageId = await logMetric(logger, "send_payment_confirmation", async () => {
                    return sendPaymentConfirmationEmail(
                        email,
                        data.projectName,
                        data.planName,
                        data.price,
                        data.operationId
                    );
                });
                break;

            case "generation-started":
                messageId = await logMetric(logger, "send_generation_started", async () => {
                    return sendGenerationStartedEmail(
                        email,
                        data.projectName,
                        data.operationId
                    );
                });
                break;

            case "generation-complete":
                messageId = await logMetric(logger, "send_generation_complete", async () => {
                    return sendGenerationCompleteEmail(
                        email,
                        data.projectName,
                        data.deploymentUrl,
                        data.operationId
                    );
                });
                break;

            case "generation-failed":
                messageId = await logMetric(logger, "send_generation_failed", async () => {
                    return sendGenerationFailedEmail(
                        email,
                        data.projectName,
                        data.error,
                        data.operationId
                    );
                });
                break;

            case "deployment-complete":
                messageId = await logMetric(logger, "send_deployment_complete", async () => {
                    return sendDeploymentCompleteEmail(
                        email,
                        data.projectName,
                        data.deploymentUrl,
                        data.operationId
                    );
                });
                break;

            case "confirmation-code":
                messageId = await logMetric(logger, "send_confirmation_code", async () => {
                    return sendConfirmationCodeEmail(
                        email,
                        data.projectName,
                        data.code
                    );
                });
                break;

            default:
                logger.warn('Unknown email type', { type });
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Unknown email type: ${type}` }),
                };
        }

        logger.info('Email sent successfully', {
            type,
            email,
            messageId,
        });

        addBreadcrumb({
            category: 'email',
            message: `Email sent: ${type}`,
            level: 'info',
            data: { type, email, messageId }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Email sent successfully",
                type,
                email,
                messageId,
            }),
        };

    } catch (error) {
        logger.error('Failed to send email', {
            error: error.message,
            stack: error.stack,
        }, { severity: 'error' });

        captureException(error, {
            operation: 'send_email',
            type: event.type,
            email: event.email,
        });

        addBreadcrumb({
            category: 'error',
            message: 'Email sending failed',
            level: 'error',
            data: { error: error.message }
        });

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to send email" }),
        };
    }
};
