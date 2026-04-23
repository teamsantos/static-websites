#!/usr/bin/env node
/**
 * Generate an API key for api.e-info.click.
 *
 * Usage:
 *   npm run api-key:generate -- --name "acme integration" --ttl-days 365
 *   node scripts/generate-api-key.js --name "acme" --ttl-days 30
 *
 * Flags:
 *   --name       Human-readable label stored on the record.        (default: "unnamed")
 *   --ttl-days   Days until the key expires (DynamoDB TTL).        (default: 365)
 *   --region     AWS region holding the api-keys table.            (default: eu-south-2)
 *   --table      Table name.                                        (default: api-keys)
 *
 * Requires AWS credentials in the environment (same creds used for `cdk deploy`).
 * The raw key is printed once — there is no way to retrieve it later.
 *
 * To revoke: edit the item in the DynamoDB console and set `status = "revoked"`.
 */

import crypto from 'crypto';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const parseArgs = () => {
    const out = {};
    const a = process.argv.slice(2);
    for (let i = 0; i < a.length; i++) {
        if (a[i].startsWith('--')) {
            const key = a[i].slice(2);
            const next = a[i + 1];
            if (next === undefined || next.startsWith('--')) {
                out[key] = 'true';
            } else {
                out[key] = next;
                i++;
            }
        }
    }
    return out;
};

const args = parseArgs();
const name = args.name || 'unnamed';
const ttlDays = Number(args['ttl-days'] || 365);
const region = args.region || process.env.AWS_REGION || 'eu-south-2';
const tableName = args.table || 'api-keys';

if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    console.error(`Invalid --ttl-days: ${args['ttl-days']}`);
    process.exit(1);
}

const rawKey = 'swk_live_' + crypto.randomBytes(32).toString('base64url');
const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
const keyId = crypto.randomUUID();
const createdAt = new Date().toISOString();
const expiresAt = Math.floor(Date.now() / 1000) + ttlDays * 86400;

const ddb = new DynamoDBClient({ region });

try {
    await ddb.send(new PutItemCommand({
        TableName: tableName,
        Item: {
            keyHash:   { S: keyHash },
            keyId:     { S: keyId },
            name:      { S: name },
            status:    { S: 'active' },
            createdAt: { S: createdAt },
            expiresAt: { N: String(expiresAt) },
        },
        ConditionExpression: 'attribute_not_exists(keyHash)',
    }));
} catch (err) {
    console.error('Failed to write key to DynamoDB:', err.message);
    process.exit(1);
}

console.log('keyId:    ', keyId);
console.log('name:     ', name);
console.log('expires:  ', new Date(expiresAt * 1000).toISOString());
console.log('table:    ', tableName, `(region ${region})`);
console.log('');
console.log('API KEY (store this now — it will not be shown again):');
console.log('');
console.log('  ' + rawKey);
console.log('');
console.log('Use it by sending header:  x-api-key: ' + rawKey);
