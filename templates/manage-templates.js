// Template Management Utility
// This script helps manage the templates registry and validate template structure

class TemplateManager {
    constructor() {
        this.registryPath = './templates/templates-registry.json';
        this.templatesPath = './templates/';
    }

    // Validate template structure
    async validateTemplate(templateId) {
        const requiredFiles = [
            `templates/${templateId}/index.html`,
            `templates/${templateId}/lang_en.json`,
            `templates/${templateId}/images.json`
        ];

        const missingFiles = [];

        for (const file of requiredFiles) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    missingFiles.push(file);
                }
            } catch (error) {
                missingFiles.push(file);
            }
        }

        return {
            valid: missingFiles.length === 0,
            missingFiles
        };
    }

    // Add a new template to the registry
    async addTemplate(templateData) {
        try {
            const registry = await this.loadRegistry();

            // Validate template structure
            const validation = await this.validateTemplate(templateData.id);
            if (!validation.valid) {
                throw new Error(`Template validation failed. Missing files: ${validation.missingFiles.join(', ')}`);
            }

            // Check if template already exists
            const existingIndex = registry.templates.findIndex(t => t.id === templateData.id);
            if (existingIndex !== -1) {
                // Update existing template
                registry.templates[existingIndex] = { ...registry.templates[existingIndex], ...templateData };
            } else {
                // Add new template
                registry.templates.push(templateData);
            }

            // Sort templates by order
            registry.templates.sort((a, b) => (a.order || 999) - (b.order || 999));

            await this.saveRegistry(registry);
            console.log(`Template ${templateData.id} added/updated successfully`);

        } catch (error) {
            console.error('Error adding template:', error);
            throw error;
        }
    }

    // Remove a template from the registry
    async removeTemplate(templateId) {
        try {
            const registry = await this.loadRegistry();
            registry.templates = registry.templates.filter(t => t.id !== templateId);
            await this.saveRegistry(registry);
            console.log(`Template ${templateId} removed successfully`);
        } catch (error) {
            console.error('Error removing template:', error);
            throw error;
        }
    }

    // List all templates
    async listTemplates() {
        try {
            const registry = await this.loadRegistry();
            return registry.templates;
        } catch (error) {
            console.error('Error listing templates:', error);
            throw error;
        }
    }

    // Load registry from file
    async loadRegistry() {
        const response = await fetch(this.registryPath);
        if (!response.ok) {
            throw new Error('Failed to load templates registry');
        }
        return await response.json();
    }

    // Save registry to file (in a real implementation, this would be server-side)
    async saveRegistry(registry) {
        // In a static site, you'd need to update this manually or use a build process
        console.log('Registry updated:', registry);
        console.log('Note: In a static site, you need to manually update templates-registry.json');
        return registry;
    }

    // Generate template preview data
    async generatePreview(templateId) {
        try {
            const templateLangPath = `templates/${templateId}/lang_en.json`;
            const response = await fetch(templateLangPath);

            if (!response.ok) {
                throw new Error('Failed to load template language data');
            }

            const langData = await response.json();

            return {
                id: templateId,
                name: langData.name || 'Unnamed Template',
                description: langData.description || 'No description available',
                features: this.extractFeatures(langData),
                preview: this.generatePreviewImage(templateId)
            };
        } catch (error) {
            console.error('Error generating preview:', error);
            throw error;
        }
    }

    // Extract features from template language data
    extractFeatures(langData) {
        const features = [];

        if (langData.hero) features.push('Hero Section');
        if (langData.about) features.push('About Section');
        if (langData.services) features.push('Services');
        if (langData.projects) features.push('Projects');
        if (langData.contact) features.push('Contact Form');
        if (langData.testimonials) features.push('Testimonials');

        return features;
    }

    // Generate preview image path
    generatePreviewImage(templateId) {
        return `templates/${templateId}/preview.jpg`;
    }
}

// Export for use in other scripts
window.TemplateManager = TemplateManager;

// Example usage:
/*
// Add a new template
const manager = new TemplateManager();
await manager.addTemplate({
    id: "new-template",
    name: "New Template",
    subTitle: "Category",
    description: "Description of the new template",
    imageURL: "./assets/new-template.svg",
    url: "./templates/new-template/",
    template: "new-template",
    featured: false,
    order: 3,
    category: "business"
});

// List all templates
const templates = await manager.listTemplates();
console.log(templates);
*/