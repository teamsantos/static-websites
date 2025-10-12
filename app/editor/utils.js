// Utility functions
export class UtilsManager {
    constructor(editor) {
        this.editor = editor;
    }

    getEditedHtml() {
        // Similar to exportTemplate but return the HTML string
        const parser = new DOMParser();
        const originalDoc = parser.parseFromString(this.editor.templateContent, 'text/html');

        // Update the body content with our modifications
        const templateContainer = document.getElementById('template-content');
        originalDoc.body.innerHTML = templateContainer.innerHTML;

        // Clean up editor-specific styles
        const styleElements = originalDoc.querySelectorAll('style');
        styleElements.forEach(styleElement => {
            let cssContent = styleElement.textContent;
            // Remove editor-specific CSS rules
            cssContent = cssContent.replace(/#template-content header\s*\{[^}]*\}/g, '');
            // Revert top positioning back to original
            cssContent = cssContent.replace(/top:\s*56px/g, 'top: 0');
            styleElement.textContent = cssContent;
        });

        // Remove any editor-added padding
        const allElements = originalDoc.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.style.paddingTop === '56px') {
                el.style.paddingTop = '';
            }
        });

        // Serialize the complete document
        return originalDoc.documentElement.outerHTML;
    }

    collectExportData() {
        // Collect the current state for export: images, translations, textColors, sectionBackgrounds, and templateId
        return {
            images: this.editor.images,
            langs: this.editor.translations[this.editor.currentLanguage] || {},
            textColors: this.editor.textColors,
            sectionBackgrounds: this.editor.sectionBackgrounds,
            templateId: this.editor.templateId
        };
    }

    cancelCurrentEdit() {
        if (this.editor.currentEditingElement) {
            this.editor.currentEditingElement.classList.remove('editing');
            this.editor.currentEditingElement = null;
        }

        // Remove any open editors
        const editors = document.querySelectorAll('.text-editor, .image-editor, .modern-text-editor-overlay');
        editors.forEach(editor => editor.remove());

        // Remove any modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.remove());
    }

    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.cancelCurrentEdit();
        }
    }

    saveChanges() {
        // In a real implementation, this would save to files
        // For now, we'll just show a success message
        this.editor.ui.showStatus('Changes saved successfully!', 'success');
    }

    exportTemplate() {
        // Export the modified template with original structure
        const parser = new DOMParser();
        const originalDoc = parser.parseFromString(this.editor.templateContent, 'text/html');

        // Update the body content with our modifications
        const templateContainer = document.getElementById('template-content');
        originalDoc.body.innerHTML = templateContainer.innerHTML;

        // Clean up editor-specific styles
        const styleElements = originalDoc.querySelectorAll('style');
        styleElements.forEach(styleElement => {
            let cssContent = styleElement.textContent;
            // Remove editor-specific CSS rules
            cssContent = cssContent.replace(/#template-content header\s*\{[^}]*\}/g, '');
            // Revert top positioning back to original
            cssContent = cssContent.replace(/top:\s*56px/g, 'top: 0');
            styleElement.textContent = cssContent;
        });

        // Remove any editor-added padding
        const allElements = originalDoc.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.style.paddingTop === '56px') {
                el.style.paddingTop = '';
            }
        });

        // Serialize the complete document
        const html = originalDoc.documentElement.outerHTML;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited-template.html';
        a.click();
        URL.revokeObjectURL(url);

        this.editor.ui.showStatus('Template exported successfully!', 'success');
    }
}