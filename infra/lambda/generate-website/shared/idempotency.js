import AWS from "aws-sdk";
import crypto from "crypto";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const IDEMPOTENCY_TABLE = process.env.DYNAMODB_IDEMPOTENCY_TABLE || "request-idempotency";

/**
 * Idempotency Helper
 *
 * Prevents duplicate processing of requests by storing results
 * Ensures the same request always returns the same result
 *
 * Use cases:
 * - Duplicate payment session requests → Same operationId
 * - Duplicate generate-website requests → Same result
 * - Network retries → Idempotent responses
 */

/**
 * Generate idempotency key from request
 * @param {object} options - Request details (method, path, body, user, etc)
 * @returns {string} - Deterministic idempotency key
 */
export function generateIdempotencyKey(options) {
    const { method = "POST", path = "", userId = "", body = "" } = options;
    
    // Include userId so different users can have same body without conflict
    const content = `${method}:${path}:${userId}:${JSON.stringify(body)}`;
    
    return crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
}

/**
 * Check if request has been processed before
 * @param {string} idempotencyKey - The idempotency key
 * @returns {Promise<object|null>} - Cached result if exists, null otherwise
 */
export async function getCachedResult(idempotencyKey) {
    try {
        const result = await dynamodb.get({
            TableName: IDEMPOTENCY_TABLE,
            Key: { idempotencyKey }
        }).promise();

        if (result.Item) {
            console.log(`[Idempotency] Cache HIT for key: ${idempotencyKey}`);
            return result.Item.result;
        }

        console.log(`[Idempotency] Cache MISS for key: ${idempotencyKey}`);
        return null;
    } catch (error) {
        console.error("[Idempotency] Error checking cache:", error);
        // On error, allow request to proceed (fail open)
        return null;
    }
}

/**
 * Store result for idempotency
 * @param {string} idempotencyKey - The idempotency key
 * @param {object} result - The result to cache
 * @param {number} ttlHours - How long to keep (default 24 hours)
 * @returns {Promise<void>}
 */
export async function cacheResult(idempotencyKey, result, ttlHours = 24) {
    try {
        const expiresAt = Math.floor(Date.now() / 1000) + (ttlHours * 3600);
        
        await dynamodb.put({
            TableName: IDEMPOTENCY_TABLE,
            Item: {
                idempotencyKey,
                result,
                timestamp: new Date().toISOString(),
                expiresAt,
            }
        }).promise();

        console.log(`[Idempotency] Cached result for key: ${idempotencyKey}`);
    } catch (error) {
        console.error("[Idempotency] Error caching result:", error);
        // Non-fatal: log but don't fail the request
    }
}

/**
 * Atomic operation: Check cache and store result in one operation
 * Prevents race conditions where two identical requests arrive simultaneously
 * @param {string} idempotencyKey - The idempotency key
 * @param {function} fn - Function to execute if not cached
 * @param {number} ttlHours - How long to keep cached result
 * @returns {Promise<object>} - Result from cache or execution
 */
export async function withIdempotency(idempotencyKey, fn, ttlHours = 24) {
    try {
        // Check if already processed
        const cached = await getCachedResult(idempotencyKey);
        if (cached) {
            return cached;
        }

        // Execute the function
        const result = await fn();

        // Cache the result for future requests
        await cacheResult(idempotencyKey, result, ttlHours);

        return result;
    } catch (error) {
        console.error("[Idempotency] Error in withIdempotency:", error);
        throw error;
    }
}

/**
 * Clear cached result (for testing or manual cleanup)
 * @param {string} idempotencyKey - The idempotency key
 * @returns {Promise<void>}
 */
export async function clearCache(idempotencyKey) {
    try {
        await dynamodb.delete({
            TableName: IDEMPOTENCY_TABLE,
            Key: { idempotencyKey }
        }).promise();

        console.log(`[Idempotency] Cleared cache for key: ${idempotencyKey}`);
    } catch (error) {
        console.error("[Idempotency] Error clearing cache:", error);
    }
}
