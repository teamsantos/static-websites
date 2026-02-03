import { baseURL, supportEmail } from './constants.js';
import { UIManager } from './ui.js';
import { ModalManager } from './modals.js';
import { ProjectManager } from './project.js';
import { TemplateManager } from './template.js';
import { ElementManager } from './elements.js';
import { EditingManager } from './editing.js';
import { UtilsManager } from './utils.js';
import { SectionManager } from './sections.js';
import { HeroImagesEditor } from './hero-images.js';
import { UploadManager } from './upload.js';

class TemplateEditor {
    constructor() {
        this.templateContent = null;
        this.translations = {};
        this.images = {};
        this.imageFiles = {}; // Store raw File objects for upload
        this.icons = {};
        this.iconColors = {};
        this.iconStyles = {};
        this.textColors = {};
        this.sectionBackgrounds = {};
        this.currentLanguage = 'en';
        this.currentEditingElement = null;
        this.mode = 'create'; // 'create' or 'save'
        this.templateId = null; // Template identifier for export
        this.shadowRoot = null; // Shadow DOM root for template isolation

        // Support email - change this in one place
        this.supportEmail = supportEmail;

        // Initialize managers
        this.ui = new UIManager(this);
        this.modals = new ModalManager(this);
        this.project = new ProjectManager(this);
        this.template = new TemplateManager(this);
        this.elements = new ElementManager(this);
        this.editing = new EditingManager(this);
        this.utils = new UtilsManager(this);
        this.sections = new SectionManager(this);
        this.heroImages = new HeroImagesEditor(this);
        this.upload = new UploadManager(this);

        this.init();
    }

    init() {
        this.bindEvents();
        this.ui.updateSupportEmail();
        this.determineMode();
        this.template.autoLoadTemplate();
    }

    determineMode() {
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('project') ? 'save' : 'create';
        this.ui.updateTitle();
        this.ui.updateButton();
        this.ui.updateButtonsVisibility();
    }

    bindEvents() {
        // Editor controls
        document.getElementById('change-template-btn').addEventListener('click', () => {
            window.location.href = `https://${baseURL}/#templates`;
        });
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChanges());
        document.getElementById('export-template-btn').addEventListener('click', () => this.openModal());

        // File inputs
        document.getElementById('image-file-input').addEventListener('change', (e) => this.handleImageFile(e));

        // Global events - use composedPath for shadow DOM events
        document.addEventListener('click', (e) => this.handleElementClick(e));
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleImageFile(event) {
        this.editing.handleImageFile(event);
    }

    // Delegate to managers
    openModal() {
        this.modals.openModal();
    }

    async createProject() {
        await this.project.createProject();
    }

    getEditedHtml() {
        return this.utils.getEditedHtml();
    }

    collectExportData() {
        return this.utils.collectExportData();
    }

    saveWithCode() {
        this.project.saveWithCode();
    }

    // Template methods delegated to TemplateManager

    // Element methods delegated to ElementManager



    // Editing methods delegated to EditingManager
    handleElementClick(event) {
        // For shadow DOM, we need to use composedPath to find the actual target
        // event.composedPath() returns the path of elements the event traveled through
        const path = event.composedPath();
        
        // Find if any element in the path is an editable element
        const editableElement = path.find(el => 
            el.classList && el.classList.contains('editable-element')
        );
        
        if (editableElement) {
            // Create a synthetic event-like object with the correct target
            const syntheticEvent = {
                target: editableElement,
                preventDefault: () => event.preventDefault(),
                stopPropagation: () => event.stopPropagation()
            };
            this.editing.handleElementClick(syntheticEvent);
        }
    }

     saveModernTextEdit(saveBtn) {
         this.editing.saveModernTextEdit(saveBtn);
     }

     cancelTextEdit(modal) {
         this.editing.cancelTextEdit(modal);
     }

     saveImageEdit(imageId, saveBtn) {
         this.editing.saveImageEdit(imageId, saveBtn);
     }

    // Utility methods delegated to UtilsManager
    cancelCurrentEdit() {
        this.utils.cancelCurrentEdit();
    }

    handleKeydown(event) {
        this.utils.handleKeydown(event);
    }

    saveChanges() {
        this.utils.saveChanges();
    }

    exportTemplate() {
        this.utils.exportTemplate();
    }
}



// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.templateEditorInstance = new TemplateEditor();
});
