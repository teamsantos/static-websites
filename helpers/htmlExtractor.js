#!/usr/bin/env node

import fs from "fs";
import { JSDOM } from "jsdom";
import path from "path";

class HTMLExtractor {
    constructor(directoryPath) {
        this.directoryPath = path.resolve(directoryPath);
        this.htmlPath = path.join(this.directoryPath, 'index.html');
        this.langsDir = path.join(this.directoryPath, 'langs');
        this.assetsDir = path.join(this.directoryPath, 'assets');
        this.enJsonPath = path.join(this.langsDir, 'en.json');
        this.imagesJsonPath = path.join(this.assetsDir, 'images.json');
        this.scriptPath = path.join(this.directoryPath, 'content-loader.js');

        this.textCounter = 1;
        this.imageCounter = 1;
        this.enJson = {};
        this.imagesJson = {};
        this.titleUsed = false;
        this.descriptionUsed = false;
    }

    ensureDirectories() {
        if (!fs.existsSync(this.langsDir)) {
            fs.mkdirSync(this.langsDir, { recursive: true });
        }

        if (!fs.existsSync(this.assetsDir)) {
            fs.mkdirSync(this.assetsDir, { recursive: true });
        }
    }

    generateTextKey(text, element = null) {
        // Check for special IDs - force specific keys for first occurrence
        if (element && element.id === 'title' && !this.titleUsed) {
            this.titleUsed = true;
            return 'title';
        }
        if (element && element.id === 'description' && !this.descriptionUsed) {
            this.descriptionUsed = true;
            return 'description';
        }

        const cleanText = text.replace(/[^\w\s]/g, '').trim();
        const words = cleanText.split(/\s+/).filter(word => word.length > 0);

        if (words.length === 0) return `text_${this.textCounter}`;

        let key = words.slice(0, 3)
            .map((word, index) =>
                index === 0 ? word.toLowerCase() :
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');

        let originalKey = key;
        let counter = 1;
        while (this.enJson.hasOwnProperty(key)) {
            key = `${originalKey}_${counter}`;
            counter++;
        }

        return key;
    }

    generateImageKey() {
        return `image_${this.imageCounter}`;
    }

    hasOnlyTextContent(element) {
        for (let child of element.childNodes) {
            if (child.nodeType === 1) {
                return false;
            }
        }
        return element.textContent.trim().length > 0;
    }

    shouldSkipElement(element) {
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'HEAD'];
        return skipTags.includes(element.tagName);
    }

    processElement(element) {
        if (this.shouldSkipElement(element)) {
            // Special case: if it's HEAD, still process its children
            if (element.tagName === 'HEAD') {
                const children = Array.from(element.children);
                for (let child of children) {
                    this.processElement(child);
                }
            }
            return;
        }

        // Handle TITLE tag in head
        if (element.tagName === 'TITLE') {
            const titleText = element.textContent.trim();
            if (titleText) {
                const textKey = this.generateTextKey(titleText, element);
                element.setAttribute('data-title-text-id', textKey);
                element.textContent = ''; // Remove the title text
                this.enJson[textKey] = titleText;
                this.textCounter++;
            }
            return; // Don't process children of title
        }

        // Handle META tags in head
        if (element.tagName === 'META') {
            const content = element.getAttribute('content');
            const name = element.getAttribute('name') || element.getAttribute('property');

            if (content && content.trim() && name) {
                const textKey = this.generateTextKey(content, element);
                element.setAttribute('data-meta-content-id', textKey);
                element.removeAttribute('content'); // Remove the content attribute
                this.enJson[textKey] = content.trim();
                this.textCounter++;
            }
            return; // Don't process children of meta
        }

        if (element.tagName === 'IMG') {
            const src = element.getAttribute('src');
            if (src) {
                const imageKey = this.generateImageKey();
                element.setAttribute('data-image-src', imageKey);
                element.removeAttribute('src'); // Remove the src attribute
                this.imagesJson[imageKey] = src;
                this.imageCounter++;
            }

            const alt = element.getAttribute('alt');
            if (alt && alt.trim()) {
                const textKey = this.generateTextKey(alt, element);
                element.setAttribute('data-alt-text-id', textKey);
                element.removeAttribute('alt'); // Remove the alt attribute
                this.enJson[textKey] = alt.trim();
                this.textCounter++;
            }
        }

        const style = element.getAttribute('style');
        if (style && style.includes('background-image')) {
            const matches = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/);
            if (matches) {
                const imageKey = this.generateImageKey();
                element.setAttribute('data-bg-image', imageKey);
                // Remove background-image from style
                const newStyle = style.replace(/background-image\s*:\s*url\(['"]?[^'")]+['"]?\)\s*;?/, '').trim();
                if (newStyle) {
                    element.setAttribute('style', newStyle);
                } else {
                    element.removeAttribute('style');
                }
                this.imagesJson[imageKey] = matches[1];
                this.imageCounter++;
            }
        }

        const title = element.getAttribute('title');
        if (title && title.trim()) {
            const textKey = this.generateTextKey(title, element);
            element.setAttribute('data-title-text-id', textKey);
            element.removeAttribute('title'); // Remove the title attribute
            this.enJson[textKey] = title.trim();
            this.textCounter++;
        }

        if (['BUTTON', 'INPUT', 'TEXTAREA'].includes(element.tagName)) {
            let text = '';

            if (element.tagName === 'BUTTON') {
                text = element.textContent.trim();
                if (text) {
                    element.textContent = ''; // Remove the text content
                }
            } else if (element.tagName === 'INPUT') {
                const placeholder = element.getAttribute('placeholder');
                const value = element.getAttribute('value');
                text = placeholder || value || '';
                if (placeholder) {
                    element.removeAttribute('placeholder'); // Remove placeholder
                }
                if (value) {
                    element.removeAttribute('value'); // Remove value
                }
            } else if (element.tagName === 'TEXTAREA') {
                const placeholder = element.getAttribute('placeholder');
                text = placeholder || element.textContent.trim();
                if (placeholder) {
                    element.removeAttribute('placeholder'); // Remove placeholder
                }
                if (element.textContent.trim()) {
                    element.textContent = ''; // Remove text content
                }
            }

            if (text) {
                const textKey = this.generateTextKey(text, element);
                element.setAttribute('data-text-id', textKey);
                this.enJson[textKey] = text;
                this.textCounter++;
            }
        }

        else if (this.hasOnlyTextContent(element)) {
            const text = element.textContent.trim();
            if (text) {
                const textKey = this.generateTextKey(text, element);
                element.setAttribute('data-text-id', textKey);
                element.textContent = ''; // Remove the text content
                this.enJson[textKey] = text;
                this.textCounter++;
            }
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.processElement(child);
        }
    }

    injectTextContent(element, langData) {
        if (this.shouldSkipElement(element)) {
            // Special case: if it's HEAD, still process its children
            if (element.tagName === 'HEAD') {
                const children = Array.from(element.children);
                for (let child of children) {
                    this.injectTextContent(child, langData);
                }
            }
            return;
        }

        // Inject text content
        const textId = element.getAttribute('data-text-id');
        if (textId && langData[textId]) {
            if (element.tagName === 'BUTTON') {
                element.textContent = langData[textId];
            } else if (element.tagName === 'TEXTAREA') {
                element.textContent = langData[textId];
            } else if (element.tagName === 'INPUT') {
                const inputType = element.getAttribute('type');
                if (inputType === 'submit' || inputType === 'button') {
                    element.setAttribute('value', langData[textId]);
                } else {
                    element.setAttribute('placeholder', langData[textId]);
                }
            } else {
                // For other elements that had text content (like h1, p, div, etc.)
                element.textContent = langData[textId];
            }
        }

        // Inject alt text
        const altTextId = element.getAttribute('data-alt-text-id');
        if (altTextId && langData[altTextId]) {
            element.setAttribute('alt', langData[altTextId]);
        }

        // Inject title text
        const titleTextId = element.getAttribute('data-title-text-id');
        if (titleTextId && langData[titleTextId]) {
            if (element.tagName === 'TITLE') {
                element.textContent = langData[titleTextId];
            } else {
                element.setAttribute('title', langData[titleTextId]);
            }
        }

        // Inject meta content
        const metaContentId = element.getAttribute('data-meta-content-id');
        if (metaContentId && langData[metaContentId]) {
            element.setAttribute('content', langData[metaContentId]);
        }

        // Inject image sources
        const imageSrc = element.getAttribute('data-image-src');
        if (imageSrc && this.imagesJson[imageSrc]) {
            element.setAttribute('src', this.imagesJson[imageSrc]);
        }

        // Inject background images
        const bgImage = element.getAttribute('data-bg-image');
        if (bgImage && this.imagesJson[bgImage]) {
            const currentStyle = element.getAttribute('style') || '';
            const bgImageStyle = `background-image: url('${this.imagesJson[bgImage]}')`;
            const newStyle = currentStyle ? `${currentStyle}; ${bgImageStyle}` : bgImageStyle;
            element.setAttribute('style', newStyle);
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.injectTextContent(child, langData);
        }
    }

    async inject(langFile = 'en') {
        try {
            const langJsonPath = path.join(this.langsDir, `${langFile}.json`);

            if (!fs.existsSync(langJsonPath)) {
                throw new Error(`Language file not found: ${langJsonPath}`);
            }

            if (!fs.existsSync(this.imagesJsonPath)) {
                throw new Error(`Images file not found: ${this.imagesJsonPath}`);
            }

            const langData = JSON.parse(fs.readFileSync(langJsonPath, 'utf8'));
            this.imagesJson = JSON.parse(fs.readFileSync(this.imagesJsonPath, 'utf8'));

            const htmlContent = fs.readFileSync(this.htmlPath, 'utf8');
            const dom = new JSDOM(htmlContent);
            const document = dom.window.document;

            // Inject content into head section
            if (document.head) {
                this.injectTextContent(document.head, langData);
            }

            // Inject content into body section
            if (document.body) {
                this.injectTextContent(document.body, langData);
            }

            const injectedHtmlPath = path.join(this.directoryPath, 'index.processed.html');
            fs.writeFileSync(injectedHtmlPath, dom.serialize(), 'utf8');

            console.log(`✅ Text injected successfully into ${injectedHtmlPath}`);
        } catch (error) {
            console.error('❌ Error injecting text:', error.message);
            process.exit(1);
        }
    }

    generateContentLoaderScript() {
        const scriptContent = `// Content Loader Script - Generated by HTML Extractor
// This script loads content from JSON files and populates the HTML

class ContentLoader {
    constructor() {
        this.langData = {};
        this.imageData = {};
        this.isLoaded = false;
    }

    async loadContent(lang = 'en') {
        try {
            // Load language data
            const langResponse = await fetch(\`./langs/\${lang}.json\`);
            if (!langResponse.ok) {
                throw new Error(\`Failed to load language file: \${langResponse.status}\`);
            }
            this.langData = await langResponse.json();

            // Load image data
            const imageResponse = await fetch('./assets/images.json');
            if (!imageResponse.ok) {
                throw new Error(\`Failed to load images file: \${imageResponse.status}\`);
            }
            this.imageData = await imageResponse.json();

            this.isLoaded = true;
            this.populateContent();
            console.log('✅ Content loaded successfully');
        } catch (error) {
            console.error('❌ Error loading content:', error.message);
        }
    }

    populateContent() {
        if (!this.isLoaded) {
            console.warn('Content not loaded yet. Call loadContent() first.');
            return;
        }

        // Populate text content
        const textElements = document.querySelectorAll('[data-text-id]');
        textElements.forEach(element => {
            const textId = element.getAttribute('data-text-id');
            if (textId && this.langData[textId]) {
                if (element.tagName === 'BUTTON') {
                    element.textContent = this.langData[textId];
                } else if (element.tagName === 'TEXTAREA') {
                    element.textContent = this.langData[textId];
                } else if (element.tagName === 'INPUT') {
                    const inputType = element.getAttribute('type');
                    if (inputType === 'submit' || inputType === 'button') {
                        element.setAttribute('value', this.langData[textId]);
                    } else {
                        element.setAttribute('placeholder', this.langData[textId]);
                    }
                } else {
                    // For other elements (h1, p, div, etc.)
                    element.textContent = this.langData[textId];
                }
            }
        });

        // Populate alt text
        const altElements = document.querySelectorAll('[data-alt-text-id]');
        altElements.forEach(element => {
            const altTextId = element.getAttribute('data-alt-text-id');
            if (altTextId && this.langData[altTextId]) {
                element.setAttribute('alt', this.langData[altTextId]);
            }
        });

        // Populate title text
        const titleElements = document.querySelectorAll('[data-title-text-id]');
        titleElements.forEach(element => {
            const titleTextId = element.getAttribute('data-title-text-id');
            if (titleTextId && this.langData[titleTextId]) {
                if (element.tagName === 'TITLE') {
                    element.textContent = this.langData[titleTextId];
                } else {
                    element.setAttribute('title', this.langData[titleTextId]);
                }
            }
        });

        // Populate meta content
        const metaElements = document.querySelectorAll('[data-meta-content-id]');
        metaElements.forEach(element => {
            const metaContentId = element.getAttribute('data-meta-content-id');
            if (metaContentId && this.langData[metaContentId]) {
                element.setAttribute('content', this.langData[metaContentId]);
            }
        });

        // Populate image sources
        const imageElements = document.querySelectorAll('[data-image-src]');
        imageElements.forEach(element => {
            const imageSrc = element.getAttribute('data-image-src');
            if (imageSrc && this.imageData[imageSrc]) {
                element.setAttribute('src', this.imageData[imageSrc]);
            }
        });

        // Populate background images
        const bgImageElements = document.querySelectorAll('[data-bg-image]');
        bgImageElements.forEach(element => {
            const bgImage = element.getAttribute('data-bg-image');
            if (bgImage && this.imageData[bgImage]) {
                const currentStyle = element.getAttribute('style') || '';
                const bgImageStyle = \`background-image: url('\${this.imageData[bgImage]}')\`;
                const newStyle = currentStyle ? \`\${currentStyle}; \${bgImageStyle}\` : bgImageStyle;
                element.setAttribute('style', newStyle);
            }
        });
    }

    // Method to change language dynamically
    async changeLanguage(lang) {
        await this.loadContent(lang);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const loader = new ContentLoader();
    loader.loadContent();
});

// Export for manual usage
window.ContentLoader = ContentLoader;
`;

        return scriptContent;
    }

    async process() {
        try {
            if (!fs.existsSync(this.htmlPath)) {
                throw new Error(`HTML file not found: ${this.htmlPath}`);
            }


            const htmlContent = fs.readFileSync(this.htmlPath, 'utf8');

            const dom = new JSDOM(htmlContent);
            const document = dom.window.document;

            this.textCounter = 1;
            this.imageCounter = 1;
            this.enJson = {};
            this.imagesJson = {};
            this.titleUsed = false;
            this.descriptionUsed = false;

            // Process head section
            if (document.head) {
                this.processElement(document.head);
            }

            // Process body section
            if (document.body) {
                this.processElement(document.body);
            }

            this.ensureDirectories();

            fs.writeFileSync(this.enJsonPath, JSON.stringify(this.enJson, null, 2), 'utf8');
            fs.writeFileSync(this.imagesJsonPath, JSON.stringify(this.imagesJson, null, 2), 'utf8');

            // Generate and save the content loader script
            const scriptContent = this.generateContentLoaderScript();
            fs.writeFileSync(this.scriptPath, scriptContent, 'utf8');

            const newBakFilePath = path.join(this.directoryPath, "index.bak.html");
            fs.rename(this.htmlPath, newBakFilePath, (err) => {
                if (err) throw err;
            });

            // Add script tag to load content automatically
            const scriptTag = document.createElement('script');
            scriptTag.src = 'content-loader.js';
            scriptTag.type = 'module';
            scriptTag.defer = true;

            // Insert before closing body tag
            if (document.body) {
                document.body.appendChild(scriptTag);
            }

            const modifiedHtmlPath = path.join(this.directoryPath, 'index.html');
            fs.writeFileSync(modifiedHtmlPath, dom.serialize(), 'utf8');

            console.log(`✅ Text extracted successfully. Original saved as ${newBakFilePath}`);
            console.log(`✅ Content loader script generated: ${this.scriptPath}`);
            console.log('✅ Script tag added to HTML for automatic content loading');
        } catch (error) {
            console.error('❌ Error processing HTML:', error.message);
            process.exit(1);
        }
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage:');
    console.log('  node htmlExtractor.js <directory> extract    # Extract text from HTML');
    console.log('  node htmlExtractor.js <directory> inject [lang]  # Inject text back into HTML');
    process.exit(1);
}

const directoryPath = args[0];
const command = args[1] || 'extract';
const lang = args[2] || 'en';

if (!fs.existsSync(directoryPath)) {
    console.error(`❌ Directory does not exist: ${directoryPath}`);
    process.exit(1);
}

const extractor = new HTMLExtractor(directoryPath);

if (command === 'extract') {
    extractor.process();
} else if (command === 'inject') {
    extractor.inject(lang);
} else {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Available commands: extract, inject');
    process.exit(1);
}
