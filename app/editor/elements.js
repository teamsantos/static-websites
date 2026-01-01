// Element loading and processing
export class ElementManager {
    constructor(editor) {
        this.editor = editor;
    }

    createPlusDivider() {
        const divider = document.createElement('div');
        divider.className = 'plus-divider';
        divider.innerHTML = `
        <div class="divider-line"></div>
        <span class="plus-icon">+</span>
        <div class="divider-line"></div>
    `;
        return divider;
    }

    /**
     * Convert RGB/RGBA color to hex
     * Handles hex, rgb, rgba, and edge cases like transparent colors
     */
    rgbToHex(color) {
        if (!color) return '#000000';
        
        // If it's already a hex color, return it
        if (typeof color === 'string' && color.startsWith('#')) {
            return color;
        }

        // Handle transparent and special values
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'inherit' || color === 'initial') {
            return '#000000'; // Default to black for transparent/unset colors
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

        // If color is a string but doesn't match known formats, try to use it as-is (might be a variable reference or keyword)
        // Default fallback
        return '#000000';
    }

     loadTranslationFiles(containerOrDoc) {
         // Try to load image files from the template
         // This can be called with either a live DOM container or a DOMParser document
         // Note: If called with DOMParser document, getComputedStyle() will not work properly
         // So this should ALWAYS be called after the template is added to the live DOM
         const langElements = containerOrDoc.querySelectorAll('[data-text-id]');
         this.editor.translations[this.editor.currentLanguage] = {};
         this.editor.textColors = {};
         this.editor.sectionBackgrounds = {};
          langElements.forEach(element => {
              const textId = element.getAttribute('data-text-id');
              if (textId) {
                  this.editor.translations[this.editor.currentLanguage][textId] = element.textContent.trim();
                  // Store the current text color (convert RGB to hex for Safari compatibility)
                  // Try multiple sources to get the actual color value
                  const computedStyle = getComputedStyle(element);
                  let colorValue = element.style.color; // First try inline styles
                  
                  if (!colorValue) {
                      // If no inline style, check computed color (from CSS classes)
                      colorValue = computedStyle.color;
                  }
                  
                  // If computed color is transparent or a webkit-text-fill-color is set, look for color in computed styles more carefully
                  if (!colorValue || colorValue === 'transparent' || colorValue === 'rgba(0, 0, 0, 0)') {
                      // This might be a gradient or webkit effect - default to a readable color
                      // In a real scenario, we'd let the user pick a color
                      colorValue = '#1f2937'; // dark gray as default for unresolvable colors
                  }
                  
                  const finalColor = this.rgbToHex(colorValue);
                  this.editor.textColors[textId] = finalColor;
                  console.debug(`Loaded color for ${textId}: raw="${colorValue}" → hex="${finalColor}"`);
                 const wrapper = document.createElement('div');
                 wrapper.className = 'lang-element-wrapper';
 
                 // Make wrapper inherit display and layout properties
                 wrapper.style.display = 'contents';
 
                 element.parentNode.insertBefore(wrapper, element);
                 wrapper.appendChild(element);
                 const divider = this.createPlusDivider();
                 // Function to update divider visibility based on text content
                 const updateDividerVisibility = () => {
                     const hasText = element.textContent.trim().length > 0;
                     divider.style.display = hasText ? 'none' : 'flex';
                 };
                 // Set initial visibility
                 updateDividerVisibility();
                 // Create MutationObserver to watch for text changes ONLY
                 const observer = new MutationObserver((mutations) => {
                     // Only update if the mutation affected text content, not attributes
                     const hasContentChange = mutations.some(mutation =>
                         mutation.type === 'characterData' || mutation.type === 'childList'
                     );
                     if (hasContentChange) {
                         updateDividerVisibility();
                     }
                 });
                 // Start observing the element for changes
                 observer.observe(element, {
                     childList: true,        // Watch for added/removed children
                     characterData: true,    // Watch for text content changes
                     subtree: true          // Watch all descendants
                     // NOTE: We're NOT watching attributes, so classes are safe
                 });
 
                 // Add click handler to plusDivider to open text editing modal
                 divider.addEventListener('click', (e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     this.editor.editing.startTextEditing(element);
                 });
 
                 wrapper.appendChild(divider);
             }
         });
 
         // Load section backgrounds (convert to hex for Safari compatibility)
         const sections = containerOrDoc.querySelectorAll('section, header, footer, main, div[id]');
         sections.forEach(section => {
             const sectionId = section.id;
             if (sectionId) {
                 const computedStyle = getComputedStyle(section);
                 const backgroundColor = section.style.backgroundColor || computedStyle.backgroundColor;
                 if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
                     const hexColor = this.rgbToHex(backgroundColor);
                     this.editor.sectionBackgrounds[sectionId] = hexColor;
                 }
             }
         });
     }

     loadImageFiles(containerOrDoc) {
         // Try to load image files from the template
         const imageElements = containerOrDoc.querySelectorAll('[data-image-src]');
         this.editor.images = {};
         imageElements.forEach(element => {
             const imageSrc = element.getAttribute('data-image-src');
             if (imageSrc) {
                 this.editor.translations[this.editor.currentLanguage][imageSrc] = element.textContent.trim();
                 const wrapper = document.createElement('div');
                 wrapper.className = 'lang-element-wrapper';
 
                 // Make wrapper inherit display and layout properties
                 wrapper.style.display = 'contents';
 
                 element.parentNode.insertBefore(wrapper, element);
                 wrapper.appendChild(element);
                 const divider = this.createPlusDivider();
                 // Function to update divider visibility based on src attribute
                 const updateDividerVisibility = () => {
                     const hasSrc = element.getAttribute('src') && element.getAttribute('src').trim().length > 0;
                     divider.style.display = hasSrc ? 'none' : 'flex';
                 };
                 // Set initial visibility
                 updateDividerVisibility();
                 // Create MutationObserver to watch for attribute changes
                 const observer = new MutationObserver(() => {
                     updateDividerVisibility();
                 });
                 // Start observing the element for attribute changes
                 observer.observe(element, {
                     attributes: true,           // Watch for attribute changes
                    attributeFilter: ['src']    // Only watch the 'src' attribute
                });

                divider.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.editor.editing.startImageEditing(element);
                });
                wrapper.appendChild(divider);
            }
        });
        imageElements.forEach(element => {
            const imageId = element.getAttribute('data-image-src');
            if (imageId) {
                this.editor.images[imageId] = element.getAttribute('src') || '';
            }
        });
    }

     processEditableElements(containerOrDoc) {
         // Add editable class to elements with data attributes
         const editableSelectors = '[data-text-id], [data-image-src]';
         const editableElements = containerOrDoc.querySelectorAll(editableSelectors);
 
         editableElements.forEach(element => {
             element.classList.add('editable-element');
 
             // Apply stored text colors to text elements
             if (element.hasAttribute('data-text-id')) {
                 const textId = element.getAttribute('data-text-id');
                 if (this.editor.textColors[textId]) {
                     const colorToApply = this.editor.textColors[textId];
                     // Use !important to ensure color overrides CSS classes
                     element.style.setProperty('color', colorToApply, 'important');
                     console.debug(`Applied color to ${textId}: ${colorToApply}`);
                 }
             }
 
             // Always enable editing - no conditional logic needed
         });
     }
}
