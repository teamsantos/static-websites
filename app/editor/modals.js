// Modal creation and management
export class ModalManager {
    constructor(editor) {
        this.editor = editor;
    }

    openModal() {
        if (this.editor.mode === 'create') {
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
                    <p style="margin-bottom: 20px; color: #374151 !important;">Enter the verification code sent to your email:</p>
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
}