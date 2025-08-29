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

        this.textCounter = 1;
        this.imageCounter = 1;
        this.enJson = {};
        this.imagesJson = {};
    }

    ensureDirectories() {
        if (!fs.existsSync(this.langsDir)) {
            fs.mkdirSync(this.langsDir, { recursive: true });
        }

        if (!fs.existsSync(this.assetsDir)) {
            fs.mkdirSync(this.assetsDir, { recursive: true });
        }
    }

    generateTextKey(text) {
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
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'TITLE', 'HEAD'];
        return skipTags.includes(element.tagName);
    }

    processElement(element) {
        if (this.shouldSkipElement(element)) {
            return;
        }

        if (element.tagName === 'IMG') {
            const src = element.getAttribute('src');
            if (src) {
                const imageKey = this.generateImageKey();
                element.setAttribute('data-image-src', imageKey);
                this.imagesJson[imageKey] = src;
                this.imageCounter++;
            }

            const alt = element.getAttribute('alt');
            if (alt && alt.trim()) {
                const textKey = this.generateTextKey(alt);
                element.setAttribute('data-alt-text-id', textKey);
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
                this.imagesJson[imageKey] = matches[1];
                this.imageCounter++;
            }
        }

        const title = element.getAttribute('title');
        if (title && title.trim()) {
            const textKey = this.generateTextKey(title);
            element.setAttribute('data-title-text-id', textKey);
            this.enJson[textKey] = title.trim();
            this.textCounter++;
        }

        if (['BUTTON', 'INPUT', 'TEXTAREA'].includes(element.tagName)) {
            let text = '';

            if (element.tagName === 'BUTTON') {
                text = element.textContent.trim();
            } else if (element.tagName === 'INPUT') {
                const placeholder = element.getAttribute('placeholder');
                const value = element.getAttribute('value');
                text = placeholder || value || '';
            } else if (element.tagName === 'TEXTAREA') {
                const placeholder = element.getAttribute('placeholder');
                text = placeholder || element.textContent.trim();
            }

            if (text) {
                const textKey = this.generateTextKey(text);
                element.setAttribute('data-text-id', textKey);
                this.enJson[textKey] = text;
                this.textCounter++;
            }
        }

        else if (this.hasOnlyTextContent(element)) {
            const text = element.textContent.trim();
            if (text) {
                const textKey = this.generateTextKey(text);
                element.setAttribute('data-text-id', textKey);
                this.enJson[textKey] = text;
                this.textCounter++;
            }
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.processElement(child);
        }
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

            if (document.body) {
                this.processElement(document.body);
            }

            this.ensureDirectories();

            fs.writeFileSync(this.enJsonPath, JSON.stringify(this.enJson, null, 2), 'utf8');
            fs.writeFileSync(this.imagesJsonPath, JSON.stringify(this.imagesJson, null, 2), 'utf8');

            const newBakFilePath = path.join(this.directoryPath, "index.bak.html");
            fs.rename(this.htmlPath, newBakFilePath, (err) => {
                if (err) throw err;
            });

            const modifiedHtmlPath = path.join(this.directoryPath, 'index.html');
            fs.writeFileSync(modifiedHtmlPath, dom.serialize(), 'utf8');
        } catch (error) {
            console.error('❌ Error processing HTML:', error.message);
            process.exit(1);
        }
    }
}

const args = process.argv.slice(2);

if (args.length === 0) {
    process.exit(1);
}

const directoryPath = args[0];

if (!fs.existsSync(directoryPath)) {
    console.error(`❌ Directory does not exist: ${directoryPath}`);
    process.exit(1);
}

const extractor = new HTMLExtractor(directoryPath);
extractor.process();
