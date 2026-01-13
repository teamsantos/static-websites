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
        this.iconCounter = 1;
        this.enJson = {};
        this.imagesJson = {};
        this.iconsJson = {};
        this.iconsJsonPath = path.join(this.assetsDir, 'icons.json');
        this.titleUsed = false;
        this.descriptionUsed = false;
    }

    generateIconKey() {
        return `icon_${this.iconCounter}`;
    }

    /**
     * Extract Font Awesome icon class from element
     * Returns the icon class (e.g., "fa-tooth", "fa-star") or null if not a Font Awesome icon
     */
    extractFontAwesomeClass(element) {
        if (element.tagName !== 'I') return null;
        
        const classList = Array.from(element.classList || []);
        // Find Font Awesome icon class (starts with fa-)
        const iconClass = classList.find(cls => 
            cls.startsWith('fa-') && 
            !['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'].includes(cls) &&
            cls !== 'fa'
        );
        
        // Check if it has a Font Awesome prefix class
        const hasPrefix = classList.some(cls => 
            ['fas', 'far', 'fal', 'fat', 'fad', 'fab', 'fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'].includes(cls)
        );
        
        if (iconClass && hasPrefix) {
            return iconClass;
        }
        
        return null;
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

    hasExtractableTextContent(element) {
        const inlineTags = ['STRONG', 'EM', 'B', 'I', 'SPAN', 'A', 'U', 'MARK', 'SMALL', 'SUB', 'SUP'];
        // BR tags break the flow - if present, don't extract as single block
        // Instead, let recursive processing handle each part separately
        
        // Check if element only contains A tags (like nav menus) - if so, don't extract as single block
        // This allows nav menus to have individually editable links
        const children = Array.from(element.children);
        if (children.length > 0 && children.every(child => child.tagName === 'A')) {
            return false;
        }

        for (let child of element.childNodes) {
            if (child.nodeType === 1) { // Element node
                // BR tags mean we should NOT extract as single block
                if (child.tagName === 'BR') {
                    return false;
                }
                if (!inlineTags.includes(child.tagName)) {
                    return false;
                }
                // Recursively check if inline child has only extractable text
                if (!this.hasExtractableTextContent(child)) {
                    return false;
                }
            } else if (child.nodeType === 3) { // Text node
                // Allow text nodes
            } else {
                // Skip comments, etc.
            }
        }
        return element.textContent.trim().length > 0;
    }

    wrapTextNodes(element) {
        // Wrap standalone text nodes in spans so they become editable
        // This is used when an element has mixed content (e.g., text + BR + more text)
        const document = element.ownerDocument;
        const childNodes = Array.from(element.childNodes);
        
        for (let node of childNodes) {
            if (node.nodeType === 3) { // Text node
                const text = node.textContent.trim();
                if (text) {
                    // Create a span wrapper for the text node
                    const span = document.createElement('span');
                    const textKey = this.generateTextKey(text);
                    span.setAttribute('data-text-id', textKey);
                    // Preserve the original whitespace by using node.textContent directly
                    // but store the trimmed version in JSON
                    span.textContent = '';
                    this.enJson[textKey] = text;
                    this.textCounter++;
                    
                    // Replace the text node with the span
                    node.parentNode.replaceChild(span, node);
                }
            }
        }
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

        // Handle Font Awesome icons (<i> elements with fa- classes)
        const iconClass = this.extractFontAwesomeClass(element);
        if (iconClass) {
            const iconKey = this.generateIconKey();
            element.setAttribute('data-icon-id', iconKey);
            this.iconsJson[iconKey] = iconClass;
            this.iconCounter++;
            // Don't process children of icon elements
            return;
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

        else if (this.hasExtractableTextContent(element)) {
            // Skip if element already has a data-text-id (preserve manual assignments)
            if (!element.hasAttribute('data-text-id')) {
                const text = element.textContent.trim();
                if (text) {
                    const textKey = this.generateTextKey(text, element);
                    element.setAttribute('data-text-id', textKey);
                    element.textContent = ''; // Remove the text content
                    this.enJson[textKey] = text;
                    this.textCounter++;
                }
            } else {
                // Element has data-text-id, preserve the text and add to JSON
                const existingKey = element.getAttribute('data-text-id');
                const text = element.textContent.trim();
                if (text && !this.enJson[existingKey]) {
                    this.enJson[existingKey] = text;
                    element.textContent = ''; // Remove the text content for injection later
                }
            }
        }
        else {
            // Element doesn't have extractable text content as a whole
            // (e.g., has BR tags or block elements inside)
            // We need to wrap standalone text nodes in spans to make them editable
            this.wrapTextNodes(element);
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
        } catch (error) {
            console.error('❌ Error injecting text:', error.message);
            process.exit(1);
        }
    }

    injectContentIntoDOM(dom) {
        // Load the JSON files and inject content directly into the DOM
        try {
            if (!fs.existsSync(this.enJsonPath)) {
                throw new Error(`Language file not found: ${this.enJsonPath}`);
            }

            if (!fs.existsSync(this.imagesJsonPath)) {
                throw new Error(`Images file not found: ${this.imagesJsonPath}`);
            }

            const langData = JSON.parse(fs.readFileSync(this.enJsonPath, 'utf8'));
            const imageData = JSON.parse(fs.readFileSync(this.imagesJsonPath, 'utf8'));
            const iconData = fs.existsSync(this.iconsJsonPath) 
                ? JSON.parse(fs.readFileSync(this.iconsJsonPath, 'utf8')) 
                : {};
            const document = dom.window.document;

            // Inject content into head section
            if (document.head) {
                this.injectTextContent(document.head, langData, imageData, iconData);
            }

            // Inject content into body section
            if (document.body) {
                this.injectTextContent(document.body, langData, imageData, iconData);
            }

            // Write back the modified HTML
            fs.writeFileSync(this.htmlPath, dom.serialize(), 'utf8');
        } catch (error) {
            console.error('❌ Error injecting content into DOM:', error.message);
            throw error;
        }
    }

    injectTextContent(element, langData, imageData, iconData = {}) {
        if (this.shouldSkipElement(element)) {
            // Special case: if it's HEAD, still process its children
            if (element.tagName === 'HEAD') {
                const children = Array.from(element.children);
                for (let child of children) {
                    this.injectTextContent(child, langData, imageData, iconData);
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
                // For other elements (h1, p, div, etc.)
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
        if (imageSrc && imageData[imageSrc]) {
            element.setAttribute('src', imageData[imageSrc]);
        }

        // Inject background images
        const bgImage = element.getAttribute('data-bg-image');
        if (bgImage && imageData[bgImage]) {
            const currentStyle = element.getAttribute('style') || '';
            const bgImageStyle = `background-image: url('${imageData[bgImage]}')`;
            const newStyle = currentStyle ? `${currentStyle}; ${bgImageStyle}` : bgImageStyle;
            element.setAttribute('style', newStyle);
        }

        // Inject icon classes (Font Awesome icons)
        const iconId = element.getAttribute('data-icon-id');
        if (iconId && iconData[iconId]) {
            // The icon class is stored in iconData, we just need to ensure it's on the element
            // The class should already be there, but this ensures consistency
            const iconClass = iconData[iconId];
            if (!element.classList.contains(iconClass)) {
                element.classList.add(iconClass);
            }
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.injectTextContent(child, langData, imageData, iconData);
        }
    }

    async process() {
        try {
            if (!fs.existsSync(this.htmlPath)) {
                throw new Error(`HTML file not found: ${this.htmlPath}`);
            }

            // Backup the original HTML
            const newBakFilePath = path.join(this.directoryPath, "index.bak.html");
            fs.copyFileSync(this.htmlPath, newBakFilePath);

            const htmlContent = fs.readFileSync(this.htmlPath, 'utf8');

            const dom = new JSDOM(htmlContent);
            const document = dom.window.document;

            this.textCounter = 1;
            this.imageCounter = 1;
            this.iconCounter = 1;
            this.enJson = {};
            this.imagesJson = {};
            this.iconsJson = {};
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
            fs.writeFileSync(this.iconsJsonPath, JSON.stringify(this.iconsJson, null, 2), 'utf8');

            // Inject the content back into the HTML for single-file builds
            this.injectContentIntoDOM(dom);

            // Write the processed HTML with actual content
            fs.writeFileSync(this.htmlPath, dom.serialize(), 'utf8');

        } catch (error) {
            console.error('❌ Error processing HTML:', error.message);
            process.exit(1);
        }
    }

    createContentLoader() {
        // Read the JSON files
        const langData = JSON.parse(fs.readFileSync(this.enJsonPath, 'utf8'));
        const imageData = JSON.parse(fs.readFileSync(this.imagesJsonPath, 'utf8'));

        const loaderContent = `// content-loader.js - Injects embedded content data
(function() {
    try {
        // Embedded language and image data
        const langData = ${JSON.stringify(langData, null, 2)};
        const imageData = ${JSON.stringify(imageData, null, 2)};

        // Inject text content
        injectTextContent(document.head, langData, imageData);
        injectTextContent(document.body, langData, imageData);

    } catch (error) {
        console.error('❌ Error loading content:', error);
    }

    function injectTextContent(element, langData, imageData) {
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
        if (imageSrc && imageData[imageSrc]) {
            element.setAttribute('src', imageData[imageSrc];
        }

        // Inject background images
        const bgImage = element.getAttribute('data-bg-image');
        if (bgImage && imageData[bgImage]) {
            const currentStyle = element.getAttribute('style') || '';
            const bgImageStyle = \`background-image: url('\${imageData[bgImage]}')\`;
            const newStyle = currentStyle ? \`\${currentStyle}; \${bgImageStyle}\` : bgImageStyle;
            element.setAttribute('style', newStyle);
        }

        // Process children
        const children = Array.from(element.children);
        for (let child of children) {
            injectTextContent(child, langData, imageData);
        }
    }
})();
`;

        return loaderContent;
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
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
    process.exit(1);
}
