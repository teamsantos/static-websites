// Template Loader System
// Handles loading template-specific translations and images

class TemplateLoader {
    constructor() {
        this.currentTemplate = null;
        this.currentLanguage = 'en';
        this.translations = {};
        this.images = {};
        this.init();
    }

    init() {
        // Detect template from body data attribute
        const body = document.body;
        this.currentTemplate = body.getAttribute('data-template');

        if (!this.currentTemplate) {
            console.warn('No template specified in body data-template attribute');
            return;
        }

        // Detect language from URL or default to English
        this.detectLanguage();

        // Load template assets
        this.loadTemplateAssets();
    }

    detectLanguage() {
        // Check URL for language parameter
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');

        if (langParam && ['en', 'pt'].includes(langParam)) {
            this.currentLanguage = langParam;
        } else {
            // Default to English or detect from browser
            this.currentLanguage = navigator.language.startsWith('pt') ? 'pt' : 'en';
        }
    }

    async loadTemplateAssets() {
        try {
            // Load translations
            await this.loadTranslations();

            // Load images configuration
            await this.loadImagesConfig();

            // Apply translations to DOM
            this.applyTranslations();

            // Initialize images
            this.initializeImages();

            // Setup language switcher if present
            this.setupLanguageSwitcher();

        } catch (error) {
            console.error('Error loading template assets:', error);
        }
    }

    async loadTranslations() {
        const translationPath = `./${this.currentTemplate}/lang_${this.currentLanguage}.json`;

        try {
            const response = await fetch(translationPath);
            if (!response.ok) {
                throw new Error(`Failed to load translations: ${response.status}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to English if current language fails
            if (this.currentLanguage !== 'en') {
                this.currentLanguage = 'en';
                return this.loadTranslations();
            }
        }
    }

    async loadImagesConfig() {
        const imagesPath = `./${this.currentTemplate}/images.json`;

        try {
            const response = await fetch(imagesPath);
            if (!response.ok) {
                throw new Error(`Failed to load images config: ${response.status}`);
            }
            this.images = await response.json();
        } catch (error) {
            console.error('Error loading images config:', error);
        }
    }

    applyTranslations() {
        // Apply translations to elements with data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);

            if (translation) {
                if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                    element.setAttribute('placeholder', translation);
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Apply translations to elements with data-i18n-placeholder attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.getTranslation(key);

            if (translation) {
                element.setAttribute('placeholder', translation);
            }
        });

        // Inject dynamic content based on template type
        this.injectDynamicContent();
    }

    getTranslation(key) {
        return key.split('.').reduce((obj, k) => obj && obj[k], this.translations);
    }

    injectDynamicContent() {
        // Inject hero features for business template
        if (this.currentTemplate === 'business') {
            this.injectHeroFeatures();
            this.injectServices();
            this.injectStats();
            this.injectTestimonials();
        }

        // Inject projects for portfolio template
        if (this.currentTemplate === 'portfolio') {
            this.injectProjects();
            this.injectExperience();
        }
    }

    injectHeroFeatures() {
        const container = document.getElementById('hero-features');
        if (!container || !this.translations.heroFeatures) return;

        const featuresHTML = this.translations.heroFeatures.map(feature => `
            <div class="feature-card reveal">
                <div class="feature-icon ${feature.icon?.color || 'blue'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        ${feature.icon?.svg || ''}
                    </svg>
                </div>
                <h3>${feature.title}</h3>
                <p>${feature.description}</p>
            </div>
        `).join('');

        container.innerHTML = featuresHTML;
    }

    injectServices() {
        const container = document.getElementById('services-grid');
        if (!container || !this.translations.services) return;

        const servicesHTML = this.translations.services.map(service => `
            <div class="service-card reveal">
                <div class="service-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        ${service.icon?.svg || ''}
                    </svg>
                </div>
                <h3>${service.title}</h3>
                <p>${service.description}</p>
            </div>
        `).join('');

        container.innerHTML = servicesHTML;
    }

    injectStats() {
        const container = document.getElementById('stats');
        if (!container || !this.translations.about?.stats) return;

        const statsHTML = this.translations.about.stats.map(stat => `
            <div class="stat-item">
                <div class="stat-number">${stat.number}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');

        container.innerHTML = statsHTML;
    }

    injectTestimonials() {
        const container = document.getElementById('testimonials');
        if (!container || !this.translations.testimonials) return;

        const testimonialsHTML = this.translations.testimonials.map(testimonial => `
            <div class="testimonial-item">
                <blockquote>"${testimonial.quote}"</blockquote>
                <cite>${testimonial.author}, ${testimonial.position}</cite>
            </div>
        `).join('');

        container.innerHTML = testimonialsHTML;
    }

    injectProjects() {
        const container = document.getElementById('projects-grid');
        if (!container || !this.translations.projects) return;

        const projectsHTML = this.translations.projects.map(project => `
            <div class="project-card ${project.featured ? 'featured' : ''} reveal">
                <div class="project-image">
                    <img data-template-image="projects" data-image-index="${this.translations.projects.indexOf(project)}" alt="${project.title}">
                    <div class="project-overlay">
                        <a href="${project.link}" class="project-link">View Project</a>
                    </div>
                </div>
                <div class="project-content">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <div class="project-tags">
                        ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = projectsHTML;
    }

    injectExperience() {
        const container = document.getElementById('experience-timeline');
        if (!container || !this.translations.experience) return;

        const experienceHTML = this.translations.experience.map(exp => `
            <div class="experience-item reveal">
                <div class="experience-content">
                    <h3>${exp.position}</h3>
                    <h4>${exp.company}</h4>
                    <span class="experience-period">${exp.period}</span>
                    <p>${exp.description}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = experienceHTML;
    }

    initializeImages() {
        // Handle single images
        document.querySelectorAll('[data-template-image]').forEach(element => {
            const imageKey = element.getAttribute('data-template-image');
            const imageIndex = element.getAttribute('data-image-index');

            if (this.images[imageKey]) {
                this.loadImage(element, this.images[imageKey], imageIndex);
            }
        });
    }

    loadImage(element, imageConfig, index = null) {
        if (imageConfig.type === 'single') {
            this.loadSingleImage(element, imageConfig);
        } else if (imageConfig.type === 'array' && index !== null) {
            this.loadArrayImage(element, imageConfig, parseInt(index));
        } else if (imageConfig.type === 'carousel') {
            this.initializeCarousel(element, imageConfig);
        }
    }

    loadSingleImage(element, imageConfig) {
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        if (!img) return;

        img.src = imageConfig.src;
        img.alt = imageConfig.alt || '';

        img.onerror = () => {
            if (imageConfig.fallback) {
                img.src = imageConfig.fallback;
            }
        };
    }

    loadArrayImage(element, imageConfig, index) {
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        if (!img || !imageConfig.images[index]) return;

        const imageData = imageConfig.images[index];
        img.src = imageData.src;
        img.alt = imageData.alt || '';

        img.onerror = () => {
            if (imageData.fallback) {
                img.src = imageData.fallback;
            }
        };
    }

    initializeCarousel(element, imageConfig) {
        // Initialize carousel with the specified configuration
        if (window.CarouselSystem) {
            new window.CarouselSystem(element, imageConfig);
        }
    }

    setupLanguageSwitcher() {
        // Create language switcher if it doesn't exist
        if (!document.querySelector('.language-switcher')) {
            const switcher = document.createElement('div');
            switcher.className = 'language-switcher';

            const languages = [
                { code: 'en', name: 'English' },
                { code: 'pt', name: 'Português' }
            ];

            switcher.innerHTML = languages.map(lang => `
                <a href="?lang=${lang.code}"
                   class="lang-link ${lang.code === this.currentLanguage ? 'active' : ''}"
                   data-lang="${lang.code}">${lang.name}</a>
            `).join(' | ');

            // Add to navbar or header
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.appendChild(switcher);
            }

            // Handle language switching
            switcher.addEventListener('click', (e) => {
                if (e.target.classList.contains('lang-link')) {
                    e.preventDefault();
                    const newLang = e.target.getAttribute('data-lang');
                    this.switchLanguage(newLang);
                }
            });
        }
    }

    async switchLanguage(newLanguage) {
        if (newLanguage === this.currentLanguage) return;

        this.currentLanguage = newLanguage;

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('lang', newLanguage);
        window.history.pushState({}, '', url);

        // Reload translations and reapply
        await this.loadTranslations();
        this.applyTranslations();

        // Update language switcher
        document.querySelectorAll('.lang-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('data-lang') === newLanguage);
        });
    }
}

// Initialize template loader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.templateLoader = new TemplateLoader();
});

// Export for use in other modules
export default TemplateLoader;
