// Tests for the upload-template Lambda. Exercised via node --test; no Jest or
// Vitest in the repo. AWS SDK clients are mocked by overriding `.send` on the
// relevant prototypes — sufficient because the handler only accesses AWS via
// that method.

process.env.S3_BUCKET_NAME = "test-bucket";
process.env.DYNAMODB_METADATA_TABLE = "test-metadata";
process.env.DYNAMODB_API_KEYS_TABLE = "test-api-keys";
process.env.TEMPLATE_DOMAIN = "template.test";
process.env.EDITOR_URL = "https://editor.test";
process.env.TEMPLATE_DISTRIBUTION_ID = "EXAMPLEDIST";
process.env.AWS_REGION = "eu-south-2";

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { handler } = await import("./index.js");

let metadataStore;
let s3Calls;
let cloudfrontCalls;

beforeEach(() => {
    metadataStore = new Map();
    s3Calls = [];
    cloudfrontCalls = [];
});

DynamoDBDocumentClient.prototype.send = async function (command) {
    const name = command.constructor.name;
    if (name === "GetCommand") {
        const key = command.input.Key.operationId || command.input.Key.keyHash;
        return { Item: metadataStore.get(key) || undefined };
    }
    if (name === "PutCommand") {
        metadataStore.set(command.input.Item.operationId, command.input.Item);
        return {};
    }
    if (name === "QueryCommand") {
        return { Count: 0, Items: [] };
    }
    throw new Error(`Unhandled DDB command in test: ${name}`);
};

S3Client.prototype.send = async function (command) {
    s3Calls.push(command);
    const name = command.constructor.name;
    if (name === "HeadObjectCommand") {
        const err = new Error("NotFound");
        err.name = "NotFound";
        err.$metadata = { httpStatusCode: 404 };
        throw err;
    }
    return {};
};

CloudFrontClient.prototype.send = async function (command) {
    cloudfrontCalls.push(command);
    return { Invalidation: { Id: "I123" } };
};

const OWNER = "owner@example.com";
const STRANGER = "stranger@example.com";
const TEMPLATE_ID = "my-template";

const minimalHtml = (title = "Hello") => `<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body><p>Hi there</p></body>
</html>`;

const seedTemplate = (templateId, email, overrides = {}) => {
    metadataStore.set(`tpl_${templateId}`, {
        operationId: `tpl_${templateId}`,
        type: "user-template",
        templateId,
        userInjected: true,
        email,
        title: "Seeded",
        description: "Seeded description",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        ...overrides,
    });
};

const makePutEvent = ({ templateName, body, origin = "https://editor.e-info.click" }) => ({
    httpMethod: "PUT",
    headers: { origin },
    requestContext: {},
    pathParameters: { templateName },
    body: JSON.stringify(body),
});

test("PUT /upload-template/{templateName} — happy path returns 200 with stable URLs and invalidates CloudFront", async () => {
    seedTemplate(TEMPLATE_ID, OWNER);

    const res = await handler(makePutEvent({
        templateName: TEMPLATE_ID,
        body: { html: minimalHtml("Updated"), email: OWNER, title: "Updated title" },
    }));

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.templateId, TEMPLATE_ID);
    assert.equal(body.editorUrl, `https://editor.test?template=${TEMPLATE_ID}`);
    assert.equal(body.previewUrl, `https://${TEMPLATE_ID}.template.test`);

    const stored = metadataStore.get(`tpl_${TEMPLATE_ID}`);
    assert.equal(stored.email, OWNER, "owner email preserved");
    assert.equal(stored.title, "Updated title", "title from body applied");
    assert.equal(stored.createdAt, "2025-01-01T00:00:00.000Z", "createdAt preserved across update");
    assert.notEqual(stored.updatedAt, "2025-01-01T00:00:00.000Z", "updatedAt refreshed");

    const indexWrite = s3Calls.find((c) =>
        c.constructor.name === "PutObjectCommand" &&
        c.input.Key === `templates/${TEMPLATE_ID}/index.html`
    );
    assert.ok(indexWrite, "index.html written to S3");

    assert.equal(cloudfrontCalls.length, 1, "CloudFront invalidation issued");
    const inv = cloudfrontCalls[0];
    assert.equal(inv.input.DistributionId, "EXAMPLEDIST");
    assert.deepEqual(inv.input.InvalidationBatch.Paths.Items, [`/templates/${TEMPLATE_ID}/*`]);
});

test("PUT /upload-template/{templateName} — 403 when body email does not match record owner", async () => {
    seedTemplate(TEMPLATE_ID, OWNER);

    const res = await handler(makePutEvent({
        templateName: TEMPLATE_ID,
        body: { html: minimalHtml(), email: STRANGER },
    }));

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "OWNER_MISMATCH");
    assert.equal(body.templateId, TEMPLATE_ID);

    const stored = metadataStore.get(`tpl_${TEMPLATE_ID}`);
    assert.equal(stored.email, OWNER, "record untouched by rejected request");
    assert.equal(cloudfrontCalls.length, 0, "no invalidation for rejected request");
});

test("PUT /upload-template/{templateName} — 404 when slug has no existing record", async () => {
    const res = await handler(makePutEvent({
        templateName: "does-not-exist",
        body: { html: minimalHtml(), email: OWNER },
    }));

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.code, "NOT_FOUND");
    assert.equal(body.templateId, "does-not-exist");

    assert.equal(s3Calls.filter((c) => c.constructor.name === "PutObjectCommand").length, 0);
    assert.equal(cloudfrontCalls.length, 0);
});
