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

    processNewImage(file) {
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
            this.editor.currentEditingElement.setAttribute('src', this.selectedImageSrc);
            this.editor.images[imageId] = this.selectedImageSrc;
            this.editor.ui.showStatus('Image updated successfully', 'success');
        }

        // Close modal and reset editing state
        const modal = saveBtn.closest('.modal');
        modal.remove();
        this.editor.cancelCurrentEdit();
        this.currentModal = null;
        this.selectedImageSrc = null;
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
            { class: 'fab', label: 'Brands', description: 'Brand logos' }
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
