const baseURL = "e-info.click"
class TemplateEditor {
    constructor() {
        this.templateContent = null;
        this.translations = {};
        this.images = {};
        this.currentLanguage = 'en';
        this.currentEditingElement = null;
        this.mode = 'create'; // 'create' or 'save'
        this.templateId = null; // Template identifier for export

        // Support email - change this in one place
        this.supportEmail = 'teamsantos.software+support@gmail.com';

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateSupportEmail();
        this.determineMode();
        this.autoLoadTemplate();
    }

    updateSupportEmail() {
        const emailPlaceholder = document.getElementById('support-email-placeholder');
        if (emailPlaceholder) {
            emailPlaceholder.textContent = this.supportEmail;
        }
    }

    determineMode() {
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('project') ? 'save' : 'create';
        this.updateTitle();
        this.updateButton();
        this.updateButtonsVisibility();
    }

    updateButton() {
        const btn = document.getElementById('export-template-btn');
        if (btn) {
            btn.textContent = this.mode === 'create' ? 'Create website' : 'Save changes';
        }
    }

    updateTitle() {
        const titleEl = document.querySelector('.editor-info h2');
        if (titleEl) {
            titleEl.innerHTML = `${this.mode === 'create' ? 'Template Editor' : 'Project Editor'} <a href="https://e-info.click" style="font-size: 0.8em; color: #6b7280; text-decoration: none; margin-left: 10px; cursor: pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">e-info.click</a>`;
        }
    }

    updateButtonsVisibility() {
        const changeBtn = document.getElementById('change-template-btn');
        const saveBtn = document.getElementById('save-changes-btn');
        const exportBtn = document.getElementById('export-template-btn');

        if (this.mode === 'save') {
            // For projects: show only Save changes (export button)
            if (changeBtn) changeBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'inline-block';
        } else {
            // For templates: show Change template and Create website (change and export)
            if (changeBtn) changeBtn.style.display = 'inline-block';
            if (saveBtn) saveBtn.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'inline-block';
        }
    }

    bindEvents() {
        // Editor controls
        document.getElementById('change-template-btn').addEventListener('click', () => {
            window.location.href = `https://${baseURL}/#templates`;
        });
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('export-template-btn').addEventListener('click', () => this.openModal());

        // File inputs
        document.getElementById('image-file-input').addEventListener('change', (e) => this.handleImageFile(e));

        // Global events
        document.addEventListener('click', (e) => this.handleElementClick(e));
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    openModal() {
        if (this.mode === 'create') {
            this.showCreateModal();
        } else {
            this.showSaveModal();
        }
    }

    showCreateModal() {
        const modal = document.createElement('div');
        modal.className = 'modern-text-editor-overlay';
        modal.innerHTML = `
            <div class="modern-text-editor-card">
                <div class="editor-card-content">
                    <div class="form-group">
                        <label for="creator-email">Creator Email:</label>
                        <input type="email" id="creator-email" placeholder="your@email.com" required>
                    </div>
                    <div class="form-group">
                        <label for="project-name">Project Name:</label>
                        <input type="text" id="project-name" placeholder="my-project" required>
                        <small class="url-preview">Your project URL will be: <span id="url-preview">my-project.e-info.click</span></small>
                    </div>
                </div>
                <div class="editor-card-footer">
                    <div class="editor-card-actions">
                        <button class="btn btn-outline btn-glass" onclick="const modal = this.closest('.modern-text-editor-overlay'); modal.classList.add('removing'); setTimeout(() => { modal.remove(); }, 300);">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.templateEditorInstance.createProject()">
                            Create Project
                        </button>
                    </div>
                    <canvas class="stars popup-stars" aria-hidden="true"></canvas>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Restore saved values from sessionStorage
        const savedEmail = sessionStorage.getItem('creator-email');
        const savedProjectName = sessionStorage.getItem('project-name');
        const emailInput = modal.querySelector('#creator-email');
        const projectNameInput = modal.querySelector('#project-name');

        if (savedEmail) {
            emailInput.value = savedEmail;
        }
        if (savedProjectName) {
            projectNameInput.value = savedProjectName;
        }

        // Update URL preview on input
        const urlPreview = modal.querySelector('#url-preview');
        projectNameInput.addEventListener('input', () => {
            const name = projectNameInput.value.trim() || 'my-project';
            urlPreview.textContent = `${name}.e-info.click`;
        });

        // Update URL preview with saved value if available
        if (savedProjectName) {
            urlPreview.textContent = `${savedProjectName}.e-info.click`;
        }

        // Add click handler to overlay for canceling
        modal.addEventListener('click', (e) => {
            // Only cancel if clicking on the overlay itself, not the card
            if (e.target === modal) {
                modal.classList.add('removing');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        });

        // Prevent click events on the card from bubbling to the overlay
        const editorCard = modal.querySelector('.modern-text-editor-card');
        editorCard.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Focus the first input (or the one without saved value)
        const firstInput = savedEmail ? (savedProjectName ? emailInput : projectNameInput) : emailInput;
        setTimeout(() => {
            firstInput.focus();

            // Reinitialize stars for the popup canvas
            const starCanvas = modal.querySelector('.stars');
            if (starCanvas && window.starsAnimationInstance) {
                window.starsAnimationInstance.reinitializeCanvas(starCanvas);
            }
        }, 100);

        // Handle keyboard shortcuts
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.classList.add('removing');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        });
    }

    showSaveModal() {
        const modal = document.createElement('div');
        modal.className = 'modern-text-editor-overlay';
        modal.innerHTML = `
            <div class="modern-text-editor-card">
                <div class="editor-card-content">
                    <p style="margin-bottom: 20px; color: #374151;">Enter the verification code sent to your email:</p>
                    <div class="form-group">
                        <input type="text" id="verification-code" placeholder="Enter code" required>
                    </div>
                </div>
                <div class="editor-card-footer">
                    <div class="editor-card-actions">
                        <button class="btn btn-outline btn-glass" onclick="const modal = this.closest('.modern-text-editor-overlay'); modal.classList.add('removing'); setTimeout(() => { modal.remove(); }, 300);">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.templateEditorInstance.saveWithCode()">
                            Save Changes
                        </button>
                    </div>
                    <canvas class="stars popup-stars" aria-hidden="true"></canvas>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add click handler to overlay for canceling
        modal.addEventListener('click', (e) => {
            // Only cancel if clicking on the overlay itself, not the card
            if (e.target === modal) {
                modal.classList.add('removing');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        });

        // Prevent click events on the card from bubbling to the overlay
        const editorCard = modal.querySelector('.modern-text-editor-card');
        editorCard.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Focus the input
        const input = modal.querySelector('#verification-code');
        setTimeout(() => {
            input.focus();

            // Reinitialize stars for the popup canvas
            const starCanvas = modal.querySelector('.stars');
            if (starCanvas && window.starsAnimationInstance) {
                window.starsAnimationInstance.reinitializeCanvas(starCanvas);
            }
        }, 100);

        // Handle keyboard shortcuts
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.classList.add('removing');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        });
    }

    async createProject() {
        const email = document.getElementById('creator-email').value.trim();
        const projectName = document.getElementById('project-name').value.trim();

        if (!email || !projectName) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showStatus('Please enter a valid email address', 'error');
            return;
        }

        // Validate project name (alphanumeric, hyphens, underscores)
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!nameRegex.test(projectName)) {
            this.showStatus('Project name can only contain letters, numbers, hyphens, and underscores', 'error');
            return;
        }

        // Save input values to sessionStorage for session-only persistence
        sessionStorage.setItem('creator-email', email);
        sessionStorage.setItem('project-name', projectName);

        this.showStatus('Creating project...', 'info');

        // Get the export data (images, langs, templateId)
        const exportData = this.collectExportData();

        try {
            const response = await fetch('https://api.e-info.click/create-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...exportData,
                    email,
                    name: projectName
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showStatus('Project created successfully! Redirecting...', 'success');
                // Clear saved data on success
                sessionStorage.removeItem('creator-email');
                sessionStorage.removeItem('project-name');
                // Close modal
                const modal = document.querySelector('.modern-text-editor-overlay');
                modal.classList.add('removing');
                setTimeout(() => {
                    modal.remove();
                    // Redirect to the created website
                    window.location.href = `https://${data.url}`;
                }, 300);
            } else {
                this.showStatus(data.error || 'Failed to create project', 'error');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showStatus('Failed to create project. Please try again.', 'error');
        }
    }

    getEditedHtml() {
        // Similar to exportTemplate but return the HTML string
        const parser = new DOMParser();
        const originalDoc = parser.parseFromString(this.templateContent, 'text/html');

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
        // Collect the current state for export: images, translations, and templateId
        return {
            images: this.images,
            langs: this.translations[this.currentLanguage] || {},
            templateId: this.templateId
        };
    }

    saveWithCode() {
        const code = document.getElementById('verification-code').value.trim();

        // For demo purposes, accept '1234' as valid code
        if (code === '1234') {
            this.saveChanges();
            const modal = document.querySelector('.modern-text-editor-overlay');
            modal.classList.add('removing');
            setTimeout(() => { modal.remove(); }, 300);
        } else {
            this.showStatus('Invalid verification code', 'error');
        }
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
            this.templateId = templateName; // Store template ID for export
        } else {
            this.showStatus(`No ${this.mode === 'create' ? 'template' : 'project'} specified. Please check your URL and try again, or contact us at ${this.supportEmail}`, 'info');
            return;
        }

        if (itemName.trim() === '') {
            this.showStatus(`Something went wrong. Please try again later or contact us at ${this.supportEmail}`, 'error');
            return;
        }

        this.showStatus(`Loading ${itemType}...`, 'info');

        // Fetch item from local directory
        fetch(itemUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                this.templateContent = html;
                this.processTemplate();
                this.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded successfully!`, 'success');
            })
            .catch(error => {
                console.error(`Error loading ${itemType}:`, error);
                // Fallback to remote URL if local fails
                this.showStatus(`Trying remote ${itemType}...`, 'info');

                fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        this.templateContent = html;
                        this.processTemplate();
                        this.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded from remote successfully!`, 'success');
                    })
                    .catch(remoteError => {
                        console.error(`Error loading remote ${itemType}:`, remoteError);
                        this.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} not found. Please check the ${itemType} name or contact us at ${this.supportEmail}`, 'error');
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
        const doc = parser.parseFromString(this.templateContent, 'text/html');

        // Remove the e-info footer if present
        const footerToRemove = doc.getElementById('modernFooter');
        if (footerToRemove) {
            footerToRemove.remove();
        }

        // Extract and apply CSS styles from the template
        this.extractAndApplyStyles(doc);

        // Load associated JSON files if they exist
        this.loadTranslationFiles(doc);
        this.loadImageFiles(doc);

        // Process editable elements
        this.processEditableElements(doc);

        // Display the template
        const templateContainer = document.getElementById('template-content');
        templateContainer.innerHTML = '';
        templateContainer.appendChild(doc.body);

        // Add padding to prevent editor overlay from blocking content
        templateContainer.style.paddingTop = '56px';

        this.showStatus('Template ready for editing!', 'success');
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

    loadTranslationFiles(doc) {
        // Try to load translation files from the template
        // This is a simplified version - in a real implementation,
        // you'd need to handle file paths properly
        const langElements = doc.querySelectorAll('[data-text-id]');
        this.translations[this.currentLanguage] = {};

        langElements.forEach(element => {
            const textId = element.getAttribute('data-text-id');
            if (textId) {
                this.translations[this.currentLanguage][textId] = element.textContent.trim();
            }
        });
    }

    loadImageFiles(doc) {
        // Try to load image files from the template
        const imageElements = doc.querySelectorAll('[data-image-src]');
        this.images = {};

        imageElements.forEach(element => {
            const imageId = element.getAttribute('data-image-src');
            if (imageId) {
                this.images[imageId] = element.getAttribute('src') || '';
            }
        });
    }

    processEditableElements(doc) {
        // Add editable class to elements with data attributes
        const editableSelectors = '[data-text-id], [data-image-src]';
        const editableElements = doc.querySelectorAll(editableSelectors);

        editableElements.forEach(element => {
            element.classList.add('editable-element');
            // Always enable editing - no conditional logic needed
        });
    }



    handleElementClick(event) {
        const element = event.target.closest('.editable-element');
        if (!element) return;

        event.preventDefault();
        event.stopPropagation();

        // Cancel any current editing
        this.cancelCurrentEdit();

        // Start editing the clicked element
        if (element.hasAttribute('data-text-id')) {
            this.startTextEditing(element);
        } else if (element.hasAttribute('data-image-src')) {
            this.startImageEditing(element);
        }
    }

    startTextEditing(element) {
        this.currentEditingElement = element;
        element.classList.add('editing');

        const textId = element.getAttribute('data-text-id');
        const currentText = this.translations[this.currentLanguage]?.[textId] || element.textContent;

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
                    window.templateEditorInstance.saveModernTextEdit.call(window.templateEditorInstance, editorModal.querySelector('.editor-btn-primary'));
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
            if (!this.translations[this.currentLanguage]) {
                this.translations[this.currentLanguage] = {};
            }
            this.translations[this.currentLanguage][textId] = newText;

            this.showStatus('Text updated successfully', 'success');
        }

        this.cancelCurrentEdit();
    }

    saveModernTextEdit(saveBtn) {
        console.log('saveModernTextEdit called', saveBtn);

        const modal = saveBtn.closest('.modern-text-editor-overlay');
        console.log('modal found:', modal);

        const textarea = modal.querySelector('.modern-text-input');
        console.log('textarea found:', textarea);

        const newText = textarea.value.trim();
        console.log('newText:', newText);
        console.log('currentEditingElement:', this.currentEditingElement);

        if (newText && this.currentEditingElement) {
            const textId = this.currentEditingElement.getAttribute('data-text-id');
            console.log('textId:', textId);

            // Update element content
            this.currentEditingElement.textContent = newText;
            console.log('Element text updated');

            // Update translations
            if (!this.translations[this.currentLanguage]) {
                this.translations[this.currentLanguage] = {};
            }
            this.translations[this.currentLanguage][textId] = newText;
            console.log('Translations updated');

            this.showStatus('Text updated successfully', 'success');
        } else {
            console.warn('Cannot save: newText or currentEditingElement is missing');
        }

        modal.classList.add('removing');
        setTimeout(() => {
            modal.remove();
            this.cancelCurrentEdit();
            console.log('Modal closed and editing cancelled');
        }, 300);
    }

    startImageEditing(element) {
        this.currentEditingElement = element;
        element.classList.add('editing');

        const imageId = element.getAttribute('data-image-src');
        const currentSrc = this.images[imageId] || element.getAttribute('src');

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
        if (file && this.currentEditingElement) {
            const imageId = this.currentEditingElement.getAttribute('data-image-src');
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
            if (this.currentEditingElement) {
                this.currentEditingElement.setAttribute('src', newSrc);
            }

            // Update images object
            this.images[imageId] = newSrc;

            this.showStatus('Image updated successfully', 'success');
            this.cancelCurrentEdit();
        };
        reader.readAsDataURL(file);
    }

    saveImageEdit(imageId, saveBtn) {
        // This would be called from the modal
        const modal = saveBtn.closest('.modal');
        modal.remove();
        this.cancelCurrentEdit();
    }

    cancelCurrentEdit() {
        if (this.currentEditingElement) {
            this.currentEditingElement.classList.remove('editing');
            this.currentEditingElement = null;
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
        this.showStatus('Changes saved successfully!', 'success');
    }

    exportTemplate() {
        // Export the modified template with original structure
        const parser = new DOMParser();
        const originalDoc = parser.parseFromString(this.templateContent, 'text/html');

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

        this.showStatus('Template exported successfully!', 'success');
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message status-${type}`;

        // Show the message
        setTimeout(() => statusEl.classList.add('show'), 100);

        // Hide after 3 seconds
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}



// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.templateEditorInstance = new TemplateEditor();
});
