/**
 * Email Token Authentication
 *
 * Validates that requests include the user's email in query parameters or headers.
 * This provides basic authentication for user-specific endpoints without full OAuth.
 *
 * Email tokens are validated via:
 * 1. Query parameter: ?email=user@example.com
 * 2. Header: X-User-Email: user@example.com
 * 3. Body: { "email": "user@example.com" }
 *
 * For security, in production should be upgraded to:
 * - JWT tokens signed with secret
 * - Time-limited tokens
 * - Rate limiting per email
 */

/**
 * Extract and validate user email from request
 * @param {object} event - API Gateway event
 * @returns {object} { valid: boolean, email: string, error: string }
 */
export const validateEmailToken = (event) => {
    // Check query parameters
    const queryEmail = event.queryStringParameters?.email;
    if (queryEmail) {
        if (isValidEmail(queryEmail)) {
            return { valid: true, email: queryEmail };
        }
        return { valid: false, email: null, error: 'Invalid email format in query parameter' };
    }

    // Check headers
    const headerEmail = event.headers?.['x-user-email'] || event.headers?.['X-User-Email'];
    if (headerEmail) {
        if (isValidEmail(headerEmail)) {
            return { valid: true, email: headerEmail };
        }
        return { valid: false, email: null, error: 'Invalid email format in header' };
    }

    // Check request body
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        if (body?.email) {
            if (isValidEmail(body.email)) {
                return { valid: true, email: body.email };
            }
            return { valid: false, email: null, error: 'Invalid email format in body' };
        }
    } catch (e) {
        // Body is not JSON, skip
    }

    return { valid: false, email: null, error: 'No email provided in query, header, or body' };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const isValidEmail = (email) => {
    if (typeof email !== 'string' || email.length === 0 || email.length > 254) {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Create standardized CORS headers for API responses
 * @param {string} origin - Request origin
 * @returns {object} CORS headers
 */
export const corsHeaders = (origin) => ({
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Email',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
});

/**
 * Create API response with consistent format
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @param {string} origin - CORS origin
 * @returns {object} API Gateway response
 */
export const apiResponse = (statusCode, body, origin = '*') => ({
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body),
});
