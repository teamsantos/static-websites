class TemplateEditor {
    constructor() {
        this.templateContent = null;
        this.translations = {};
        this.images = {};
        this.currentLanguage = 'en';
        this.currentEditingElement = null;

        // Support email - change this in one place
        this.supportEmail = 'teamsantos.software+support@gmail.com';

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateSupportEmail();
        this.autoLoadTemplate();
    }

    updateSupportEmail() {
        const emailPlaceholder = document.getElementById('support-email-placeholder');
        if (emailPlaceholder) {
            emailPlaceholder.textContent = this.supportEmail;
        }
    }

    bindEvents() {
        // Editor controls
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('export-template-btn').addEventListener('click', () => this.exportTemplate());

        // File inputs
        document.getElementById('image-file-input').addEventListener('change', (e) => this.handleImageFile(e));

        // Global events
        document.addEventListener('click', (e) => this.handleElementClick(e));
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    autoLoadTemplate() {
        // Get template name from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const templateName = urlParams.get('template');



        if (!templateName) {
            this.showStatus(`No template specified. Please check your URL and try again, or contact us at ${this.supportEmail}`, 'info');
            return;
        }

        if (templateName.trim() === '') {
                this.showStatus(`Something went wrong. Please try again later or contact us at ${this.supportEmail}`, 'error');
            return;
        }

        // Load template from local templates directory
        const templateUrl = `templates/${templateName}/index.html`;

        this.showStatus('Loading template...', 'info');

        // Fetch template from local directory
        fetch(templateUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                this.templateContent = html;
                this.processTemplate();
                this.showStatus('Template loaded successfully!', 'success');
            })
            .catch(error => {
                console.error('Error loading template:', error);
                // Fallback to remote URL if local fails
                const remoteUrl = `https://${templateName}.templates.e-info.click`;
                this.showStatus('Trying remote template...', 'info');

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
                        this.showStatus('Template loaded from remote successfully!', 'success');
                    })
                    .catch(remoteError => {
                        console.error('Error loading remote template:', remoteError);
                        this.showStatus(`Template not found. Please check the template name or contact us at ${this.supportEmail}`, 'error');
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

        // Create text editor
        const editor = document.createElement('textarea');
        editor.className = 'text-editor';
        editor.value = currentText;
        editor.style.width = element.offsetWidth + 'px';
        editor.style.height = Math.min(Math.max(element.offsetHeight, 60), 150) + 'px';

        // Position the editor
        const rect = element.getBoundingClientRect();
        editor.style.position = 'fixed';
        editor.style.top = rect.top + 'px';
        editor.style.left = rect.left + 'px';
        editor.style.zIndex = '1002';

        document.body.appendChild(editor);
        editor.focus();
        editor.select();

        // Handle save/cancel
        editor.addEventListener('blur', () => this.saveTextEdit(editor, element));
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.saveTextEdit(editor, element);
            } else if (e.key === 'Escape') {
                this.cancelCurrentEdit();
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
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
            <button class="editor-btn" onclick="this.closest('.modal').remove()">Cancel</button>
            <button class="editor-btn primary" onclick="templateEditor.saveImageEdit('${imageId}', this)">Save</button>
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
        const editors = document.querySelectorAll('.text-editor, .image-editor');
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

// Stars background animation for hero
(() => {
    const canvas = document.querySelector('.stars');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, dpr;
    let stars = [];
    let shooting = [];

    function resize() {
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initStars() {
        const count = Math.max(5, Math.floor((width * height) / 18000)); // density
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 1.1 + 0.2,
            a: Math.random() * 0.6 + 0.3,
            tw: Math.random() * 0.02 + 0.005,
            t: Math.random() * Math.PI * 2
        }));
    }

    function spawnShootingStar() {
        if (shooting.length > 2) return;
        const fromTop = Math.random() < 0.5;
        const startX = fromTop ? Math.random() * width * 0.6 : width * (0.4 + Math.random() * 0.6);
        const startY = fromTop ? -20 : Math.random() * height * 0.5;
        const speed = 600 + Math.random() * 600; // px/s
        const angle = (Math.PI / 4) + Math.random() * (Math.PI / 8); // down-right
        shooting.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.6 + Math.random() * 0.6,
            age: 0
        });
    }

    let last = performance.now();
    function tick(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, width, height);

        // aurora-friendly dark sky gradient
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(12, 18, 32, 0.2)');
        g.addColorStop(1, 'rgba(12, 18, 32, 0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // twinkling stars
        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            s.t += s.tw;
            const alpha = s.a + Math.sin(s.t) * 0.25;
            ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // shooting stars
        for (let i = shooting.length - 1; i >= 0; i--) {
            const sh = shooting[i];
            sh.age += dt;
            if (sh.age > sh.life) { shooting.splice(i, 1); continue; }
            const px = sh.x, py = sh.y;
            sh.x += sh.vx * dt; sh.y += sh.vy * dt;
            const trail = 120; // px
            const ang = Math.atan2(sh.vy, sh.vx);
            const tx = Math.cos(ang) * -trail;
            const ty = Math.sin(ang) * -trail;
            const grad = ctx.createLinearGradient(px, py, px + tx, py + ty);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + tx, py + ty);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        // occasionally spawn a shooting star
        if (Math.random() < 0.007) spawnShootingStar();

        requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => { resize(); initStars(); });
    ro.observe(canvas);
    resize();
    initStars();
    requestAnimationFrame(tick);
})();

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const templateEditor = new TemplateEditor();
});