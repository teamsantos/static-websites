// UI update methods
export class UIManager {
    constructor(editor) {
        this.editor = editor;
    }

    updateSupportEmail() {
        const emailPlaceholder = document.getElementById('support-email-placeholder');
        if (emailPlaceholder) {
            emailPlaceholder.textContent = this.editor.supportEmail;
        }
    }

    updateButton() {
        const btn = document.getElementById('export-template-btn');
        if (btn) {
            btn.textContent = this.editor.mode === 'create' ? 'Create website' : 'Save changes';
        }
    }

    updateTitle() {
        const titleEl = document.querySelector('.editor-info h2');
        if (titleEl) {
            titleEl.innerHTML = `${this.editor.mode === 'create' ? 'Template Editor' : 'Project Editor'} <a href="https://e-info.click" style="font-size: 0.8em; color: #6b7280; text-decoration: none; margin-left: 10px; cursor: pointer;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">e-info.click</a>`;
        }
    }

    updateButtonsVisibility() {
        const changeBtn = document.getElementById('change-template-btn');
        const saveBtn = document.getElementById('save-changes-btn');
        const exportBtn = document.getElementById('export-template-btn');

        if (this.editor.mode === 'save') {
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