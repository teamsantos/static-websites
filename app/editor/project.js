// Project creation functionality
export class ProjectManager {
    constructor(editor) {
        this.editor = editor;
    }

    async createProject() {
        const email = document.getElementById('creator-email').value.trim();
        const projectName = document.getElementById('project-name').value.trim();

        if (!email || !projectName) {
            this.editor.ui.showStatus('Please fill in all fields', 'error');
            return;
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.editor.ui.showStatus('Please enter a valid email address', 'error');
            return;
        }

        // Validate project name (alphanumeric, hyphens, underscores)
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!nameRegex.test(projectName)) {
            this.editor.ui.showStatus('Project name can only contain letters, numbers, hyphens, and underscores', 'error');
            return;
        }

        // Save input values to sessionStorage for session-only persistence
        sessionStorage.setItem('creator-email', email);
        sessionStorage.setItem('project-name', projectName);

        this.editor.ui.showStatus('Creating project...', 'info');

        // Get the export data (images, langs, templateId)
        const exportData = this.editor.collectExportData();

        try {
            const response = await fetch("https://pay.e-info.click/checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...exportData,
                    priceId: "price_1S5P4zHSl67hemuh5NUTtsRg"
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Checkout creation failed:", error);
                alert("Failed to create checkout session.");
                return;
            }

            const data = await response.json();
            window.location.href = data.sessionUrl; // Redirect to Stripe checkout
        } catch (err) {
            console.error("Error creating checkout:", err);
            alert("Something went wrong.");
        }
    }

    // async createProject() {
    //     const email = document.getElementById('creator-email').value.trim();
    //     const projectName = document.getElementById('project-name').value.trim();
    //
    //     if (!email || !projectName) {
    //         this.editor.ui.showStatus('Please fill in all fields', 'error');
    //         return;
    //     }
    //
    //     // Validate email
    //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //     if (!emailRegex.test(email)) {
    //         this.editor.ui.showStatus('Please enter a valid email address', 'error');
    //         return;
    //     }
    //
    //     // Validate project name (alphanumeric, hyphens, underscores)
    //     const nameRegex = /^[a-zA-Z0-9_-]+$/;
    //     if (!nameRegex.test(projectName)) {
    //         this.editor.ui.showStatus('Project name can only contain letters, numbers, hyphens, and underscores', 'error');
    //         return;
    //     }
    //
    //     // Save input values to sessionStorage for session-only persistence
    //     sessionStorage.setItem('creator-email', email);
    //     sessionStorage.setItem('project-name', projectName);
    //
    //     this.editor.ui.showStatus('Creating project...', 'info');
    //
    //     // Get the export data (images, langs, templateId)
    //     const exportData = this.editor.collectExportData();
    //
    //     try {
    //         const response = await fetch('https://api.e-info.click/create-project', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //             },
    //             body: JSON.stringify({
    //                 ...exportData,
    //                 email,
    //                 name: projectName
    //             })
    //         });
    //
    //         const data = await response.json();
    //
    //         if (response.ok) {
    //             this.editor.ui.showStatus('Project created successfully! Redirecting...', 'success');
    //             // Clear saved data on success
    //             sessionStorage.removeItem('creator-email');
    //             sessionStorage.removeItem('project-name');
    //             // Close modal
    //             const modal = document.querySelector('.modern-text-editor-overlay');
    //             modal.classList.add('removing');
    //             setTimeout(() => {
    //                 modal.remove();
    //                 // Redirect to the created website
    //                 window.location.href = `https://${data.url}`;
    //             }, 300);
    //         } else {
    //             this.editor.ui.showStatus(data.error || 'Failed to create project', 'error');
    //         }
    //     } catch (error) {
    //         console.error('Error creating project:', error);
    //         this.editor.ui.showStatus('Failed to create project. Please try again.', 'error');
    //     }
    // }

    saveWithCode() {
        const code = document.getElementById('verification-code').value.trim();

        // For demo purposes, accept '1234' as valid code
        if (code === '1234') {
            this.editor.saveChanges();
            const modal = document.querySelector('.modern-text-editor-overlay');
            modal.classList.add('removing');
            setTimeout(() => { modal.remove(); }, 300);
        } else {
            this.editor.ui.showStatus('Invalid verification code', 'error');
        }
    }
}
