// Template loading and processing
export class TemplateManager {
    constructor(editor) {
        this.editor = editor;
    }

    autoLoadTemplate() {
        // Get template or project name from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const templateName = urlParams.get('template');
        const projectName = urlParams.get('project');

        let itemName, itemType, itemUrl, remoteUrl;

        if (projectName) {
            itemName = projectName;
            itemType = 'project';
            itemUrl = `projects/${projectName}/index.html`;
            remoteUrl = `https://${projectName}.e-info.click`;
        } else if (templateName) {
            itemName = templateName;
            itemType = 'template';
            itemUrl = `templates/${templateName}/dist/index.html`;
            remoteUrl = `https://${templateName}.templates.e-info.click`;
            this.editor.templateId = templateName; // Store template ID for export
        } else {
            this.editor.ui.showStatus(`No ${this.editor.mode === 'create' ? 'template' : 'project'} specified. Please check your URL and try again, or contact us at ${this.editor.supportEmail}`, 'info');
            return;
        }

        if (itemName.trim() === '') {
            this.editor.ui.showStatus(`Something went wrong. Please try again later or contact us at ${this.editor.supportEmail}`, 'error');
            return;
        }

        this.editor.ui.showStatus(`Loading ${itemType}...`, 'info');

        // Fetch item from local directory
        fetch(itemUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                this.editor.templateContent = html;
                this.processTemplate();
                this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded successfully!`, 'success');
            })
            .catch(error => {
                console.error(`Error loading ${itemType}:`, error);
                // Fallback to remote URL if local fails
                this.editor.ui.showStatus(`Trying remote ${itemType}...`, 'info');

                fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        this.editor.templateContent = html;
                        this.processTemplate();
                        this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded from remote successfully!`, 'success');
                    })
                    .catch(remoteError => {
                        console.error(`Error loading remote ${itemType}:`, remoteError);
                        this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} not found. Please check the ${itemType} name or contact us at ${this.editor.supportEmail}`, 'error');
                    });
            });
    }

    clearTemplateStyles() {
        // Remove any existing template styles
        const existingTemplateStyles = document.querySelectorAll('[data-template-style]');
        existingTemplateStyles.forEach(style => style.remove());
    }

    processTemplate() {
        // Clear any existing template styles first
        this.clearTemplateStyles();

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.editor.templateContent, 'text/html');

        // Remove the e-info footer if present
        const footerToRemove = doc.getElementById('modernFooter');
        if (footerToRemove) {
            footerToRemove.remove();
        }

        // Extract and apply CSS styles from the template
        this.extractAndApplyStyles(doc);

        // Load associated JSON files if they exist
        this.editor.elements.loadTranslationFiles(doc);
        this.editor.elements.loadImageFiles(doc);

        // Process editable elements
        this.editor.elements.processEditableElements(doc);

        // Display the template
        const templateContainer = document.getElementById('template-content');
        templateContainer.innerHTML = '';
        templateContainer.appendChild(doc.body);

        // Add padding to prevent editor overlay from blocking content
        templateContainer.style.paddingTop = '56px';

        this.editor.ui.showStatus('Template ready for editing!', 'success');
    }

    extractAndApplyStyles(doc) {
        // Extract styles from template head
        const styleElements = doc.querySelectorAll('style');
        const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');

        // Add style elements
        styleElements.forEach(styleElement => {
            const newStyle = document.createElement('style');
            newStyle.setAttribute('data-template-style', 'true');
            // Add higher specificity to template styles to avoid conflicts with editor
            let cssContent = styleElement.textContent;
            // Wrap body styles with template container specificity
            cssContent = cssContent.replace(/body\s*\{/g, '#template-content body {');
            cssContent = cssContent.replace(/html\s*\{/g, '#template-content html {');
            newStyle.textContent = cssContent;
            document.head.appendChild(newStyle);
        });

        // Add link elements (external stylesheets)
        linkElements.forEach(linkElement => {
            const newLink = document.createElement('link');
            newLink.setAttribute('data-template-style', 'true');
            newLink.rel = 'stylesheet';
            newLink.href = linkElement.href;
            document.head.appendChild(newLink);
        });
    }
}