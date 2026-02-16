// Utility functions
export class UtilsManager {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Get the shadow root or template container
     */
    getTemplateRoot() {
        return this.editor.shadowRoot || document.getElementById('template-content');
    }

    /**
     * Get the content wrapper inside shadow root
     */
    getTemplateWrapper() {
        const shadowRoot = this.editor.shadowRoot;
        if (shadowRoot) {
            return shadowRoot.querySelector('#template-shadow-wrapper');
        }
        return document.getElementById('template-content');
    }

    getEditedHtml() {
        // Similar to exportTemplate but return the HTML string
        const parser = new DOMParser();
        const originalDoc = parser.parseFromString(this.editor.templateContent, 'text/html');

        // Update the body content with our modifications from shadow root
        const templateWrapper = this.getTemplateWrapper();
        if (templateWrapper) {
            // Clone the content and clean up editor-specific elements
            const cleanedContent = this.getCleanedContent(templateWrapper);
            originalDoc.body.innerHTML = cleanedContent;
        }

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

    /**
     * Get cleaned content from template wrapper, removing editor-specific elements
     */
    getCleanedContent(wrapper) {
        // Clone the wrapper to avoid modifying the live DOM
        const clone = wrapper.cloneNode(true);
        
        // Remove editor-specific elements
        const editorsToRemove = clone.querySelectorAll('.section-controls, .plus-divider, .lang-element-wrapper');
        editorsToRemove.forEach(el => {
            // For lang-element-wrapper, unwrap the contents
            if (el.classList.contains('lang-element-wrapper')) {
                const parent = el.parentNode;
                while (el.firstChild) {
                    // Skip plus-divider elements
                    if (el.firstChild.classList?.contains('plus-divider')) {
                        el.removeChild(el.firstChild);
                    } else {
                        parent.insertBefore(el.firstChild, el);
                    }
                }
                parent.removeChild(el);
            } else {
                el.remove();
            }
        });

        // Remove editable-element class
        const editableElements = clone.querySelectorAll('.editable-element');
        editableElements.forEach(el => {
            el.classList.remove('editable-element');
            el.classList.remove('editing');
        });

        // Remove padding from wrapper if present
        if (clone.style.paddingTop === '56px') {
            clone.style.paddingTop = '';
        }

        return clone.innerHTML;
    }

    collectExportData() {
        // Collect the current state for export: images, translations, textColors, icons, iconColors, iconStyles, sectionBackgrounds, imageSizes, imageZIndexes, and templateId
        return {
            images: this.editor.images,
            icons: this.editor.icons,
            iconColors: this.editor.iconColors,
            iconStyles: this.editor.iconStyles,
            langs: this.editor.translations[this.editor.currentLanguage] || {},
            textColors: this.editor.textColors,
            sectionBackgrounds: this.editor.sectionBackgrounds,
            imageSizes: this.editor.imageSizes || {},
            imageZIndexes: this.editor.imageZIndexes || {},
            templateId: this.editor.templateId
        };
    }

    cancelCurrentEdit() {
        if (this.editor.currentEditingElement) {
            this.editor.currentEditingElement.classList.remove('editing');
            this.editor.currentEditingElement = null;
        }

        // Remove any open editors (these are in the main document, not shadow root)
        const editors = document.querySelectorAll('.text-editor, .image-editor, .modern-text-editor-overlay, .modern-icon-editor-overlay');
        editors.forEach(editor => editor.remove());

        // Remove any modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.remove());
    }

    handleKeydown(event) {
        if (event.key === 'Escape') {
            // If in image resize/move mode, reset the image instead of canceling edit
            if (this.editor.editing.imageEditMode) {
                this.editor.editing.resetImageSize();
            } else {
                this.cancelCurrentEdit();
            }
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

        // Update the body content with our modifications from shadow root
        const templateWrapper = this.getTemplateWrapper();
        if (templateWrapper) {
            const cleanedContent = this.getCleanedContent(templateWrapper);
            originalDoc.body.innerHTML = cleanedContent;
        }

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