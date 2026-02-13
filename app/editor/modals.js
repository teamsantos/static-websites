// Modal creation and management
export class ModalManager {
    constructor(editor) {
        this.editor = editor;
        this._lastCodeSendTime = 0;
        this._codeSendCooldown = 10000; // 10 seconds cooldown
    }

    openModal() {
        if (this.editor.mode === 'create') {
            this.showCreateModal();
        } else if (this.editor.mode === 'save') {
            this.showSaveModal();
        } else {
            console.error('Unknown editor mode:', this.editor.mode);
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
                        <input type="text" id="project-name" placeholder="my-project" required pattern="[A-Za-z0-9-]+" title="Only letters, numbers and hyphens allowed (no spaces).">
                        <small id="project-name-error" class="error-message" style="color: #ef4444; display: none;">Project name contains invalid characters — they were removed.</small>
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

        // Update URL preview on input and sanitize value
        const urlPreview = modal.querySelector('#url-preview');
        const projectNameError = modal.querySelector('#project-name-error');

        // Helper: sanitize project name for use as a subdomain label
        function sanitizeProjectName(raw) {
            // Replace whitespace with hyphens, then remove any character that's not A-Z a-z 0-9 or hyphen
            let s = raw.replace(/\s+/g, '-');
            const before = s;
            s = s.replace(/[^A-Za-z0-9-]/g, '');
            // Trim leading/trailing hyphens
            s = s.replace(/^[-]+|[-]+$/g, '');
            return { sanitized: s, changed: s !== before };
        }

        projectNameInput.addEventListener('input', () => {
            const raw = projectNameInput.value;
            const { sanitized, changed } = sanitizeProjectName(raw);

            if (sanitized !== raw) {
                // Update input value to the sanitized version to prevent invalid characters
                const selectionStart = projectNameInput.selectionStart;
                projectNameInput.value = sanitized;
                // Try to restore cursor position (clamped)
                const pos = Math.min(selectionStart || 0, sanitized.length);
                projectNameInput.setSelectionRange(pos, pos);
            }

            // Show a brief error if changes were made
            if (changed) {
                projectNameError.style.display = 'block';
                clearTimeout(projectNameError._hideTimeout);
                projectNameError._hideTimeout = setTimeout(() => { projectNameError.style.display = 'none'; }, 2500);
            }

            const name = (projectNameInput.value.trim()) || 'my-project';
            // Use encodeURIComponent for safety when showing the preview (but keep the sanitized name visible)
            urlPreview.textContent = `${encodeURIComponent(name)}.e-info.click`;
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
        const urlParams = new URLSearchParams(window.location.search);
        const projectName = urlParams.get('project');

        if (!projectName) {
            this.editor.ui.showStatus('No project name found', 'error');
            return;
        }

        // Check if we can send code (cooldown check)
        const now = Date.now();
        const canSendImmediately = now - this._lastCodeSendTime >= this._codeSendCooldown;

        // Send code immediately on modal open (if not in cooldown)
        if (canSendImmediately) {
            this._sendVerificationCode(projectName);
        }

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
                        <button id="resend-code-btn" class="btn btn-secondary" ${canSendImmediately ? '' : 'disabled'}>
                            ${canSendImmediately ? 'Resend Code' : 'Wait 10s...'}
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

        // Add resend button handler
        const resendBtn = modal.querySelector('#resend-code-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                resendBtn.disabled = true;
                resendBtn.textContent = 'Sending...';
                const success = await this._sendVerificationCode(projectName);
                if (success) {
                    this._startCooldown(resendBtn);
                } else {
                    // Re-enable button on failure so user can retry
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'Resend Code';
                }
            });

            // Start cooldown if we just sent the code on modal open
            if (canSendImmediately) {
                this._startCooldown(resendBtn);
            }
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

    /**
     * Send verification code to user's email
     * @param {string} projectName - The project name/templateId
     * @returns {Promise<boolean>} - True if code was sent successfully
     */
    _sendVerificationCode(projectName) {
        this.editor.ui.showStatus('Sending verification code...', 'info');

        return fetch('https://api.e-info.click/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId: projectName })
        })
        .then(async res => {
            if (!res.ok) {
                try {
                    const data = await res.json();
                    throw new Error(data.error || `Server error: ${res.status}`);
                } catch (e) {
                    throw new Error(e.message || `Server error: ${res.status}`);
                }
            }
            return res.json();
        })
        .then(data => {
            this.editor.ui.showStatus('Verification code sent to email', 'success');
            // Only set cooldown time after successful send
            this._lastCodeSendTime = Date.now();
            return true;
        })
        .catch(err => {
            console.error('Error sending code:', err);
            this.editor.ui.showStatus(err.message || 'Failed to send verification code', 'error');
            return false;
        });
    }

    /**
     * Start cooldown timer for resend button
     * @param {HTMLElement} button - The resend button element
     */
    _startCooldown(button) {
        // Clear any existing cooldown timer
        if (this._cooldownInterval) {
            clearInterval(this._cooldownInterval);
        }

        button.disabled = true;
        let remainingSeconds = 10;
        button.textContent = `Wait ${remainingSeconds}s...`;

        this._cooldownInterval = setInterval(() => {
            remainingSeconds--;
            // Check if button is still in DOM before updating
            if (!button.isConnected) {
                clearInterval(this._cooldownInterval);
                this._cooldownInterval = null;
                return;
            }
            if (remainingSeconds > 0) {
                button.textContent = `Wait ${remainingSeconds}s...`;
            } else {
                clearInterval(this._cooldownInterval);
                this._cooldownInterval = null;
                button.disabled = false;
                button.textContent = 'Resend Code';
            }
        }, 1000);
    }
}
