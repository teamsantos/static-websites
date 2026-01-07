/**
 * Structured JSON Logger for CloudWatch
 * 
 * Provides consistent logging across all lambdas with:
 * - JSON format for easy parsing and querying in CloudWatch Insights
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Automatic context (requestId, function name, timestamp)
 * - Performance metrics and tracing
 * 
 * Usage:
 * const logger = createLogger('payment-session');
 * logger.info('Payment session created', { sessionId: '123', email: 'user@example.com' });
 * logger.error('Payment failed', { error: err.message, code: err.code }, { severity: 'critical' });
 */

export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * Create a logger instance for a specific Lambda function
 * @param {string} functionName - Name of the Lambda function (e.g., 'payment-session')
 * @param {object} context - Lambda context object (optional)
 * @returns {object} Logger instance with debug, info, warn, error methods
 */
export function createLogger(functionName, context = {}) {
  const functionContext = {
    functionName,
    requestId: context.requestId || context.awsRequestId || 'unknown',
    environment: process.env.NODE_ENV || 'production',
    region: process.env.AWS_REGION || 'unknown'
  };

  const log = (level, message, data = {}, metadata = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...functionContext,
      ...metadata,
      ...(Object.keys(data).length > 0 && { data })
    };

    // Send to CloudWatch (console.log)
    console.log(JSON.stringify(logEntry));

    // Also return structured for programmatic use
    return logEntry;
  };

  return {
    debug: (message, data = {}, metadata = {}) => 
      log(LOG_LEVELS.DEBUG, message, data, metadata),
    
    info: (message, data = {}, metadata = {}) => 
      log(LOG_LEVELS.INFO, message, data, metadata),
    
    warn: (message, data = {}, metadata = {}) => 
      log(LOG_LEVELS.WARN, message, data, metadata),
    
    error: (message, data = {}, metadata = {}) => 
      log(LOG_LEVELS.ERROR, message, data, metadata),

    /**
     * Log an HTTP request/response
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {string} path - Request path
     * @param {number} statusCode - Response status code
     * @param {number} duration - Duration in milliseconds
     * @param {object} extra - Additional data
     */
    http: (method, path, statusCode, duration, extra = {}) => 
      log(LOG_LEVELS.INFO, `HTTP ${method} ${path}`, {
        method,
        path,
        statusCode,
        durationMs: duration,
        ...extra
      }, {
        type: 'http_request'
      }),

    /**
     * Log a database operation
     * @param {string} operation - Operation type (put, query, scan, etc.)
     * @param {string} table - Table name
     * @param {number} duration - Duration in milliseconds
     * @param {object} extra - Additional data
     */
    database: (operation, table, duration, extra = {}) =>
      log(LOG_LEVELS.INFO, `Database ${operation} ${table}`, {
        operation,
        table,
        durationMs: duration,
        ...extra
      }, {
        type: 'database_operation'
      }),

    /**
     * Log an external API call
     * @param {string} service - Service name (Stripe, GitHub, etc.)
     * @param {string} endpoint - API endpoint
     * @param {number} statusCode - Response status
     * @param {number} duration - Duration in milliseconds
     * @param {object} extra - Additional data
     */
    externalApi: (service, endpoint, statusCode, duration, extra = {}) =>
      log(LOG_LEVELS.INFO, `External API ${service} ${endpoint}`, {
        service,
        endpoint,
        statusCode,
        durationMs: duration,
        ...extra
      }, {
        type: 'external_api_call'
      }),

    /**
     * Log cache hit/miss
     * @param {string} cacheType - Type of cache (template, language, etc.)
     * @param {boolean} hit - Whether it was a hit
     * @param {object} extra - Additional data
     */
    cache: (cacheType, hit, extra = {}) =>
      log(LOG_LEVELS.DEBUG, `Cache ${hit ? 'HIT' : 'MISS'} ${cacheType}`, {
        cacheType,
        hit,
        ...extra
      }, {
        type: 'cache_operation'
      }),

    /**
     * Log performance metric
     * @param {string} metricName - Name of metric
     * @param {number} value - Metric value
     * @param {string} unit - Unit of measurement (ms, bytes, count, etc.)
     * @param {object} extra - Additional data
     */
    metric: (metricName, value, unit = '', extra = {}) =>
      log(LOG_LEVELS.DEBUG, `Metric ${metricName}`, {
        metricName,
        value,
        unit,
        ...extra
      }, {
        type: 'performance_metric'
      })
  };
}

/**
 * Middleware for Express-like handlers
 * Logs all HTTP requests/responses automatically
 * 
 * Usage:
 * export const handler = createHttpLogger(async (event, context) => {
 *   // Your handler code
 * }, context);
 */
export function createHttpLogger(handlerFn, context) {
  return async (event, ctx) => {
    const startTime = Date.now();
    const logger = createLogger(handlerFn.name || 'http-handler', ctx);

    const method = event.httpMethod || 'UNKNOWN';
    const path = event.path || event.rawPath || 'unknown';
    const origin = event.headers?.origin || event.headers?.Origin || 'unknown';

    logger.info('HTTP request received', {
      method,
      path,
      origin,
      queryStringParameters: event.queryStringParameters,
      sourceIp: event.requestContext?.identity?.sourceIp
    });

    try {
      const response = await handlerFn(event, ctx);
      const duration = Date.now() - startTime;

      logger.http(method, path, response.statusCode, duration, {
        responseSize: response.body?.length || 0
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('HTTP request failed', {
        method,
        path,
        error: error.message,
        stack: error.stack,
        duration
      }, {
        severity: 'error'
      });

      // Re-throw to let Lambda handler deal with it
      throw error;
    }
  };
}

/**
 * Measure execution time of async functions
 * Logs metrics automatically
 * 
 * Usage:
 * const result = await logMetric(logger, 'process_images', () => 
 *   processImages(images)
 * );
 */
export async function logMetric(logger, metricName, fn, unit = 'ms') {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.metric(metricName, duration, unit);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.metric(`${metricName}_error`, duration, unit);
    throw error;
  }
}

/**
 * Default export for convenience
 */
export default {
  createLogger,
  createHttpLogger,
  logMetric,
  LOG_LEVELS
};
