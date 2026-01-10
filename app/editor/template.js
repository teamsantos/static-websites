// Template loading and processing
export class TemplateManager {
    constructor(editor) {
        this.editor = editor;
        this.styleObserver = null;
        this.scopedStyleIds = new Set();
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
            itemUrl = `../projects/${templateName}/dist/index.html`;
            remoteUrl = `https://${templateName}.template.e-info.click`;
            this.editor.templateId = templateName; // Store template ID for export
        } else {
            this.editor.ui.showStatus(`No ${this.editor.mode === 'create' ? 'template' : 'project'} specified. Please check your URL and try again, or contact us at ${this.editor.supportEmail}`, 'info');
            return;
        }

        if (itemName.trim() === '') {
            this.editor.ui.showStatus(`Something went wrong. Please try again later or contact us at ${this.editor.supportEmail}`, 'error');
            return;
        }

        this.editor.ui.showStatus(`Loading ${itemType}...`, 'info');

        // Fetch item from local directory
        fetch(itemUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                this.editor.templateContent = html;
                this.processTemplate();
                this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded successfully!`, 'success');
            })
            .catch(error => {
                console.error(`Error loading ${itemType}:`, error);
                // Fallback to remote URL if local fails
                this.editor.ui.showStatus(`Trying remote ${itemType}...`, 'info');

                fetch(remoteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        this.editor.templateContent = html;
                        this.processTemplate();
                        this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} loaded from remote successfully!`, 'success');
                    })
                    .catch(remoteError => {
                        console.error(`Error loading remote ${itemType}:`, remoteError);
                        this.editor.ui.showStatus(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} not found. Please check the ${itemType} name or contact us at ${this.editor.supportEmail}`, 'error');
                    });
            });
    }

     startStyleInterception() {
         // Use MutationObserver to intercept all style additions and scope them
         if (this.styleObserver) {
             this.styleObserver.disconnect();
         }
         
         this.styleObserver = new MutationObserver((mutations) => {
             mutations.forEach((mutation) => {
                 if (mutation.type === 'childList') {
                     mutation.addedNodes.forEach((node) => {
                         if (node.nodeType === 1 && node.tagName === 'STYLE') {
                             // Check if this is a Tailwind-generated style
                             if (!node.getAttribute('data-scoped')) {
                                 this.scopeStyleTag(node);
                             }
                         }
                     });
                 }
             });
         });
         
         // Observe the document head for new style tags
         this.styleObserver.observe(document.head, {
             childList: true,
             subtree: false,
         });
     }

     scopeStyleTag(styleTag) {
         // Mark as scoped to avoid double-processing
         styleTag.setAttribute('data-scoped', 'true');
         styleTag.setAttribute('data-template-style', 'true');
         
         let cssContent = styleTag.textContent;
         
         // Check if it's Tailwind-generated (contains . selectors and utility patterns)
         const isTailwind = cssContent.includes('@layer') || 
                          cssContent.match(/\.[a-z]+-[a-z0-9-]+\s*\{/);
         
         if (!isTailwind || cssContent.includes('.template-scope-wrapper')) {
             return; // Not Tailwind or already scoped
         }
         
         // For Tailwind utilities and components, scope them
         let scopedCss = cssContent;
         
         // Skip @import rules
         const importMatch = scopedCss.match(/^@import[^;]+;[\s\n]*/);
         let importText = '';
         if (importMatch) {
             importText = importMatch[0];
             scopedCss = scopedCss.substring(importMatch[0].length);
         }
         
         // Scope layer utilities
         if (scopedCss.includes('@layer utilities')) {
             scopedCss = scopedCss.replace(
                 /@layer utilities/,
                 '@layer utilities'  // Keep as is, utilities are scoped via 'important'
             );
         }
         
         // Scope regular selectors
         const lines = scopedCss.split('\n');
         const scopedLines = lines.map((line, idx) => {
             // Skip empty lines and @-rules
             if (!line.trim() || line.trim().startsWith('@')) {
                 return line;
             }
             
             // Check if this is a selector line (ends with {)
             if (line.match(/\{[\s]*$/)) {
                 // Skip :root, html, body as they're already handled
                 if (line.includes(':root') || line.includes('html') || line.includes('body')) {
                     return '.template-scope-wrapper { /* normalized */ }';
                 }
                 
                 // Add wrapper prefix to selector
                 return '.template-scope-wrapper ' + line;
             }
             
             // For declaration lines, add !important if not already present
             if (line.includes(':') && line.includes(';')) {
                 if (!line.includes('!important')) {
                     return line.replace(/;/g, ' !important;');
                 }
             }
             
             return line;
         });
         
         // Update the style tag content
         styleTag.textContent = importText + scopedLines.join('\n');
     }

    clearTemplateStyles() {
         // Stop observing style changes
         if (this.styleObserver) {
             this.styleObserver.disconnect();
             this.styleObserver = null;
         }
         
         // Remove any existing template styles
         const existingTemplateStyles = document.querySelectorAll('[data-template-style]');
         existingTemplateStyles.forEach(style => style.remove());
         
         // Clear the scoped style tracking
         this.scopedStyleIds.clear();
     }

    processTemplate() {
         // Clear any existing template styles first
         this.clearTemplateStyles();

         // START OBSERVING for Tailwind style injections BEFORE anything else loads
         this.startStyleInterception();
 
         const parser = new DOMParser();
         const doc = parser.parseFromString(this.editor.templateContent, 'text/html');
 
         // Remove the e-info footer if present
         const footerToRemove = doc.getElementById('modernFooter');
         if (footerToRemove) {
             footerToRemove.remove();
         }
 
         // Create a wrapper div with strict CSS isolation using display: contents
         // and a custom containment strategy
         const scopeWrapper = document.createElement('div');
         scopeWrapper.className = 'template-scope-wrapper';
         scopeWrapper.setAttribute('data-template-style', 'true');
         
         // Display the template in the DOM first so CSS styles are applied
         const templateContainer = document.getElementById('template-content');
         templateContainer.innerHTML = '';
         templateContainer.appendChild(scopeWrapper);
 
         // Extract and apply CSS styles from the template (pass scopeWrapper to it)
         this.extractAndApplyStyles(doc, scopeWrapper);
 
         // Move body content into the scope wrapper
         while (doc.body.firstChild) {
             scopeWrapper.appendChild(doc.body.firstChild);
         }
 
         // Add padding to prevent editor overlay from blocking content
         scopeWrapper.style.paddingTop = '56px';
 
         // Now that the template is in the live DOM and CSS styles are applied,
         // load text/image files and process editable elements
         // This must happen AFTER appendChild so getComputedStyle() works correctly
         this.editor.elements.loadTranslationFiles(scopeWrapper);
         this.editor.elements.loadImageFiles(scopeWrapper);
 
         // Process editable elements
         this.editor.elements.processEditableElements(scopeWrapper);
 
         // Initialize section management
         this.editor.sections.initializeSections();
 
         this.editor.ui.showStatus('Template ready for editing!', 'success');
     }

     extractAndApplyStyles(doc, scopeWrapper) {
         // Extract styles from template head
         const styleElements = doc.querySelectorAll('style');
         const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
         const scriptElements = doc.querySelectorAll('script');

         // Create a style container to hold all template styles
         // This will be isolated using !important and selector scoping
         const styleIsolationPrefix = '.template-scope-wrapper';

         // CRITICAL: Process Tailwind config FIRST before any other scripts
         let tailwindConfigScript = null;
         let hasTailwindCDN = false;
         
         // Find Tailwind-related scripts
         scriptElements.forEach(scriptElement => {
             if (scriptElement.src && scriptElement.src.includes('cdn.tailwindcss')) {
                 hasTailwindCDN = true;
             } else if (scriptElement.textContent && scriptElement.textContent.includes('tailwind.config')) {
                 tailwindConfigScript = scriptElement;
             }
         });

         // If we have Tailwind, setup the config immediately BEFORE loading anything else
         if (hasTailwindCDN || tailwindConfigScript) {
             this.setupTailwindConfiguration(scopeWrapper, tailwindConfigScript);
         }

         // Add style elements - scoped to template wrapper
         styleElements.forEach(styleElement => {
             const newStyle = document.createElement('style');
             newStyle.setAttribute('data-template-style', 'true');
             let cssContent = styleElement.textContent;
             
             // CRITICAL: Scope ALL CSS rules to prevent global effects
             cssContent = cssContent.replace(/\bbody\s*\{/g, `${styleIsolationPrefix} {`);
             cssContent = cssContent.replace(/\bhtml\s*\{/g, `${styleIsolationPrefix} {`);
             cssContent = cssContent.replace(/\:root\s*\{/g, `${styleIsolationPrefix} {`);
             cssContent = cssContent.replace(/^\s*\*\s*\{/gm, `${styleIsolationPrefix}, ${styleIsolationPrefix} * {`);
             
             // Add !important to all declarations to ensure they override editor styles
             cssContent = cssContent.replace(/;(?!\s*!important)/gm, ' !important;');
             
             newStyle.textContent = cssContent;
             document.head.appendChild(newStyle);
         });

         // Add link elements (external stylesheets) 
         linkElements.forEach(linkElement => {
             // Skip Tailwind CDN link as it will be handled via script
             if (linkElement.href && (linkElement.href.includes('tailwind') || linkElement.href.includes('cdn.tailwind'))) {
                 return;
             }
             const newLink = document.createElement('link');
             newLink.setAttribute('data-template-style', 'true');
             newLink.rel = 'stylesheet';
             newLink.href = linkElement.href;
             document.head.appendChild(newLink);
         });

         // Handle non-Tailwind scripts
         scriptElements.forEach(scriptElement => {
             // Skip Tailwind-related scripts (already handled above)
             if ((scriptElement.src && scriptElement.src.includes('cdn.tailwindcss')) ||
                 (scriptElement.textContent && scriptElement.textContent.includes('tailwind.config'))) {
                 return;
             }
             
             if (!scriptElement.src && scriptElement.textContent && scriptElement.type !== 'module') {
                 // Inline scripts (non-module)
                 const newScript = document.createElement('script');
                 newScript.setAttribute('data-template-style', 'true');
                 newScript.type = scriptElement.type || 'text/javascript';
                 newScript.textContent = scriptElement.textContent;
                 scopeWrapper.appendChild(newScript);
             } else if (scriptElement.type === 'module' && scriptElement.textContent) {
                 // Module scripts
                 const newScript = document.createElement('script');
                 newScript.setAttribute('data-template-style', 'true');
                 newScript.type = 'module';
                 newScript.textContent = scriptElement.textContent;
                 scopeWrapper.appendChild(newScript);
             }
         });
     }

     setupTailwindConfiguration(scopeWrapper, tailwindConfigScript) {
         // The key insight: Tailwind loads and injects styles into document.head
         // regardless of where the <script> tag is. We need to:
         // 1. Load Tailwind in the wrapper
         // 2. Immediately override all generated styles to be scoped
         // 3. Or prevent Tailwind from affecting the parent document at all
         
         window.tailwind = window.tailwind || {};
         
         // Create base config with critical settings
         const baseConfig = {
             important: '.template-scope-wrapper',  // Scope ALL utilities
             corePlugins: {
                 preflight: false,  // DISABLE preflight completely
             },
         };
         
         // If template has a Tailwind config, merge it but keep our scoping
         if (tailwindConfigScript && tailwindConfigScript.textContent) {
             const originalConfigText = tailwindConfigScript.textContent;
             
             // Create a temporary script to capture the user's config
             const tempScript = document.createElement('script');
             tempScript.textContent = `
                 (function() {
                     window._rawTailwindConfig = null;
                     ${originalConfigText.replace(/tailwind\.config\s*=\s*/, 'window._rawTailwindConfig = ')}
                 })();
             `;
             document.head.appendChild(tempScript);
             
             // Set initial config
             window.tailwind.config = baseConfig;
             
             // After config script runs, merge with user config
             setTimeout(() => {
                 if (window._rawTailwindConfig) {
                     const userConfig = window._rawTailwindConfig;
                     window.tailwind.config = {
                         ...userConfig,
                         important: '.template-scope-wrapper',
                         corePlugins: {
                             ...userConfig.corePlugins,
                             preflight: false,  // CRITICAL
                         },
                     };
                 }
                 tempScript.remove();
                 delete window._rawTailwindConfig;
             }, 10);
         } else {
             window.tailwind.config = baseConfig;
         }
         
         // Load Tailwind into the wrapper
         const script = document.createElement('script');
         script.setAttribute('data-template-style', 'true');
         script.src = 'https://cdn.tailwindcss.com';
         script.defer = true;
         
         script.onload = () => {
             // After Tailwind loads, ensure config is still correct
             setTimeout(() => {
                 if (window.tailwind && window.tailwind.config) {
                     const config = window.tailwind.config;
                     // Force the important flag
                     if (!config.important) {
                         config.important = '.template-scope-wrapper';
                     }
                     // Force preflight off
                     if (!config.corePlugins) {
                         config.corePlugins = {};
                     }
                     config.corePlugins.preflight = false;
                 }
                 
                 // Now extract Tailwind styles from head and move to wrapper with !important
                 this.scopeAllTailwindStyles();
             }, 200);
         };
         
         scopeWrapper.appendChild(script);
     }

     scopeAllTailwindStyles() {
         // After Tailwind loads, it puts styles in <head>
         // We need to extract them and re-apply with proper scoping
         const templateWrapper = document.querySelector('.template-scope-wrapper');
         if (!templateWrapper) return;
         
         // Find all style tags that were added by Tailwind (marked with data-tailwind)
         const tailwindStyles = document.head.querySelectorAll('style[data-tailwind], style[data-tw]');
         
         tailwindStyles.forEach(styleTag => {
             let cssContent = styleTag.textContent;
             
             // Check if it's already scoped
             if (cssContent.includes('.template-scope-wrapper')) {
                 return; // Already scoped
             }
             
             // Tailwind utilities need special handling
             // They come in the form of: .text-red-500 { ... }
             // We need to scope them: .template-scope-wrapper .text-red-500 { ... }
             
             if (!cssContent.includes(':root') && !cssContent.includes('html') && !cssContent.includes('body')) {
                 // This is utilities - scope them
                 const wrapper = '.template-scope-wrapper ';
                 const lines = cssContent.split('\n');
                 const scopedLines = lines.map(line => {
                     // Add wrapper prefix to selectors (but be careful with complex selectors)
                     if (line.match(/^[^{]*\{/)) {
                         return wrapper + line;
                     }
                     return line;
                 });
                 styleTag.textContent = scopedLines.join('\n');
             }
         });
     }
}
