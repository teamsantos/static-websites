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
            this.applyStoredBackground(section);
            this.addSectionControls(section);
        });

        // Also check for divs that might be sections (like hero sections)
        const potentialSections = templateContainer.querySelectorAll('div[id]');
        potentialSections.forEach(div => {
            // Only add controls to divs that look like sections (have meaningful content)
            if (this.isSectionLike(div)) {
                this.applyStoredBackground(div);
                this.addSectionControls(div);
            }
        });
    }

    /**
     * Apply stored background color to a section
     */
    applyStoredBackground(section) {
        const sectionId = section.id;
        if (sectionId && this.editor.sectionBackgrounds[sectionId]) {
            section.style.backgroundColor = this.editor.sectionBackgrounds[sectionId];
        }
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

         // Create background color swatch for iro.js picker
         const bgColorSwatch = document.createElement('div');
         bgColorSwatch.className = 'section-bg-color-swatch';
         bgColorSwatch.setAttribute('data-section-id', sectionId);
         bgColorSwatch.title = 'Change background color';
         bgColorSwatch.style.backgroundColor = this.getSectionBackgroundColor(section);
         bgColorSwatch.onclick = (e) => {
             e.stopPropagation();
             this.toggleSectionColorPicker(sectionId, bgColorSwatch);
         };

         // Create color picker popover container
         const colorPickerPopover = document.createElement('div');
         colorPickerPopover.className = 'section-color-picker-popover';
         colorPickerPopover.style.display = 'none';
         const pickerId = `section-color-picker-${sectionId}`;
         colorPickerPopover.innerHTML = `<div id="${pickerId}"></div>`;

         // Create section label
         const sectionLabel = document.createElement('span');
         sectionLabel.className = 'section-label';
         sectionLabel.textContent = this.getSectionLabel(section, sectionId);

         controlContainer.appendChild(sectionLabel);
         controlContainer.appendChild(bgColorSwatch);
         controlContainer.appendChild(colorPickerPopover);
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

         // Initialize iro.js color picker for this section
         setTimeout(() => {
             this.initializeSectionColorPicker(sectionId, this.getSectionBackgroundColor(section));
         }, 0);
     }

     /**
      * Initialize iro.js color picker for section background
      */
     initializeSectionColorPicker(sectionId, initialColor) {
         const pickerId = `section-color-picker-${sectionId}`;
         const pickerContainer = document.getElementById(pickerId);
         if (!pickerContainer || this.sectionPickers?.[sectionId]) return;

         if (!this.sectionPickers) this.sectionPickers = {};

         const picker = new iro.ColorPicker(`#${pickerId}`, {
             width: 180,
             color: initialColor
         });

         this.sectionPickers[sectionId] = picker;

         picker.on('color:change', (color) => {
             this.changeSectionBackground(sectionId, color.hexString);
             const swatch = document.querySelector(`.section-bg-color-swatch[data-section-id="${sectionId}"]`);
             if (swatch) {
                 swatch.style.backgroundColor = color.hexString;
             }
         });
     }

      /**
       * Toggle section color picker visibility
       */
      toggleSectionColorPicker(sectionId, swatchElement) {
          const popover = swatchElement.parentElement.querySelector('.section-color-picker-popover');
          if (!popover) return;

          const isVisible = popover.style.display === 'block';
          popover.style.display = isVisible ? 'none' : 'block';

          if (!isVisible) {
              this.positionSectionColorPickerPopover(swatchElement, popover);
          }

          // Close picker when clicking outside
          document.addEventListener('click', (e) => {
              if (!popover.contains(e.target) && e.target !== swatchElement) {
                  popover.style.display = 'none';
              }
          });
      }

       /**
        * Position section color picker popover with viewport awareness
        */
       positionSectionColorPickerPopover(swatchElement, popover) {
           const swatchRect = swatchElement.getBoundingClientRect();
           const controlsRect = swatchElement.closest('.section-controls').getBoundingClientRect();
           const popoverWidth = 206; // 180px picker + 12px padding on each side + borders
           const popoverHeight = 206; // Approximate height for the picker
           const gap = 8; // Space between swatch and popover

           // Calculate available space in viewport
           const spaceAbove = swatchRect.top - gap - popoverHeight;
           const spaceBelow = window.innerHeight - swatchRect.bottom - gap - popoverHeight;
           const spaceLeft = swatchRect.left - gap - popoverWidth;
           const spaceRight = window.innerWidth - swatchRect.right - gap - popoverWidth;

           // Determine vertical position: prefer below, fallback to above
           let top;
           if (spaceBelow >= 0) {
               // Position below the swatch
               top = swatchRect.top - controlsRect.top + swatchRect.height + gap;
           } else if (spaceAbove >= 0) {
               // Position above the swatch
               top = swatchRect.top - controlsRect.top - popoverHeight - gap;
           } else {
               // Not enough space either way, prefer below
               top = swatchRect.top - controlsRect.top + swatchRect.height + gap;
           }

           // Determine horizontal position: prefer right, fallback to left
           let left;
           if (spaceRight >= 0) {
               // Position to the right of the swatch
               left = swatchRect.left - controlsRect.left + swatchRect.width + gap;
           } else if (spaceLeft >= 0) {
               // Position to the left of the swatch
               left = swatchRect.left - controlsRect.left - popoverWidth - gap;
           } else {
               // Not enough space either way, constrain within reasonable bounds
               left = Math.max(0, Math.min(swatchRect.left - controlsRect.left - popoverWidth / 2, controlsRect.width - popoverWidth));
           }

           popover.style.left = left + 'px';
           popover.style.top = top + 'px';
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

        // Re-apply stored background color
        if (this.editor.sectionBackgrounds[sectionId]) {
            sectionData.element.style.backgroundColor = this.editor.sectionBackgrounds[sectionId];
        }

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
     * Get the current background color of a section
     */
    getSectionBackgroundColor(section) {
        const computedStyle = getComputedStyle(section);
        const backgroundColor = section.style.backgroundColor || computedStyle.backgroundColor;

        // If it's transparent or default, return a default color
        if (!backgroundColor || backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)') {
            return '#ffffff'; // Default to white
        }

        // Convert RGB/RGBA to hex for the color picker
        return this.rgbToHex(backgroundColor);
    }

    /**
     * Convert RGB/RGBA color to hex
     * Handles hex, rgb, rgba, and edge cases like transparent colors
     */
    rgbToHex(color) {
        if (!color) return '#ffffff';
        
        // If it's already a hex color, return it
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }

        // Handle transparent and special values
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'inherit' || color === 'initial') {
            return '#ffffff'; // Default to white for transparent/unset colors
        }

        // Handle RGB/RGBA colors - with flexible spacing
        const rgbMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)$/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            return hex.toLowerCase();
        }

        // Default fallback
        return '#ffffff';
    }

    /**
     * Change the background color of a section
     */
    changeSectionBackground(sectionId, color) {
        const section = document.getElementById(sectionId) || document.querySelector(`[data-section-id="${sectionId}"]`)?.parentElement;
        if (!section) return;

        // Apply the background color
        section.style.backgroundColor = color;

        // Store the color for export
        this.editor.sectionBackgrounds[sectionId] = color;

        this.editor.ui.showStatus(`Section background changed to ${color}`, 'success');
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
