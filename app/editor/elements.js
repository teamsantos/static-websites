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
     * Convert OKLCH color to sRGB
     * @param {number} L - Lightness (0-1)
     * @param {number} C - Chroma (0-0.4+)
     * @param {number} H - Hue (0-360)
     * @returns {object} {r, g, b} values 0-255
     */
    oklchToRgb(L, C, H) {
        // Convert hue to radians
        const hRad = (H * Math.PI) / 180;
        
        // OKLCH to OKLab
        const a = C * Math.cos(hRad);
        const b = C * Math.sin(hRad);
        
        // OKLab to linear sRGB via LMS
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
        
        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;
        
        // LMS to linear sRGB
        let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let bVal = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
        
        // Linear sRGB to sRGB (gamma correction)
        const toSrgb = (c) => {
            if (c <= 0.0031308) {
                return 12.92 * c;
            }
            return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };
        
        r = toSrgb(r);
        g = toSrgb(g);
        bVal = toSrgb(bVal);
        
        // Clamp and convert to 0-255
        return {
            r: Math.round(Math.max(0, Math.min(1, r)) * 255),
            g: Math.round(Math.max(0, Math.min(1, g)) * 255),
            b: Math.round(Math.max(0, Math.min(1, bVal)) * 255)
        };
    }

    /**
     * Convert RGB/RGBA/OKLCH color to hex
     * Handles hex, rgb, rgba, oklch, and edge cases like transparent colors
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

        // Handle OKLCH colors - oklch(L C H) or oklch(L C H / alpha)
        const oklchMatch = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i);
        if (oklchMatch) {
            const L = parseFloat(oklchMatch[1]);
            const C = parseFloat(oklchMatch[2]);
            const H = parseFloat(oklchMatch[3]);
            const { r, g, b } = this.oklchToRgb(L, C, H);
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            return hex.toLowerCase();
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

                 // Add the edit/resize button overlay on the image
                 this.addImageEditButton(element, imageSrc);

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

    /**
     * Add edit controls on an image element
     * - Top-left: Resize/move button (Edit)
     * - Middle overlay: Click to change image
     */
    addImageEditButton(element, imageId) {
        // Create a container for the image with relative positioning
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-edit-container';

        // Insert container before element and move element inside
        element.parentNode.insertBefore(imageContainer, element);
        imageContainer.appendChild(element);

        // Apply saved image sizes if they exist
        if (this.editor.imageSizes && this.editor.imageSizes[imageId]) {
            const savedSize = this.editor.imageSizes[imageId];
            element.style.width = savedSize.width;
            element.style.height = savedSize.height;
            element.style.left = savedSize.left;
            element.style.top = savedSize.top;
            element.style.position = savedSize.position || 'absolute';
            element.style.marginLeft = '0';
            element.style.marginTop = '0';
        }

        // Create the resize/move button positioned at top-left
        const resizeButton = document.createElement('button');
        resizeButton.className = 'image-resize-btn';
        resizeButton.title = 'Resize & Move';
        resizeButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;

        resizeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.editor.editing.enterImageEditMode(imageId, element);
        });

        imageContainer.appendChild(resizeButton);

        // Create the light overlay that appears on hover for changing image
        const hoverOverlay = document.createElement('div');
        hoverOverlay.className = 'image-hover-overlay';
        hoverOverlay.innerHTML = '<span class="change-image-text">Click to change image</span>';

        hoverOverlay.addEventListener('click', (e) => {
            // Skip if in image edit mode (resize/move)
            if (this.editor.editing.imageEditMode) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.editor.editing.startImageEditing(element);
        });

        imageContainer.appendChild(hoverOverlay);
    }

     loadIconFiles(containerOrDoc) {
         // Load icon files from the template (Font Awesome icons with data-icon-id)
         const iconElements = containerOrDoc.querySelectorAll('[data-icon-id]');
         this.editor.icons = {};
         iconElements.forEach(element => {
             const iconId = element.getAttribute('data-icon-id');
             if (iconId) {
                 // Extract the current Font Awesome icon class
                 const iconClass = this.extractFontAwesomeClass(element);
                 this.editor.icons[iconId] = iconClass || '';

                 const wrapper = document.createElement('div');
                 wrapper.className = 'lang-element-wrapper icon-element-wrapper';

                 // Make wrapper inherit display and layout properties
                 wrapper.style.display = 'contents';

                 element.parentNode.insertBefore(wrapper, element);
                 wrapper.appendChild(element);

                 // Icons don't need plus dividers since they're always visible
                 // Just make them clickable directly
             }
         });
     }

     /**
      * Extract Font Awesome icon class from element
      * Returns the icon class (e.g., "fa-tooth", "fa-star") or null if not a Font Awesome icon
      */
     extractFontAwesomeClass(element) {
         if (element.tagName !== 'I') return null;
         
         const classList = Array.from(element.classList || []);
         // Find Font Awesome icon class (starts with fa-)
         const iconClass = classList.find(cls => 
             cls.startsWith('fa-') && 
             !['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'].includes(cls) &&
             cls !== 'fa'
         );
         
         return iconClass || null;
     }

     processEditableElements(containerOrDoc) {
         // Add editable class to elements with data attributes
         const editableSelectors = '[data-text-id], [data-image-src], [data-icon-id]';
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
 
             // Mark parent elements that have overflow:hidden so we can handle tooltip visibility
             this.markOverflowParents(element);
         });
     }

    /**
     * Mark parent elements with overflow:hidden so CSS can handle tooltip visibility
     * This walks up the DOM tree and adds a class to parents that clip content
     */
    markOverflowParents(element) {
        let parent = element.parentElement;
        let depth = 0;
        const maxDepth = 5; // Only check up to 5 levels

        while (parent && depth < maxDepth) {
            // Get computed style - works in shadow DOM since element is already attached
            try {
                const style = getComputedStyle(parent);
                if (style.overflow === 'hidden' || style.overflowY === 'hidden' || style.overflowX === 'hidden') {
                    parent.classList.add('editable-overflow-parent');
                }
            } catch (e) {
                // If getComputedStyle fails, skip this element
            }
            parent = parent.parentElement;
            depth++;
        }
    }
}
