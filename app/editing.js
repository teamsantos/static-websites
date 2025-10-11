// Text and image editing functionality
export class EditingManager {
    constructor(editor) {
        this.editor = editor;
    }

    handleElementClick(event) {
        const element = event.target.closest('.editable-element');
        if (!element) return;

        event.preventDefault();
        event.stopPropagation();

        this.editor.cancelCurrentEdit();

        if (element.hasAttribute('data-text-id')) {
            this.startTextEditing(element);
        } else if (element.hasAttribute('data-image-src')) {
            this.startImageEditing(element);
        }
    }

    startTextEditing(element) {
        this.editor.currentEditingElement = element;
        element.classList.add('editing');

        const textId = element.getAttribute('data-text-id');
        const currentText = this.editor.translations[this.editor.currentLanguage]?.[textId] || element.textContent;

        // Create modern floating editor modal (like image editor)
        const editorModal = document.createElement('div');
        editorModal.className = 'modern-text-editor-overlay';
        editorModal.innerHTML = `
            <div class="modern-text-editor-card">
                <div class="editor-card-content">
                    <textarea class="modern-text-input" placeholder="Enter your text here...">${currentText}</textarea>
                </div>
                <div class="editor-card-footer">
                    <div class="editor-card-actions">
                        <button class="btn btn-outline btn-glass" onclick="const modal = this.closest('.modern-text-editor-overlay'); modal.classList.add('removing'); setTimeout(() => { modal.remove(); if(window.templateEditorInstance) { window.templateEditorInstance.cancelCurrentEdit(); } }, 300);">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="if(window.templateEditorInstance) { window.templateEditorInstance.saveModernTextEdit.call(window.templateEditorInstance, this); } else { console.error('Template editor instance not found'); }">
                            Save Changes
                        </button>
                    </div>
                <canvas class="stars popup-stars" aria-hidden="true"></canvas>
                </div>
            </div>
        `;

        // Calculate optimal dimensions for the card
        const rect = element.getBoundingClientRect();
        const minWidth = 440; // Minimum readable width for modern card
        const minHeight = 340; // Minimum readable height for modern card
        const maxWidth = Math.min(window.innerWidth - 48, 520);
        const maxHeight = Math.min(window.innerHeight - 160, 640);

        const optimalWidth = Math.max(minWidth, Math.min(rect.width + 100, maxWidth));
        const optimalHeight = Math.max(minHeight, Math.min(rect.height + 180, maxHeight));

        const editorCard = editorModal.querySelector('.modern-text-editor-card');
        editorCard.style.width = optimalWidth + 'px';
        editorCard.style.minHeight = optimalHeight + 'px';
        editorCard.style.maxHeight = maxHeight + 'px';

        document.body.appendChild(editorModal);

        // Add click handler to overlay for canceling (like image editor)
        editorModal.addEventListener('click', (e) => {
            // Only cancel if clicking on the overlay itself, not the card
            if (e.target === editorModal) {
                editorModal.classList.add('removing');
                setTimeout(() => {
                    editorModal.remove();
                    if (window.templateEditorInstance) {
                        window.templateEditorInstance.cancelCurrentEdit();
                    }
                }, 300);
            }
        });

        // Prevent click events on the card from bubbling to the overlay
        editorCard.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Focus the textarea and reinitialize stars
        const textarea = editorModal.querySelector('.modern-text-input');
        const starCanvas = editorModal.querySelector('.stars');

        setTimeout(() => {
            textarea.focus();
            textarea.select();

            // Reinitialize stars for the popup canvas
            if (starCanvas && window.starsAnimationInstance) {
                window.starsAnimationInstance.reinitializeCanvas(starCanvas);
            }
        }, 100);



        // Handle keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                // Use the global instance for keyboard shortcuts
                if (window.templateEditorInstance) {
                    window.templateEditorInstance.saveModernTextEdit.call(window.templateEditorInstance, editorModal.querySelector('.btn-primary'));
                }
            } else if (e.key === 'Escape') {
                editorModal.classList.add('removing');
                setTimeout(() => {
                    editorModal.remove();
                    if (window.templateEditorInstance) {
                        window.templateEditorInstance.cancelCurrentEdit();
                    }
                }, 300);
            }
        });
    }

    saveTextEdit(editor, element) {
        const newText = editor.value.trim();
        const textId = element.getAttribute('data-text-id');

        if (newText && textId) {
            // Update element content
            element.textContent = newText;

            // Update translations
            if (!this.editor.translations[this.editor.currentLanguage]) {
                this.editor.translations[this.editor.currentLanguage] = {};
            }
            this.editor.translations[this.editor.currentLanguage][textId] = newText;

            this.editor.ui.showStatus('Text updated successfully', 'success');
        }

        this.editor.cancelCurrentEdit();
    }

    saveModernTextEdit(saveBtn) {
        console.log('saveModernTextEdit called', saveBtn);

        const modal = saveBtn.closest('.modern-text-editor-overlay');
        console.log('modal found:', modal);

        const textarea = modal.querySelector('.modern-text-input');
        console.log('textarea found:', textarea);

        const newText = textarea.value.trim();
        console.log('newText:', newText);
        console.log('currentEditingElement:', this.editor.currentEditingElement);

        if (this.editor.currentEditingElement) {
            const textId = this.editor.currentEditingElement.getAttribute('data-text-id');
            console.log('textId:', textId);

            // Update element content
            this.editor.currentEditingElement.textContent = newText;
            console.log('Element text updated');

            // Update translations
            if (!this.editor.translations[this.editor.currentLanguage]) {
                this.editor.translations[this.editor.currentLanguage] = {};
            }
            this.editor.translations[this.editor.currentLanguage][textId] = newText;
            console.log('Translations updated');

            this.editor.ui.showStatus('Text updated successfully', 'success');
        } else {
            console.warn('Cannot save: newText or currentEditingElement is missing');
        }

        modal.classList.add('removing');
        setTimeout(() => {
            modal.remove();
            this.editor.cancelCurrentEdit();
            console.log('Modal closed and editing cancelled');
        }, 300);
    }

    startImageEditing(element) {
        this.editor.currentEditingElement = element;
        element.classList.add('editing');

        const imageId = element.getAttribute('data-image-src');
        const currentSrc = this.editor.images[imageId] || element.getAttribute('src');

        // Create image editor modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
<div class="modal-content">
    <div class="modal-header">
        <h3>Change Image</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
    </div>
    <div class="image-editor-content">
        ${currentSrc ? `<img src="${currentSrc}" alt="Current image" class="current-image">` : ''}
        <div class="image-upload-area" onclick="document.getElementById('image-file-input').click()">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
            <div>Click to upload new image</div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">or drag and drop</div>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 2rem;">
            <button class="modal-btn modal-btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="templateEditor.saveImageEdit('${imageId}', this)">Save Changes</button>
        </div>
    </div>
</div>
`;

        document.body.appendChild(modal);

        // Handle drag and drop
        const uploadArea = modal.querySelector('.image-upload-area');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleDroppedImage(files[0], imageId, modal);
            }
        });
    }

    handleImageFile(event) {
        const file = event.target.files[0];
        if (file && this.editor.currentEditingElement) {
            const imageId = this.editor.currentEditingElement.getAttribute('data-image-src');
            this.processNewImage(file, imageId);
        }
    }

    handleDroppedImage(file, imageId, modal) {
        this.processNewImage(file, imageId);
        modal.remove();
    }

    processNewImage(file, imageId) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newSrc = e.target.result;

            // Update element
            if (this.editor.currentEditingElement) {
                this.editor.currentEditingElement.setAttribute('src', newSrc);
            }

            // Update images object
            this.editor.images[imageId] = newSrc;

            this.editor.ui.showStatus('Image updated successfully', 'success');
            this.editor.cancelCurrentEdit();
        };
        reader.readAsDataURL(file);
    }

    saveImageEdit(imageId, saveBtn) {
        // This would be called from the modal
        const modal = saveBtn.closest('.modal');
        modal.remove();
        this.editor.cancelCurrentEdit();
    }
}