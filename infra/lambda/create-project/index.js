import { Octokit } from "octokit";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ses = new AWS.SES({ region: process.env.AWS_SES_REGION });

async function generateHtmlFromTemplate(templateId, customImages, customLangs) {
    try {
        // Load base template HTML (processed version with data attributes)
        const templatePath = path.join(__dirname, '../../../templates', templateId, 'index.html');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templatePath}`);
        }

        const templateHtml = fs.readFileSync(templatePath, 'utf8');

        // Load base langs and images
        const baseLangsPath = path.join(__dirname, '../../../templates', templateId, 'langs', 'en.json');
        const baseImagesPath = path.join(__dirname, '../../../templates', templateId, 'assets', 'images.json');

        let baseLangs = {};
        let baseImages = {};

        if (fs.existsSync(baseLangsPath)) {
            baseLangs = JSON.parse(fs.readFileSync(baseLangsPath, 'utf8'));
        }

        if (fs.existsSync(baseImagesPath)) {
            baseImages = JSON.parse(fs.readFileSync(baseImagesPath, 'utf8'));
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

    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    try {
        // Check if project exists
        const path = `projects/${projectName}`;
        await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });

        // If no error, project exists
        return {
            statusCode: 409,
            headers: {
                'Access-Control-Allow-Origin': origin || '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
            },
            body: JSON.stringify({ error: 'Project already exists' }),
        };
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
        // 404 means not exists, proceed
    }

    // Generate HTML from template and custom data
    const html = await generateHtmlFromTemplate(templateId, images, langs);

    // Create index.html
    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/index.html`,
        message: `Add ${projectName} project`,
        content: Buffer.from(html).toString('base64'),
    });

    // Create .email file
    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `projects/${projectName}/.email`,
        message: `Add email for ${projectName}`,
        content: Buffer.from(email).toString('base64'),
    });

    // Send email
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
