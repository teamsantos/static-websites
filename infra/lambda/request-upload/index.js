const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml"
];

const MAX_FILES = 10;

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*", // Configure this to your domain in production
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing request body" })
            };
        }

        const { files } = JSON.parse(event.body);

        if (!files || !Array.isArray(files)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Invalid 'files' array" })
            };
        }

        if (files.length > MAX_FILES) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Too many files. Max ${MAX_FILES} allowed.` })
            };
        }

        const uploads = [];

        for (const file of files) {
            const { name, type } = file;

            if (!name || !type) {
                continue;
            }

            if (!ALLOWED_MIME_TYPES.includes(type)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `File type ${type} not allowed` })
                };
            }

            // Generate a unique file name to prevent collisions and ensure it's in the temp folder
            const uniqueId = crypto.randomUUID();
            const extension = name.split('.').pop();
            const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const key = `temp-uploads/${uniqueId}-${sanitizedName}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                ContentType: type,
                // Enforce that the uploaded object is automatically deleted after 1 day
                // Note: The bucket lifecycle policy MUST be configured to expire objects in temp-uploads/
                // We can also add tagging if we want to be explicit
                Tagging: "lifecycle=temp" 
            });

            // Expiration: 15 minutes to start the upload
            const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

            uploads.push({
                originalName: name,
                key: key,
                uploadUrl: url
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ uploads })
        };

    } catch (error) {
        console.error("Error generating presigned URLs:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
