// Section management functionality
export class SectionManager {
    constructor(editor) {
        this.editor = editor;
        this.removedSections = new Map(); // Store removed sections by ID
        this.sectionControls = new Map(); // Store control elements by section ID
    }

    /**
     * Initialize section management for the current template
     */
    initializeSections() {
        const templateContainer = document.getElementById('template-content');
        if (!templateContainer) return;

        // Find all sections in the template
        const sections = templateContainer.querySelectorAll('section, header, footer, main');
        sections.forEach(section => {
            this.addSectionControls(section);
        });

        // Also check for divs that might be sections (like hero sections)
        const potentialSections = templateContainer.querySelectorAll('div[id]');
        potentialSections.forEach(div => {
            // Only add controls to divs that look like sections (have meaningful content)
            if (this.isSectionLike(div)) {
                this.addSectionControls(div);
            }
        });
    }

    /**
     * Check if a div element looks like a section
     */
    isSectionLike(element) {
        // Check if it has a meaningful ID and contains substantial content
        const id = element.id;
        if (!id || id.startsWith('template-') || id === 'template-content') return false;

        // Check if it has substantial content (not just a wrapper)
        const childCount = element.children.length;
        const textContent = element.textContent.trim().length;

        return childCount > 0 || textContent > 50;
    }

    /**
     * Add control buttons to a section
     */
    addSectionControls(section) {
        const sectionId = section.id || this.generateSectionId(section);
        if (!sectionId) return;

        // Skip if controls already exist
        if (this.sectionControls.has(sectionId)) return;

        // Create control container
        const controlContainer = document.createElement('div');
        controlContainer.className = 'section-controls';
        controlContainer.setAttribute('data-section-id', sectionId);

        // Create hide button
        const hideBtn = document.createElement('button');
        hideBtn.className = 'section-control-btn section-hide-btn';
        hideBtn.title = 'Hide section';
        hideBtn.innerHTML = '×';
        hideBtn.onclick = () => this.removeSection(sectionId);

        // Create section label
        const sectionLabel = document.createElement('span');
        sectionLabel.className = 'section-label';
        sectionLabel.textContent = this.getSectionLabel(section, sectionId);

        controlContainer.appendChild(sectionLabel);
        controlContainer.appendChild(hideBtn);

        // Position the controls - always visible for easier access
        controlContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0.7;
            transition: opacity 0.2s;
        `;

        // Make section position relative for absolute positioning
        section.style.position = section.style.position || 'relative';

        // Show controls on hover for better UX
        section.addEventListener('mouseenter', () => {
            controlContainer.style.opacity = '1';
        });
        section.addEventListener('mouseleave', () => {
            controlContainer.style.opacity = '0.7';
        });

        section.appendChild(controlContainer);
        this.sectionControls.set(sectionId, controlContainer);
    }

    /**
     * Generate an ID for a section if it doesn't have one
     */
    generateSectionId(section) {
        // Try to generate a meaningful ID based on content
        const className = section.className;
        if (className) {
            return className.split(' ')[0];
        }

        // Fallback to element type
        return section.tagName.toLowerCase();
    }

    /**
     * Get a human-readable label for a section
     */
    getSectionLabel(section, sectionId) {
        // Try to get a meaningful name from the section content
        const headings = section.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length > 0) {
            return headings[0].textContent.substring(0, 20) + '...';
        }

        // Use ID or class name
        return sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    }

    /**
     * Remove a section from the template
     */
    removeSection(sectionId) {
        const section = document.getElementById(sectionId) || document.querySelector(`[data-section-id="${sectionId}"]`)?.parentElement;
        if (!section) return;

        // Store the section reference for re-adding
        this.removedSections.set(sectionId, {
            element: section,
            originalPosition: this.getSectionPosition(section)
        });

        // Hide the section instead of removing it
        section.style.display = 'none';

        // Update navigation links that might reference this section
        this.updateNavigationLinks(sectionId);

        // Show re-add option
        this.showReAddOption(sectionId);

        this.editor.ui.showStatus(`Section "${sectionId}" hidden. You can restore it using the section manager.`, 'info');
    }

    /**
     * Get the position of a section relative to its siblings
     */
    getSectionPosition(section) {
        const siblings = Array.from(section.parentElement.children);
        return siblings.indexOf(section);
    }

    /**
     * Update navigation links that reference the removed section
     */
    updateNavigationLinks(sectionId) {
        const links = document.querySelectorAll(`a[href="#${sectionId}"]`);
        links.forEach(link => {
            link.style.textDecoration = 'line-through';
            link.style.opacity = '0.5';
            link.title = 'Section removed - re-add to restore link';
        });
    }

    /**
     * Show option to re-add the removed section
     */
    showReAddOption(sectionId) {
        // Create or update the re-add sections panel
        let reAddPanel = document.getElementById('re-add-sections-panel');
        if (!reAddPanel) {
            reAddPanel = document.createElement('div');
            reAddPanel.id = 're-add-sections-panel';
            reAddPanel.className = 're-add-sections-panel';
            reAddPanel.innerHTML = `
                <h4>Hidden Sections</h4>
                <div class="removed-sections-list"></div>
            `;

            // Add to editor UI
            const editorContainer = document.querySelector('.editor-container') || document.body;
            editorContainer.appendChild(reAddPanel);
        }

        const list = reAddPanel.querySelector('.removed-sections-list');

        // Check if this section is already in the list
        if (list.querySelector(`[data-section-id="${sectionId}"]`)) return;

        const sectionItem = document.createElement('div');
        sectionItem.className = 'removed-section-item';
        sectionItem.setAttribute('data-section-id', sectionId);
        sectionItem.innerHTML = `
            <span>${this.getSectionLabel(this.removedSections.get(sectionId).element, sectionId)}</span>
            <button class="re-add-btn" onclick="window.templateEditorInstance.sections.reAddSection('${sectionId}')">Restore</button>
        `;

        list.appendChild(sectionItem);
        reAddPanel.style.display = 'block';
    }

    /**
     * Re-add a previously removed section
     */
    reAddSection(sectionId) {
        const sectionData = this.removedSections.get(sectionId);
        if (!sectionData) return;

        // Show the section (it's already in its original position)
        sectionData.element.style.display = '';

        // Remove from removed sections
        this.removedSections.delete(sectionId);

        // Update navigation links
        this.restoreNavigationLinks(sectionId);

        // Remove from re-add panel
        const reAddItem = document.querySelector(`.removed-section-item[data-section-id="${sectionId}"]`);
        if (reAddItem) {
            reAddItem.remove();
        }

        // Hide panel if no more removed sections
        const reAddPanel = document.getElementById('re-add-sections-panel');
        if (reAddPanel && reAddPanel.querySelectorAll('.removed-section-item').length === 0) {
            reAddPanel.style.display = 'none';
        }

        this.editor.ui.showStatus(`Section "${sectionId}" restored to its original position!`, 'success');
    }

    /**
     * Restore navigation links for re-added section
     */
    restoreNavigationLinks(sectionId) {
        const links = document.querySelectorAll(`a[href="#${sectionId}"]`);
        links.forEach(link => {
            link.style.textDecoration = '';
            link.style.opacity = '';
            link.title = '';
        });
    }

    /**
     * Get list of available sections that can be added
     */
    getAvailableSections() {
        // This could be expanded to provide predefined sections
        return [
            { id: 'hero', name: 'Hero Section', template: this.getDefaultHeroSection() },
            { id: 'services', name: 'Services Section', template: this.getDefaultServicesSection() },
            { id: 'about', name: 'About Section', template: this.getDefaultAboutSection() },
            { id: 'testimonials', name: 'Testimonials Section', template: this.getDefaultTestimonialsSection() },
            { id: 'contact', name: 'Contact Section', template: this.getDefaultContactSection() }
        ];
    }

    /**
     * Add a new section to the template
     */
    addNewSection(sectionType) {
        const availableSections = this.getAvailableSections();
        const sectionTemplate = availableSections.find(s => s.id === sectionType);

        if (!sectionTemplate) return;

        const templateContainer = document.getElementById('template-content');
        if (!templateContainer) return;

        // Create the section element
        const sectionElement = document.createElement('section');
        sectionElement.id = sectionType;
        sectionElement.className = sectionType;
        sectionElement.innerHTML = sectionTemplate.template;

        // Add to the end of the template
        templateContainer.appendChild(sectionElement);

        // Add controls
        this.addSectionControls(sectionElement);

        this.editor.ui.showStatus(`New ${sectionTemplate.name} added!`, 'success');
    }

    /**
     * Show the section manager modal
     */
    showSectionManager() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content section-manager-modal">
                <div class="modal-header">
                    <h3>Manage Sections</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="section-manager-content">
                        <div class="add-section-section">
                            <h4>Add New Section</h4>
                            <div class="available-sections">
                                ${this.getAvailableSections().map(section => `
                                    <div class="section-option" onclick="window.templateEditorInstance.sections.addNewSection('${section.id}')">
                                        <div class="section-icon">${this.getSectionIcon(section.id)}</div>
                                        <div class="section-info">
                                            <h5>${section.name}</h5>
                                            <p>Add a ${section.name.toLowerCase()} to your template</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ${this.removedSections.size > 0 ? `
                        <div class="removed-sections-section">
                            <h4>Restore Hidden Sections</h4>
                            <div class="removed-sections-grid">
                                ${Array.from(this.removedSections.entries()).map(([id, data]) => `
                                    <div class="removed-section-option" onclick="window.templateEditorInstance.sections.reAddSection('${id}')">
                                        <div class="section-icon">↺</div>
                                        <div class="section-info">
                                            <h5>${this.getSectionLabel(data.element, id)}</h5>
                                            <p>Click to restore this section</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add modal styles
        this.addSectionManagerStyles();
    }

    /**
     * Get icon for section type
     */
    getSectionIcon(sectionType) {
        const icons = {
            hero: '⊡',
            services: '⚙',
            about: 'ℹ',
            testimonials: '❝',
            contact: '✉'
        };
        return icons[sectionType] || '□';
    }

    /**
     * Add styles for section manager modal
     */
    addSectionManagerStyles() {
        if (document.getElementById('section-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'section-manager-styles';
        style.textContent = `
            .section-manager-modal .modal-content {
                max-width: 600px;
                width: 90vw;
            }

            .section-manager-content {
                padding: 0;
            }

            .add-section-section,
            .removed-sections-section {
                margin-bottom: 24px;
            }

            .add-section-section h4,
            .removed-sections-section h4 {
                margin: 0 0 16px 0;
                color: #374151;
                font-size: 16px;
                font-weight: 600;
            }

            .available-sections,
            .removed-sections-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .section-option,
            .removed-section-option {
                display: flex;
                align-items: center;
                padding: 16px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                background: white;
            }

            .section-option:hover,
            .removed-section-option:hover {
                border-color: #3b82f6;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
                transform: translateY(-1px);
            }

            .section-icon {
                font-size: 18px;
                margin-right: 16px;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f3f4f6;
                border-radius: 6px;
                color: #6b7280;
                font-weight: bold;
            }

            .section-info h5 {
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: #111827;
            }

            .section-info p {
                margin: 0;
                font-size: 13px;
                color: #6b7280;
            }

            .removed-section-option .section-icon {
                background: #fef3c7;
                color: #92400e;
            }

            .removed-section-option .section-info h5 {
                color: #92400e;
            }

            @media (max-width: 640px) {
                .section-manager-modal .modal-content {
                    margin: 20px;
                    width: calc(100vw - 40px);
                }

                .section-option,
                .removed-section-option {
                    padding: 12px;
                }

                .section-icon {
                    width: 30px;
                    height: 30px;
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Default section templates (simplified versions)
    getDefaultHeroSection() {
        return `
            <div class="container">
                <div class="hero-content">
                    <div class="hero-text">
                        <h1>Welcome to Our Website</h1>
                        <p>This is a hero section. Click to edit the content.</p>
                        <a href="#contact" class="cta-button">Get Started</a>
                    </div>
                </div>
            </div>
        `;
    }

    getDefaultServicesSection() {
        return `
            <div class="container">
                <h2 class="section-title">Our Services</h2>
                <p class="section-subtitle">What we offer</p>
                <div class="services-grid">
                    <div class="service-card">
                        <h3>Service 1</h3>
                        <p>Description of service 1</p>
                    </div>
                    <div class="service-card">
                        <h3>Service 2</h3>
                        <p>Description of service 2</p>
                    </div>
                    <div class="service-card">
                        <h3>Service 3</h3>
                        <p>Description of service 3</p>
                    </div>
                </div>
            </div>
        `;
    }

    getDefaultAboutSection() {
        return `
            <div class="container">
                <div class="about-content">
                    <div class="about-text">
                        <h2>About Us</h2>
                        <p>Tell your story here.</p>
                    </div>
                </div>
            </div>
        `;
    }

    getDefaultTestimonialsSection() {
        return `
            <div class="container">
                <h2 class="section-title">Testimonials</h2>
                <div class="testimonials-grid">
                    <div class="testimonial-card">
                        <p>"Great service!"</p>
                        <div class="testimonial-author">
                            <div class="author-info">
                                <h4>John Doe</h4>
                                <span>Customer</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getDefaultContactSection() {
        return `
            <div class="container">
                <div class="contact-content">
                    <div class="contact-info">
                        <h2>Contact Us</h2>
                        <p>Get in touch</p>
                    </div>
                    <div class="contact-form">
                        <form>
                            <input type="text" placeholder="Name" required>
                            <input type="email" placeholder="Email" required>
                            <textarea placeholder="Message" required></textarea>
                            <button type="submit" class="cta-button">Send</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
}