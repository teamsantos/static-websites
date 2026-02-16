import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, '../templates');
const outputFile = path.join(__dirname, '../assets/templates.json');

async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

async function comingSoon(path) {
    if (await fileExists(path)) {
        return true;
    }
    return false;
}

async function getLangsFromTemplate(name) {
    const data = await fs.readFile(`${templatesDir}/${name}/langs/en.json`, "utf-8");
    return JSON.parse(data);
}

async function getTemplates() {
    const templates = [];
    const dirs = fsSync.readdirSync(templatesDir, { withFileTypes: true });

    for (const dir of dirs) {
        if (dir.isDirectory()) {
            const langs = await getLangsFromTemplate(dir.name);
            const _comingSoon = await comingSoon(`${templatesDir}/${dir.name}/.commingsoon`);
            const _liveFrame = await fileExists(`${templatesDir}/${dir.name}/.liveframe`);
            templates.push({
                "name": dir.name,
                "comingSoon": _comingSoon,
                "title": langs["title"],
                "description": langs["description"],
                "screenshot": _liveFrame ? null : `https://${dir.name.toLowerCase()}.template.e-info.click/assets/images/screenshot.webp`
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
    } catch (error) {
        console.error('Error generating templates.json:', error);
    }
}

main();
