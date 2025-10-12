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

    loadTranslationFiles(doc) {
        const langElements = doc.querySelectorAll('[data-text-id]');
        this.editor.translations[this.editor.currentLanguage] = {};
        langElements.forEach(element => {
            const textId = element.getAttribute('data-text-id');
            if (textId) {
                this.editor.translations[this.editor.currentLanguage][textId] = element.textContent.trim();
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
    }

    loadImageFiles(doc) {
        // Try to load image files from the template
        const imageElements = doc.querySelectorAll('[data-image-src]');
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

    processEditableElements(doc) {
        // Add editable class to elements with data attributes
        const editableSelectors = '[data-text-id], [data-image-src]';
        const editableElements = doc.querySelectorAll(editableSelectors);

        editableElements.forEach(element => {
            element.classList.add('editable-element');
            // Always enable editing - no conditional logic needed
        });
    }
}
