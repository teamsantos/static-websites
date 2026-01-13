// Template loading and processing
export class TemplateManager {
    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Update the loading screen status text
     */
    updateLoadingStatus(message) {
        const statusText = document.getElementById('loading-status-text');
        if (statusText) {
            statusText.textContent = message;
        }
    }

    /**
     * Hide the loading screen and show the template content
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const templateContent = document.getElementById('template-content');
        
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
        
        if (templateContent) {
            templateContent.classList.remove('template-content-hidden');
            templateContent.classList.add('template-content-visible');
        }
    }

    /**
     * Show error state when template fails to load
     */
    showErrorState(message) {
        const loadingScreen = document.getElementById('loading-screen');
        const templateContent = document.getElementById('template-content');
        const errorState = templateContent?.querySelector('.template-error-state');
        
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
        
        if (templateContent) {
            templateContent.classList.remove('template-content-hidden');
            templateContent.classList.add('template-content-visible');
        }
        
        if (errorState) {
            errorState.style.display = 'flex';
        }
    }

    autoLoadTemplate() {
        // Get template or project name from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const templateName = urlParams.get('template');
        const projectName = urlParams.get('project');

        // Detect if running locally (localhost or 127.0.0.1)
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        let itemName, itemType, itemUrl, remoteUrl;

        if (projectName) {
            itemName = projectName;
            itemType = 'project';
            itemUrl = isLocal 
                ? `/projects/${projectName}/index.html`
                : `projects/${projectName}/index.html`;
            remoteUrl = `https://${projectName}.e-info.click`;
            this.updateLoadingStatus(`Loading project: ${projectName}...`);
        } else if (templateName) {
            itemName = templateName;
            itemType = 'template';
            // When running locally from /dist/, use absolute path to templates folder
            itemUrl = isLocal 
                ? `/templates/${templateName}/dist/index.html`
                : `../templates/${templateName}/dist/index.html`;
            remoteUrl = `https://${templateName}.template.e-info.click`;
            this.editor.templateId = templateName; // Store template ID for export
            this.updateLoadingStatus(`Loading template: ${templateName}...`);
        } else {
            this.showErrorState();
            this.editor.ui.showStatus(`No ${this.editor.mode === 'create' ? 'template' : 'project'} specified. Please check your URL and try again, or contact us at ${this.editor.supportEmail}`, 'info');
            return;
        }

        if (itemName.trim() === '') {
            this.showErrorState();
            this.editor.ui.showStatus(`Something went wrong. Please try again later or contact us at ${this.editor.supportEmail}`, 'error');
            return;
        }

        // Fetch item from local directory
        fetch(itemUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                this.updateLoadingStatus('Processing template...');
                return response.text();
            })
            .then(html => {
                this.editor.templateContent = html;
                this.processTemplate();
            })
            .catch(error => {
                console.error(`Error loading ${itemType}:`, error);
                // Fallback to remote URL if local fails
                this.updateLoadingStatus(`Trying remote server...`);

                fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        this.updateLoadingStatus('Processing template...');
                        return response.text();
                    })
                    .then(html => {
                        this.editor.templateContent = html;
                        this.processTemplate();
                    })
                    .catch(remoteError => {
                        console.error(`Error loading remote ${itemType}:`, remoteError);
                        this.showErrorState();
                        this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} not found. Please check the ${itemType} name or contact us at ${this.editor.supportEmail}`, 'error');
                    });
            });
    }

    clearTemplateStyles() {
        // Remove any existing template styles from document head (legacy cleanup)
        const existingTemplateStyles = document.querySelectorAll('[data-template-style]');
        existingTemplateStyles.forEach(style => style.remove());
    }

     processTemplate() {
         // Clear any existing template styles first
         this.clearTemplateStyles();

         const parser = new DOMParser();
         const doc = parser.parseFromString(this.editor.templateContent, 'text/html');

         // Remove the e-info footer if present
         const footerToRemove = doc.getElementById('modernFooter');
         if (footerToRemove) {
             footerToRemove.remove();
         }

         // Transform image paths to use the template domain
         this.transformImagePaths(doc);

         // Check if template uses Tailwind CDN
         const usesTailwind = this.checkForTailwindCDN(doc);

        // Get or create Shadow DOM for complete CSS isolation
        const templateContainer = document.getElementById('template-content');
        let shadowRoot = templateContainer.shadowRoot;
        if (!shadowRoot) {
            shadowRoot = templateContainer.attachShadow({ mode: 'open' });
        }
        shadowRoot.innerHTML = '';

        // Store shadow root reference on editor for other modules to access
        this.editor.shadowRoot = shadowRoot;

        if (usesTailwind) {
            // For Tailwind templates, we need a special process
            this.processTemplateWithTailwind(doc, shadowRoot, templateContainer);
        } else {
            // For non-Tailwind templates, proceed normally
            this.processTemplateNormal(doc, shadowRoot);
        }
    }

     /**
      * Check if the template uses Tailwind CDN
      */
     checkForTailwindCDN(doc) {
         const scripts = doc.querySelectorAll('script[src]');
         for (const script of scripts) {
             if (script.src.includes('tailwindcss') || script.src.includes('cdn.tailwindcss.com')) {
                 return true;
             }
         }
         return false;
     }

     /**
      * Transform image paths from relative paths to full template domain URLs
      * E.g., /images/image.jpg becomes https://<templateID>.template.e-info.click/images/image.jpg
      */
     transformImagePaths(doc) {
         // Get the template ID from the URL parameters
         const urlParams = new URLSearchParams(window.location.search);
         const templateName = urlParams.get('template');
         const projectName = urlParams.get('project');

         if (!templateName && !projectName) {
             return; // No template/project to transform paths for
         }

         const domain = templateName 
             ? `https://${templateName}.template.e-info.click`
             : `https://${projectName}.e-info.click`;

         // Find all img elements and transform their src attributes
         const imageElements = doc.querySelectorAll('img[src], [data-image-src]');
         imageElements.forEach(element => {
             const src = element.getAttribute('src');
             if (src && src.startsWith('/')) {
                 // Transform relative path to full URL
                 element.setAttribute('src', domain + src);
             }
         });
     }

     /**
      * Process template that uses Tailwind CDN
      */
    processTemplateWithTailwind(doc, shadowRoot, templateContainer) {
        // For Tailwind, we need to:
        // 1. Inject Tailwind script and config into the main document
        // 2. Temporarily render content in a visible (but off-screen) div in main document
        // 3. Let Tailwind generate styles
        // 4. Copy generated styles to shadow root
        // 5. Move content to shadow root

        // Update loading status
        this.updateLoadingStatus('Loading Tailwind CSS...');

        // Show loading indicator while Tailwind processes
        this.showTailwindLoadingIndicator(shadowRoot);

        // Step 1: Extract Tailwind-related elements from template
        const styleElements = doc.querySelectorAll('style');
        const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
        const scriptElements = doc.querySelectorAll('script');

        // Inject font stylesheets to document head (fonts need to be in main document)
        linkElements.forEach(linkElement => {
            if (linkElement.rel !== 'stylesheet') return;
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = linkElement.href;
            newLink.setAttribute('data-template-style', 'true');
            if (linkElement.crossOrigin) {
                newLink.crossOrigin = linkElement.crossOrigin;
            }
            document.head.appendChild(newLink);
        });

        // Step 2: Find Tailwind script and config
        let tailwindSrc = null;
        let tailwindConfigContent = null;
        
        scriptElements.forEach(scriptElement => {
            const src = scriptElement.src;
            const content = scriptElement.textContent;
            
            if (src && (src.includes('tailwindcss') || src.includes('cdn.tailwindcss.com'))) {
                tailwindSrc = src;
            } else if (content && content.includes('tailwind.config')) {
                tailwindConfigContent = content;
            }
        });

        // Step 3: Load Tailwind, then config, then create temp container
        this.loadTailwindAndProcess(tailwindSrc, tailwindConfigContent, doc, shadowRoot, styleElements);
    }

    /**
     * Load Tailwind CDN, apply config, and process template
     */
    loadTailwindAndProcess(tailwindSrc, tailwindConfigContent, doc, shadowRoot, styleElements) {
        const loadTailwind = () => {
            return new Promise((resolve) => {
                // Check if Tailwind is already loaded
                if (window.tailwind) {
                    resolve();
                    return;
                }

                if (!tailwindSrc) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = tailwindSrc;
                script.setAttribute('data-template-style', 'true');
                script.onload = () => {
                    // Give Tailwind a moment to initialize
                    setTimeout(resolve, 200);
                };
                script.onerror = () => resolve();
                document.head.appendChild(script);
            });
        };

        loadTailwind().then(() => {
            // Step 4: Inject Tailwind config AFTER Tailwind has loaded
            this.updateLoadingStatus('Applying theme configuration...');
            if (tailwindConfigContent && window.tailwind) {
                try {
                    // Execute config - this sets tailwind.config
                    const configScript = document.createElement('script');
                    configScript.textContent = tailwindConfigContent;
                    configScript.setAttribute('data-template-style', 'true');
                    document.head.appendChild(configScript);
                } catch (e) {
                    console.warn('Error applying Tailwind config:', e);
                }
            }

            // Step 5: Create temp container with template content
            // Make it visible but off-screen so Tailwind can scan it
            this.updateLoadingStatus('Generating styles...');
            const tempContainer = document.createElement('div');
            tempContainer.id = 'tailwind-temp-container';
            tempContainer.style.cssText = 'position:fixed;left:-10000px;top:0;width:1920px;height:auto;visibility:visible;';
            tempContainer.innerHTML = doc.body.innerHTML;
            document.body.appendChild(tempContainer);

            // Step 6: Trigger Tailwind to rescan by adding a small delay and forcing a repaint
            // This ensures Tailwind's MutationObserver picks up the new content
            requestAnimationFrame(() => {
                this.updateLoadingStatus('Finalizing template...');
                setTimeout(() => {
                    this.finishTailwindSetup(doc, shadowRoot, tempContainer, styleElements);
                }, 800); // Increased delay to ensure Tailwind has time to process
            });
        });
    }

    /**
     * Finish setting up template after Tailwind has processed
     */
    async finishTailwindSetup(doc, shadowRoot, tempContainer, styleElements) {
        // Remove loading indicator
        this.removeTailwindLoadingIndicator(shadowRoot);

        // Collect ALL styles from the document - Tailwind CDN injects styles into <style> tags
        let tailwindCSS = '';
        
        // Get all style elements in the document
        const allStyles = document.querySelectorAll('style');
        allStyles.forEach(style => {
            const content = style.textContent;
            if (!content) return;
            
            // Include all Tailwind-related styles
            // Tailwind CDN creates style tags with utility classes
            if (
                content.includes('--tw-') ||           // Tailwind CSS variables
                content.includes('tailwindcss') ||     // Tailwind comment marker
                content.includes('.bg-') ||            // Background utilities
                content.includes('.text-') ||          // Text utilities
                content.includes('.flex') ||           // Flex utilities
                content.includes('.grid') ||           // Grid utilities
                content.includes('.p-') ||             // Padding utilities
                content.includes('.m-') ||             // Margin utilities
                content.includes('box-sizing')         // Reset styles
            ) {
                tailwindCSS += content + '\n';
            }
        });

        // Add template's own style elements (like dark mode styles)
        // Transform :root to :host for Shadow DOM compatibility
        styleElements.forEach(styleElement => {
            let css = styleElement.textContent;
            css = this.transformCSSForShadowDOM(css);
            tailwindCSS += css + '\n';
        });

        // Inject combined styles into shadow root
        const combinedStyle = document.createElement('style');
        combinedStyle.textContent = tailwindCSS;
        shadowRoot.appendChild(combinedStyle);

        // Inject editor-specific styles
        await this.injectEditorStylesIntoShadow(shadowRoot);

        // Create wrapper and move content to shadow root
        const wrapper = document.createElement('div');
        wrapper.id = 'template-shadow-wrapper';
        wrapper.style.paddingTop = '56px';
        wrapper.style.minHeight = '100vh';
        
        // Copy body classes to wrapper (important for Tailwind body utilities like bg-background)
        const bodyClasses = doc.body.className;
        if (bodyClasses) {
            wrapper.className = bodyClasses;
        }
        
        wrapper.innerHTML = tempContainer.innerHTML;
        shadowRoot.appendChild(wrapper);

        // Clean up temp container
        tempContainer.remove();

        // Now process elements in shadow root
        this.editor.elements.loadTranslationFiles(shadowRoot);
        this.editor.elements.loadImageFiles(shadowRoot);
        this.editor.elements.loadIconFiles(shadowRoot);
        this.editor.elements.processEditableElements(shadowRoot);
        this.editor.sections.initializeSections();

        // Initialize hero images editor if template has trail images
        this.editor.heroImages.initialize();

        // Hide loading screen and show template
        this.hideLoadingScreen();
        this.editor.ui.showStatus('Template ready for editing!', 'success');
    }

    /**
     * Process non-Tailwind template normally
     */
    async processTemplateNormal(doc, shadowRoot) {
        // Inject styles INTO the shadow root (not document.head) for isolation
        this.injectStylesIntoShadow(doc, shadowRoot);

        // Create wrapper to hold template content with proper padding
        const wrapper = document.createElement('div');
        wrapper.id = 'template-shadow-wrapper';
        wrapper.style.paddingTop = '56px';
        wrapper.style.minHeight = '100vh';

        // Copy the body content into wrapper
        Array.from(doc.body.childNodes).forEach(node => {
            wrapper.appendChild(node.cloneNode(true));
        });

        shadowRoot.appendChild(wrapper);

        // Add editor-specific styles to shadow root for editable elements
        await this.injectEditorStylesIntoShadow(shadowRoot);

        // Now that the template is in the live DOM (shadow DOM) and CSS styles are applied,
        // load text/image files and process editable elements
        this.editor.elements.loadTranslationFiles(shadowRoot);
        this.editor.elements.loadImageFiles(shadowRoot);
        this.editor.elements.loadIconFiles(shadowRoot);
        this.editor.elements.processEditableElements(shadowRoot);
        this.editor.sections.initializeSections();

        // Initialize hero images editor if template has trail images
        this.editor.heroImages.initialize();

        // Hide loading screen and show template
        this.hideLoadingScreen();
        this.editor.ui.showStatus('Template ready for editing!', 'success');
    }

    /**
     * Inject template styles into the shadow root for CSS isolation (non-Tailwind)
     */
    injectStylesIntoShadow(doc, shadowRoot) {
        // Extract and inject style elements
        const styleElements = doc.querySelectorAll('style');
        styleElements.forEach(styleElement => {
            const newStyle = document.createElement('style');
            // Transform CSS for Shadow DOM compatibility:
            // 1. Replace :root with :host (CSS variables need to be on :host in shadow DOM)
            // 2. Replace body selector with #template-shadow-wrapper
            let cssContent = styleElement.textContent;
            cssContent = this.transformCSSForShadowDOM(cssContent);
            newStyle.textContent = cssContent;
            shadowRoot.appendChild(newStyle);
        });

        // Extract and inject link elements (external stylesheets)
        const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach(linkElement => {
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = linkElement.href;
            if (linkElement.crossOrigin) {
                newLink.crossOrigin = linkElement.crossOrigin;
            }
            shadowRoot.appendChild(newLink);
        });

        // Skip template scripts in editor mode - they would run in the wrong context
        // (main document instead of shadow DOM) and cause issues like:
        // - Custom cursors appearing on the editor page
        // - Event listeners not finding elements (they're in shadow DOM)
        // - Navbar scroll effects not working
        // The template preview is for visual editing, not interactive functionality
    }

    /**
     * Transform CSS to work inside Shadow DOM
     * - :root becomes :host (for CSS variables)
     * - body becomes #template-shadow-wrapper
     * - html becomes :host
     */
    transformCSSForShadowDOM(css) {
        // Replace :root with :host for CSS custom properties
        css = css.replace(/:root\s*\{/g, ':host {');
        
        // Replace html selector with :host
        css = css.replace(/(?<![a-zA-Z0-9_-])html\s*\{/g, ':host {');
        
        // Replace body selector with #template-shadow-wrapper
        // Be careful not to replace body inside other selectors or comments
        css = css.replace(/(?<![a-zA-Z0-9_-])body\s*\{/g, '#template-shadow-wrapper {');
        
        // Also handle body in combined selectors like "html, body {"
        css = css.replace(/(?<![a-zA-Z0-9_-])body\s*,/g, '#template-shadow-wrapper,');
        css = css.replace(/,\s*body\s*\{/g, ', #template-shadow-wrapper {');
        
        // Remove cursor: none styles - templates shouldn't hide the cursor in editor mode
        css = css.replace(/cursor\s*:\s*none\s*(!important)?\s*;?/gi, 'cursor: auto;');
        
        // Hide custom cursor elements and mobile menu overlays in editor mode
        // These are interactive features that don't work without JavaScript
        css += `
            .cursor, .cursor-dot, [class*="cursor"]:not([class*="cursor-pointer"]) {
                display: none !important;
            }
            .mobile-menu, .mobile-menu-btn, .mobile-menu-close {
                display: none !important;
            }
            /* Ensure navbar is visible and properly styled in editor */
            .navbar {
                position: absolute !important;
            }
        `;
        
        return css;
    }

    /**
     * Inject editor-specific styles into shadow root for editable element highlighting
     * Loads styles from the external editor.css file to maintain a single source of truth
     */
    async injectEditorStylesIntoShadow(shadowRoot) {
        // Detect if running locally (localhost or 127.0.0.1)
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Build the path to editor.css
        const cssPath = isLocal 
            ? '/styles/editor.css'
            : '../styles/editor.css';
        
        try {
            const response = await fetch(cssPath);
            if (!response.ok) {
                throw new Error(`Failed to load editor.css: ${response.status}`);
            }
            
            let cssContent = await response.text();
            
            // Transform selectors for shadow DOM compatibility
            // Replace #template-content selectors since we're inside the shadow root
            cssContent = cssContent.replace(/#template-content\s+/g, '');
            
            const editorStyles = document.createElement('style');
            editorStyles.textContent = cssContent;
            shadowRoot.appendChild(editorStyles);
        } catch (error) {
            console.warn('Could not load editor.css, using fallback inline styles:', error);
            // Fallback to minimal inline styles if CSS file cannot be loaded
            this.injectFallbackEditorStyles(shadowRoot);
        }
    }

    /**
     * Fallback inline styles in case editor.css cannot be loaded
     */
    injectFallbackEditorStyles(shadowRoot) {
        const editorStyles = document.createElement('style');
        editorStyles.textContent = `
            /* Editable element highlighting */
            .editable-element {
                position: relative;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .editable-element:hover {
                box-shadow: 0 0 0 2px #3b82f6;
            }

            .editable-element.editing {
                box-shadow: 0 0 0 2px #3b82f6;
            }

            .editable-element:hover {
                overflow: visible !important;
            }

            .editable-element[data-text-id]:hover::after {
                content: "Click to edit text";
                position: absolute;
                top: -32px;
                left: 0;
                background: #1e293b;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                z-index: 1001;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-transform: none;
                letter-spacing: normal;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', Roboto, sans-serif;
            }

            .editable-element[data-image-src]:hover::after {
                content: "Click to change image";
                position: absolute;
                top: -32px;
                left: 0;
                background: #1e293b;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                z-index: 1001;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-transform: none;
                letter-spacing: normal;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', Roboto, sans-serif;
            }

            .editable-element[data-icon-id]:hover::after {
                content: "Click to change icon";
                position: absolute;
                top: -32px;
                left: 0;
                background: #1e293b;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                z-index: 1001;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-transform: none;
                letter-spacing: normal;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', Roboto, sans-serif;
            }

            .plus-divider {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 20px 0;
                opacity: 0.2;
                transition: opacity 0.3s ease;
                cursor: pointer;
            }

            .plus-divider:hover {
                opacity: 1;
            }

            .divider-line {
                flex: 1;
                height: 1px;
                background-color: currentColor;
            }

            .plus-icon {
                font-size: 18px;
                font-weight: 300;
                user-select: none;
            }

            .lang-element-wrapper {
                display: contents;
            }

            .section-controls {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 6px;
                opacity: 0.7 !important;
                transition: opacity 0.2s;
                backdrop-filter: blur(4px);
            }

            .section-controls:hover {
                opacity: 1 !important;
            }

            .section-label {
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 120px;
            }

            .section-control-btn {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
            }

            .section-control-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }

            .section-hide-btn:hover {
                background: rgba(107, 114, 128, 0.8);
            }

            .section-bg-color-swatch {
                width: 24px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                cursor: pointer;
                background: white;
                margin-right: 4px;
                transition: all 0.2s ease;
            }

            .section-bg-color-swatch:hover {
                border-color: rgba(255, 255, 255, 0.8);
                box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
            }

            .section-color-picker-popover {
                position: absolute;
                display: none;
                padding: 12px;
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1010;
            }

            .image-remove-btn {
                position: absolute;
                top: 2rem;
                right: 0.5rem;
                background: rgba(239, 68, 68, 0.9);
                color: white;
                border: none;
                border-radius: 0.375rem;
                width: 2rem;
                height: 2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                backdrop-filter: blur(4px);
                z-index: 10;
            }

            .image-remove-btn:hover {
                background: rgba(220, 38, 38, 1);
                transform: scale(1.05);
            }

            .image-remove-btn:active {
                transform: scale(0.95);
            }

            .image-remove-btn svg {
                pointer-events: none;
            }

            section:hover,
            header:hover,
            footer:hover,
            main:hover,
            div[id]:hover {
                outline: 2px solid rgba(59, 130, 246, 0.3);
                outline-offset: 2px;
            }

            .tailwind-loading-indicator {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                text-align: center;
                color: #64748b;
            }

            .tailwind-loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e2e8f0;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: tailwind-spin 1s linear infinite;
                margin-bottom: 16px;
            }

            @keyframes tailwind-spin {
                to { transform: rotate(360deg); }
            }

            .tailwind-loading-text {
                font-size: 14px;
                font-weight: 500;
            }
        `;
        shadowRoot.appendChild(editorStyles);
    }

    /**
     * Show loading indicator while Tailwind processes styles
     */
    showTailwindLoadingIndicator(shadowRoot) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'tailwind-loading-indicator';
        loadingIndicator.id = 'tailwind-loading';
        loadingIndicator.innerHTML = `
            <div class="tailwind-loading-spinner"></div>
            <div class="tailwind-loading-text">Processing Tailwind styles...</div>
        `;
        shadowRoot.appendChild(loadingIndicator);
    }

    /**
     * Remove loading indicator after Tailwind processing is complete
     */
    removeTailwindLoadingIndicator(shadowRoot) {
        const loadingIndicator = shadowRoot.querySelector('#tailwind-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
}
