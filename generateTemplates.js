import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, 'templates');
const outputFile = path.join(__dirname, 'assets/templates.json');

async function getLangsFromTemplate(name) {
    // Use fs/promises for async reading
    const data = await fs.readFile(`templates/${name}/langs/en.json`, "utf-8");
    return JSON.parse(data);
}

async function getTemplates() {
    const templates = [];
    const dirs = fsSync.readdirSync(templatesDir, { withFileTypes: true });

    for (const dir of dirs) {
        if (dir.isDirectory()) {
            const langs = await getLangsFromTemplate(dir.name);
            templates.push({
                "name": dir.name,
                "commingSoon": false,
                "title": langs["title"],
                "description": langs["description"]
            });
        }
    }
    return templates;
}

async function main() {
    try {
        const templates = await getTemplates();
        const json = JSON.stringify(templates, null, 2);
        await fs.writeFile(outputFile, json);
        console.log('templates.json generated successfully');
    } catch (error) {
        console.error('Error generating templates.json:', error);
    }
}

main();
