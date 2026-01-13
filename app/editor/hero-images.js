// Hero Trail Images Editor for portfolio template
export class HeroImagesEditor {
    constructor(editor) {
        this.editor = editor;
        this.heroImages = [];
        this.isInitialized = false;
        this.panelVisible = false;
    }

    /**
     * Initialize hero images editor if the template has hero trail images
     * Call this after the template is loaded
     */
    initialize() {
        if (this.isInitialized) return;

        // Look for hero trail images in the template's script
        const templateContent = this.editor.templateContent;
        if (!templateContent) return;

        // Check if this template has trailImages array in script
        const trailImagesMatch = templateContent.match(/const\s+trailImages\s*=\s*\[([\s\S]*?)\];/);
        if (!trailImagesMatch) return;

        // Parse the images from the script
        this.parseTrailImages(trailImagesMatch[1]);

        if (this.heroImages.length === 0) return;

        // Create the editor UI
        this.createEditorUI();
        this.isInitialized = true;
    }

    /**
     * Parse trail images from the template script
     */
    parseTrailImages(imagesString) {
        // Match URL strings within quotes
        const urlRegex = /['"`](https?:\/\/[^'"`]+)['"`]/g;
        let match;
        
        while ((match = urlRegex.exec(imagesString)) !== null) {
            this.heroImages.push(match[1]);
        }
    }

    /**
     * Create the hero images editor UI
     */
    createEditorUI() {
        // Add the floating button to access the panel
        this.createFloatingButton();
        
        // Create the panel (hidden initially)
        this.createEditorPanel();
    }

    /**
     * Create the floating button that opens the hero images panel
     */
    createFloatingButton() {
        const button = document.createElement('button');
        button.id = 'hero-images-btn';
        button.className = 'hero-images-floating-btn';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Hero Images</span>
        `;
        button.title = 'Edit Hero Trail Images';
        button.addEventListener('click', () => this.togglePanel());
        
        document.body.appendChild(button);
    }

    /**
     * Create the editor panel with image thumbnails
     */
    createEditorPanel() {
        const panel = document.createElement('div');
        panel.id = 'hero-images-panel';
        panel.className = 'hero-images-panel';
        panel.innerHTML = `
            <div class="hero-images-panel-header">
                <h3>Hero Trail Images</h3>
                <p class="hero-images-panel-subtitle">These images appear when moving the mouse over the hero section</p>
                <button class="hero-images-panel-close" aria-label="Close panel">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="hero-images-grid" id="hero-images-grid">
                <!-- Images will be rendered here -->
            </div>
            <div class="hero-images-panel-footer">
                <button class="btn btn-outline btn-glass hero-images-add-btn" id="hero-images-add-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Image
                </button>
            </div>
        `;
        
        // Add event listeners
        panel.querySelector('.hero-images-panel-close').addEventListener('click', () => this.togglePanel());
        panel.querySelector('#hero-images-add-btn').addEventListener('click', () => this.addNewImage());
        
        document.body.appendChild(panel);
        
        // Render initial images
        this.renderImages();
    }

    /**
     * Render all hero images in the panel
     */
    renderImages() {
        const grid = document.getElementById('hero-images-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        this.heroImages.forEach((imageUrl, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'hero-image-item';
            imageItem.innerHTML = `
                <div class="hero-image-preview">
                    <img src="${imageUrl}" alt="Trail image ${index + 1}" loading="lazy">
                    <div class="hero-image-overlay">
                        <span class="hero-image-index">${index + 1}</span>
                    </div>
                </div>
                <div class="hero-image-actions">
                    <button class="hero-image-action-btn edit-btn" data-index="${index}" title="Change image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="hero-image-action-btn delete-btn" data-index="${index}" title="Remove image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
            
            // Add event listeners for action buttons
            imageItem.querySelector('.edit-btn').addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                this.editImage(idx);
            });
            
            imageItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                this.removeImage(idx);
            });
            
            grid.appendChild(imageItem);
        });

        // Show empty state if no images
        if (this.heroImages.length === 0) {
            grid.innerHTML = `
                <div class="hero-images-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p>No trail images added yet</p>
                    <span>Click "Add Image" to get started</span>
                </div>
            `;
        }
    }

    /**
     * Toggle the panel visibility
     */
    togglePanel() {
        const panel = document.getElementById('hero-images-panel');
        const button = document.getElementById('hero-images-btn');
        
        if (!panel || !button) return;
        
        this.panelVisible = !this.panelVisible;
        
        if (this.panelVisible) {
            panel.classList.add('visible');
            button.classList.add('active');
        } else {
            panel.classList.remove('visible');
            button.classList.remove('active');
        }
    }

    /**
     * Edit an existing image at the specified index
     */
    editImage(index) {
        this.openImageModal(index);
    }

    /**
     * Add a new image
     */
    addNewImage() {
        this.openImageModal(null); // null index means new image
    }

    /**
     * Open modal to select/upload an image
     */
    openImageModal(index) {
        const isNew = index === null;
        const currentSrc = isNew ? '' : this.heroImages[index];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'hero-image-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${isNew ? 'Add Trail Image' : 'Change Trail Image'}</h3>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                <div class="image-editor-content">
                    <div style="position: relative; display: inline-block;">
                        ${currentSrc ? `<img src="${currentSrc}" class="current-image" id="hero-image-preview">` : '<div id="hero-image-preview" class="hero-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><span>No image selected</span></div>'}
                    </div>
                    <div class="image-upload-area" id="hero-image-upload-area">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
                        <div>Click to upload new image</div>
                        <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">or drag and drop</div>
                    </div>
                    <div class="hero-image-url-input-wrapper">
                        <label for="hero-image-url">Or enter image URL:</label>
                        <input type="text" id="hero-image-url" class="hero-image-url-input" placeholder="https://example.com/image.jpg" value="${currentSrc}">
                    </div>
                    <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 2rem;">
                        <button class="modal-btn modal-btn-secondary" id="hero-image-cancel">Cancel</button>
                        <button class="modal-btn modal-btn-primary" id="hero-image-save">${isNew ? 'Add Image' : 'Save Changes'}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Store selected image temporarily
        let selectedImageSrc = currentSrc;
        
        // Close button
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#hero-image-cancel').addEventListener('click', () => modal.remove());
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Upload area
        const uploadArea = modal.querySelector('#hero-image-upload-area');
        uploadArea.addEventListener('click', () => {
            const fileInput = document.getElementById('image-file-input');
            
            // Create a temporary handler
            const handleFile = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        selectedImageSrc = event.target.result;
                        this.updatePreview(modal, selectedImageSrc);
                        modal.querySelector('#hero-image-url').value = '';
                    };
                    reader.readAsDataURL(file);
                }
                fileInput.removeEventListener('change', handleFile);
            };
            
            fileInput.addEventListener('change', handleFile);
            fileInput.click();
        });
        
        // Drag and drop
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
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedImageSrc = event.target.result;
                    this.updatePreview(modal, selectedImageSrc);
                    modal.querySelector('#hero-image-url').value = '';
                };
                reader.readAsDataURL(files[0]);
            }
        });
        
        // URL input
        const urlInput = modal.querySelector('#hero-image-url');
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                selectedImageSrc = url;
                this.updatePreview(modal, url);
            }
        });
        
        // Save button
        modal.querySelector('#hero-image-save').addEventListener('click', () => {
            if (!selectedImageSrc) {
                this.editor.ui.showStatus('Please select an image first', 'error');
                return;
            }
            
            if (isNew) {
                this.heroImages.push(selectedImageSrc);
            } else {
                this.heroImages[index] = selectedImageSrc;
            }
            
            this.renderImages();
            this.updateTemplateScript();
            modal.remove();
            this.editor.ui.showStatus(isNew ? 'Image added successfully' : 'Image updated successfully', 'success');
        });
    }

    /**
     * Update the preview in the modal
     */
    updatePreview(modal, src) {
        const preview = modal.querySelector('#hero-image-preview');
        if (!preview) return;
        
        if (preview.tagName === 'IMG') {
            preview.src = src;
        } else {
            // Replace placeholder with img
            const img = document.createElement('img');
            img.id = 'hero-image-preview';
            img.className = 'current-image';
            img.src = src;
            img.alt = 'Preview';
            preview.parentNode.replaceChild(img, preview);
        }
    }

    /**
     * Remove an image at the specified index
     */
    removeImage(index) {
        if (index < 0 || index >= this.heroImages.length) return;
        
        // Confirm removal
        if (this.heroImages.length === 1) {
            // Last image - warn user
            if (!confirm('This is the last trail image. Removing it will disable the trail effect. Continue?')) {
                return;
            }
        }
        
        this.heroImages.splice(index, 1);
        this.renderImages();
        this.updateTemplateScript();
        this.editor.ui.showStatus('Image removed', 'success');
    }

    /**
     * Update the template's script with the new hero images array
     */
    updateTemplateScript() {
        if (!this.editor.templateContent) return;
        
        // Build the new trailImages array string
        const imagesArrayStr = this.heroImages.map(url => `                '${url}'`).join(',\n');
        const newArrayContent = `const trailImages = [\n${imagesArrayStr}\n            ];`;
        
        // Replace in the template content
        this.editor.templateContent = this.editor.templateContent.replace(
            /const\s+trailImages\s*=\s*\[([\s\S]*?)\];/,
            newArrayContent
        );
    }

    /**
     * Get the current hero images array
     */
    getHeroImages() {
        return [...this.heroImages];
    }

    /**
     * Destroy the editor UI
     */
    destroy() {
        const button = document.getElementById('hero-images-btn');
        const panel = document.getElementById('hero-images-panel');
        
        if (button) button.remove();
        if (panel) panel.remove();
        
        this.heroImages = [];
        this.isInitialized = false;
        this.panelVisible = false;
    }
}
