import AWS from "aws-sdk";
import { Octokit } from "octokit";
import { validateImages, validateLanguageStrings, validateColorsObject } from "./shared/validators.js";
import { injectContent, validateContentBeforeInjection } from "./shared/templateInjection.js";
import { optimizeImage, uploadOptimizedImages, generateSrcset } from "./shared/imageOptimization.js";
import { getTemplate, cacheTemplate, getLanguageFile, cacheLanguageFile, getCacheStats } from "./shared/cache.js";

// Note: X-Ray tracing disabled by default (requires aws-xray-sdk-core package)
// To enable X-Ray: add aws-xray-sdk-core to dependencies and uncomment code below
// import AWSXRay from "aws-xray-sdk-core";
// if (process.env.XRAY_ENABLED === 'true') {
//     AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
//     AWS = AWSXRay.captureAPIGateway(AWS);
// }

const ses = new AWS.SES({ region: process.env.AWS_SES_REGION });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();
const METADATA_TABLE = process.env.DYNAMODB_METADATA_TABLE || "websites-metadata";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

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
        const response = await s3.getObject({
            Bucket: bucketName,
            Key: 'metadata.json'
        }).promise();

        const metadataContent = response.Body.toString('utf-8');
        const metadata = JSON.parse(metadataContent);

        if (!metadata[operationId]) {
            throw new Error(`Operation ID '${operationId}' not found in metadata`);
        }

        const operationMetadata = metadata[operationId];
        return operationMetadata;
    } catch (error) {
        console.error('Error fetching metadata from S3:', error);
        throw error;
    }
}

async function processImages(images, projectName) {
    const updatedImages = {};
    const bucketName = process.env.S3_BUCKET_NAME;
    const uploadPromises = [];

    for (const [key, value] of Object.entries(images)) {
        // Check if it's a URL (starts with http/https) or a data URL (base64 image content)
        if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            // It's already a URL, keep as is
            updatedImages[key] = value;
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
            // It's base64 image data, optimize and upload to S3 (PARALLEL)
            const matches = value.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) {
                throw new Error(`Invalid image data for ${key}`);
            }

            const imageFormat = matches[1];
            const imageData = matches[2];
            const imageName = key;

            // Push optimization and upload to parallel queue
            uploadPromises.push(
                (async () => {
                    try {
                        // Optimize image (generates multiple sizes and formats)
                        console.log(`[Performance] Starting image optimization for ${imageName}...`);
                        const optimizedImages = await optimizeImage(imageData, imageName, imageFormat);

                        // Upload all variants to S3 in parallel
                        const s3Paths = await uploadOptimizedImages(optimizedImages, projectName, imageName);
                        
                        // Return responsive image URL with srcset
                        updatedImages[key] = s3Paths.md || `/images/${imageName}.${imageFormat}`;
                        console.log(`[Performance] Image optimized and uploaded: ${imageName}`);
                    } catch (error) {
                        // Fallback: upload original image if optimization fails
                        console.warn(`[Performance] Image optimization failed for ${imageName}, uploading original:`, error);
                        const s3Key = `projects/${projectName}/images/${imageName}.${imageFormat}`;
                        const buffer = Buffer.from(imageData, 'base64');
                        
                        await s3.putObject({
                            Bucket: bucketName,
                            Key: s3Key,
                            Body: buffer,
                            ContentType: `image/${imageFormat}`,
                            CacheControl: "public, max-age=31536000"
                        }).promise();

                        updatedImages[key] = `/images/${imageName}.${imageFormat}`;
                    }
                })()
            );
        } else {
            // Assume it's already a path or other valid value
            updatedImages[key] = value;
        }
    }

    // Wait for all image uploads to complete in parallel
    if (uploadPromises.length > 0) {
        console.log(`[Performance] Uploading ${uploadPromises.length} images in parallel...`);
        await Promise.all(uploadPromises);
        console.log(`[Performance] All images uploaded successfully`);
    }

    return updatedImages;
}

async function getTemplateFromS3(templateId) {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        const s3Key = `templates/${templateId}/index.html`;

        const response = await s3.getObject({
            Bucket: bucketName,
            Key: s3Key
        }).promise();

        const templateHtml = response.Body.toString('utf-8');
        return templateHtml;
    } catch (error) {
        console.error(`Error fetching template from S3:`, error);
        throw error;
    }
}

async function generateHtmlFromTemplate(templateId, customImages, customLangs, customTextColors, customSectionBackgrounds, octokit, owner, repo) {
    const startTime = Date.now();

    try {
        // Load base template HTML (with caching)
        let templateHtml = getTemplate(templateId);
        if (!templateHtml) {
            console.log(`[Cache] Template ${templateId} not cached, fetching from S3...`);
            templateHtml = await getTemplateFromS3(`${templateId}`.toLowerCase());
            cacheTemplate(templateId, templateHtml);
        }

        // Load base langs and images from GitHub (with caching)
        const baseLangsPath = `templates/${templateId}/langs/en.json`;
        const baseImagesPath = `templates/${templateId}/assets/images.json`;

        let baseLangs = getLanguageFile(templateId, 'en') || {};
        let baseImages = {};

        // Only fetch if not cached
        if (Object.keys(baseLangs).length === 0) {
            try {
                const response = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: baseLangsPath,
                });
                baseLangs = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
                cacheLanguageFile(templateId, 'en', baseLangs);
            } catch (error) {
                if (error.status !== 404) {
                    throw error;
                }
            }
        }

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: baseImagesPath,
            });
            baseImages = JSON.parse(Buffer.from(response.data.content, 'base64').toString('utf8'));
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
        }

        // Merge custom data with base data (custom overrides base)
        const mergedLangs = { ...baseLangs, ...customLangs };
        const mergedImages = { ...baseImages, ...customImages };

        // PERFORMANCE: Use regex-based injection (10x faster than JSDOM)
        console.log(`[Performance] Starting HTML injection using regex-based method...`);
        const finalHtml = injectContent(templateHtml, mergedLangs, mergedImages, customTextColors, customSectionBackgrounds);

        const elapsed = Date.now() - startTime;
        console.log(`[Performance] HTML generation completed in ${elapsed}ms`);

        return finalHtml;
    } catch (error) {
        console.error('Error generating HTML from template:', error);
        throw error;
    }
}

/**
 * Upload generated index.html to S3
 * 
 * @param {string} html - Generated HTML content
 * @param {string} projectName - Project name (used in S3 path)
 * @returns {Promise<string>} - S3 path of uploaded file
 */
async function uploadIndexHtmlToS3(html, projectName) {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        const s3Key = `projects/${projectName}/index.html`;
        
        console.log(`[S3] Uploading index.html for project: ${projectName}`);
        
        const uploadResponse = await s3.putObject({
            Bucket: bucketName,
            Key: s3Key,
            Body: html,
            ContentType: 'text/html',
            CacheControl: 'public, max-age=300', // 5 minute cache for HTML
            Metadata: {
                'deployment-date': new Date().toISOString(),
                'project-name': projectName,
            }
        }).promise();
        
        const s3Path = `https://${bucketName}.s3.eu-south-2.amazonaws.com/${s3Key}`;
        console.log(`[S3] Successfully uploaded index.html to: ${s3Path}`);
        
        return s3Path;
    } catch (error) {
        console.error(`[S3] Error uploading index.html:`, error);
        throw error;
    }
}

/**
 * Invalidate CloudFront cache for the project
 * 
 * @param {string} projectName - Project name to invalidate
 * @returns {Promise<string>} - Invalidation ID
 */
async function invalidateCloudFront(projectName) {
    try {
        // Get CloudFront distribution ID from CloudFormation stack
        const cloudformation = new AWS.CloudFormation();
        
        console.log(`[CloudFront] Getting distribution ID for project: ${projectName}`);
        
        const stackResponse = await cloudformation.describeStacks({
            StackName: 'MultiTenantDistribution'
        }).promise();
        
        const distributionId = stackResponse.Stacks[0].Outputs.find(
            output => output.OutputKey === 'DistributionId'
        )?.OutputValue;
        
        if (!distributionId) {
            console.warn(`[CloudFront] Could not find distribution ID, skipping invalidation`);
            return null;
        }
        
        const cloudfront = new AWS.CloudFront();
        
        const invalidationParams = {
            DistributionId: distributionId,
            InvalidationBatch: {
                Paths: {
                    Quantity: 4,
                    Items: [
                        `/projects/${projectName}/index.html`,
                        `/projects/${projectName}/images/*`,
                        `/projects/${projectName}/css/*`,
                        `/projects/${projectName}/js/*`
                    ]
                },
                CallerReference: `${projectName}-${Date.now()}`
            }
        };
        
        const invalidationResponse = await cloudfront.createInvalidation(invalidationParams).promise();
        
        console.log(`[CloudFront] Invalidation created: ${invalidationResponse.Invalidation.Id}`);
        
        return invalidationResponse.Invalidation.Id;
    } catch (error) {
        console.error(`[CloudFront] Error invalidating cache:`, error);
        // Don't throw - cache invalidation failure shouldn't block deployment
        console.warn(`[CloudFront] Continuing without cache invalidation`);
        return null;
    }
}


/**
 * Core website generation logic (used by both API Gateway and SQS handlers)
 */
async function generateWebsiteCore(operationId) {
    // Fetch metadata from DynamoDB
    const metadataResponse = await dynamodb.get({
        TableName: METADATA_TABLE,
        Key: { operationId }
    }).promise();

    if (!metadataResponse.Item) {
        throw new Error(`Operation ID '${operationId}' not found in metadata table`);
    }

    const metadata = metadataResponse.Item;
    const { images, langs, templateId, email, projectName, textColors, sectionBackgrounds } = metadata;

    // Validate metadata
    if (!images || !langs || !templateId || !email || !projectName) {
        throw new Error('Invalid metadata: missing required fields (images, langs, templateId, email, projectName)');
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
        await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        // If no error, project exists, this is an update
        isUpdate = true;
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
        // 404 means not exists, this is a create
    }

    // Generate HTML from template and custom data
    const html = await generateHtmlFromTemplate(templateId, processedImages, langs, textColors, sectionBackgrounds, octokit, owner, repo);

    if (isUpdate) {
        // For updates, just update the index.html file
        const commitMessage = `Update ${projectName} project`;

        // Fetch the current file to get its SHA
        const currentFile = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: `projects/${projectName}/index.html`,
        });

        const updateResponse = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `projects/${projectName}/index.html`,
            message: commitMessage,
            content: Buffer.from(html).toString('base64'),
            sha: currentFile.data.sha,
        });

        console.log(`[DEBUG] Successfully updated index.html for project: ${projectName}`);
    } else {
        // For new projects, create both files in a single commit
        const commitMessage = `Add ${projectName} project`;

        // Get the current branch reference
        const { data: ref } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: 'heads/master',
        });

        const baseSha = ref.object.sha;

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

        // Create commit
        const { data: commit } = await octokit.rest.git.createCommit({
            owner,
            repo,
            message: commitMessage,
            tree: tree.sha,
            parents: [baseSha],
        });

        // Update branch reference
        await octokit.rest.git.updateRef({
            owner,
            repo,
            ref: 'heads/master',
            sha: commit.sha,
        });
    }

    // Upload generated index.html to S3
    console.log(`[Deployment] Starting S3 upload for project: ${projectName}`);
    const s3Path = await uploadIndexHtmlToS3(html, projectName);
    console.log(`[Deployment] Successfully uploaded to S3: ${s3Path}`);

    // Invalidate CloudFront cache
    console.log(`[Deployment] Invalidating CloudFront cache for project: ${projectName}`);
    const invalidationId = await invalidateCloudFront(projectName);
    if (invalidationId) {
        console.log(`[Deployment] CloudFront cache invalidation initiated: ${invalidationId}`);
    }

    // Send email only for new projects
    if (!isUpdate) {
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
    }

    return { success: true, websiteUrl: `https://${projectName}.e-info.click` };
}

/**
 * SQS Event Handler
 * Processes messages from SQS queue (called by Lambda event source mapping)
 */
async function handleSQSEvent(event) {
    const batchItemFailures = [];

    for (const record of event.Records) {
        try {
            console.log(`[SQS] Processing message: ${record.messageId}`);
            
            let messageBody;
            try {
                messageBody = JSON.parse(record.body);
            } catch (error) {
                console.error(`[SQS] Failed to parse message body for ${record.messageId}:`, error);
                batchItemFailures.push({ itemId: record.messageId });
                continue;
            }

            const { operationId } = messageBody;
            if (!operationId) {
                console.error(`[SQS] Missing operationId in message ${record.messageId}`);
                batchItemFailures.push({ itemId: record.messageId });
                continue;
            }

            // Generate website
            await generateWebsiteCore(operationId);
            console.log(`[SQS] Successfully processed operationId: ${operationId}`);

        } catch (error) {
            console.error(`[SQS] Error processing message ${record.messageId}:`, error);
            batchItemFailures.push({ itemId: record.messageId });
        }
    }

    return { batchItemFailures };
}

/**
 * API Gateway Event Handler
 * Processes HTTP requests from API Gateway
 */
async function handleAPIGatewayEvent(event) {
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
        const result = await generateWebsiteCore(operationId);
        
        // Log performance metrics
        const cacheStats = getCacheStats();
        console.log(`[Metrics] Cache stats:`, cacheStats);
        console.log(`[Metrics] Lambda memory:`, process.memoryUsage());
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
                'X-Cache-Hit-Rate': cacheStats.hitRate,
            },
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error('Error in generate-website API handler:', error);
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
}

/**
 * Main Handler
 * Routes to appropriate handler based on event source
 */
export const handler = async (event) => {
    // Detect event source: SQS events have 'Records' with 'eventSource' === 'aws:sqs'
    if (event.Records && event.Records[0]?.eventSource === 'aws:sqs') {
        console.log('[HANDLER] Routing to SQS event handler');
        return await handleSQSEvent(event);
    }

    // Otherwise, treat as API Gateway event
    console.log('[HANDLER] Routing to API Gateway event handler');
    return await handleAPIGatewayEvent(event);
};
