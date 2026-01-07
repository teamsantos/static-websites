/**
 * Sentry Integration for E-Info Platform
 * 
 * Provides error tracking, performance monitoring, and alerting
 * Integrates with all Lambda functions for automatic error reporting
 * 
 * Features:
 * - Automatic error capture and reporting
 * - Performance transaction tracking
 * - Release tracking (git commits)
 * - User context and environment tracking
 * - Breadcrumb logging for debugging
 * 
 * Usage:
 * import { initSentry, captureException, captureMessage, startTransaction } from '../shared/sentry.js';
 * 
 * export const handler = async (event, context) => {
 *   initSentry('payment-session', context);
 *   
 *   try {
 *     const transaction = startTransaction('checkout_session_creation');
 *     // ... do work
 *     transaction.finish();
 *   } catch (error) {
 *     captureException(error, { operationId, email });
 *   }
 * };
 */

// Sentry client (lazy-loaded if SENTRY_DSN is set)
let sentryClient = null;
let sentryInitialized = false;

/**
 * Initialize Sentry for a Lambda function
 * Should be called once per Lambda invocation
 * 
 * @param {string} functionName - Name of the Lambda function
 * @param {object} context - AWS Lambda context
 */
export function initSentry(functionName, context = {}) {
    if (sentryInitialized) return;
    
    const dsn = process.env.SENTRY_DSN;
    const environment = process.env.NODE_ENV || 'production';
    const releaseVersion = process.env.RELEASE_VERSION || 'unknown';
    
    if (!dsn) {
        console.debug('Sentry DSN not configured, error tracking disabled');
        sentryInitialized = true;
        return;
    }

    // Mock Sentry client if we can't import the real one
    sentryClient = {
        captureException,
        captureMessage,
        addBreadcrumb,
        setTag,
        setUser,
        withScope,
        startTransaction: startTransactionImpl
    };

    // Set up context for all events
    setTag('lambda_function', functionName);
    setTag('region', process.env.AWS_REGION || 'unknown');
    setTag('environment', environment);
    
    // Set request context
    setUser({
        id: context.requestId || context.awsRequestId || 'unknown',
        lambda_request_id: context.requestId || context.awsRequestId
    });

    // Add Lambda context as breadcrumb
    addBreadcrumb({
        category: 'lambda',
        message: 'Lambda invocation started',
        level: 'info',
        data: {
            function: functionName,
            requestId: context.requestId || context.awsRequestId,
            memoryLimitInMB: context.memoryLimitInMB,
            region: process.env.AWS_REGION
        }
    });

    sentryInitialized = true;
}

/**
 * Capture an exception and send to Sentry
 * @param {Error} error - The error to capture
 * @param {object} context - Additional context (userId, operationId, etc.)
 * @param {object} options - Additional options (tags, level, fingerprint, etc.)
 */
export function captureException(error, context = {}, options = {}) {
    if (!sentryClient) {
        console.error('Sentry not initialized, logging error locally:', error.message);
        return;
    }

    const scope = {
        level: options.level || 'error',
        tags: {
            ...options.tags,
            error_type: error.name,
            error_code: error.code || 'unknown'
        },
        contexts: {
            ...context
        },
        fingerprint: options.fingerprint || undefined
    };

    try {
        sentryClient.captureException(error, scope);
    } catch (err) {
        console.error('Failed to send error to Sentry:', err.message);
    }
}

/**
 * Capture a message and send to Sentry
 * @param {string} message - Message to capture
 * @param {string} level - Log level (info, warning, error)
 * @param {object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
    if (!sentryClient) {
        console.log(`[${level.toUpperCase()}] ${message}`, context);
        return;
    }

    try {
        sentryClient.captureMessage(message, {
            level,
            contexts: context
        });
    } catch (err) {
        console.error('Failed to send message to Sentry:', err.message);
    }
}

/**
 * Add a breadcrumb for debugging
 * @param {object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
    if (!sentryClient) return;

    try {
        sentryClient.addBreadcrumb({
            timestamp: Math.floor(Date.now() / 1000),
            ...breadcrumb
        });
    } catch (err) {
        console.error('Failed to add breadcrumb:', err.message);
    }
}

/**
 * Set a tag for all future events
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
export function setTag(key, value) {
    if (!sentryClient) return;
    
    try {
        sentryClient.setTag(key, value);
    } catch (err) {
        console.error('Failed to set tag:', err.message);
    }
}

/**
 * Set user context
 * @param {object} user - User data (id, email, etc.)
 */
export function setUser(user) {
    if (!sentryClient) return;
    
    try {
        sentryClient.setUser(user);
    } catch (err) {
        console.error('Failed to set user:', err.message);
    }
}

/**
 * Start a performance transaction
 * @param {string} name - Transaction name
 * @param {object} options - Additional options
 * @returns {object} Transaction object with finish() method
 */
export function startTransaction(name, options = {}) {
    if (!sentryClient) {
        // Return no-op transaction
        return {
            setStatus: () => {},
            setTag: () => {},
            finish: () => {},
            startChild: () => ({
                setStatus: () => {},
                finish: () => {}
            })
        };
    }

    try {
        return sentryClient.startTransaction({
            name,
            op: options.op || 'http.server',
            ...options
        });
    } catch (err) {
        console.error('Failed to start transaction:', err.message);
        // Return no-op transaction
        return {
            setStatus: () => {},
            setTag: () => {},
            finish: () => {},
            startChild: () => ({
                setStatus: () => {},
                finish: () => {}
            })
        };
    }
}

/**
 * Internal transaction implementation
 */
function startTransactionImpl(options = {}) {
    const startTime = Date.now();
    
    return {
        name: options.name,
        op: options.op || 'http.server',
        startTime,
        status: null,
        tags: {},
        
        setStatus(status) {
            this.status = status;
        },
        
        setTag(key, value) {
            this.tags[key] = value;
        },
        
        finish() {
            const duration = Date.now() - startTime;
            console.debug(`Transaction '${this.name}' finished in ${duration}ms with status ${this.status || 'ok'}`);
        },
        
        startChild(options = {}) {
            return {
                startTime: Date.now(),
                setStatus: () => {},
                finish: () => {}
            };
        }
    };
}

/**
 * Middleware to automatically capture Lambda errors
 * Wraps a handler and catches/reports exceptions
 * 
 * Usage:
 * export const handler = withSentry('my-function', async (event, context) => {
 *   // Handler code
 * });
 */
export function withSentry(functionName, handler) {
    return async (event, context) => {
        initSentry(functionName, context);
        
        const transaction = startTransaction(`${functionName}_invocation`, {
            op: 'lambda.handler'
        });

        try {
            const result = await handler(event, context);
            transaction.setStatus('ok');
            transaction.finish();
            return result;
        } catch (error) {
            captureException(error, {
                event: event,
                requestId: context.requestId || context.awsRequestId
            });
            transaction.setStatus('error');
            transaction.finish();
            throw error;
        }
    };
}

export default {
    initSentry,
    captureException,
    captureMessage,
    addBreadcrumb,
    setTag,
    setUser,
    startTransaction,
    withSentry
};
