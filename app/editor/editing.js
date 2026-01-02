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
         // Ensure color is in hex format
         let currentColor = this.editor.textColors[textId];
         
         // If no stored color, try to get it from element
         if (!currentColor) {
             const computedStyle = getComputedStyle(element);
             currentColor = element.style.color || computedStyle.color || '#1f2937';
         }
         
         // Convert RGB/RGBA to hex if needed
         currentColor = this.editor.elements.rgbToHex(currentColor);

         // Create modern floating editor modal (like image editor)
         const editorModal = document.createElement('div');
         editorModal.className = 'modern-text-editor-overlay';
         editorModal.innerHTML = `
             <div class="modern-text-editor-card">
                 <div class="editor-card-content">
                     <div class="text-editor-controls">
                         <div class="color-picker-group">
                             <label for="text-color-swatch">Text Color:</label>
                             <div id="text-color-swatch" class="color-swatch" style="background: ${currentColor};"></div>
                         </div>
                     </div>
                     <div id="color-picker-popover" class="color-picker-popover" style="display: none;">
                         <div id="color-picker"></div>
                     </div>
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
         const minHeight = 380; // Minimum readable height for modern card (increased for color picker)
         const maxWidth = Math.min(window.innerWidth - 48, 520);
         const maxHeight = Math.min(window.innerHeight - 160, 640);

         const optimalWidth = Math.max(minWidth, Math.min(rect.width + 100, maxWidth));
         const optimalHeight = Math.max(minHeight, Math.min(rect.height + 220, maxHeight)); // Increased for color picker

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

         // Initialize iro.js color picker
         this.setupIroColorPicker(editorModal, currentColor);

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

     setupIroColorPicker(modal, initialColor) {
         const swatch = modal.querySelector('#text-color-swatch');
         const popover = modal.querySelector('#color-picker-popover');

         const picker = new iro.ColorPicker('#color-picker', {
             width: 180,
             color: initialColor
         });

         // Store picker instance for later use
         modal.colorPickerInstance = picker;

         swatch.addEventListener('click', () => {
             const rect = swatch.getBoundingClientRect();
             const cardRect = modal.querySelector('.modern-text-editor-card').getBoundingClientRect();
             popover.style.left = (rect.left - cardRect.left) + 'px';
             popover.style.top = (rect.bottom - cardRect.top) + 'px';
             popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
         });

         document.addEventListener('click', (e) => {
             if (!popover.contains(e.target) && e.target !== swatch) {
                 popover.style.display = 'none';
             }
         });

         picker.on('color:change', (color) => {
             swatch.style.backgroundColor = color.hexString;
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
         const modal = saveBtn.closest('.modern-text-editor-overlay');
         const textarea = modal.querySelector('.modern-text-input');
         const picker = modal.colorPickerInstance;

         const newText = textarea.value.trim();
         const newColor = picker.color.hexString;

         if (this.editor.currentEditingElement) {
             const textId = this.editor.currentEditingElement.getAttribute('data-text-id');

             // Update element content
             this.editor.currentEditingElement.textContent = newText;

             // Update element color
             this.editor.currentEditingElement.style.setProperty('color', newColor, 'important');
             console.debug(`Set color on element: ${newColor}`);

             // Update translations
             if (!this.editor.translations[this.editor.currentLanguage]) {
                 this.editor.translations[this.editor.currentLanguage] = {};
             }
             this.editor.translations[this.editor.currentLanguage][textId] = newText;

             // Update text colors
             this.editor.textColors[textId] = newColor;

             this.editor.ui.showStatus('Text updated successfully', 'success');
         } else {
             console.warn('Cannot save: newText or currentEditingElement is missing');
         }

         modal.classList.add('removing');
         setTimeout(() => {
             modal.remove();
             this.editor.cancelCurrentEdit();
         }, 300);
     }

    startImageEditing(element) {
        this.editor.currentEditingElement = element;
        this.currentModal = null; // Store modal reference
        this.selectedImageSrc = null; // Store selected image temporarily
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
        <div style="position: relative; display: inline-block;">
            ${currentSrc ? `<img src="${currentSrc}" class="current-image" id="image-preview">` : '<div id="image-preview" style="display: none;"></div>'}
            ${currentSrc ? `
            <button class="image-remove-btn" onclick="window.templateEditorInstance.editing.removeImage(this)" title="Remove image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>` : ''}
        </div>
        <div class="image-upload-area" onclick="document.getElementById('image-file-input').click()">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
            <div>Click to upload new image</div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">or drag and drop</div>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 2rem;">
            <button class="modal-btn modal-btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="window.templateEditorInstance.saveImageEdit('${imageId}', this)">Save Changes</button>
        </div>
    </div>
</div>
`;
        this.currentModal = modal;
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

    removeImage(button) {
        const modal = button.closest('.modal');
        const preview = modal.querySelector('#image-preview');
        const removeBtn = modal.querySelector('.image-remove-btn');

        // Clear the image
        this.selectedImageSrc = '';

        // Update preview
        if (preview.tagName === 'IMG') {
            preview.style.display = 'none';
        }

        // Hide remove button
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
    }

    handleImageFile(event) {
        const file = event.target.files[0];
        if (file && this.editor.currentEditingElement) {
            const imageId = this.editor.currentEditingElement.getAttribute('data-image-src');
            this.processNewImage(file, imageId);
        }
    }

    handleDroppedImage(file, imageId) {
        this.processNewImage(file, imageId);
        // Don't remove modal - let user preview and save
    }

    processNewImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newSrc = e.target.result;
            this.selectedImageSrc = newSrc;

            // Update modal preview instead of actual element
            if (this.currentModal) {
                const previewImg = this.currentModal.querySelector('#image-preview');
                if (previewImg) {
                    if (previewImg.tagName === 'IMG') {
                        previewImg.src = newSrc;
                    } else {
                        // Replace the placeholder div with an img element
                        const imgElement = document.createElement('img');
                        imgElement.src = newSrc;
                        imgElement.alt = "New image";
                        imgElement.className = "current-image";
                        imgElement.id = "image-preview";
                        previewImg.parentNode.replaceChild(imgElement, previewImg);
                    }
                }
            }
        };
        reader.readAsDataURL(file);
    }

    saveImageEdit(imageId, saveBtn) {
        // Apply the selected image to the actual element
        if (this.editor.currentEditingElement) {
            this.editor.currentEditingElement.setAttribute('src', this.selectedImageSrc);
            this.editor.images[imageId] = this.selectedImageSrc;
            this.editor.ui.showStatus('Image updated successfully', 'success');
        }

        // Close modal and reset editing state
        const modal = saveBtn.closest('.modal');
        modal.remove();
        this.editor.cancelCurrentEdit();
        this.currentModal = null;
        this.selectedImageSrc = null;
    }
}
