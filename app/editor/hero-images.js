// Hero Trail Images Editor for templates with heroImagesContainer
export class HeroImagesEditor {
    constructor(editor) {
        this.editor = editor;
        this.heroImages = [];
        this.isInitialized = false;
        this.containerElement = null;
        this.triggerButton = null;
        // Pattern tracking for save/update
        this.arrayPattern = null; // 'named' or 'minified'
        this.minifiedVarName = null; // Variable name in minified code (e.g., 'o')
        this.originalMatch = null; // Original matched string for replacement
    }

    /**
     * Initialize hero images editor if the template has heroImagesContainer
     * Call this after the template is loaded into the shadow DOM
     */
    initialize() {
        if (this.isInitialized) return;

        // Look for heroImagesContainer in the shadow DOM
        const shadowRoot = this.editor.shadowRoot;
        if (!shadowRoot) {
            console.debug('[HeroImagesEditor] No shadow root found');
            return;
        }

        this.containerElement = shadowRoot.getElementById('heroImagesContainer');
        if (!this.containerElement) {
            console.debug('[HeroImagesEditor] No heroImagesContainer found in template');
            // Hide the button since this template doesn't have trail images
            this.hideButton();
            return;
        }

        console.debug('[HeroImagesEditor] Found heroImagesContainer, parsing trail images from script...');

        // Parse the trailImages array from the template content
        this.parseTrailImagesFromTemplate();

        console.debug(`[HeroImagesEditor] Parsed ${this.heroImages.length} trail images`);

        // Only show button if we found images to edit
        if (this.heroImages.length === 0) {
            console.debug('[HeroImagesEditor] No trail images found, hiding button');
            this.hideButton();
            return;
        }

        // Show and setup the button in the editor overlay
        this.setupButton();
        
        this.isInitialized = true;
        console.debug('[HeroImagesEditor] Initialized successfully');
    }

    /**
     * Parse trail images from the template's script content
     * Handles both minified and non-minified versions
     */
    parseTrailImagesFromTemplate() {
        const templateContent = this.editor.templateContent;
        if (!templateContent) return;

        // Strategy 1: Try to match named trailImages array (non-minified)
        let trailImagesMatch = templateContent.match(/(const|let|var)\s+trailImages\s*=\s*\[([\s\S]*?)\];/);
        
        if (trailImagesMatch) {
            console.debug('[HeroImagesEditor] Found named trailImages array');
            this.extractUrlsFromArrayContent(trailImagesMatch[2]);
            this.arrayPattern = 'named'; // Track which pattern was matched
            this.originalMatch = trailImagesMatch[0];
            return;
        }

        // Strategy 2: For minified code, look for array of image URLs near heroImagesContainer reference
        // The minified pattern typically looks like: const o=["url1","url2",...] followed by o.forEach or (new Image).src=e
        // We look for an array that contains multiple unsplash/image URLs
        const minifiedPattern = /(const|let|var)\s+(\w)=\[((?:"https?:\/\/[^"]+",?\s*){3,})\]/;
        trailImagesMatch = templateContent.match(minifiedPattern);
        
        if (trailImagesMatch) {
            console.debug('[HeroImagesEditor] Found minified image array');
            this.extractUrlsFromArrayContent(trailImagesMatch[3]);
            this.arrayPattern = 'minified';
            this.minifiedVarName = trailImagesMatch[2];
            this.originalMatch = trailImagesMatch[0];
            return;
        }

        console.debug('[HeroImagesEditor] No trailImages array found in script');
    }

    /**
     * Extract URLs from array content string
     */
    extractUrlsFromArrayContent(arrayContent) {
        const urlRegex = /['"`](https?:\/\/[^'"`]+)['"`]/g;
        let match;
        
        while ((match = urlRegex.exec(arrayContent)) !== null) {
            this.heroImages.push(match[1]);
        }
    }

    /**
     * Setup the button in the editor overlay
     */
    setupButton() {
        this.triggerButton = document.getElementById('edit-trail-images-btn');
        if (!this.triggerButton) {
            console.debug('[HeroImagesEditor] Button not found in editor overlay');
            return;
        }

        // Show the button
        this.triggerButton.style.display = 'inline-flex';

        // Add click handler
        this.triggerButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openModal();
        });
    }

    /**
     * Hide the button when template doesn't have trail images
     */
    hideButton() {
        const button = document.getElementById('edit-trail-images-btn');
        if (button) {
            button.style.display = 'none';
        }
    }

    /**
     * Open the hero images editor modal
     */
    openModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('hero-images-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'hero-images-modal';
        modal.className = 'hero-images-modal-overlay';
        modal.innerHTML = `
            <div class="hero-images-modal">
                <div class="hero-images-modal-header">
                    <div class="hero-images-modal-title-section">
                        <div class="hero-images-modal-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                        </div>
                        <div>
                            <h2>Hero Trail Images</h2>
                            <p>These images appear as you move your mouse across the hero section</p>
                        </div>
                    </div>
                    <button class="hero-images-modal-close" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="hero-images-modal-body">
                    <div class="hero-images-list" id="hero-images-list">
                        <!-- Images will be rendered here -->
                    </div>
                </div>
                <div class="hero-images-modal-footer">
                    <button class="hero-images-add-btn" id="hero-images-add-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add New Image
                    </button>
                    <div class="hero-images-modal-actions">
                        <button class="hero-images-btn-secondary" id="hero-images-cancel">Cancel</button>
                        <button class="hero-images-btn-primary" id="hero-images-save">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Render images
        this.renderImagesList();

        // Event listeners
        modal.querySelector('.hero-images-modal-close').addEventListener('click', () => this.closeModal());
        modal.querySelector('#hero-images-cancel').addEventListener('click', () => this.closeModal());
        modal.querySelector('#hero-images-add-btn').addEventListener('click', () => this.addNewImage());
        modal.querySelector('#hero-images-save').addEventListener('click', () => this.saveAndClose());

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
    }

    /**
     * Render the list of images in the modal
     */
    renderImagesList() {
        const list = document.getElementById('hero-images-list');
        if (!list) return;

        if (this.heroImages.length === 0) {
            list.innerHTML = `
                <div class="hero-images-empty-state">
                    <div class="hero-images-empty-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                    </div>
                    <h3>No Trail Images Yet</h3>
                    <p>Add images that will appear when visitors move their mouse over the hero section</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.heroImages.map((url, index) => `
            <div class="hero-image-list-item" data-index="${index}">
                <div class="hero-image-list-item-preview">
                    <img src="${url}" alt="Trail image ${index + 1}" loading="lazy">
                    <div class="hero-image-list-item-number">${index + 1}</div>
                </div>
                <div class="hero-image-list-item-info">
                    <div class="hero-image-list-item-url" title="${url}">${this.truncateUrl(url)}</div>
                    <div class="hero-image-list-item-hint">Image ${index + 1} of ${this.heroImages.length}</div>
                </div>
                <div class="hero-image-list-item-actions">
                    <button class="hero-image-action-btn hero-image-edit-btn" data-index="${index}" title="Replace image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="hero-image-action-btn hero-image-delete-btn" data-index="${index}" title="Remove image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        list.querySelectorAll('.hero-image-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.editImage(index);
            });
        });

        list.querySelectorAll('.hero-image-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.removeImage(index);
            });
        });
    }

    /**
     * Truncate URL for display
     */
    truncateUrl(url) {
        if (url.length <= 50) return url;
        const start = url.substring(0, 25);
        const end = url.substring(url.length - 20);
        return `${start}...${end}`;
    }

    /**
     * Close the modal
     */
    closeModal() {
        const modal = document.getElementById('hero-images-modal');
        if (!modal) return;

        modal.classList.remove('visible');
        modal.classList.add('closing');
        
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    /**
     * Add a new image
     */
    addNewImage() {
        this.openImagePicker(null);
    }

    /**
     * Edit an existing image
     */
    editImage(index) {
        this.openImagePicker(index);
    }

    /**
     * Remove an image
     */
    removeImage(index) {
        if (index < 0 || index >= this.heroImages.length) return;

        // Add removal animation
        const item = document.querySelector(`.hero-image-list-item[data-index="${index}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                this.heroImages.splice(index, 1);
                this.renderImagesList();
            }, 300);
        } else {
            this.heroImages.splice(index, 1);
            this.renderImagesList();
        }
    }

    /**
     * Open image picker modal
     */
    openImagePicker(index) {
        const isNew = index === null;
        const currentSrc = isNew ? '' : this.heroImages[index];

        // Create picker overlay
        const picker = document.createElement('div');
        picker.className = 'hero-image-picker-overlay';
        picker.innerHTML = `
            <div class="hero-image-picker">
                <div class="hero-image-picker-header">
                    <h3>${isNew ? 'Add New Image' : 'Replace Image'}</h3>
                    <button class="hero-image-picker-close" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="hero-image-picker-body">
                    <div class="hero-image-picker-preview" id="picker-preview">
                        ${currentSrc 
                            ? `<img src="${currentSrc}" alt="Preview">` 
                            : `<div class="hero-image-picker-placeholder">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                                <span>No image selected</span>
                            </div>`
                        }
                    </div>
                    <div class="hero-image-picker-upload" id="picker-upload-area">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span>Click to upload or drag & drop</span>
                        <small>PNG, JPG, WebP up to 5MB</small>
                    </div>
                    <div class="hero-image-picker-divider">
                        <span>or enter URL</span>
                    </div>
                    <input type="text" class="hero-image-picker-url" id="picker-url-input" placeholder="https://example.com/image.jpg" value="${currentSrc}">
                </div>
                <div class="hero-image-picker-footer">
                    <button class="hero-images-btn-secondary" id="picker-cancel">Cancel</button>
                    <button class="hero-images-btn-primary" id="picker-save">${isNew ? 'Add Image' : 'Save'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(picker);

        let selectedSrc = currentSrc;

        // Event listeners
        const closePicker = () => {
            picker.classList.add('closing');
            setTimeout(() => picker.remove(), 300);
        };

        picker.querySelector('.hero-image-picker-close').addEventListener('click', closePicker);
        picker.querySelector('#picker-cancel').addEventListener('click', closePicker);
        picker.addEventListener('click', (e) => {
            if (e.target === picker) closePicker();
        });

        // Upload area
        const uploadArea = picker.querySelector('#picker-upload-area');
        uploadArea.addEventListener('click', () => {
            const fileInput = document.getElementById('image-file-input');
            const handler = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        selectedSrc = event.target.result;
                        this.updatePickerPreview(picker, selectedSrc);
                        picker.querySelector('#picker-url-input').value = '';
                    };
                    reader.readAsDataURL(file);
                }
                fileInput.removeEventListener('change', handler);
                fileInput.value = '';
            };
            fileInput.addEventListener('change', handler);
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedSrc = event.target.result;
                    this.updatePickerPreview(picker, selectedSrc);
                    picker.querySelector('#picker-url-input').value = '';
                };
                reader.readAsDataURL(file);
            }
        });

        // URL input
        const urlInput = picker.querySelector('#picker-url-input');
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                selectedSrc = url;
                this.updatePickerPreview(picker, url);
            }
        });

        // Save
        picker.querySelector('#picker-save').addEventListener('click', () => {
            if (!selectedSrc) {
                this.editor.ui.showStatus('Please select an image first', 'error');
                return;
            }

            if (isNew) {
                this.heroImages.push(selectedSrc);
            } else {
                this.heroImages[index] = selectedSrc;
            }

            this.renderImagesList();
            closePicker();
        });

        // Animate in
        requestAnimationFrame(() => picker.classList.add('visible'));
    }

    /**
     * Update picker preview
     */
    updatePickerPreview(picker, src) {
        const preview = picker.querySelector('#picker-preview');
        if (!preview) return;

        preview.innerHTML = `<img src="${src}" alt="Preview">`;
    }

    /**
     * Save changes and close modal
     */
    saveAndClose() {
        this.updateTemplateScript();
        this.closeModal();
        this.editor.ui.showStatus('Trail images updated successfully!', 'success');
    }

    /**
     * Update the template's script with the new hero images array
     * Handles both minified and non-minified versions
     */
    updateTemplateScript() {
        if (!this.editor.templateContent || !this.originalMatch) return;

        let newArrayContent;

        if (this.arrayPattern === 'named') {
            // Non-minified: preserve formatting
            const imagesArrayStr = this.heroImages.map(url => `                '${url}'`).join(',\n');
            newArrayContent = `const trailImages = [\n${imagesArrayStr}\n            ]`;
            
            // Replace in the template content
            this.editor.templateContent = this.editor.templateContent.replace(
                /(const|let|var)\s+trailImages\s*=\s*\[([\s\S]*?)\]/,
                newArrayContent
            );
        } else if (this.arrayPattern === 'minified') {
            // Minified: keep it compact with the same variable name
            const imagesArrayStr = this.heroImages.map(url => `"${url}"`).join(',');
            newArrayContent = `const ${this.minifiedVarName}=[${imagesArrayStr}]`;
            
            // Replace the original match
            this.editor.templateContent = this.editor.templateContent.replace(
                this.originalMatch,
                newArrayContent
            );
        }

        console.debug('[HeroImagesEditor] Template script updated with', this.heroImages.length, 'images');
    }

    /**
     * Get the current hero images array
     */
    getHeroImages() {
        return [...this.heroImages];
    }
}
