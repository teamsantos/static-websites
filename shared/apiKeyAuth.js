/**
 * API Key Authentication
 *
 * Opt-in header-based auth. Each caller site decides how to combine this with its
 * existing auth (origin allow-list, email token, etc.). Keys live in DynamoDB as
 * SHA-256 hashes. The raw key is never persisted — the CLI prints it once.
 *
 * Usage inside a Lambda handler:
 *
 *   const rawKey = extractApiKey(event);
 *   if (rawKey) {
 *       const r = await validateApiKey(rawKey, ddb, tableName);
 *       if (!r.valid) return apiResponse(401, { error: 'Invalid API key' }, origin);
 *       // Skip origin / email-token gate — key is god-mode.
 *   } else {
 *       // ... existing origin or email-token check unchanged ...
 *   }
 */

import crypto from 'crypto';

const KEY_PREFIX = 'swk_live_';

export const hashApiKey = (raw) =>
    crypto.createHash('sha256').update(raw).digest('hex');

export const extractApiKey = (event) => {
    const h = event.headers || {};
    return h['x-api-key'] || h['X-Api-Key'] || h['X-API-Key'] || null;
};

/**
 * Look up a raw API key in DynamoDB and check it's active + unexpired.
 * @param {string} rawKey - The raw key from the request header.
 * @param {object} ddb - aws-sdk v2 DynamoDB DocumentClient.
 * @param {string} tableName - Name of the api-keys table.
 * @returns {Promise<{valid: boolean, keyId?: string, name?: string, error?: string}>}
 */
export const validateApiKey = async (rawKey, ddb, tableName) => {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
        return { valid: false, error: 'malformed_key' };
    }

    if (!ddb || !tableName) {
        return { valid: false, error: 'server_misconfigured' };
    }

    const keyHash = hashApiKey(rawKey);
    const res = await ddb.get({
        TableName: tableName,
        Key: { keyHash },
    }).promise();

    if (!res.Item) return { valid: false, error: 'unknown_key' };
    if (res.Item.status !== 'active') return { valid: false, error: 'revoked' };

    const exp = res.Item.expiresAt;
    if (exp && Number(exp) < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'expired' };
    }

    return { valid: true, keyId: res.Item.keyId, name: res.Item.name };
};
