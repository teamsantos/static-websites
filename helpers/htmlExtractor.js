#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { extractFromHtml, injectIntoSkeleton } from "../shared/htmlExtractor.js";

class HTMLExtractor {
    constructor(directoryPath) {
        this.directoryPath = path.resolve(directoryPath);
        this.htmlPath = path.join(this.directoryPath, 'index.html');
        this.langsDir = path.join(this.directoryPath, 'langs');
        this.assetsDir = path.join(this.directoryPath, 'assets');
        this.enJsonPath = path.join(this.langsDir, 'en.json');
        this.imagesJsonPath = path.join(this.assetsDir, 'images.json');
        this.iconsJsonPath = path.join(this.assetsDir, 'icons.json');
    }

    ensureDirectories() {
        if (!fs.existsSync(this.langsDir)) {
            fs.mkdirSync(this.langsDir, { recursive: true });
        }
        if (!fs.existsSync(this.assetsDir)) {
            fs.mkdirSync(this.assetsDir, { recursive: true });
        }
    }

    async process() {
        if (!fs.existsSync(this.htmlPath)) {
            throw new Error(`HTML file not found: ${this.htmlPath}`);
        }

        const bakFilePath = path.join(this.directoryPath, "index.bak.html");
        fs.copyFileSync(this.htmlPath, bakFilePath);

        const htmlContent = fs.readFileSync(this.htmlPath, 'utf8');

        const { skeletonHtml, langs, images, icons } = extractFromHtml(htmlContent);

        this.ensureDirectories();
        fs.writeFileSync(this.enJsonPath, JSON.stringify(langs, null, 2), 'utf8');
        fs.writeFileSync(this.imagesJsonPath, JSON.stringify(images, null, 2), 'utf8');
        fs.writeFileSync(this.iconsJsonPath, JSON.stringify(icons, null, 2), 'utf8');

        const processedHtml = injectIntoSkeleton(skeletonHtml, langs, images, icons);
        fs.writeFileSync(this.htmlPath, processedHtml, 'utf8');
    }

    async inject(langFile = 'en') {
        const langJsonPath = path.join(this.langsDir, `${langFile}.json`);

        if (!fs.existsSync(langJsonPath)) {
            throw new Error(`Language file not found: ${langJsonPath}`);
        }
        if (!fs.existsSync(this.imagesJsonPath)) {
            throw new Error(`Images file not found: ${this.imagesJsonPath}`);
        }

        const langs = JSON.parse(fs.readFileSync(langJsonPath, 'utf8'));
        const images = JSON.parse(fs.readFileSync(this.imagesJsonPath, 'utf8'));
        const icons = fs.existsSync(this.iconsJsonPath)
            ? JSON.parse(fs.readFileSync(this.iconsJsonPath, 'utf8'))
            : {};

        const htmlContent = fs.readFileSync(this.htmlPath, 'utf8');
        const processedHtml = injectIntoSkeleton(htmlContent, langs, images, icons);

        const injectedHtmlPath = path.join(this.directoryPath, 'index.processed.html');
        fs.writeFileSync(injectedHtmlPath, processedHtml, 'utf8');
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
    extractor.process().catch(err => {
        console.error('❌ Error processing HTML:', err.message);
        process.exit(1);
    });
} else if (command === 'inject') {
    extractor.inject(lang).catch(err => {
        console.error('❌ Error injecting text:', err.message);
        process.exit(1);
    });
} else {
    console.error(`❌ Unknown command: ${command}`);
    process.exit(1);
}
