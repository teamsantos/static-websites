// Text and image editing functionality
export class EditingManager {
    constructor(editor) {
        this.editor = editor;
    }

    handleElementClick(event) {
        // The event.target should already be the editable element (set by editor.js for shadow DOM)
        const element = event.target.classList?.contains('editable-element') 
            ? event.target 
            : event.target.closest?.('.editable-element');
        if (!element) return;

        event.preventDefault();
        event.stopPropagation();

        this.editor.cancelCurrentEdit();

        if (element.hasAttribute('data-text-id')) {
            this.startTextEditing(element);
        } else if (element.hasAttribute('data-image-src')) {
            this.startImageEditing(element);
        } else if (element.hasAttribute('data-icon-id')) {
            this.startIconEditing(element);
        }
    }

     startTextEditing(element) {
          this.editor.currentEditingElement = element;
          element.classList.add('editing');

          const textId = element.getAttribute('data-text-id');
          
          // For input elements, get placeholder; for others, get textContent
          let currentText;
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              currentText = this.editor.translations[this.editor.currentLanguage]?.[textId] || element.placeholder;
          } else {
              currentText = this.editor.translations[this.editor.currentLanguage]?.[textId] || element.textContent;
          }
         // Ensure color is in hex format
         let currentColor = this.editor.textColors[textId];
         
         // If no stored color, try to get it from element
         if (!currentColor) {
             const computedStyle = getComputedStyle(element);
             currentColor = element.style.color || computedStyle.color || '#1f2937';
         }
         
         // Convert RGB/RGBA to hex if needed
         currentColor = this.editor.elements.rgbToHex(currentColor);

         // Store initial state for cancel functionality
         const initialColor = currentColor;
         const initialText = currentText;

         // Create modern floating editor modal (like image editor)
         const editorModal = document.createElement('div');
         editorModal.className = 'modern-text-editor-overlay';
         editorModal.innerHTML = `
             <div class="modern-text-editor-card">
                 <div class="editor-card-content">
                     <div class="text-editor-controls">
                         <div class="color-picker-group">
                             <label for="text-color-swatch">Text Color:</label>
                             <div id="text-color-swatch" class="color-swatch" style="background: ${currentColor};"></div>
                         </div>
                     </div>
                     <div id="color-picker-popover" class="color-picker-popover" style="display: none;">
                         <div id="color-picker"></div>
                     </div>
                     <textarea class="modern-text-input" placeholder="Enter your text here...">${currentText}</textarea>
                  </div>
                  <div class="editor-card-footer">
                      <div class="editor-card-actions">
                          <button class="btn btn-outline btn-glass" onclick="const modal = this.closest('.modern-text-editor-overlay'); if(window.templateEditorInstance) { window.templateEditorInstance.cancelTextEdit(modal); } modal.classList.add('removing'); setTimeout(() => { modal.remove(); }, 300);">
                              Cancel
                          </button>
                          <button class="btn btn-primary" onclick="if(window.templateEditorInstance) { window.templateEditorInstance.saveModernTextEdit.call(window.templateEditorInstance, this); } else { console.error('Template editor instance not found'); }">
                              Save Changes
                          </button>
                      </div>
                  <canvas class="stars popup-stars" aria-hidden="true"></canvas>
                  </div>
              </div>
          `;

         // Calculate optimal dimensions for the card
         const rect = element.getBoundingClientRect();
         const minWidth = 440; // Minimum readable width for modern card
         const minHeight = 380; // Minimum readable height for modern card (increased for color picker)
         const maxWidth = Math.min(window.innerWidth - 48, 520);
         const maxHeight = Math.min(window.innerHeight - 160, 640);

         const optimalWidth = Math.max(minWidth, Math.min(rect.width + 100, maxWidth));
         const optimalHeight = Math.max(minHeight, Math.min(rect.height + 220, maxHeight)); // Increased for color picker

         const editorCard = editorModal.querySelector('.modern-text-editor-card');
         editorCard.style.width = optimalWidth + 'px';
         editorCard.style.minHeight = optimalHeight + 'px';
         editorCard.style.maxHeight = maxHeight + 'px';

         document.body.appendChild(editorModal);

         // Add click handler to overlay for canceling (like image editor)
         editorModal.addEventListener('click', (e) => {
             // Only cancel if clicking on the overlay itself, not the card
             if (e.target === editorModal) {
                 if (window.templateEditorInstance) {
                     window.templateEditorInstance.cancelTextEdit(editorModal);
                 }
                 editorModal.classList.add('removing');
                 setTimeout(() => {
                     editorModal.remove();
                 }, 300);
             }
         });

         // Prevent click events on the card from bubbling to the overlay
         editorCard.addEventListener('click', (e) => {
             e.stopPropagation();
         });

         // Focus the textarea and reinitialize stars
         const textarea = editorModal.querySelector('.modern-text-input');
         const starCanvas = editorModal.querySelector('.stars');

         setTimeout(() => {
             textarea.focus();
             textarea.select();

             // Reinitialize stars for the popup canvas
             if (starCanvas && window.starsAnimationInstance) {
                 window.starsAnimationInstance.reinitializeCanvas(starCanvas);
             }
         }, 100);

          // Add real-time text preview while editing
          textarea.addEventListener('input', (e) => {
              // For input/textarea elements, update placeholder; for others, update textContent
              if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                  element.setAttribute('placeholder', e.target.value);
              } else {
                  element.textContent = e.target.value;
              }
          });

         // Initialize iro.js color picker
         this.setupIroColorPicker(editorModal, currentColor, element, initialColor);

         // Store initial state on modal for cancel functionality
         editorModal.originalText = initialText;
         editorModal.originalColor = initialColor;
         editorModal.editingElement = element;

         // Handle keyboard shortcuts
         textarea.addEventListener('keydown', (e) => {
             if (e.key === 'Enter' && e.ctrlKey) {
                 // Use the global instance for keyboard shortcuts
                 if (window.templateEditorInstance) {
                     window.templateEditorInstance.saveModernTextEdit.call(window.templateEditorInstance, editorModal.querySelector('.btn-primary'));
                 }
             } else if (e.key === 'Escape') {
                 if (window.templateEditorInstance) {
                     window.templateEditorInstance.cancelTextEdit(editorModal);
                 }
                 editorModal.classList.add('removing');
                 setTimeout(() => {
                     editorModal.remove();
                 }, 300);
             }
         });
     }

      setupIroColorPicker(modal, initialColor, element, originalColor) {
          const swatch = modal.querySelector('#text-color-swatch');
          const popover = modal.querySelector('#color-picker-popover');
          const card = modal.querySelector('.modern-text-editor-card');

          const picker = new iro.ColorPicker('#color-picker', {
              width: 180,
              color: initialColor
          });

          // Store picker instance for later use
          modal.colorPickerInstance = picker;

          swatch.addEventListener('click', (e) => {
              e.stopPropagation();
              const isVisible = popover.style.display === 'block';
              if (isVisible) {
                  popover.style.display = 'none';
              } else {
                  this.positionColorPickerPopover(swatch, popover, modal);
                  popover.style.display = 'block';
              }
          });

          // Close picker when clicking anywhere on the card (except the popover)
          card.addEventListener('click', (e) => {
              if (!popover.contains(e.target) && e.target !== swatch && !swatch.contains(e.target)) {
                  popover.style.display = 'none';
              }
          });

          // Close picker when clicking on the overlay
          modal.addEventListener('click', (e) => {
              if (e.target === modal) {
                  popover.style.display = 'none';
              }
          });

           // Real-time color preview: update the element's color as user changes it
           picker.on('color:change', (color) => {
               swatch.style.backgroundColor = color.hexString;
               // Update the element on the page in real-time
               if (element) {
                   element.style.setProperty('color', color.hexString, 'important');
               }
           });

           // Store picker instance on modal for later use
           modal.colorPickerInstance = picker;
       }

       positionColorPickerPopover(swatch, popover, modal) {
           const modalRect = modal.querySelector('.modern-text-editor-card').getBoundingClientRect();
           const swatchRect = swatch.getBoundingClientRect();
           const popoverWidth = 206; // 180px picker + 12px padding on each side + borders
           const popoverHeight = 206; // Approximate height for the picker
           const gap = 8; // Space between swatch and popover

           // Calculate available space
           const spaceAbove = swatchRect.top - gap - popoverHeight;
           const spaceBelow = window.innerHeight - swatchRect.bottom - gap - popoverHeight;
           const spaceLeft = swatchRect.left - gap - popoverWidth;
           const spaceRight = window.innerWidth - swatchRect.right - gap - popoverWidth;

           // Determine vertical position: prefer below, fallback to above
           let top;
           if (spaceBelow >= 0) {
               // Position below the swatch
               top = swatchRect.top - modalRect.top + swatchRect.height + gap;
           } else if (spaceAbove >= 0) {
               // Position above the swatch
               top = swatchRect.top - modalRect.top - popoverHeight - gap;
           } else {
               // Not enough space either way, center vertically but prefer below
               top = swatchRect.top - modalRect.top + swatchRect.height + gap;
           }

            // Determine horizontal position: prefer right, fallback to left
            let left;
            if (spaceRight >= 0) {
                // Position to the right of the swatch
                left = swatchRect.left - modalRect.left + swatchRect.width + gap;
            } else if (spaceLeft >= 0) {
                // Position to the left of the swatch
                left = swatchRect.left - modalRect.left - popoverWidth - gap;
            } else {
                // Not enough space either way, try to center within modal bounds
                left = Math.max(gap, Math.min(swatchRect.left - modalRect.left - popoverWidth / 2, modalRect.width - popoverWidth - gap));
            }

            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
        }

     saveTextEdit(editor, element) {
         const newText = editor.value.trim();
         const textId = element.getAttribute('data-text-id');

         if (newText && textId) {
             // Update element content
             element.textContent = newText;

             // Update translations
             if (!this.editor.translations[this.editor.currentLanguage]) {
                 this.editor.translations[this.editor.currentLanguage] = {};
             }
             this.editor.translations[this.editor.currentLanguage][textId] = newText;

             this.editor.ui.showStatus('Text updated successfully', 'success');
         }

         this.editor.cancelCurrentEdit();
     }

       cancelTextEdit(modal) {
           // Restore the original text and color of the element before closing the modal
           if (modal && modal.editingElement) {
               // Restore text
               if (modal.originalText !== undefined) {
                   const element = modal.editingElement;
                   if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                       element.setAttribute('placeholder', modal.originalText);
                   } else {
                       element.textContent = modal.originalText;
                   }
               }
               // Restore color
               if (modal.originalColor) {
                   modal.editingElement.style.setProperty('color', modal.originalColor, 'important');
               }
           }
           this.editor.cancelCurrentEdit();
       }

      saveModernTextEdit(saveBtn) {
          const modal = saveBtn.closest('.modern-text-editor-overlay');
          const textarea = modal.querySelector('.modern-text-input');
          const picker = modal.colorPickerInstance;

          const newText = textarea.value.trim();
          const newColor = picker.color.hexString;

          if (this.editor.currentEditingElement) {
              const element = this.editor.currentEditingElement;
              const textId = element.getAttribute('data-text-id');

              // For input/textarea elements, update placeholder; for others, update textContent
              if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                  element.setAttribute('placeholder', newText);
              } else {
                  element.textContent = newText;
              }

              // Update element color
              this.editor.currentEditingElement.style.setProperty('color', newColor, 'important');
              console.debug(`Set color on element: ${newColor}`);

              // Update translations
              if (!this.editor.translations[this.editor.currentLanguage]) {
                  this.editor.translations[this.editor.currentLanguage] = {};
              }
              this.editor.translations[this.editor.currentLanguage][textId] = newText;

              // Update text colors
              this.editor.textColors[textId] = newColor;

              this.editor.ui.showStatus('Text updated successfully', 'success');
          } else {
              console.warn('Cannot save: newText or currentEditingElement is missing');
          }

          modal.classList.add('removing');
          setTimeout(() => {
              modal.remove();
              this.editor.cancelCurrentEdit();
          }, 300);
      }

    startImageEditing(element) {
        this.editor.currentEditingElement = element;
        this.currentModal = null; // Store modal reference
        this.selectedImageSrc = null; // Store selected image temporarily
        element.classList.add('editing');
        const imageId = element.getAttribute('data-image-src');
        const currentSrc = this.editor.images[imageId] || element.getAttribute('src');
        // Create image editor modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
<div class="modal-content">
    <div class="modal-header">
        <h3>Change Image</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
    </div>
    <div class="image-editor-content">
        <div style="position: relative; display: inline-block;">
            ${currentSrc ? `<img src="${currentSrc}" class="current-image" id="image-preview">` : '<div id="image-preview" style="display: none;"></div>'}
            ${currentSrc ? `
            <button class="image-remove-btn" onclick="window.templateEditorInstance.editing.removeImage(this)" title="Remove image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>` : ''}
        </div>
        <div class="image-upload-area" onclick="document.getElementById('image-file-input').click()">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
            <div>Click to upload new image</div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">or drag and drop</div>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 2rem;">
            <button class="modal-btn modal-btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button class="modal-btn modal-btn-primary" onclick="window.templateEditorInstance.saveImageEdit('${imageId}', this)">Save Changes</button>
        </div>
    </div>
</div>
`;
        this.currentModal = modal;
        document.body.appendChild(modal);
        // Handle drag and drop
        const uploadArea = modal.querySelector('.image-upload-area');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleDroppedImage(files[0], imageId, modal);
            }
        });
    }

    removeImage(button) {
        const modal = button.closest('.modal');
        const preview = modal.querySelector('#image-preview');
        const removeBtn = modal.querySelector('.image-remove-btn');

        // Clear the image
        this.selectedImageSrc = '';
        this.selectedFile = null;

        // Update preview
        if (preview.tagName === 'IMG') {
            preview.style.display = 'none';
        }

        // Hide remove button
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
    }

    handleImageFile(event) {
        const file = event.target.files[0];
        if (file && this.editor.currentEditingElement) {
            const imageId = this.editor.currentEditingElement.getAttribute('data-image-src');
            this.processNewImage(file, imageId);
        }
    }

    handleDroppedImage(file, imageId) {
        this.processNewImage(file, imageId);
        // Don't remove modal - let user preview and save
    }

    processNewImage(file, imageId) {
        this.selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const newSrc = e.target.result;
            this.selectedImageSrc = newSrc;

            // Update modal preview instead of actual element
            if (this.currentModal) {
                const previewImg = this.currentModal.querySelector('#image-preview');
                if (previewImg) {
                    if (previewImg.tagName === 'IMG') {
                        previewImg.src = newSrc;
                    } else {
                        // Replace the placeholder div with an img element
                        const imgElement = document.createElement('img');
                        imgElement.src = newSrc;
                        imgElement.alt = "New image";
                        imgElement.className = "current-image";
                        imgElement.id = "image-preview";
                        previewImg.parentNode.replaceChild(imgElement, previewImg);
                    }
                }
            }
        };
        reader.readAsDataURL(file);
    }

    saveImageEdit(imageId, saveBtn) {
        // Apply the selected image to the actual element
        if (this.editor.currentEditingElement) {
            // Check if explicitly cleared (empty string) or if we have a new selection
            if (this.selectedImageSrc !== null) {
                this.editor.currentEditingElement.setAttribute('src', this.selectedImageSrc);
                this.editor.images[imageId] = this.selectedImageSrc;

                // Update the file registry
                if (this.selectedFile) {
                    this.editor.imageFiles[imageId] = this.selectedFile;
                } else if (this.selectedImageSrc === '') {
                    // Image was removed
                    delete this.editor.imageFiles[imageId];
                }
            }
            this.editor.ui.showStatus('Image updated successfully', 'success');
        }

        // Close modal and reset editing state
        const modal = saveBtn.closest('.modal');
        modal.remove();
        this.editor.cancelCurrentEdit();
        this.currentModal = null;
        this.selectedImageSrc = null;
        this.selectedFile = null;
    }

    // ============================================
    // Image Edit Mode - Resize and Move
    // ============================================

    enterImageEditMode(imageId, imageElement) {
        // imageElement is passed directly from the button on the image
        if (!imageElement) {
            this.editor.ui.showStatus('Image element not found', 'error');
            return;
        }

        // Cancel any current editing
        this.editor.cancelCurrentEdit();
        this.editor.currentEditingElement = imageElement;

        // Calculate viewport-relative position
        const rect = imageElement.getBoundingClientRect();
        const viewportX = rect.left;
        const viewportY = rect.top;

        // CAPTURE ALL DIMENSIONS BEFORE REMOVING FROM DOM
        const elementWidth = imageElement.offsetWidth;
        const elementHeight = imageElement.offsetHeight;
        const naturalWidth = imageElement.naturalWidth || elementWidth;
        const naturalHeight = imageElement.naturalHeight || elementHeight;

        // Get the element's index among siblings
        const originalParent = imageElement.parentElement;
        const siblings = Array.from(originalParent.children);
        const elementIndex = siblings.indexOf(imageElement);

        // Calculate effective z-index by traversing up the DOM tree
        // This captures inherited z-index from parent stacking contexts
        let effectiveZIndex = this.calculateEffectiveZIndex(imageElement);

        // Store edit mode state with viewport-relative position info
        this.imageEditMode = {
            element: imageElement,
            imageId: imageId,
            initialWidth: elementWidth,
            initialHeight: elementHeight,
            initialLeft: viewportX,
            initialTop: viewportY,
            viewportX: viewportX,
            viewportY: viewportY,
            originalParent: originalParent,
            elementIndex: elementIndex,
            aspectRatio: naturalWidth / naturalHeight || elementWidth / elementHeight,
            effectiveZIndex: effectiveZIndex
        };

        // Store the current z-index for later
        if (!this.editor.imageZIndexes) {
            this.editor.imageZIndexes = {};
        }
        this.editor.imageZIndexes[imageId] = effectiveZIndex;

        // Store original styles before any modifications
        this.imageEditMode.originalStyles = {
            position: imageElement.style.position,
            left: imageElement.style.left,
            top: imageElement.style.top,
            width: imageElement.style.width,
            height: imageElement.style.height,
            marginLeft: imageElement.style.marginLeft,
            marginTop: imageElement.style.marginTop,
            zIndex: imageElement.style.zIndex,
            opacity: imageElement.style.opacity,
            parentPosition: originalParent.style.position,
            parentZIndex: originalParent.style.zIndex,
            parentLeft: originalParent.style.left,
            parentTop: originalParent.style.top,
            parentWidth: originalParent.style.width,
            parentHeight: originalParent.style.height,
            parentMarginLeft: originalParent.style.marginLeft,
            parentMarginTop: originalParent.style.marginTop
        };

        // Remove from original parent
        imageElement.remove();

        // Get the shadow wrapper to append the image to
        const shadowWrapper = this.editor.shadowRoot.getElementById('template-shadow-wrapper');
        
        // Calculate position relative to shadow wrapper
        // Since shadow wrapper has position: relative, coordinates should be relative to it
        // We need to use scrollX/Y because viewportX/Y are relative to the viewport
        // and shadowWrapper is positioned relative to the document (effectively).
        // Wait, if shadowWrapper is position: relative, then absolute children are relative to IT.
        // We need to find where shadowWrapper is on the page.
        const wrapperRect = shadowWrapper.getBoundingClientRect();
        
        // The image's current viewport position is (viewportX, viewportY).
        // The wrapper's current viewport position is (wrapperRect.left, wrapperRect.top).
        // So the relative position is simply the difference.
        // We do NOT add scrollX/Y here because both rects are viewport-relative.
        // As scrolling happens, both rects change together, so the difference remains correct
        // (assuming the image is supposed to stay fixed on the page as we scroll? No, it should scroll with content).
        // If we append to wrapper, it will scroll with wrapper.
        
        const relativeLeft = viewportX - wrapperRect.left;
        const relativeTop = viewportY - wrapperRect.top;

        // Set absolute positioning using coordinates relative to shadow wrapper
        // This keeps the image at exactly the same visual position
        imageElement.style.position = 'absolute';
        imageElement.style.left = `${relativeLeft}px`;
        imageElement.style.top = `${relativeTop}px`;
        imageElement.style.width = `${elementWidth}px`;
        imageElement.style.height = `${elementHeight}px`;
        imageElement.style.marginLeft = '0';
        imageElement.style.marginTop = '0';
        imageElement.style.zIndex = effectiveZIndex;

        // Add edit mode class
        imageElement.classList.add('image-edit-mode');

        // Append to shadow wrapper instead of body to maintain stacking context
        shadowWrapper.appendChild(imageElement);

        // Create wrapper for controls (toolbar, handles, size indicator, z-index control)
        // Wrapper is positioned at the same location as the image
        const wrapper = document.createElement('div');
        wrapper.className = 'image-edit-mode-wrapper';
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${relativeLeft}px`;
        wrapper.style.top = `${relativeTop}px`;
        wrapper.style.width = `${elementWidth}px`;
        wrapper.style.height = `${elementHeight}px`;
        wrapper.style.zIndex = 2147483647; // Maximum z-index so controls are always accessible
        wrapper.style.pointerEvents = 'none';

        // Create resize handles container
        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'image-resize-handles';
        
        // Create resize handles (corners and edges)
        const handles = [
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
        ];
        
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `image-resize-handle ${position}`;
            handle.setAttribute('data-position', position);
            handle.addEventListener('mousedown', (e) => this.startResize(e, position));
            handle.addEventListener('touchstart', (e) => this.startResize(e, position), { passive: false });
            handlesContainer.appendChild(handle);
        });

        // Create toolbar with z-index control
        const toolbar = document.createElement('div');
        toolbar.className = 'image-edit-toolbar';
        toolbar.innerHTML = `
            <button onclick="window.templateEditorInstance.editing.resetImageSize()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                </svg>
                Reset
            </button>
            <div class="image-zindex-control">
                <span class="zindex-label">z-index:</span>
                <button class="zindex-btn" onclick="window.templateEditorInstance.editing.changeZIndex(-1)" title="Decrease z-index">−</button>
                <span class="zindex-value" id="zindex-value">${effectiveZIndex}</span>
                <button class="zindex-btn" onclick="window.templateEditorInstance.editing.changeZIndex(1)" title="Increase z-index">+</button>
            </div>
            <button onclick="window.templateEditorInstance.editing.exitImageEditMode(false)">
                Cancel
            </button>
            <button class="primary" onclick="window.templateEditorInstance.editing.exitImageEditMode(true)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Done
            </button>
        `;

        // Create size indicator using captured dimensions
        const sizeIndicator = document.createElement('div');
        sizeIndicator.className = 'image-size-indicator';
        sizeIndicator.textContent = `${Math.round(elementWidth)} × ${Math.round(elementHeight)}`;
        this.imageEditMode.sizeIndicator = sizeIndicator;

        // Assemble the wrapper
        wrapper.appendChild(handlesContainer);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(sizeIndicator);
        
        // Add wrapper to shadow wrapper (same level as image)
        shadowWrapper.appendChild(wrapper);

        this.imageEditMode.wrapper = wrapper;
        this.imageEditMode.handlesContainer = handlesContainer;
        this.imageEditMode.toolbar = toolbar;

        // Add move functionality to the image itself
        imageElement.addEventListener('mousedown', this.startMove.bind(this));
        imageElement.addEventListener('touchstart', this.startMove.bind(this), { passive: false });

        // Store bound handlers for cleanup
        this.imageEditMode.mouseMoveHandler = this.handleMouseMove.bind(this);
        this.imageEditMode.mouseUpHandler = this.handleMouseUp.bind(this);
        
        document.addEventListener('mousemove', this.imageEditMode.mouseMoveHandler);
        document.addEventListener('mouseup', this.imageEditMode.mouseUpHandler);
        document.addEventListener('touchmove', this.imageEditMode.mouseMoveHandler, { passive: false });
        document.addEventListener('touchend', this.imageEditMode.mouseUpHandler);

        this.editor.ui.showStatus('Drag to move, use handles to resize', 'info');
    }

    calculateEffectiveZIndex(element) {
        // Calculate the effective z-index by looking at all ancestor stacking contexts
        let zIndex = 0;
        let current = element;
        
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const currentZIndex = style.zIndex;
            
            // If this element creates a new stacking context and has a z-index, add it
            if (currentZIndex !== 'auto') {
                zIndex += parseInt(currentZIndex);
            }
            
            // Check if parent creates a stacking context
            const parent = current.parentElement;
            if (parent) {
                const parentStyle = window.getComputedStyle(parent);
                // Parent creates stacking context if it has:
                // - position with z-index (not static)
                // - opacity < 1
                // - transform, filter, clip-path, etc.
                const createsStackingContext = 
                    (parentStyle.position !== 'static' && parentStyle.zIndex !== 'auto') ||
                    parseFloat(parentStyle.opacity) < 1 ||
                    parentStyle.transform !== 'none' ||
                    parentStyle.filter !== 'none' ||
                    parentStyle.clipPath !== 'none';
                
                if (createsStackingContext && parentStyle.zIndex !== 'auto') {
                    zIndex += parseInt(parentStyle.zIndex);
                }
            }
            
            current = parent;
        }
        
        // Return at least 1
        return Math.max(1, zIndex);
    }

    startResize(e, position) {
        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches ? e.touches[0] : e;
        const element = this.imageEditMode.element;
        
        this.imageEditMode.isResizing = true;
        this.imageEditMode.resizePosition = position;
        this.imageEditMode.startX = touch.clientX;
        this.imageEditMode.startY = touch.clientY;
        this.imageEditMode.startWidth = element.offsetWidth;
        this.imageEditMode.startHeight = element.offsetHeight;
        
        // Use current style values which are relative to shadow wrapper
        this.imageEditMode.startLeft = parseFloat(element.style.left);
        this.imageEditMode.startTop = parseFloat(element.style.top);
        
    }

    startMove(e) {
        // Only start move if not clicking on a resize handle
        if (e.target.classList.contains('image-resize-handle')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches ? e.touches[0] : e;

        this.imageEditMode.isMoving = true;
        this.imageEditMode.startX = touch.clientX;
        this.imageEditMode.startY = touch.clientY;
        // Use current style values which are relative to shadow wrapper
        this.imageEditMode.startLeft = parseFloat(this.imageEditMode.element.style.left);
        this.imageEditMode.startTop = parseFloat(this.imageEditMode.element.style.top);
    }

    handleMouseMove(e) {
        if (!this.imageEditMode) return;

        const touch = e.touches ? e.touches[0] : e;
        
        if (this.imageEditMode.isResizing) {
            e.preventDefault();
            this.handleResize(touch);
        } else if (this.imageEditMode.isMoving) {
            e.preventDefault();
            this.handleMove(touch);
        }
    }

    handleResize(touch) {
        const deltaX = touch.clientX - this.imageEditMode.startX;
        const deltaY = touch.clientY - this.imageEditMode.startY;
        const position = this.imageEditMode.resizePosition;
        const element = this.imageEditMode.element;
        const wrapper = this.imageEditMode.wrapper;
        const aspectRatio = this.imageEditMode.aspectRatio;

        let newWidth = this.imageEditMode.startWidth;
        let newHeight = this.imageEditMode.startHeight;
        
        // Use relative start positions
        let newLeft = this.imageEditMode.startLeft;
        let newTop = this.imageEditMode.startTop;
        
        // Note: For relative positioning inside shadow wrapper, we don't need viewportX/Y fallback 
        // because startLeft/startTop are already relative to the wrapper due to how we set them in enterImageEditMode
        // However, we still need to be careful about what startLeft/startTop contained
        
        if (isNaN(newLeft)) {
             // Fallback if parsing failed - re-calculate relative to wrapper
             const shadowWrapper = this.editor.shadowRoot.getElementById('template-shadow-wrapper');
             const wrapperRect = shadowWrapper.getBoundingClientRect();
             newLeft = this.imageEditMode.viewportX - wrapperRect.left;
        }
        
        if (isNaN(newTop)) {
             const shadowWrapper = this.editor.shadowRoot.getElementById('template-shadow-wrapper');
             const wrapperRect = shadowWrapper.getBoundingClientRect();
             newTop = this.imageEditMode.viewportY - wrapperRect.top;
        }

        // Calculate new dimensions based on which handle is being dragged
        const isCorner = position.includes('top-left') || position.includes('top-right') || 
                         position.includes('bottom-left') || position.includes('bottom-right');

        if (position.includes('right')) {
            newWidth = Math.max(50, this.imageEditMode.startWidth + deltaX);
        } else if (position.includes('left')) {
            newWidth = Math.max(50, this.imageEditMode.startWidth - deltaX);
            newLeft = this.imageEditMode.startLeft + (this.imageEditMode.startWidth - newWidth);
        }

        if (position.includes('bottom')) {
            newHeight = Math.max(50, this.imageEditMode.startHeight + deltaY);
        } else if (position.includes('top')) {
            newHeight = Math.max(50, this.imageEditMode.startHeight - deltaY);
            newTop = this.imageEditMode.startTop + (this.imageEditMode.startHeight - newHeight);
        }

        // Maintain aspect ratio for corner handles
        if (isCorner) {
            // Use the larger change to determine new size while maintaining aspect ratio
            const widthRatio = newWidth / this.imageEditMode.startWidth;
            const heightRatio = newHeight / this.imageEditMode.startHeight;
            
            if (Math.abs(widthRatio - 1) > Math.abs(heightRatio - 1)) {
                newHeight = newWidth / aspectRatio;
            } else {
                newWidth = newHeight * aspectRatio;
            }

            // Recalculate position for top/left corners when maintaining aspect ratio
            if (position.includes('left')) {
                newLeft = this.imageEditMode.startLeft + (this.imageEditMode.startWidth - newWidth);
            }
            if (position.includes('top')) {
                newTop = this.imageEditMode.startTop + (this.imageEditMode.startHeight - newHeight);
            }
        }

        // Apply new dimensions and position
        element.style.width = `${Math.round(newWidth)}px`;
        element.style.height = `${Math.round(newHeight)}px`;
        element.style.left = `${Math.round(newLeft)}px`;
        element.style.top = `${Math.round(newTop)}px`;

        // Update wrapper to match
        wrapper.style.width = `${Math.round(newWidth)}px`;
        wrapper.style.height = `${Math.round(newHeight)}px`;
        wrapper.style.left = `${Math.round(newLeft)}px`;
        wrapper.style.top = `${Math.round(newTop)}px`;

        // Update size indicator
        if (this.imageEditMode.sizeIndicator) {
            this.imageEditMode.sizeIndicator.textContent = `${Math.round(newWidth)} × ${Math.round(newHeight)}`;
        }
    }

    handleMove(touch) {
        const deltaX = touch.clientX - this.imageEditMode.startX;
        const deltaY = touch.clientY - this.imageEditMode.startY;
        const element = this.imageEditMode.element;
        const wrapper = this.imageEditMode.wrapper;

        const newLeft = this.imageEditMode.startLeft + deltaX;
        const newTop = this.imageEditMode.startTop + deltaY;

        // Update both image and wrapper positions
        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        wrapper.style.left = `${newLeft}px`;
        wrapper.style.top = `${newTop}px`;
    }

    handleMouseUp(e) {
        if (!this.imageEditMode) return;

        // Clear flags after a small delay
        setTimeout(() => {
            if (this.imageEditMode) {
                this.imageEditMode.isResizing = false;
                this.imageEditMode.isMoving = false;
            }
        }, 50);
    }

    resetImageSize() {
        if (!this.imageEditMode) return;

        const element = this.imageEditMode.element;
        const wrapper = this.imageEditMode.wrapper;

        // Reset to initial dimensions
        element.style.width = `${this.imageEditMode.initialWidth}px`;
        element.style.height = `${this.imageEditMode.initialHeight}px`;

        // Calculate initial relative position
        const shadowWrapper = this.editor.shadowRoot.getElementById('template-shadow-wrapper');
        const wrapperRect = shadowWrapper.getBoundingClientRect();
        
        // initialLeft/initialTop are viewport coordinates
        const resetLeft = this.imageEditMode.initialLeft - wrapperRect.left;
        const resetTop = this.imageEditMode.initialTop - wrapperRect.top;

        element.style.left = `${resetLeft}px`;
        element.style.top = `${resetTop}px`;

        // Update wrapper to match
        wrapper.style.width = `${this.imageEditMode.initialWidth}px`;
        wrapper.style.height = `${this.imageEditMode.initialHeight}px`;
        wrapper.style.left = `${resetLeft}px`;
        wrapper.style.top = `${resetTop}px`;

        // Update size indicator
        if (this.imageEditMode.sizeIndicator) {
            this.imageEditMode.sizeIndicator.textContent =
                `${Math.round(this.imageEditMode.initialWidth)} × ${Math.round(this.imageEditMode.initialHeight)}`;
        }

        this.editor.ui.showStatus('Image size reset', 'info');
    }

    changeZIndex(delta) {
        if (!this.imageEditMode) return;

        const element = this.imageEditMode.element;
        const wrapper = this.imageEditMode.wrapper;
        const imageId = this.imageEditMode.imageId;

        // Get current z-index
        let currentZIndex = parseInt(element.style.zIndex) || 1;

        // Calculate new z-index - allow negative values to go below other elements
        // Minimum is -100 to prevent accidentally hiding it too much
        const newZIndex = Math.max(-100, currentZIndex + delta);

        // Update element z-index
        element.style.zIndex = newZIndex;

        // Keep wrapper at a high z-index so controls are always accessible
        // This ensures users can still interact with the image even when it's behind other elements
        wrapper.style.zIndex = 2147483647; // Maximum z-index value

        // Visual feedback: add opacity change when image is behind other elements
        if (newZIndex < 0) {
            element.style.opacity = '0.7';
        } else {
            element.style.opacity = '1';
        }

        // Update stored value
        this.editor.imageZIndexes[imageId] = newZIndex;

        // Update the displayed value
        const zIndexValueEl = document.getElementById('zindex-value');
        if (zIndexValueEl) {
            zIndexValueEl.textContent = newZIndex;
        }

        // Show status message to help user understand
        if (newZIndex < 0) {
            this.editor.ui.showStatus(`Image z-index: ${newZIndex} (behind other elements)`, 'info');
        }
    }

    exitImageEditMode(save = true) {
        if (!this.imageEditMode) return;

        const element = this.imageEditMode.element;
        const imageId = this.imageEditMode.imageId;
        const originalParent = this.imageEditMode.originalParent;
        const elementIndex = this.imageEditMode.elementIndex;

        // Remove event listeners
        document.removeEventListener('mousemove', this.imageEditMode.mouseMoveHandler);
        document.removeEventListener('mouseup', this.imageEditMode.mouseUpHandler);
        document.removeEventListener('touchmove', this.imageEditMode.mouseMoveHandler);
        document.removeEventListener('touchend', this.imageEditMode.mouseUpHandler);

        // Remove edit mode class
        element.classList.remove('image-edit-mode');

        // Get final dimensions and position before moving back
        const finalWidth = element.offsetWidth;
        const finalHeight = element.offsetHeight;
        
        // These are now relative to the shadow wrapper
        const finalRelativeLeft = parseFloat(element.style.left);
        const finalRelativeTop = parseFloat(element.style.top);
        
        // Convert to viewport coordinates (for consistent saving logic below)
        const shadowWrapper = this.editor.shadowRoot.getElementById('template-shadow-wrapper');
        const wrapperRect = shadowWrapper.getBoundingClientRect();
        
        const finalLeft = finalRelativeLeft + wrapperRect.left;
        const finalTop = finalRelativeTop + wrapperRect.top;

        if (save) {
            // Get the z-index from imageZIndexes (set by changeZIndex or from original)
            const savedZIndex = this.editor.imageZIndexes?.[imageId];

            // Calculate parent-relative coordinates
            // finalLeft/finalTop are viewport coordinates from when element was on body
            // We need to convert them to be relative to the original parent
            let parentRelativeLeft = finalLeft;
            let parentRelativeTop = finalTop;
            
            // For image edit containers, we want to position the CONTAINER, not the image inside it
            // This ensures the edit controls (which are siblings of the image) move with the image
            const isImageContainer = originalParent && originalParent.classList.contains('image-edit-container');
            
            if (originalParent) {
                if (isImageContainer) {
                    // For the container approach, we need to position the container relative to ITS parent
                    let containerParent = originalParent.offsetParent;
                    if (!containerParent) containerParent = document.body;
                    
                    const containerParentRect = containerParent.getBoundingClientRect();
                    parentRelativeLeft = finalLeft - containerParentRect.left;
                    parentRelativeTop = finalTop - containerParentRect.top;
                    
                    // Add scroll offsets if the parent is a scroll container (not body/html which are handled by rect)
                    if (containerParent !== document.body && containerParent !== document.documentElement) {
                        parentRelativeLeft += containerParent.scrollLeft;
                        parentRelativeTop += containerParent.scrollTop;
                    }
                } else {
                    const parentRect = originalParent.getBoundingClientRect();
                    // If parent is not positioned, we need to make it positioned for absolute positioning to work
                    const parentStyle = window.getComputedStyle(originalParent);
                    if (parentStyle.position === 'static') {
                        originalParent.style.position = 'relative';
                    }
                    // Convert viewport coordinates to parent-relative coordinates
                    parentRelativeLeft = finalLeft - parentRect.left;
                    parentRelativeTop = finalTop - parentRect.top;
                }
            }

            // Save the new dimensions and parent-relative position
            if (!this.editor.imageSizes) {
                this.editor.imageSizes = {};
            }
            this.editor.imageSizes[imageId] = {
                width: `${finalWidth}px`,
                height: `${finalHeight}px`,
                left: `${parentRelativeLeft}px`,
                top: `${parentRelativeTop}px`,
                position: 'absolute'
            };

            if (isImageContainer) {
                // Apply styles to the CONTAINER
                originalParent.style.width = `${finalWidth}px`;
                originalParent.style.height = `${finalHeight}px`;
                originalParent.style.left = `${parentRelativeLeft}px`;
                originalParent.style.top = `${parentRelativeTop}px`;
                originalParent.style.position = 'absolute';
                originalParent.style.zIndex = savedZIndex !== undefined ? savedZIndex : (this.imageEditMode.originalStyles.zIndex || '');
                originalParent.style.marginLeft = '0';
                originalParent.style.marginTop = '0';
                
                // Image fills the container
                element.style.width = '100%';
                element.style.height = '100%';
                element.style.position = 'static';
                element.style.left = 'auto';
                element.style.top = 'auto';
                element.style.zIndex = '';
                element.style.marginLeft = '0';
                element.style.marginTop = '0';
            } else {
                // Apply the final styles to the element (using parent-relative coordinates)
                element.style.width = `${finalWidth}px`;
                element.style.height = `${finalHeight}px`;
                element.style.left = `${parentRelativeLeft}px`;
                element.style.top = `${parentRelativeTop}px`;
                element.style.position = 'absolute';
                element.style.marginLeft = '0';
                element.style.marginTop = '0';
                // Only apply z-index if it was explicitly changed, otherwise clear it
                if (savedZIndex !== undefined) {
                    element.style.zIndex = savedZIndex;
                } else {
                    element.style.zIndex = this.imageEditMode.originalStyles.zIndex || '';
                }
            }

            // Reset opacity
            element.style.opacity = '';

            // If we were using an image container, we don't need to manually restore the element's position attributes to 'static'
            // because they are set in the block above.
            
            this.editor.ui.showStatus('Image size and position saved', 'success');
        } else {
            // Restore original styles
            const originalStyles = this.imageEditMode.originalStyles;
            element.style.position = originalStyles.position;
            element.style.left = originalStyles.left;
            element.style.top = originalStyles.top;
            element.style.width = originalStyles.width;
            element.style.height = originalStyles.height;
            element.style.marginLeft = originalStyles.marginLeft;
            element.style.marginTop = originalStyles.marginTop;
            element.style.zIndex = originalStyles.zIndex;
            element.style.opacity = originalStyles.opacity || '';

            // Restore container styles if needed
            if (originalParent && originalParent.classList.contains('image-edit-container') && originalStyles.parentPosition) {
                originalParent.style.position = originalStyles.parentPosition;
                originalParent.style.zIndex = originalStyles.parentZIndex;
                originalParent.style.left = originalStyles.parentLeft;
                originalParent.style.top = originalStyles.parentTop;
                originalParent.style.width = originalStyles.parentWidth;
                originalParent.style.height = originalStyles.parentHeight;
                originalParent.style.marginLeft = originalStyles.parentMarginLeft;
                originalParent.style.marginTop = originalStyles.parentMarginTop;
            }
        }

        // Remove wrapper
        if (this.imageEditMode.wrapper) {
            this.imageEditMode.wrapper.remove();
        }

        // Remove overlay if it exists
        if (this.imageEditMode.overlay) {
            this.imageEditMode.overlay.remove();
        }

        // Move element back to original parent at the correct position
        // The element is currently a child of shadow wrapper
        if (originalParent) {
            // Remove from shadow wrapper
            element.remove();

            // Insert at the original index
            const siblings = Array.from(originalParent.children);
            if (elementIndex >= 0 && elementIndex < siblings.length) {
                originalParent.insertBefore(element, siblings[elementIndex]);
            } else {
                originalParent.appendChild(element);
            }
        }

        // Clear edit mode state
        this.imageEditMode = null;
        this.editor.cancelCurrentEdit();
    }

    // Available Font Awesome icons for selection (commonly used icons)
    getAvailableIcons() {
        return [
            // General/Common
            { class: 'fa-tooth', label: 'Tooth' },
            { class: 'fa-star', label: 'Star' },
            { class: 'fa-heart', label: 'Heart' },
            { class: 'fa-check', label: 'Check' },
            { class: 'fa-times', label: 'Times/Close' },
            { class: 'fa-plus', label: 'Plus' },
            { class: 'fa-minus', label: 'Minus' },
            { class: 'fa-home', label: 'Home' },
            { class: 'fa-user', label: 'User' },
            { class: 'fa-users', label: 'Users' },
            { class: 'fa-cog', label: 'Settings' },
            { class: 'fa-gear', label: 'Gear' },
            { class: 'fa-search', label: 'Search' },
            
            // Communication
            { class: 'fa-envelope', label: 'Email' },
            { class: 'fa-phone', label: 'Phone' },
            { class: 'fa-comment', label: 'Comment' },
            { class: 'fa-comments', label: 'Comments' },
            { class: 'fa-bell', label: 'Bell' },
            
            // Location & Time
            { class: 'fa-map-marker-alt', label: 'Location' },
            { class: 'fa-map-marker', label: 'Map Marker' },
            { class: 'fa-location-dot', label: 'Location Dot' },
            { class: 'fa-clock', label: 'Clock' },
            { class: 'fa-calendar', label: 'Calendar' },
            { class: 'fa-calendar-alt', label: 'Calendar Alt' },
            
            // Business & Commerce
            { class: 'fa-briefcase', label: 'Briefcase' },
            { class: 'fa-building', label: 'Building' },
            { class: 'fa-shopping-cart', label: 'Shopping Cart' },
            { class: 'fa-credit-card', label: 'Credit Card' },
            { class: 'fa-dollar-sign', label: 'Dollar' },
            { class: 'fa-euro-sign', label: 'Euro' },
            { class: 'fa-chart-line', label: 'Chart Line' },
            { class: 'fa-chart-bar', label: 'Chart Bar' },
            
            // Medical/Health
            { class: 'fa-hospital', label: 'Hospital' },
            { class: 'fa-stethoscope', label: 'Stethoscope' },
            { class: 'fa-heartbeat', label: 'Heartbeat' },
            { class: 'fa-medkit', label: 'Med Kit' },
            { class: 'fa-pills', label: 'Pills' },
            { class: 'fa-syringe', label: 'Syringe' },
            { class: 'fa-ambulance', label: 'Ambulance' },
            { class: 'fa-user-md', label: 'Doctor' },
            { class: 'fa-user-nurse', label: 'Nurse' },
            
            // Tools & Work
            { class: 'fa-tools', label: 'Tools' },
            { class: 'fa-wrench', label: 'Wrench' },
            { class: 'fa-hammer', label: 'Hammer' },
            { class: 'fa-screwdriver', label: 'Screwdriver' },
            { class: 'fa-paint-brush', label: 'Paint Brush' },
            { class: 'fa-pen', label: 'Pen' },
            { class: 'fa-pencil', label: 'Pencil' },
            
            // Technology
            { class: 'fa-laptop', label: 'Laptop' },
            { class: 'fa-desktop', label: 'Desktop' },
            { class: 'fa-mobile', label: 'Mobile' },
            { class: 'fa-tablet', label: 'Tablet' },
            { class: 'fa-wifi', label: 'WiFi' },
            { class: 'fa-cloud', label: 'Cloud' },
            { class: 'fa-database', label: 'Database' },
            { class: 'fa-server', label: 'Server' },
            { class: 'fa-code', label: 'Code' },
            
            // Actions
            { class: 'fa-download', label: 'Download' },
            { class: 'fa-upload', label: 'Upload' },
            { class: 'fa-share', label: 'Share' },
            { class: 'fa-link', label: 'Link' },
            { class: 'fa-lock', label: 'Lock' },
            { class: 'fa-unlock', label: 'Unlock' },
            { class: 'fa-shield-alt', label: 'Shield' },
            { class: 'fa-key', label: 'Key' },
            
            // Arrows & Navigation
            { class: 'fa-arrow-right', label: 'Arrow Right' },
            { class: 'fa-arrow-left', label: 'Arrow Left' },
            { class: 'fa-arrow-up', label: 'Arrow Up' },
            { class: 'fa-arrow-down', label: 'Arrow Down' },
            { class: 'fa-chevron-right', label: 'Chevron Right' },
            { class: 'fa-chevron-left', label: 'Chevron Left' },
            { class: 'fa-angle-right', label: 'Angle Right' },
            { class: 'fa-angle-left', label: 'Angle Left' },
            
            // People & Social
            { class: 'fa-child', label: 'Child' },
            { class: 'fa-user-friends', label: 'Friends' },
            { class: 'fa-handshake', label: 'Handshake' },
            { class: 'fa-thumbs-up', label: 'Thumbs Up' },
            { class: 'fa-thumbs-down', label: 'Thumbs Down' },
            
            // Status & Alerts
            { class: 'fa-info-circle', label: 'Info' },
            { class: 'fa-question-circle', label: 'Question' },
            { class: 'fa-exclamation-circle', label: 'Alert' },
            { class: 'fa-check-circle', label: 'Check Circle' },
            { class: 'fa-times-circle', label: 'Times Circle' },
            { class: 'fa-bolt', label: 'Bolt/Lightning' },
            { class: 'fa-fire', label: 'Fire' },
            
            // Media
            { class: 'fa-image', label: 'Image' },
            { class: 'fa-camera', label: 'Camera' },
            { class: 'fa-video', label: 'Video' },
            { class: 'fa-music', label: 'Music' },
            { class: 'fa-play', label: 'Play' },
            { class: 'fa-pause', label: 'Pause' },
            { class: 'fa-stop', label: 'Stop' },
            
            // Food & Drink
            { class: 'fa-utensils', label: 'Utensils' },
            { class: 'fa-coffee', label: 'Coffee' },
            { class: 'fa-wine-glass', label: 'Wine Glass' },
            { class: 'fa-beer', label: 'Beer' },
            { class: 'fa-pizza-slice', label: 'Pizza' },
            
            // Nature & Weather
            { class: 'fa-sun', label: 'Sun' },
            { class: 'fa-moon', label: 'Moon' },
            { class: 'fa-cloud-sun', label: 'Cloud Sun' },
            { class: 'fa-snowflake', label: 'Snowflake' },
            { class: 'fa-leaf', label: 'Leaf' },
            { class: 'fa-tree', label: 'Tree' },
            { class: 'fa-water', label: 'Water' },
            
            // Transport
            { class: 'fa-car', label: 'Car' },
            { class: 'fa-truck', label: 'Truck' },
            { class: 'fa-plane', label: 'Plane' },
            { class: 'fa-bicycle', label: 'Bicycle' },
            { class: 'fa-ship', label: 'Ship' },
            
            // Documents & Files
            { class: 'fa-file', label: 'File' },
            { class: 'fa-file-alt', label: 'File Alt' },
            { class: 'fa-folder', label: 'Folder' },
            { class: 'fa-folder-open', label: 'Folder Open' },
            { class: 'fa-copy', label: 'Copy' },
            { class: 'fa-paste', label: 'Paste' },
            { class: 'fa-trash', label: 'Trash' },
            { class: 'fa-edit', label: 'Edit' },
            
            // Misc
            { class: 'fa-gift', label: 'Gift' },
            { class: 'fa-trophy', label: 'Trophy' },
            { class: 'fa-award', label: 'Award' },
            { class: 'fa-crown', label: 'Crown' },
            { class: 'fa-gem', label: 'Gem' },
            { class: 'fa-lightbulb', label: 'Lightbulb' },
            { class: 'fa-graduation-cap', label: 'Graduation Cap' },
            { class: 'fa-book', label: 'Book' },
            { class: 'fa-quote-left', label: 'Quote Left' },
            { class: 'fa-quote-right', label: 'Quote Right' },
        ];
    }

    startIconEditing(element) {
        this.editor.currentEditingElement = element;
        element.classList.add('editing');
        
        const iconId = element.getAttribute('data-icon-id');
        
        // Get current icon class and style
        const currentIconClass = this.editor.elements.extractFontAwesomeClass(element) || '';
        const currentIconStyle = this.extractIconStyle(element) || 'fas';
        
        // Get current icon color
        let currentColor = this.editor.iconColors?.[iconId];
        if (!currentColor) {
            const computedStyle = getComputedStyle(element);
            currentColor = element.style.color || computedStyle.color || '#334155';
        }
        // Convert RGB/RGBA to hex if needed
        currentColor = this.editor.elements.rgbToHex(currentColor);
        
        // Store initial state for cancel functionality
        const initialIconClass = currentIconClass;
        const initialIconStyle = currentIconStyle;
        const initialColor = currentColor;
        
        // Create icon editor modal
        const editorModal = document.createElement('div');
        editorModal.className = 'modern-icon-editor-overlay';
        
        const availableIcons = this.getAvailableIcons();
        const iconGridHtml = availableIcons.map(icon => `
            <div class="icon-option ${icon.class === currentIconClass ? 'selected' : ''}" 
                 data-icon-class="${icon.class}" 
                 title="${icon.label}">
                <i class="${currentIconStyle} ${icon.class}"></i>
                <span class="icon-label">${icon.label}</span>
            </div>
        `).join('');
        
        // Icon styles available in Font Awesome
        const iconStyles = this.getIconStyles();
        const styleOptionsHtml = iconStyles.map(style => `
            <button class="icon-style-btn ${style.class === currentIconStyle ? 'active' : ''}" 
                    data-style="${style.class}" 
                    title="${style.description}">
                <i class="${style.class} fa-star"></i>
                <span>${style.label}</span>
            </button>
        `).join('');
        
        editorModal.innerHTML = `
            <div class="modern-icon-editor-card">
                <div class="editor-card-content">
                    <div class="icon-editor-header">
                        <h3>Change Icon</h3>
                        <div class="current-icon-preview">
                            <span>Current:</span>
                            <i class="${currentIconStyle} ${currentIconClass}" id="icon-preview" style="color: ${currentColor};"></i>
                        </div>
                    </div>
                    <div class="icon-editor-controls">
                        <div class="icon-style-group">
                            <label>Style:</label>
                            <div class="icon-style-buttons" id="icon-style-buttons">
                                ${styleOptionsHtml}
                            </div>
                        </div>
                        <div class="color-picker-group">
                            <label for="icon-color-swatch">Color:</label>
                            <div id="icon-color-swatch" class="color-swatch" style="background: ${currentColor};"></div>
                        </div>
                    </div>
                    <div id="icon-color-picker-popover" class="color-picker-popover" style="display: none;">
                        <div id="icon-color-picker"></div>
                    </div>
                    <div class="icon-search-container">
                        <input type="text" class="icon-search-input" placeholder="Search icons..." id="icon-search">
                    </div>
                    <div class="icon-grid" id="icon-grid">
                        ${iconGridHtml}
                    </div>
                </div>
                <div class="editor-card-footer">
                    <div class="editor-card-actions">
                        <button class="btn btn-outline btn-glass" id="cancel-icon-btn">
                            Cancel
                        </button>
                        <button class="btn btn-primary" id="save-icon-btn">
                            Save Changes
                        </button>
                    </div>
                    <canvas class="stars popup-stars" aria-hidden="true"></canvas>
                </div>
            </div>
        `;
        
        // Calculate optimal dimensions for the card
        const minWidth = 480;
        const minHeight = 500;
        const maxWidth = Math.min(window.innerWidth - 48, 600);
        const maxHeight = Math.min(window.innerHeight - 100, 700);
        
        const editorCard = editorModal.querySelector('.modern-icon-editor-card');
        editorCard.style.width = maxWidth + 'px';
        editorCard.style.minHeight = minHeight + 'px';
        editorCard.style.maxHeight = maxHeight + 'px';
        
        document.body.appendChild(editorModal);
        
        // Store modal data for later use
        editorModal.originalIconClass = initialIconClass;
        editorModal.originalIconStyle = initialIconStyle;
        editorModal.originalColor = initialColor;
        editorModal.editingElement = element;
        editorModal.selectedIconClass = currentIconClass;
        editorModal.selectedIconStyle = currentIconStyle;
        editorModal.selectedColor = currentColor;
        
        // Add click handler to overlay for canceling
        editorModal.addEventListener('click', (e) => {
            if (e.target === editorModal) {
                this.cancelIconEdit(editorModal);
            }
        });
        
        // Prevent click events on the card from bubbling to the overlay
        editorCard.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Focus the search input and reinitialize stars
        const searchInput = editorModal.querySelector('#icon-search');
        const starCanvas = editorModal.querySelector('.stars');
        const iconGrid = editorModal.querySelector('#icon-grid');
        const iconPreview = editorModal.querySelector('#icon-preview');
        const styleButtons = editorModal.querySelector('#icon-style-buttons');
        
        setTimeout(() => {
            searchInput.focus();
            
            // Reinitialize stars for the popup canvas
            if (starCanvas && window.starsAnimationInstance) {
                window.starsAnimationInstance.reinitializeCanvas(starCanvas);
            }
        }, 100);
        
        // Setup icon color picker
        this.setupIconColorPicker(editorModal, currentColor, element, initialColor, iconPreview);
        
        // Icon style selection handler
        styleButtons.addEventListener('click', (e) => {
            const styleBtn = e.target.closest('.icon-style-btn');
            if (styleBtn) {
                // Remove active from all style buttons
                styleButtons.querySelectorAll('.icon-style-btn').forEach(btn => btn.classList.remove('active'));
                // Add active to clicked button
                styleBtn.classList.add('active');
                
                const newStyle = styleBtn.getAttribute('data-style');
                editorModal.selectedIconStyle = newStyle;
                
                // Update all icons in the grid with the new style
                iconGrid.querySelectorAll('.icon-option i').forEach(icon => {
                    // Remove old style classes and add new one
                    icon.className = icon.className.replace(/\b(fas|far|fal|fat|fad|fab)\b/, newStyle);
                });
                
                // Update preview icon style
                iconPreview.className = iconPreview.className.replace(/\b(fas|far|fal|fat|fad|fab)\b/, newStyle);
                
                // Update the actual element in real-time for preview
                this.updateIconStyle(element, editorModal.originalIconStyle, newStyle);
            }
        });
        
        // Icon selection handler
        iconGrid.addEventListener('click', (e) => {
            const iconOption = e.target.closest('.icon-option');
            if (iconOption) {
                // Remove selection from all icons
                iconGrid.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
                // Add selection to clicked icon
                iconOption.classList.add('selected');
                
                const newIconClass = iconOption.getAttribute('data-icon-class');
                editorModal.selectedIconClass = newIconClass;
                
                // Update preview with current style
                const currentStyle = editorModal.selectedIconStyle;
                iconPreview.className = `${currentStyle} ${newIconClass}`;
                // Preserve color
                iconPreview.style.color = editorModal.selectedColor;
                
                // Update the actual element in real-time for preview
                this.updateIconClass(element, editorModal.originalIconClass, newIconClass);
            }
        });
        
        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const iconOptions = iconGrid.querySelectorAll('.icon-option');
            
            iconOptions.forEach(option => {
                const iconClass = option.getAttribute('data-icon-class').toLowerCase();
                const label = option.querySelector('.icon-label').textContent.toLowerCase();
                
                if (iconClass.includes(searchTerm) || label.includes(searchTerm)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        });
        
        // Cancel button handler
        const cancelBtn = editorModal.querySelector('#cancel-icon-btn');
        cancelBtn.addEventListener('click', () => {
            this.cancelIconEdit(editorModal);
        });
        
        // Save button handler
        const saveBtn = editorModal.querySelector('#save-icon-btn');
        saveBtn.addEventListener('click', () => {
            this.saveIconEdit(editorModal);
        });
        
        // Handle keyboard shortcuts
        editorModal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.target.matches('input')) {
                this.saveIconEdit(editorModal);
            } else if (e.key === 'Escape') {
                this.cancelIconEdit(editorModal);
            }
        });
    }
    
    /**
     * Update the icon class on an element
     * Removes old icon class and adds new one
     */
    updateIconClass(element, oldIconClass, newIconClass) {
        if (oldIconClass && element.classList.contains(oldIconClass)) {
            element.classList.remove(oldIconClass);
        }
        if (newIconClass && !element.classList.contains(newIconClass)) {
            element.classList.add(newIconClass);
        }
    }
    
    /**
     * Update the icon style on an element (fas, far, fal, etc.)
     */
    updateIconStyle(element, oldStyle, newStyle) {
        if (oldStyle && element.classList.contains(oldStyle)) {
            element.classList.remove(oldStyle);
        }
        if (newStyle && !element.classList.contains(newStyle)) {
            element.classList.add(newStyle);
        }
    }
    
    /**
     * Extract the Font Awesome style class from an element (fas, far, fal, fab, etc.)
     */
    extractIconStyle(element) {
        const styleClasses = ['fas', 'far', 'fal', 'fat', 'fad', 'fab', 'fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'];
        for (const styleClass of styleClasses) {
            if (element.classList.contains(styleClass)) {
                // Normalize to short form
                const styleMap = {
                    'fa-solid': 'fas',
                    'fa-regular': 'far',
                    'fa-light': 'fal',
                    'fa-thin': 'fat',
                    'fa-duotone': 'fad',
                    'fa-brands': 'fab'
                };
                return styleMap[styleClass] || styleClass;
            }
        }
        return 'fas'; // Default to solid
    }
    
    /**
     * Get available Font Awesome icon styles
     * Note: Only free styles are included. Light, Thin, and Duotone require Font Awesome Pro.
     */
    getIconStyles() {
        return [
            { class: 'fas', label: 'Solid', description: 'Filled/Solid icons' },
            { class: 'far', label: 'Regular', description: 'Outlined/Regular icons' },
            // { class: 'fab', label: 'Brands', description: 'Brand logos' }
        ];
    }
    
    /**
     * Setup the color picker for icon editing
     */
    setupIconColorPicker(modal, initialColor, element, originalColor, iconPreview) {
        const swatch = modal.querySelector('#icon-color-swatch');
        const popover = modal.querySelector('#icon-color-picker-popover');
        const card = modal.querySelector('.modern-icon-editor-card');

        const picker = new iro.ColorPicker('#icon-color-picker', {
            width: 180,
            color: initialColor
        });

        // Store picker instance for later use
        modal.colorPickerInstance = picker;

        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = popover.style.display === 'block';
            if (isVisible) {
                popover.style.display = 'none';
            } else {
                this.positionIconColorPickerPopover(swatch, popover, modal);
                popover.style.display = 'block';
            }
        });

        // Close picker when clicking anywhere on the card (except the popover)
        card.addEventListener('click', (e) => {
            if (!popover.contains(e.target) && e.target !== swatch && !swatch.contains(e.target)) {
                popover.style.display = 'none';
            }
        });

        // Close picker when clicking on the overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                popover.style.display = 'none';
            }
        });

        // Real-time color preview: update the element's color as user changes it
        picker.on('color:change', (color) => {
            swatch.style.backgroundColor = color.hexString;
            modal.selectedColor = color.hexString;
            
            // Update the preview icon in modal
            if (iconPreview) {
                iconPreview.style.color = color.hexString;
            }
            
            // Update the element on the page in real-time
            if (element) {
                element.style.setProperty('color', color.hexString, 'important');
            }
        });
    }

    positionIconColorPickerPopover(swatch, popover, modal) {
        const modalRect = modal.querySelector('.modern-icon-editor-card').getBoundingClientRect();
        const swatchRect = swatch.getBoundingClientRect();
        const popoverWidth = 206; // 180px picker + 12px padding on each side + borders
        const popoverHeight = 206; // Approximate height for the picker
        const gap = 8; // Space between swatch and popover

        // Calculate available space
        const spaceBelow = window.innerHeight - swatchRect.bottom - gap - popoverHeight;
        const spaceAbove = swatchRect.top - gap - popoverHeight;

        // Determine vertical position: prefer below, fallback to above
        let top;
        if (spaceBelow >= 0) {
            top = swatchRect.top - modalRect.top + swatchRect.height + gap;
        } else if (spaceAbove >= 0) {
            top = swatchRect.top - modalRect.top - popoverHeight - gap;
        } else {
            top = swatchRect.top - modalRect.top + swatchRect.height + gap;
        }

        // Horizontal position: align with swatch
        let left = swatchRect.left - modalRect.left;
        
        // Make sure it doesn't overflow the modal
        if (left + popoverWidth > modalRect.width - gap) {
            left = modalRect.width - popoverWidth - gap;
        }
        if (left < gap) {
            left = gap;
        }

        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    }
    
    cancelIconEdit(modal) {
        // Restore the original icon class, style, and color before closing the modal
        if (modal && modal.editingElement) {
            if (modal.originalIconClass !== undefined) {
                this.updateIconClass(modal.editingElement, modal.selectedIconClass, modal.originalIconClass);
            }
            if (modal.originalIconStyle !== undefined) {
                this.updateIconStyle(modal.editingElement, modal.selectedIconStyle, modal.originalIconStyle);
            }
            if (modal.originalColor) {
                modal.editingElement.style.setProperty('color', modal.originalColor, 'important');
            }
        }
        
        modal.classList.add('removing');
        setTimeout(() => {
            modal.remove();
            this.editor.cancelCurrentEdit();
        }, 300);
    }
    
    saveIconEdit(modal) {
        const element = modal.editingElement;
        const iconId = element.getAttribute('data-icon-id');
        const newIconClass = modal.selectedIconClass;
        const newIconStyle = modal.selectedIconStyle;
        const newColor = modal.selectedColor;
        
        if (element && iconId) {
            // Update icon class if changed
            if (newIconClass) {
                this.editor.icons[iconId] = newIconClass;
            }
            
            // Update icon style if changed
            if (newIconStyle) {
                if (!this.editor.iconStyles) {
                    this.editor.iconStyles = {};
                }
                this.editor.iconStyles[iconId] = newIconStyle;
            }
            
            // Update icon color
            if (newColor) {
                element.style.setProperty('color', newColor, 'important');
                if (!this.editor.iconColors) {
                    this.editor.iconColors = {};
                }
                this.editor.iconColors[iconId] = newColor;
            }
            
            this.editor.ui.showStatus('Icon updated successfully', 'success');
        }
        
        modal.classList.add('removing');
        setTimeout(() => {
            modal.remove();
            this.editor.cancelCurrentEdit();
        }, 300);
    }
}
