/**
 * CloudWatch Insights Queries Helper
 * 
 * Pre-built queries for common monitoring scenarios
 * These can be used in the AWS CloudWatch Logs Insights console
 * 
 * Usage in Console:
 * 1. Go to CloudWatch > Logs > Logs Insights
 * 2. Select log groups
 * 3. Copy and paste queries from this file
 * 4. Adjust @timestamp range as needed
 */

/**
 * ERROR AND EXCEPTION QUERIES
 */

// All errors from last hour
export const QUERY_ALL_ERRORS = `
fields @timestamp, level, message, data.error, data.stack, functionName, requestId
| filter level = "ERROR"
| stats count() as error_count by functionName
`;

// High error rate detection (> 10% of requests)
export const QUERY_HIGH_ERROR_RATE = `
fields @timestamp, functionName, level
| stats count() as total, sum(case when level = "ERROR" then 1 else 0 end) as errors by functionName
| fields functionName, total, errors, (errors * 100.0 / total) as error_rate_percent
| filter error_rate_percent > 10
`;

// Database errors
export const QUERY_DATABASE_ERRORS = `
fields @timestamp, message, data.error, data.table, functionName, requestId
| filter message like /Database/ and level = "ERROR"
| stats count() as db_error_count by functionName, data.table
`;

// External API failures
export const QUERY_EXTERNAL_API_ERRORS = `
fields @timestamp, message, data.service, data.statusCode, data.error
| filter message like /External API/ and level = "ERROR"
| stats count() as api_error_count by data.service
`;

// Payment failures
export const QUERY_PAYMENT_FAILURES = `
fields @timestamp, message, data.error, data.email, data.operationId, functionName
| filter message like /payment|stripe/ and level = "ERROR"
| stats count() as payment_error_count by functionName
`;

/**
 * PERFORMANCE AND LATENCY QUERIES
 */

// Slowest requests
export const QUERY_SLOWEST_REQUESTS = `
fields @timestamp, functionName, message, data.durationMs, data.method, data.path
| filter message like /HTTP/
| stats avg(data.durationMs) as avg_ms, max(data.durationMs) as max_ms, pct(data.durationMs, 95) as p95_ms by functionName, data.path
| sort max_ms desc
`;

// Requests slower than 5 seconds
export const QUERY_SLOW_REQUESTS_5S = `
fields @timestamp, functionName, message, data.durationMs, data.method, data.path, requestId
| filter data.durationMs > 5000
| sort data.durationMs desc
`;

// Lambda cold starts (first few milliseconds of invocation)
export const QUERY_COLD_STARTS = `
fields @timestamp, functionName, message, data.durationMs
| filter message = "HTTP request received"
| stats count() as total, sum(case when data.durationMs > 1000 then 1 else 0 end) as potential_coldstarts by functionName
`;

// Database query performance
export const QUERY_DB_PERFORMANCE = `
fields @timestamp, functionName, message, data.durationMs, data.table, data.operation
| filter message like /Database/
| stats avg(data.durationMs) as avg_ms, max(data.durationMs) as max_ms, pct(data.durationMs, 95) as p95_ms by data.operation, data.table
| sort max_ms desc
`;

// Image processing performance
export const QUERY_IMAGE_PERFORMANCE = `
fields @timestamp, message, data.durationMs
| filter message like /image|Image/
| stats count() as image_count, avg(data.durationMs) as avg_ms, max(data.durationMs) as max_ms, pct(data.durationMs, 95) as p95_ms
`;

/**
 * CACHE EFFECTIVENESS
 */

// Cache hit rate
export const QUERY_CACHE_HIT_RATE = `
fields @timestamp, data.cacheType, data.hit
| filter message like /Cache/
| stats count() as total, sum(case when data.hit = true then 1 else 0 end) as hits by data.cacheType
| fields data.cacheType, hits, total, (hits * 100.0 / total) as hit_rate_percent
`;

// Cache misses
export const QUERY_CACHE_MISSES = `
fields @timestamp, data.cacheType, functionName, requestId
| filter message like /Cache/ and data.hit = false
| stats count() as cache_miss_count by data.cacheType, functionName
`;

/**
 * BUSINESS METRICS
 */

// Payment session creation
export const QUERY_PAYMENT_SESSIONS = `
fields @timestamp, message, data.email, data.projectName, data.sessionId
| filter message like /Stripe session created/
| stats count() as session_count by data.email
`;

// Website generation status
export const QUERY_WEBSITE_GENERATION = `
fields @timestamp, message, data.operationId, data.status
| filter message like /Metadata/
| stats count() as generation_count by data.status
`;

// Deployment tracking
export const QUERY_DEPLOYMENTS = `
fields @timestamp, message, data.operationId, data.commitSha
| filter message like /deployment|deployed/
| stats count() as deployment_count
`;

/**
 * OPERATIONAL QUERIES
 */

// Request volume by function
export const QUERY_VOLUME_BY_FUNCTION = `
fields @timestamp, functionName, level
| stats count() as total, sum(case when level = "ERROR" then 1 else 0 end) as errors by functionName
| fields functionName, total, errors, (errors * 100.0 / total) as error_rate_percent
`;

// Requests by HTTP status code
export const QUERY_STATUS_CODES = `
fields @timestamp, data.statusCode, functionName
| filter message like /HTTP/
| stats count() as request_count by data.statusCode, functionName
| sort request_count desc
`;

// Failed requests by reason
export const QUERY_FAILED_REQUESTS = `
fields @timestamp, functionName, message, data.error, requestId
| filter level = "ERROR"
| stats count() as failure_count by message
| sort failure_count desc
`;

// Traffic pattern (requests per minute)
export const QUERY_TRAFFIC_PATTERN = `
fields @timestamp, functionName
| stats count() as request_count by bin(5m)
| sort @timestamp desc
`;

// User activity
export const QUERY_USER_ACTIVITY = `
fields @timestamp, data.email, data.projectName, message, functionName
| filter data.email != ""
| stats count() as action_count, count_distinct(data.projectName) as projects_created by data.email
| sort action_count desc
`;

/**
 * SECURITY AND COMPLIANCE
 */

// Failed authorization/validation
export const QUERY_VALIDATION_FAILURES = `
fields @timestamp, message, data.error, functionName, requestId
| filter message like /Validation|CORS|signature/
| stats count() as validation_failure_count by message, functionName
`;

// Suspicious activity
export const QUERY_SUSPICIOUS_ACTIVITY = `
fields @timestamp, message, data.origin, functionName, requestId
| filter message like /rejected|Forbidden|unauthorized/i
| stats count() as suspicious_count by data.origin, functionName
`;

// Webhook signature verification failures
export const QUERY_WEBHOOK_FAILURES = `
fields @timestamp, message, functionName, requestId
| filter message like /signature|webhook/ and level = "ERROR"
| stats count() as webhook_failure_count by functionName
`;

/**
 * INTEGRATION QUERIES (Multi-function tracking)
 */

// End-to-end payment flow
export const QUERY_PAYMENT_FLOW_E2E = `
fields @timestamp, functionName, message, data.operationId, data.email, data.status
| filter data.operationId != ""
| stats count() as event_count by data.operationId, functionName, data.status
| sort data.operationId desc
`;

// Website generation pipeline
export const QUERY_GENERATION_PIPELINE = `
fields @timestamp, functionName, message, data.operationId, data.projectName
| filter data.operationId != "" and (message like /generation|optimiz|upload/)
| stats count() as step_count by data.operationId, functionName
| sort data.operationId, @timestamp
`;

export default {
    QUERY_ALL_ERRORS,
    QUERY_HIGH_ERROR_RATE,
    QUERY_DATABASE_ERRORS,
    QUERY_EXTERNAL_API_ERRORS,
    QUERY_PAYMENT_FAILURES,
    QUERY_SLOWEST_REQUESTS,
    QUERY_SLOW_REQUESTS_5S,
    QUERY_COLD_STARTS,
    QUERY_DB_PERFORMANCE,
    QUERY_IMAGE_PERFORMANCE,
    QUERY_CACHE_HIT_RATE,
    QUERY_CACHE_MISSES,
    QUERY_PAYMENT_SESSIONS,
    QUERY_WEBSITE_GENERATION,
    QUERY_DEPLOYMENTS,
    QUERY_VOLUME_BY_FUNCTION,
    QUERY_STATUS_CODES,
    QUERY_FAILED_REQUESTS,
    QUERY_TRAFFIC_PATTERN,
    QUERY_USER_ACTIVITY,
    QUERY_VALIDATION_FAILURES,
    QUERY_SUSPICIOUS_ACTIVITY,
    QUERY_WEBHOOK_FAILURES,
    QUERY_PAYMENT_FLOW_E2E,
    QUERY_GENERATION_PIPELINE
};
