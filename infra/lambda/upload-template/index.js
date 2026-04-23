import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";
import { JSDOM } from "jsdom";

import { extractFromDom, injectIntoSkeleton } from "@app/shared/htmlExtractor";
import { extractApiKey, validateApiKey } from "@app/shared/apiKeyAuth";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE;
const API_KEYS_TABLE = process.env.DYNAMODB_API_KEYS_TABLE;
const TEMPLATE_DOMAIN = process.env.TEMPLATE_DOMAIN || "template.e-info.click";
const EDITOR_URL = process.env.EDITOR_URL || "https://editor.e-info.click";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TEMPLATE_NAME_LEN = 40;
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 1000;
const MAX_TEMPLATES_PER_EMAIL = 10;

// Slugs that collide with in-repo templates (published by CI deploys) or with
// conventional subdomain names. Keep this list in lockstep with the
// `templates/` directory — future additions there must be mirrored here to
// prevent user-uploaded templates from being silently overwritten on deploy.
const RESERVED_SLUGS = new Set([
    "businesscard",
    "bussinesscardtest",
    "coffee",
    "modern-header",
    "portfolio",
    "admin", "api", "www", "mail", "root", "static", "assets", "editor",
    "template", "templates", "dist", "null", "undefined",
]);

// Data-URI MIME → S3 object extension. SVG intentionally omitted — SVGs can
// carry `<script>` and event handlers, and we upload bytes unchanged, so an
// attacker could stash executable content at /images/<sha>.svg. If SVG support
// becomes necessary, sanitize the SVG tree before upload.
const IMAGE_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
};

const ALLOWED_ORIGINS = [
    "https://editor.e-info.click",
    "https://ssh.e-info.click",
    "https://e-info.click",
    "https://www.e-info.click",
];

// Elements that can load or execute remote content outside our allowed surface.
// Dropped entirely by the sanitizer.
const DROPPED_TAGS = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "BASE"]);

// Attributes whose value can legitimately be a URL. If the value is a
// `javascript:` URL it's stripped (not the whole element — the element may be
// fine once the malicious URL is gone).
const URL_ATTRIBUTES = new Set([
    "href", "src", "action", "formaction", "data", "xlink:href", "ping",
]);

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Origin",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
});

const respond = (statusCode, body, origin) => ({
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body),
});

const slugify = (name) =>
    name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");

// Strip attacker-controlled code paths from the uploaded HTML so the editor
// doesn't execute them when it re-opens the template in shadow DOM under
// `editor.e-info.click`. Mutates the DOM in place and returns it — callers
// run extraction on the same DOM instance to avoid a second parse.
const sanitizeDom = (dom) => {
    const document = dom.window.document;

    // Drop entire elements whose purpose is to load/execute external content.
    for (const tag of DROPPED_TAGS) {
        document.querySelectorAll(tag).forEach((el) => el.remove());
    }

    // Drop <meta http-equiv="refresh"> — can redirect to `javascript:` URLs or
    // away from the expected origin.
    document.querySelectorAll('meta[http-equiv]').forEach((el) => {
        if (el.getAttribute("http-equiv").toLowerCase() === "refresh") {
            el.remove();
        }
    });

    for (const el of document.querySelectorAll("*")) {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();

            // Any `on*=` event handler.
            if (name.startsWith("on")) {
                el.removeAttribute(attr.name);
                continue;
            }

            // `javascript:` / `vbscript:` / `data:text/html` in URL-bearing
            // attributes. Also catches `srcdoc` (iframe already stripped, but
            // a rogue <img srcdoc=...> or similar would still pass through).
            if (URL_ATTRIBUTES.has(name) || name === "srcdoc") {
                const value = attr.value.trim().toLowerCase();
                if (value.startsWith("javascript:") ||
                    value.startsWith("vbscript:") ||
                    value.startsWith("data:text/html")) {
                    el.removeAttribute(attr.name);
                }
            }
        }
    }

    return dom;
};

const parseDataUri = (value) => {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const isBase64 = Boolean(match[2]);
    const payload = match[3];
    if (!isBase64) return { mime, buffer: Buffer.from(decodeURIComponent(payload), "utf8") };
    return { mime, buffer: Buffer.from(payload, "base64") };
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const resolveImages = async (images, templateId) => {
    const resolved = {};
    const uploads = [];
    const missing = [];

    for (const [key, value] of Object.entries(images)) {
        if (!value) {
            resolved[key] = value;
            continue;
        }

        if (isAbsoluteUrl(value)) {
            resolved[key] = value;
            continue;
        }

        const dataUri = value.startsWith("data:") ? parseDataUri(value) : null;
        if (dataUri) {
            const ext = IMAGE_MIME_EXTENSIONS[dataUri.mime];
            if (!ext) {
                missing.push({ key, reason: `unsupported MIME ${dataUri.mime}` });
                continue;
            }
            const sha = createHash("sha256").update(dataUri.buffer).digest("hex").slice(0, 16);
            const s3Key = `templates/${templateId}/images/${sha}.${ext}`;
            uploads.push(
                s3.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                    Body: dataUri.buffer,
                    ContentType: dataUri.mime,
                    CacheControl: "public, max-age=31536000, immutable",
                }))
            );
            resolved[key] = `./images/${sha}.${ext}`;
            continue;
        }

        missing.push({ key, path: value });
    }

    await Promise.all(uploads);
    return { resolved, missing };
};

const templateExists = async (templateId) => {
    try {
        await s3.send(new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `templates/${templateId}/index.html`,
        }));
        return true;
    } catch (err) {
        if (err.$metadata?.httpStatusCode === 404 || err.name === "NotFound") return false;
        throw err;
    }
};

const getTemplateMetadata = async (templateId) => {
    const res = await ddb.send(new GetCommand({
        TableName: METADATA_TABLE,
        Key: { operationId: `tpl_${templateId}` },
    }));
    return res.Item || null;
};

const countUserTemplatesForEmail = async (email) => {
    const res = await ddb.send(new QueryCommand({
        TableName: METADATA_TABLE,
        IndexName: "email-createdAt-index",
        KeyConditionExpression: "email = :e",
        FilterExpression: "#t = :type",
        ExpressionAttributeNames: { "#t": "type" },
        ExpressionAttributeValues: { ":e": email, ":type": "user-template" },
        Select: "COUNT",
    }));
    return res.Count || 0;
};

// Adapter: shared/apiKeyAuth.js expects an SDK v2 DocumentClient interface
// (`.get({...}).promise()`). We run on SDK v3, so present a minimal shim.
const apiKeyDdbShim = {
    get: (params) => ({ promise: () => ddb.send(new GetCommand(params)) }),
};

export const handler = async (event) => {
    const origin = event.headers?.origin || event.headers?.Origin || "*";

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: corsHeaders(origin), body: "" };
    }

    const isHttpInvocation = Boolean(event.requestContext);
    const apiKey = isHttpInvocation ? extractApiKey(event) : null;
    if (apiKey) {
        let keyResult;
        try {
            keyResult = await validateApiKey(apiKey, apiKeyDdbShim, API_KEYS_TABLE);
        } catch (err) {
            console.error("validateApiKey failed:", err);
            return respond(500, { error: "Auth check failed" }, origin);
        }
        if (!keyResult.valid) {
            return respond(401, { error: "Invalid API key" }, origin);
        }
    } else if (isHttpInvocation) {
        const isAllowed = ALLOWED_ORIGINS.some(
            (allowed) => origin === allowed || origin.startsWith(allowed)
        );
        if (!isAllowed) {
            return respond(403, { error: "Forbidden" }, origin);
        }
    }

    if (!event.body) {
        return respond(400, { error: "Missing request body" }, origin);
    }

    let parsed;
    try {
        parsed = JSON.parse(event.body);
    } catch {
        return respond(400, { error: "Invalid JSON in request body" }, origin);
    }

    const { html, templateName, title, description, email } = parsed;

    if (typeof html !== "string" || html.length === 0) {
        return respond(400, { error: "Missing or invalid 'html'" }, origin);
    }
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
        return respond(413, { error: "HTML payload exceeds 2MB" }, origin);
    }
    if (typeof templateName !== "string" || templateName.trim().length === 0) {
        return respond(400, { error: "Missing 'templateName'" }, origin);
    }
    if (templateName.length > MAX_TEMPLATE_NAME_LEN) {
        return respond(400, { error: `'templateName' exceeds ${MAX_TEMPLATE_NAME_LEN} chars` }, origin);
    }
    if (title != null && (typeof title !== "string" || title.length > MAX_TITLE_LEN)) {
        return respond(400, { error: `'title' must be a string up to ${MAX_TITLE_LEN} chars` }, origin);
    }
    if (description != null && (typeof description !== "string" || description.length > MAX_DESCRIPTION_LEN)) {
        return respond(400, { error: `'description' must be a string up to ${MAX_DESCRIPTION_LEN} chars` }, origin);
    }
    if (typeof email !== "string" || !email.includes("@")) {
        return respond(400, { error: "Missing or invalid 'email'" }, origin);
    }

    const templateId = slugify(templateName);
    if (!templateId) {
        return respond(400, { error: "'templateName' produced an empty slug after sanitization" }, origin);
    }
    if (RESERVED_SLUGS.has(templateId)) {
        return respond(409, { error: "Template name is reserved", code: "NAME_RESERVED", templateId }, origin);
    }

    // Check whether this slug is already owned (including by us). Resolving
    // ownership up front lets us treat a same-email request as a retry:
    // - same email → skip quota (we'll overwrite the existing row, not add)
    //                and skip the S3 HeadObject (we'll overwrite index.html too)
    // - different email → 409 NAME_TAKEN (don't hint whether S3 has the site)
    // - no record → normal path (quota check + S3 uniqueness check)
    let existing;
    try {
        existing = await getTemplateMetadata(templateId);
    } catch (err) {
        console.error("GetItem failed:", err);
        return respond(500, { error: "Failed to look up template metadata" }, origin);
    }

    if (existing && existing.email !== email) {
        return respond(409, { error: "Template name already in use", code: "NAME_TAKEN", templateId }, origin);
    }

    const isRetry = Boolean(existing);

    if (!isRetry) {
        try {
            const count = await countUserTemplatesForEmail(email);
            if (count >= MAX_TEMPLATES_PER_EMAIL) {
                return respond(429, {
                    error: `Quota exceeded: ${MAX_TEMPLATES_PER_EMAIL} templates per email`,
                    code: "QUOTA_EXCEEDED",
                }, origin);
            }
        } catch (err) {
            console.error("Quota check failed:", err);
            return respond(500, { error: "Failed to check template quota" }, origin);
        }

        try {
            if (await templateExists(templateId)) {
                return respond(409, { error: "Template name already in use", code: "NAME_TAKEN", templateId }, origin);
            }
        } catch (err) {
            console.error("HeadObject failed:", err);
            return respond(500, { error: "Failed to check template availability" }, origin);
        }
    }

    // Parse once, sanitize + extract on the same DOM instance.
    let dom;
    try {
        dom = sanitizeDom(new JSDOM(html));
    } catch (err) {
        console.error("Parse/sanitize failed:", err);
        return respond(400, { error: "Invalid HTML", code: "INVALID_HTML", detail: err.message }, origin);
    }

    let extraction;
    try {
        extraction = extractFromDom(dom);
    } catch (err) {
        console.error("Extraction failed:", err);
        return respond(400, { error: "Invalid HTML", code: "INVALID_HTML", detail: err.message }, origin);
    }

    const { skeletonHtml, langs, images, icons } = extraction;

    let resolved, missing;
    try {
        ({ resolved, missing } = await resolveImages(images, templateId));
    } catch (err) {
        console.error("Image upload failed:", err);
        return respond(500, { error: "Failed to upload images" }, origin);
    }

    if (missing.length > 0) {
        return respond(400, {
            error: "Referenced images could not be resolved. Embed them as data URIs or use absolute URLs.",
            code: "MISSING_ASSET",
            missing,
        }, origin);
    }

    const processedHtml = injectIntoSkeleton(skeletonHtml, langs, resolved, icons);

    // Write metadata FIRST. If the S3 write below fails the template is never
    // visible (no `index.html` at the slug → subsequent same-email retries
    // find the DDB row, skip the quota + HeadObject checks, and overwrite).
    // Opposite order risks a published site without metadata (invisible to
    // the owner's "my templates" list).
    try {
        await ddb.send(new PutCommand({
            TableName: METADATA_TABLE,
            Item: {
                operationId: `tpl_${templateId}`,
                type: "user-template",
                templateId,
                userInjected: true,
                email,
                title: title || templateName,
                description: description || "",
                createdAt: existing?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        }));
    } catch (err) {
        console.error("DDB PutItem failed:", err);
        return respond(500, { error: "Failed to record template metadata" }, origin);
    }

    try {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `templates/${templateId}/index.html`,
            Body: processedHtml,
            ContentType: "text/html; charset=utf-8",
            CacheControl: "no-cache",
        }));
    } catch (err) {
        console.error("PutObject index.html failed:", err);
        return respond(500, { error: "Failed to publish template" }, origin);
    }

    return respond(200, {
        templateId,
        editorUrl: `${EDITOR_URL}?template=${templateId}`,
        previewUrl: `https://${templateId}.${TEMPLATE_DOMAIN}`,
    }, origin);
};
