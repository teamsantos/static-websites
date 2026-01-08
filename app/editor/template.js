// Template loading and processing
export class TemplateManager {
    constructor(editor) {
        this.editor = editor;
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

    clearTemplateStyles() {
        // Remove any existing template styles
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
 
         // Create a wrapper div for isolated Tailwind scope
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

         // Add style elements - scoped to template wrapper
         styleElements.forEach(styleElement => {
             const newStyle = document.createElement('style');
             newStyle.setAttribute('data-template-style', 'true');
             let cssContent = styleElement.textContent;
             
             // Wrap body and html styles with template scope wrapper specificity
             // This prevents them from affecting the editor page
             cssContent = cssContent.replace(/\bbody\s*\{/g, '.template-scope-wrapper {');
             cssContent = cssContent.replace(/\bhtml\s*\{/g, '.template-scope-wrapper {');
             cssContent = cssContent.replace(/\:root\s*\{/g, '.template-scope-wrapper {');
             
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

         // Handle Tailwind scripts - inject into scope wrapper only
         let hasTailwindConfig = false;
         scriptElements.forEach(scriptElement => {
             // Check if this is a Tailwind CDN script
             if (scriptElement.src && scriptElement.src.includes('cdn.tailwindcss')) {
                 // Load Tailwind CDN into the scope wrapper
                 this.injectTailwindIntoScope(scopeWrapper);
             } else if (scriptElement.textContent && scriptElement.textContent.includes('tailwind.config')) {
                 // This is a Tailwind config script - inject it into the scope wrapper
                 hasTailwindConfig = true;
                 const newScript = document.createElement('script');
                 newScript.setAttribute('data-template-style', 'true');
                 newScript.textContent = this.scopeTailwindConfig(scriptElement.textContent);
                 scopeWrapper.appendChild(newScript);
             } else if (!scriptElement.src && scriptElement.textContent && scriptElement.type !== 'module') {
                 // Inline scripts (non-module) - add to scope wrapper
                 const newScript = document.createElement('script');
                 newScript.setAttribute('data-template-style', 'true');
                 newScript.type = scriptElement.type || 'text/javascript';
                 newScript.textContent = scriptElement.textContent;
                 scopeWrapper.appendChild(newScript);
             } else if (scriptElement.type === 'module' && scriptElement.textContent) {
                 // Module scripts - add to scope wrapper
                 const newScript = document.createElement('script');
                 newScript.setAttribute('data-template-style', 'true');
                 newScript.type = 'module';
                 newScript.textContent = scriptElement.textContent;
                 scopeWrapper.appendChild(newScript);
             }
         });

         // If Tailwind config was found but not loaded, ensure we still load Tailwind CDN
         if (hasTailwindConfig) {
             this.injectTailwindIntoScope(scopeWrapper);
         }
     }

     scopeTailwindConfig(configScript) {
         // Add important flag to scope Tailwind to the wrapper
         // This modifies the config to make all utilities scoped
         return configScript.replace(
             /tailwind\.config\s*=\s*\{/,
             `tailwind.config = {
                 important: '.template-scope-wrapper',`
         );
     }

     injectTailwindIntoScope(scopeWrapper) {
         // Load Tailwind from CDN and inject it into the scope wrapper
         const script = document.createElement('script');
         script.setAttribute('data-template-style', 'true');
         script.src = 'https://cdn.tailwindcss.com';
         
         // Configure Tailwind when it loads
         script.onload = () => {
             // Wait a tick for Tailwind to initialize
             setTimeout(() => {
                 if (window.tailwind) {
                     // Override Tailwind config to scope styles
                     window.tailwind.config = {
                         important: '.template-scope-wrapper',
                         corePlugins: {
                             preflight: false, // Disable preflight to prevent global resets
                         },
                         theme: {
                             extend: {},
                         },
                     };
                 }
             }, 50);
         };
         
         scopeWrapper.appendChild(script);
     }
}
