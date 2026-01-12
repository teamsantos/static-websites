#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

class TemplateBuildManager {
    constructor() {
        this.templatesDir = path.join(rootDir, 'templates');
    }

    /**
     * Get all template directories
     */
    getAllTemplates() {
        const items = fs.readdirSync(this.templatesDir);
        return items.filter(item => {
            const fullPath = path.join(this.templatesDir, item);
            const isDir = fs.statSync(fullPath).isDirectory();
            // Exclude hidden folders and files
            return isDir && !item.startsWith('.');
        });
    }

    /**
     * Validate template name
     */
    isValidTemplate(templateName) {
        const templatePath = path.join(this.templatesDir, templateName);
        if (!fs.existsSync(templatePath)) {
            return false;
        }
        const indexPath = path.join(templatePath, 'index.html');
        return fs.existsSync(indexPath);
    }

    /**
     * Run command and return promise
     */
    runCommand(command, args, cwd, env = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd,
                stdio: 'inherit',
                shell: true,
                env: { ...process.env, ...env }
            });

            child.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            child.on('error', err => {
                reject(err);
            });
        });
    }

    /**
     * Build a single template
     */
    async buildTemplate(templateName) {
        if (!this.isValidTemplate(templateName)) {
            throw new Error(`Invalid template: ${templateName}`);
        }

        const templatePath = path.join(this.templatesDir, templateName);
        console.log(`\n🔨 Building template: ${templateName}`);
        console.log(`   Path: ${templatePath}`);

        try {
            // Step 1: Run htmlExtractor
            console.log(`   ✓ Extracting HTML content...`);
            await this.runCommand('node', [
                path.join(rootDir, 'helpers/htmlExtractor.js'),
                templatePath
            ], rootDir);

            // Step 2: Run Vite build (run vite directly, not npm run build which also builds the editor)
            console.log(`   ✓ Running Vite build...`);
            await this.runCommand('npx', ['vite', 'build'], rootDir, {
                TEMPLATE: templateName
            });

            // Step 3: Clean up temporary files
            console.log(`   ✓ Cleaning up temporary files...`);
            const indexPath = path.join(templatePath, 'index.html');
            const contentLoaderPath = path.join(templatePath, 'content-loader.js');
            const bakPath = path.join(templatePath, 'index.bak.html');

            if (fs.existsSync(indexPath)) {
                fs.unlinkSync(indexPath);
            }
            if (fs.existsSync(contentLoaderPath)) {
                fs.unlinkSync(contentLoaderPath);
            }
            if (fs.existsSync(bakPath)) {
                fs.renameSync(bakPath, indexPath);
            }

            console.log(`✅ Template built successfully: ${templateName}`);
            console.log(`   Output: ${path.join(templatePath, 'dist')}`);

        } catch (error) {
            console.error(`❌ Error building template ${templateName}:`, error.message);
            throw error;
        }
    }

    /**
     * Build all templates
     */
    async buildAllTemplates() {
        const templates = this.getAllTemplates();

        if (templates.length === 0) {
            console.log('⚠️  No templates found to build');
            return;
        }

        console.log(`\n📦 Building ${templates.length} template(s)...`);

        const results = { success: [], failed: [] };

        for (const template of templates) {
            try {
                await this.buildTemplate(template);
                results.success.push(template);
            } catch (error) {
                results.failed.push({ name: template, error: error.message });
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Build Summary');
        console.log('='.repeat(50));
        console.log(`✅ Successful: ${results.success.length}`);
        if (results.success.length > 0) {
            results.success.forEach(t => console.log(`   • ${t}`));
        }

        if (results.failed.length > 0) {
            console.log(`\n❌ Failed: ${results.failed.length}`);
            results.failed.forEach(f => console.log(`   • ${f.name}: ${f.error}`));
            process.exit(1);
        }

        console.log('='.repeat(50));
    }
}

// Main execution
const manager = new TemplateBuildManager();
const args = process.argv.slice(2);

if (args.length === 0) {
    // Build all templates
    manager.buildAllTemplates().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
} else {
    // Build specific template(s)
    const templateNames = args;
    (async () => {
        for (const templateName of templateNames) {
            try {
                await manager.buildTemplate(templateName);
            } catch (error) {
                process.exit(1);
            }
        }
    })().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
