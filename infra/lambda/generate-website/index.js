import AWS from "aws-sdk";
import { JSDOM } from "jsdom";
import { Octokit } from "octokit";

const ses = new AWS.SES({ region: process.env.AWS_SES_REGION });
const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

// Cache secrets to avoid fetching on every invocation
let cachedGithubToken = null;
let cachedGithubConfig = null;

async function getSecrets() {
    if (!cachedGithubToken || !cachedGithubConfig) {
        const [tokenSecret, configSecret] = await Promise.all([
            secretsManager.getSecretValue({ SecretId: process.env.GITHUB_TOKEN_SECRET_NAME }).promise(),
            secretsManager.getSecretValue({ SecretId: process.env.GITHUB_CONFIG_SECRET_NAME }).promise()
        ]);

        cachedGithubToken = tokenSecret.SecretString;
        cachedGithubConfig = JSON.parse(configSecret.SecretString);
    }

    return {
        githubToken: cachedGithubToken,
        githubOwner: cachedGithubConfig.owner,
        githubRepo: cachedGithubConfig.repo
    };
}

async function getMetadataFromS3(operationId) {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        console.log(`[DEBUG] Fetching metadata from S3 bucket: ${bucketName}`);
        const response = await s3.getObject({
            Bucket: bucketName,
            Key: 'metadata.json'
        }).promise();

        const metadataContent = response.Body.toString('utf-8');
        const metadata = JSON.parse(metadataContent);

        console.log(`[DEBUG] All metadata keys available: ${Object.keys(metadata).join(', ')}`);
        if (!metadata[operationId]) {
            throw new Error(`Operation ID '${operationId}' not found in metadata`);
        }

        const operationMetadata = metadata[operationId];
        console.log(`[DEBUG] Retrieved metadata for operationId: ${operationId}`);
        console.log(`[DEBUG] Metadata content (before processing):`, JSON.stringify(operationMetadata, null, 2));

        return operationMetadata;
    } catch (error) {
        console.error('Error fetching metadata from S3:', error);
        throw error;
    }
}

async function processImages(images, projectName) {
    const updatedImages = {};
    const bucketName = process.env.S3_BUCKET_NAME;

    console.log(`[DEBUG] Processing images for project: ${projectName}`);
    console.log(`[DEBUG] Input images object:`, JSON.stringify(images, null, 2));

    for (const [key, value] of Object.entries(images)) {
        // Check if it's a URL (starts with http/https) or a data URL (base64 image content)
        if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            // It's already a URL, keep as is
            console.log(`[DEBUG] Image '${key}' is already a URL: ${value}`);
            updatedImages[key] = value;
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
            // It's base64 image data, upload to S3
            console.log(`[DEBUG] Image '${key}' is base64 data, uploading to S3`);
            const matches = value.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) {
                throw new Error(`Invalid image data for ${key}`);
            }
            const imageFormat = matches[1];
            const imageData = matches[2];
            const imageName = `${key}.${imageFormat}`;
            const s3Key = `projects/${projectName}/images/${imageName}`;

            console.log(`[DEBUG] Uploading image to S3: ${s3Key}`);
            const buffer = Buffer.from(imageData, 'base64');

            await s3.putObject({
                Bucket: bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: `image/${imageFormat}`
            }).promise();

            const imageUrl = `/projects/${projectName}/images/${imageName}`;
            console.log(`[DEBUG] Image uploaded successfully, URL: ${imageUrl}`);
            updatedImages[key] = imageUrl;
        } else {
            // Assume it's already a path or other valid value
            console.log(`[DEBUG] Image '${key}' is already a path: ${value}`);
            updatedImages[key] = value;
        }
    }

    console.log(`[DEBUG] Processed images output:`, JSON.stringify(updatedImages, null, 2));
    return updatedImages;
}

async function getTemplateFromS3(templateId) {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        const s3Key = `templates/${templateId}/index.html`;
        console.log(`[DEBUG] Fetching template HTML from S3: ${s3Key}`);

        const response = await s3.getObject({
            Bucket: bucketName,
            Key: s3Key
        }).promise();

        const templateHtml = response.Body.toString('utf-8');
        console.log(`[DEBUG] Retrieved template HTML from S3, size: ${templateHtml.length} bytes`);
        return templateHtml;
    } catch (error) {
        console.error(`Error fetching template from S3:`, error);
        throw error;
    }
}

async function generateHtmlFromTemplate(templateId, customImages, customLangs, octokit, owner, repo) {
    try {
        console.log(`[DEBUG] Starting HTML generation for template: ${templateId}`);

        // Load base template HTML from S3
        const templateHtml = await getTemplateFromS3(`${templateId}`.toLowerCase());

        // Load base langs and images from GitHub
        const baseLangsPath = `templates/${templateId}/langs/en.json`;
        const baseImagesPath = `templates/${templateId}/assets/images.json`;

        let baseLangs = {};
        let baseImages = {};

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: baseLangsPath,
            });
            baseLangs = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
            console.log(`[DEBUG] Loaded base langs from GitHub, keys: ${Object.keys(baseLangs).join(', ')}`);
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
            console.log(`[DEBUG] Base langs file not found in GitHub: ${baseLangsPath}`);
        }

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: baseImagesPath,
            });
            baseImages = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
            console.log(`[DEBUG] Loaded base images from GitHub, keys: ${Object.keys(baseImages).join(', ')}`);
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
            console.log(`[DEBUG] Base images file not found in GitHub: ${baseImagesPath}`);
        }

        // Merge custom data with base data (custom overrides base)
        console.log(`[DEBUG] Custom langs before merge:`, JSON.stringify(customLangs, null, 2));
        console.log(`[DEBUG] Custom images before merge:`, JSON.stringify(customImages, null, 2));

        const mergedLangs = { ...baseLangs, ...customLangs };
        const mergedImages = { ...baseImages, ...customImages };

        console.log(`[DEBUG] Merged langs keys: ${Object.keys(mergedLangs).join(', ')}`);
        console.log(`[DEBUG] Merged images keys: ${Object.keys(mergedImages).join(', ')}`);
        console.log(`[DEBUG] Merged langs content:`, JSON.stringify(mergedLangs, null, 2));
        console.log(`[DEBUG] Merged images content:`, JSON.stringify(mergedImages, null, 2));

        // Inject content into HTML
        const dom = new JSDOM(templateHtml);
        const document = dom.window.document;

        console.log(`[DEBUG] Original HTML size: ${templateHtml.length} bytes`);
        console.log(`[DEBUG] Starting content injection into HEAD and BODY`);
        injectContent(document.head, mergedLangs, mergedImages);
        injectContent(document.body, mergedLangs, mergedImages);

        const finalHtml = dom.serialize();
        console.log(`[DEBUG] HTML generation complete, final size: ${finalHtml.length} bytes`);

        return finalHtml;
    } catch (error) {
        console.error('Error generating HTML from template:', error);
        throw error;
    }
}

function injectContent(element, langs, images) {
    // Skip script and style elements
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
        return;
    }

    // Inject text content
    const textId = element.getAttribute('data-text-id');
    if (textId && langs[textId]) {
        console.log(`[DEBUG] Injecting text into ${element.tagName} with data-text-id='${textId}': ${langs[textId]}`);
        if (element.tagName === 'BUTTON') {
            element.textContent = langs[textId];
        } else if (element.tagName === 'TEXTAREA') {
            element.textContent = langs[textId];
        } else if (element.tagName === 'INPUT') {
            const inputType = element.getAttribute('type');
            if (inputType === 'submit' || inputType === 'button') {
                element.setAttribute('value', langs[textId]);
            } else {
                element.setAttribute('placeholder', langs[textId]);
            }
        } else {
            element.textContent = langs[textId];
        }
    }

    // Inject alt text
    const altTextId = element.getAttribute('data-alt-text-id');
    if (altTextId && langs[altTextId]) {
        console.log(`[DEBUG] Injecting alt text into ${element.tagName} with data-alt-text-id='${altTextId}': ${langs[altTextId]}`);
        element.setAttribute('alt', langs[altTextId]);
    }

    // Inject title text
    const titleTextId = element.getAttribute('data-title-text-id');
    if (titleTextId && langs[titleTextId]) {
        console.log(`[DEBUG] Injecting title into ${element.tagName} with data-title-text-id='${titleTextId}': ${langs[titleTextId]}`);
        if (element.tagName === 'TITLE') {
            element.textContent = langs[titleTextId];
        } else {
            element.setAttribute('title', langs[titleTextId]);
        }
    }

    // Inject meta content
    const metaContentId = element.getAttribute('data-meta-content-id');
    if (metaContentId && langs[metaContentId]) {
        console.log(`[DEBUG] Injecting meta content into ${element.tagName} with data-meta-content-id='${metaContentId}': ${langs[metaContentId]}`);
        element.setAttribute('content', langs[metaContentId]);
    }

    // Inject image sources
    const imageSrc = element.getAttribute('data-image-src');
    if (imageSrc && images[imageSrc]) {
        console.log(`[DEBUG] Injecting image src into ${element.tagName} with data-image-src='${imageSrc}': ${images[imageSrc]}`);
        element.setAttribute('src', images[imageSrc]);
    }

    // Inject background images
    const bgImage = element.getAttribute('data-bg-image');
    if (bgImage && images[bgImage]) {
        console.log(`[DEBUG] Injecting background image into ${element.tagName} with data-bg-image='${bgImage}': ${images[bgImage]}`);
        const currentStyle = element.getAttribute('style') || '';
        const bgImageStyle = `background-image: url('${images[bgImage]}')`;
        const newStyle = currentStyle ? `${currentStyle}; ${bgImageStyle}` : bgImageStyle;
        element.setAttribute('style', newStyle);
    }

    // Process children
    const children = Array.from(element.children || []);
    for (let child of children) {
        injectContent(child, langs, images);
    }
}

export const handler = async (event) => {
    // Handle CORS preflight OPTIONS requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: '',
        };
    }

    // Check origin for security - allow specific origins
    const origin = event.headers?.origin || event.headers?.Origin;

    console.log(`Origin: ${origin}`);

    const allowedOrigins = [
        'https://editor.e-info.click',
        'https://ssh.e-info.click',
        'http://89.152.33.66',
        'https://89.152.33.66',
        'e-info.click'
    ];

    const isAllowedOrigin = !origin || allowedOrigins.some(allowed =>
        origin === allowed || origin.startsWith(allowed) || origin.endsWith(allowed)
    );

    if (!isAllowedOrigin) {
        return {
            statusCode: 403,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ message: 'Forbidden' }),
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (error) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        };
    }

    const { operationId } = requestBody;

    if (!operationId) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Missing required field: operationId' }),
        };
    }

    try {
        // Fetch metadata from S3
        const metadata = await getMetadataFromS3(operationId);

        console.log(`[DEBUG] Retrieved metadata for operation ${operationId}`);
        console.log(`[DEBUG] Metadata:`, JSON.stringify(metadata, null, 2));
        const { images, langs, templateId, email, projectName } = metadata;

        // Validate metadata
        // if (!images || !langs || !templateId || !email || !projectName || !sections) {
        if (!images || !langs || !templateId || !email || !projectName) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': origin || '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS',
                },
                body: JSON.stringify({ error: 'Invalid metadata: missing required fields (images, langs, templateId, email, name)' }),
            };
        }

        // Process images: upload new ones to S3 and update paths
        const processedImages = await processImages(images, projectName);

        // Get secrets from AWS Secrets Manager
        const { githubToken, githubOwner, githubRepo } = await getSecrets();

        const octokit = new Octokit({
            auth: githubToken,
        });

        const owner = githubOwner;
        const repo = githubRepo;

        let isUpdate = false;
        try {
            // Check if project exists
            const path = `projects/${projectName}`;
            console.log(`[DEBUG] Checking if project exists at: ${path}`);
            await octokit.rest.repos.getContent({
                owner,
                repo,
                path,
            });

            // If no error, project exists, this is an update
            isUpdate = true;
            console.log(`[DEBUG] Project exists - this is an UPDATE operation`);
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
            // 404 means not exists, this is a create
            console.log(`[DEBUG] Project does not exist - this is a CREATE operation`);
        }

        // Generate HTML from template and custom data
        console.log(`[DEBUG] Generating HTML from template...`);
        const html = await generateHtmlFromTemplate(templateId, processedImages, langs, octokit, owner, repo);
        console.log(`[DEBUG] HTML generated successfully, size: ${html.length} bytes`);

        if (isUpdate) {
            // For updates, just update the index.html file
            console.log(`[DEBUG] UPDATING project: ${projectName}`);
            const commitMessage = `Update ${projectName} project`;
            console.log(`[DEBUG] Commit message: ${commitMessage}`);
            console.log(`[DEBUG] Uploading to: projects/${projectName}/index.html`);

            const updateResponse = await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `projects/${projectName}/index.html`,
                message: commitMessage,
                content: Buffer.from(html).toString('base64'),
            });

            console.log(`[DEBUG] File update response:`, JSON.stringify(updateResponse.data, null, 2));
            console.log(`[DEBUG] Successfully updated index.html for project: ${projectName}`);
        } else {
            // For new projects, create both files in a single commit
            console.log(`[DEBUG] CREATING new project: ${projectName}`);
            const commitMessage = `Add ${projectName} project`;

            // Get the current branch reference
            const { data: ref } = await octokit.rest.git.getRef({
                owner,
                repo,
                ref: 'heads/master',
            });

            const baseSha = ref.object.sha;
            console.log(`[DEBUG] Base SHA: ${baseSha}`);

            // Get the base commit
            const { data: baseCommit } = await octokit.rest.git.getCommit({
                owner,
                repo,
                commit_sha: baseSha,
            });

            // Create blobs for both files
            const [htmlBlob, emailBlob] = await Promise.all([
                octokit.rest.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(html).toString('base64'),
                    encoding: 'base64',
                }),
                octokit.rest.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(email).toString('base64'),
                    encoding: 'base64',
                }),
            ]);

            console.log(`[DEBUG] Created blobs - HTML: ${htmlBlob.data.sha}, Email: ${emailBlob.data.sha}`);

            // Create tree with both files
            const { data: tree } = await octokit.rest.git.createTree({
                owner,
                repo,
                base_tree: baseCommit.tree.sha,
                tree: [
                    {
                        path: `projects/${projectName}/index.html`,
                        mode: '100644',
                        type: 'blob',
                        sha: htmlBlob.data.sha,
                    },
                    {
                        path: `projects/${projectName}/.email`,
                        mode: '100644',
                        type: 'blob',
                        sha: emailBlob.data.sha,
                    },
                ],
            });

            console.log(`[DEBUG] Created tree: ${tree.sha}`);

            // Create commit
            const { data: commit } = await octokit.rest.git.createCommit({
                owner,
                repo,
                message: commitMessage,
                tree: tree.sha,
                parents: [baseSha],
            });

            console.log(`[DEBUG] Created commit: ${commit.sha}`);

            // Update branch reference
            await octokit.rest.git.updateRef({
                owner,
                repo,
                ref: 'heads/master',
                sha: commit.sha,
            });

            console.log(`[DEBUG] Updated master branch to: ${commit.sha}`);
        }

        // Send email only for new projects
        if (!isUpdate) {
            console.log(`[DEBUG] Sending deployment email to: ${email}`);
            const params = {
                Source: process.env.FROM_EMAIL,
                Destination: {
                    ToAddresses: [email],
                },
                Message: {
                    Subject: {
                        Data: 'Your website is ready',
                    },
                    Body: {
                        Text: {
                            Data: ` Your website has been successfully deployed and is now ready to use.

You can access your website at the following URL:
https://${projectName}.e-info.click

You can edit your website via:
https://editor.e-info.click/?project=${projectName}
If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
E-info team.`
                        },
                    },
                },
            };

            await ses.sendEmail(params).promise();
            console.log(`[DEBUG] Email sent successfully`);
        }

        console.log(`[DEBUG] Handler execution completed successfully`);
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({
                success: true,
                websiteUrl: `https://${projectName}.e-info.click`
            }),
        };

    } catch (error) {
        console.error('Error in generate-website handler:', error);
        console.error('Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            }),
        };
    }
};
