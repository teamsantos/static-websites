import { Octokit } from "octokit";
import AWS from "aws-sdk";
import { JSDOM } from "jsdom";

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

async function processImages(images, projectName) {
    const updatedImages = {};
    const bucketName = process.env.S3_BUCKET_NAME;

    for (const [key, value] of Object.entries(images)) {
        // Check if it's a URL (starts with http/https) or a data URL (base64 image content)
        if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            // It's already a URL, keep as is
            updatedImages[key] = value;
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
            // It's base64 image data, upload to S3
            const matches = value.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) {
                throw new Error(`Invalid image data for ${key}`);
            }
            const imageFormat = matches[1];
            const imageData = matches[2];
            const imageName = `${key}.${imageFormat}`;
            const s3Key = `projects/${projectName}/images/${imageName}`;

            const buffer = Buffer.from(imageData, 'base64');

            await s3.putObject({
                Bucket: bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: `image/${imageFormat}`,
                ACL: 'public-read'
            }).promise();

            updatedImages[key] = `/images/${imageName}`;
        } else {
            // Assume it's already a path or other valid value
            updatedImages[key] = value;
        }
    }

    return updatedImages;
}

async function generateHtmlFromTemplate(templateId, customImages, customLangs, octokit, owner, repo) {
    try {
        // Load base template HTML (processed version with data attributes)
        const templatePath = `templates/${templateId}/index.html`;
        let templateHtml;
        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: templatePath,
            });
            templateHtml = Buffer.from(response.data.content, 'base64').toString('utf8');
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Template not found: ${templatePath}`);
            }
            throw error;
        }

        // Load base langs and images
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
        } catch (error) {
            if (error.status !== 404) {
                throw error;
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

        // Inject content into HTML
        const dom = new JSDOM(templateHtml);
        const document = dom.window.document;

        injectContent(document.head, mergedLangs, mergedImages);
        injectContent(document.body, mergedLangs, mergedImages);

        return dom.serialize();
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
        element.setAttribute('alt', langs[altTextId]);
    }

    // Inject title text
    const titleTextId = element.getAttribute('data-title-text-id');
    if (titleTextId && langs[titleTextId]) {
        if (element.tagName === 'TITLE') {
            element.textContent = langs[titleTextId];
        } else {
            element.setAttribute('title', langs[titleTextId]);
        }
    }

    // Inject meta content
    const metaContentId = element.getAttribute('data-meta-content-id');
    if (metaContentId && langs[metaContentId]) {
        element.setAttribute('content', langs[metaContentId]);
    }

    // Inject image sources
    const imageSrc = element.getAttribute('data-image-src');
    if (imageSrc && images[imageSrc]) {
        element.setAttribute('src', images[imageSrc]);
    }

    // Inject background images
    const bgImage = element.getAttribute('data-bg-image');
    if (bgImage && images[bgImage]) {
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
        'https://89.152.33.66'
    ];

    const isAllowedOrigin = !origin || allowedOrigins.some(allowed =>
        origin === allowed || origin.startsWith(allowed)
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

    const { images, langs, templateId, email, name: projectName } = requestBody;

    if (!images || !langs || !templateId || !email || !projectName) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Missing required fields: images, langs, templateId, email, name' }),
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

    console.log(`Using GitHub repo: ${owner}/${repo}`);

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
    const html = await generateHtmlFromTemplate(templateId, processedImages, langs, octokit, owner, repo);

    // Create or update index.html
    const commitMessage = isUpdate ? `Update ${projectName} project` : `Add ${projectName} project`;
    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/index.html`,
        message: commitMessage,
        content: Buffer.from(html).toString('base64'),
    });

    // Create .email file if new project
    if (!isUpdate) {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `projects/${projectName}/.email`,
            message: `Add email for ${projectName}`,
            content: Buffer.from(email).toString('base64'),
        });
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

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ url: `${projectName}.e-info.click` }),
    };
};
