#!/usr/bin/env node

/**
 * Template Screenshot Generator
 * 
 * This script automatically generates WebP screenshots of all templates
 * defined in assets/templates.json. Screenshots are saved to each template's
 * assets/images/screenshot directory.
 * 
 * Usage:
 *   node scripts/generate-screenshots.js
 * 
 * Environment Variables:
 *   BASE_URL - Base URL for templates (default: https://template.e-info.click)
 */

import { chromium } from 'playwright';
import { readFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Configuration
const CONFIG = {
    baseUrl: process.env.BASE_URL || 'template.e-info.click',
    viewport: {
        width: 800,
        height: 600
    },
    screenshotQuality: 80, // WebP quality (0-100)
    timeout: 30000 // 30 seconds
};

/**
 * Load templates from templates.json
 */
async function loadTemplates() {
    const templatesPath = join(PROJECT_ROOT, 'assets', 'templates.json');
    const data = await readFile(templatesPath, 'utf-8');
    return JSON.parse(data);
}

/**
 * Check if a directory exists
 */
async function directoryExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure screenshot directory exists for a template
 */
async function ensureScreenshotDirectory(templateName) {
    const screenshotDir = join(
        PROJECT_ROOT,
        'templates',
        templateName,
        'assets',
        'images',
        'screenshot'
    );
    
    await mkdir(screenshotDir, { recursive: true });
    return screenshotDir;
}

/**
 * Generate screenshot for a single template
 */
async function generateScreenshot(browser, template) {
    const { name, comingSoon, title } = template;
    
    // Skip templates marked as coming soon
    if (comingSoon) {
        console.log(`⏭️  Skipping "${title}" (coming soon)`);
        return { success: true, skipped: true };
    }
    
    // Check if template directory exists
    const templateDir = join(PROJECT_ROOT, 'templates', name);
    if (!(await directoryExists(templateDir))) {
        console.warn(`⚠️  Template directory not found: ${name}`);
        return { success: false, error: 'Directory not found' };
    }
    
    const url = `https://${name}.${CONFIG.baseUrl}`;
    const screenshotDir = await ensureScreenshotDirectory(name);
    const screenshotPath = join(screenshotDir, 'index.webp');
    
    console.log(`📸 Generating screenshot for "${title}"...`);
    console.log(`   URL: ${url}`);
    
    try {
        const page = await browser.newPage({
            viewport: CONFIG.viewport
        });
        
        // Navigate to the template URL
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: CONFIG.timeout
        });
        
        // Wait a bit for any animations to complete
        await page.waitForTimeout(1000);
        
        // Take screenshot
        await page.screenshot({
            path: screenshotPath,
            type: 'webp',
            quality: CONFIG.screenshotQuality
        });
        
        await page.close();
        
        console.log(`✅ Screenshot saved: ${screenshotPath}`);
        return { success: true, path: screenshotPath };
        
    } catch (error) {
        console.error(`❌ Failed to generate screenshot for "${title}":`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Starting template screenshot generation...\n');
    console.log(`Configuration:
    - Base URL: ${CONFIG.baseUrl}
    - Viewport: ${CONFIG.viewport.width}x${CONFIG.viewport.height}
    - Quality: ${CONFIG.screenshotQuality}%
    - Timeout: ${CONFIG.timeout}ms\n`);
    
    try {
        // Load templates
        const templates = await loadTemplates();
        console.log(`📋 Found ${templates.length} templates\n`);
        
        // Launch browser
        console.log('🌐 Launching browser...');
        const browser = await chromium.launch({
            headless: true
        });
        
        // Generate screenshots
        const results = [];
        for (const template of templates) {
            const result = await generateScreenshot(browser, template);
            results.push({ template: template.name, ...result });
        }
        
        // Close browser
        await browser.close();
        
        // Print summary
        console.log('\n📊 Summary:');
        const successful = results.filter(r => r.success && !r.skipped).length;
        const skipped = results.filter(r => r.skipped).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`   ✅ Successful: ${successful}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed templates:');
            results
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.template}: ${r.error}`));
            process.exit(1);
        }
        
        console.log('\n✨ Screenshot generation complete!');
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
main();
