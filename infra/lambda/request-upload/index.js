const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml"
];

const MAX_FILES_PER_REQUEST = 10;

// CORS headers
const HEADERS = {
    "Access-Control-Allow-Origin": "*", // Configure this to your domain in production
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
};

/**
 * Creates a response object with standard headers
 * @param {number} statusCode 
 * @param {object} body 
 * @returns {object}
 */
const createResponse = (statusCode, body) => ({
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(body)
});

/**
 * Generates a unique image key using project name, timestamp, and random suffix
 * @param {string} projectName 
 * @param {string} originalName 
 * @returns {string}
 */
const generateImageKey = (projectName, originalName) => {
    const timestamp = Date.now();
    const uniqueId = randomUUID().substring(0, 8);
    const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Extract extension, defaulting to 'bin' if no extension present
    const nameParts = originalName.split('.');
    const extension = nameParts.length > 1 
        ? nameParts.pop().toLowerCase() 
        : 'bin';
    
    return `temp-uploads/${sanitizedProjectName}-${timestamp}-${uniqueId}.${extension}`;
};

/**
 * Validates that a string is valid base64 and returns the decoded buffer
 * @param {string} data - The base64 string to validate
 * @returns {{valid: boolean, buffer?: Buffer, error?: string}}
 */
const validateAndDecodeBase64 = (data) => {
    // Check for valid base64 characters (A-Z, a-z, 0-9, +, /, =)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) {
        return { valid: false, error: "Invalid base64 characters" };
    }

    const buffer = Buffer.from(data, "base64");
    
    // Verify the decoded size is reasonable relative to input
    // Base64 encoding increases size by ~33%, so decoded should be ~75% of input
    const expectedMinSize = Math.floor(data.length * 0.7);
    const expectedMaxSize = Math.ceil(data.length * 0.8);
    
    if (buffer.length < expectedMinSize || buffer.length > expectedMaxSize) {
        return { valid: false, error: "Base64 data appears corrupted" };
    }

    return { valid: true, buffer };
};

/**
 * Lambda handler - receives images as base64 and uploads directly to S3
 * 
 * Expected request body:
 * {
 *   "projectName": "my-project",
 *   "images": [
 *     {
 *       "name": "original-filename.jpg",
 *       "type": "image/jpeg",
 *       "data": "base64-encoded-image-data"
 *     }
 *   ]
 * }
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: HEADERS, body: "" };
    }

    try {
        if (!event.body) {
            return createResponse(400, { error: "Missing request body" });
        }

        const { projectName, images } = JSON.parse(event.body);

        // Validate projectName
        if (!projectName || typeof projectName !== "string") {
            return createResponse(400, { error: "Missing or invalid 'projectName'" });
        }

        // Validate images array
        if (!images || !Array.isArray(images)) {
            return createResponse(400, { error: "Invalid 'images' array" });
        }

        if (images.length === 0) {
            return createResponse(400, { error: "No images provided" });
        }

        if (images.length > MAX_FILES_PER_REQUEST) {
            return createResponse(400, { 
                error: `Too many files. Max ${MAX_FILES_PER_REQUEST} per request.`,
                code: "TOO_MANY_FILES"
            });
        }

        const uploads = [];
        const errors = [];

        for (const image of images) {
            const { name, type, data, imageId } = image;

            // Validate required fields
            if (!name || !type || !data) {
                errors.push({ name: name || "unknown", error: "Missing name, type, or data" });
                continue;
            }

            // Validate MIME type
            if (!ALLOWED_MIME_TYPES.includes(type)) {
                errors.push({ name, error: `File type ${type} not allowed` });
                continue;
            }

            // Validate base64 data
            if (typeof data !== "string" || data.length === 0) {
                errors.push({ name, error: "Invalid or empty image data" });
                continue;
            }

            try {
                // Generate unique S3 key
                const key = generateImageKey(projectName, name);

                // Validate and decode base64 to buffer
                const decodeResult = validateAndDecodeBase64(data);
                if (!decodeResult.valid) {
                    errors.push({ name, error: decodeResult.error });
                    continue;
                }
                const imageBuffer = decodeResult.buffer;

                // Upload to S3
                const command = new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: imageBuffer,
                    ContentType: type,
                    // Tag for lifecycle policy (temp uploads expire after 1 day)
                    Tagging: "lifecycle=temp"
                });

                await s3Client.send(command);

                uploads.push({
                    imageId: imageId || null,
                    originalName: name,
                    key: key
                });

            } catch (uploadError) {
                console.error(`Error uploading ${name}:`, uploadError);
                errors.push({ name, error: "Failed to upload" });
            }
        }

        // If all images failed, return error
        if (uploads.length === 0 && errors.length > 0) {
            return createResponse(500, { 
                error: "All uploads failed",
                details: errors
            });
        }

        return createResponse(200, { 
            uploads,
            ...(errors.length > 0 && { errors })
        });

    } catch (error) {
        console.error("Error processing upload request:", error);
        
        // Check for JSON parse errors (likely caused by truncated payload)
        if (error instanceof SyntaxError || error.name === 'SyntaxError') {
            return createResponse(400, { 
                error: "Invalid request body. The payload may be too large or malformed.",
                code: "INVALID_PAYLOAD"
            });
        }

        return createResponse(500, { error: "Internal Server Error" });
    }
};
