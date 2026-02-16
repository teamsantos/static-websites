import translationsEN from '../assets/langs/en.json' with { type: 'json' };
import templateList from '../assets/templates.json' with { type: 'json' };

const lang = translationsEN;
const baseURL = "e-info.click";
const editorURL = `https://editor.${baseURL}?template=`;
const templatesURL = `template.${baseURL}`;

const injectPlans = (plans) => {
    const container = document.getElementById("plans");
    const fragment = document.createDocumentFragment();

    plans.forEach((plan) => {
        const card = document.createElement("div");
        card.className = `plan-item ${plan.coming_soon ? 'coming-soon' : ''}`;
        const isComingSoon = plan.coming_soon === true;

        card.innerHTML = `
<div class="plan-header">
    <div class="plan-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            ${plan.svg}
        </svg>
    </div>
    <h3 class="plan-name">${plan.name}</h3>
    ${isComingSoon ? '<span class="plan-badge">Coming Soon</span>' : ''}
</div>

<div class="plan-pricing">
    <div class="price">${plan.price}</div>
</div>

<ul class="plan-features">
    ${plan.description.map(point => `<li class="feature-point"><span class="checkmark">✓</span>${point}</li>`).join("")}
</ul>

<div class="plan-action">
    ${isComingSoon
                ? `<button class="btn btn-disabled coming-soon-btn" disabled>Coming Soon</button>`
                : `<button class="btn btn-primary pay-btn" redirect-to="_templates">Choose Plan</button>`
            }
</div>
`;
        // Handle click events for coming soon
        if (isComingSoon) {
            card.style.cursor = "default";
            card.onclick = (e) => {
                e.stopPropagation();
                showComingSoonNotification(plan.name);
            };
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
};

const injectBenifits = (benifits) => {
    const container = document.getElementById("benifits");
    container.innerHTML = benifits.map((benifit) => `
<div class="benefit-item">
<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
<path d="M9 12l2 2 4-4"/>
<circle cx="12" cy="12" r="10"/>
</svg>
<span>${benifit.title}</span>
</div>
`).join("");
};

const injectTemplates = (templates, selectText) => {
    const container = document.getElementById("templates");
    const fragment = document.createDocumentFragment();
    templates.forEach((template) => {
        const card = document.createElement("div");
        card.className = `template-card ${template.comingSoon ? 'coming-soon' : ''}`;
        const previewText = 'Preview';
        const previewButtonClass = template.comingSoon ? 'btn btn-secondary btn-full disabled' : 'btn btn-primary btn-full';
        card.innerHTML = `
<div class="template-image">
    ${template.comingSoon
                ? `<div class="frame-placeholder">
        <div class="placeholder-content">
            <span>Preview Coming Soon</span>
        </div>
        <div class="coming-soon-badge">Coming Soon</div>
    </div>`
                : template.screenshot
                    ? `<img 
        src="${template.screenshot}"
        alt="${template.title} Preview"
        loading="lazy"
        class="template-screenshot"
    />`
                    : `<div class="iframe-wrapper" data-iframe-container>
        <iframe 
            src="https://${template.name}.template.e-info.click"
            title="${template.title} Preview"
            loading="lazy"
            class="template-screenshot"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock"
            data-iframe-preview
        ></iframe>
    </div>`
            }
</div>
<div class="template-content">
    <div class="template-header">
        <h3>${template.title}</h3>
    </div>
    <p>${template.description}</p>
</div>
<div class="template-content template-button">
    <button class="${previewButtonClass}" ${template.comingSoon ? 'disabled' : ''}>
        ${template.comingSoon ? 'Coming Soon' : previewText}
    </button>
</div>
`;
        // Handle click events
        if (!template.comingSoon) {
            card.style.cursor = "pointer";

            // Handle "Preview" button clicks
            const previewButton = card.querySelector('.btn-primary');
            if (previewButton) {
                previewButton.onclick = (e) => {
                    e.stopPropagation();
                    showPreviewModal(template);
                };
            }

            // Card click opens preview modal
            card.onclick = () => {
                showPreviewModal(template);
            };
        } else if (template.comingSoon) {
            card.style.cursor = "default";
            card.onclick = (e) => {
                e.stopPropagation();
                showComingSoonNotification(template.title);
            };
        }
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
    
    // Scale iframe previews to fit their containers
    scaleIframePreviews();
};

// Scale iframe previews to fill their containers completely
const scaleIframePreviews = () => {
    const wrappers = document.querySelectorAll('[data-iframe-container]');
    wrappers.forEach(wrapper => {
        const iframe = wrapper.querySelector('[data-iframe-preview]');
        if (!iframe) return;
        
        const containerWidth = wrapper.offsetWidth;
        const containerHeight = wrapper.offsetHeight;
        const scaleX = containerWidth / 1920;
        const scaleY = containerHeight / 1080;
        
        iframe.style.transform = `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`;
    });
};

// Preview Modal Functions
const createPreviewModal = () => {
    // Remove existing modal if any
    const existingModal = document.querySelector('.preview-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'preview-modal-overlay';
    overlay.innerHTML = `
<div class="preview-modal">
    <div class="preview-modal-header">
        <div class="preview-modal-title">
            <h3 class="preview-title-text">Template Preview</h3>
            <span class="preview-modal-badge">Preview</span>
        </div>
        <div class="preview-modal-actions">
            <div class="preview-device-selector">
                <button class="preview-device-btn active" data-device="desktop" title="Desktop view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                </button>
                <button class="preview-device-btn" data-device="tablet" title="Tablet view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                        <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                </button>
                <button class="preview-device-btn" data-device="mobile" title="Mobile view">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                        <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                </button>
            </div>
            <button class="preview-modal-close" title="Close preview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    </div>
    <div class="preview-modal-body">
        <div class="preview-modal-loading">
            <div class="preview-modal-spinner"></div>
            <span>Loading preview...</span>
        </div>
        <div class="preview-iframe-container desktop">
            <iframe class="preview-modal-iframe" title="Template Preview" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        </div>
    </div>
    <div class="preview-modal-footer">
        <div class="preview-modal-info">
            <p class="preview-description-text">Preview this template before editing</p>
        </div>
        <div class="preview-modal-buttons">
            <button class="btn btn-secondary preview-open-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open in New Tab
            </button>
            <button class="btn btn-primary preview-edit-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Template
            </button>
        </div>
    </div>
</div>
`;

    document.body.appendChild(overlay);
    return overlay;
};

const showPreviewModal = (template) => {
    const overlay = createPreviewModal();
    const iframe = overlay.querySelector('.preview-modal-iframe');
    const loading = overlay.querySelector('.preview-modal-loading');
    const closeBtn = overlay.querySelector('.preview-modal-close');
    const openBtn = overlay.querySelector('.preview-open-btn');
    const editBtn = overlay.querySelector('.preview-edit-btn');
    const deviceBtns = overlay.querySelectorAll('.preview-device-btn');
    const iframeContainer = overlay.querySelector('.preview-iframe-container');
    const titleText = overlay.querySelector('.preview-title-text');
    const descriptionText = overlay.querySelector('.preview-description-text');

    const templateUrl = `https://${template.name}.${templatesURL}`;

    // Update modal content
    titleText.textContent = template.title;
    descriptionText.textContent = template.description;

    // Load iframe
    iframe.src = templateUrl;
    iframe.onload = () => {
        loading.classList.add('hidden');
    };

    // Show modal with animation
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // Close modal function
    const closeModal = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => overlay.remove(), 300);
    };

    // Event listeners
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    // Escape key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Open in new tab
    openBtn.onclick = () => {
        window.open(templateUrl, '_blank');
    };

    // Edit template
    editBtn.onclick = () => {
        window.location.href = `${editorURL}${template.name}`;
    };

    // Device switching
    deviceBtns.forEach(btn => {
        btn.onclick = () => {
            deviceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const device = btn.dataset.device;
            iframeContainer.className = `preview-iframe-container ${device}`;
        };
    });
};

const showComingSoonNotification = (templateName, plan = false) => {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = 'notification coming-soon-notification';
    notification.innerHTML = `
<div class="notification-content">
    <h4>Coming Soon!</h4>
    ${!plan
            ? `<p>The ${templateName} template is currently in development. Check back soon!</p>`
            : ''
        }
    <button class="btn btn-primary notification-close">Got it</button>
</div>
`;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds or on button click
    const closeButton = notification.querySelector('.notification-close');
    closeButton.onclick = () => notification.remove();

    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
};

const injectFeatures = (features) => {
    const container = document.getElementById("features");
    container.innerHTML = features.map((feature) => `
<div class="feature-item">
<div class="feature-item-icon">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
${feature.icon.svg}
</svg>
</div>
<h3>${feature.title}</h3>
<p>${feature.description}</p>
</div>
`).join("");
};

const injectHeroFeatures = (heroFeatures) => {
    const container = document.getElementById("hero-features");
    const fragment = document.createDocumentFragment();

    heroFeatures.forEach((heroFeature) => {
        const featureCard = document.createElement('div');
        featureCard.className = 'feature-card';
        featureCard.innerHTML = `
<div class="feature-icon ${heroFeature.icon.color}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        ${heroFeature.icon.svg}
    </svg>
</div>
<h3>${heroFeature.title}</h3>
<p>${heroFeature.description}</p>
`;
        fragment.appendChild(featureCard);
    });

    container.appendChild(fragment);
};

async function loadTranslations() {
    try {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (lang[key]) {
                el.textContent = lang[key];
            } else {
                console.warn(`Missing translation for key: ${key}`);
            }
        });

        let heroFeatures = lang["hero.features"];
        if (heroFeatures) {
            injectHeroFeatures(heroFeatures);
        }

        let features = lang["features"];
        if (features) {
            injectFeatures(features);
        }

        // Load templates from static data
        // let templates = lang["templates"];
        if (templateList) {
            injectTemplates(templateList, lang["template.select"] ?? "Use this template");
        }

        let benifits = lang["getStarted.benifits"];
        if (benifits) {
            injectBenifits(benifits)
        }

        let plans = lang["plans.list"];
        if (plans) {
            injectPlans(plans);
        }

        // REPLACE YOUR EXISTING STAGGER CODE WITH THIS:
        const staggerParents = [
            document.querySelector('.hero-features'),
            document.querySelector('.features-grid'),
            document.querySelector('.plans-grid'),
            document.querySelector('.templates-grid')
        ];

        staggerParents.forEach((parent) => {
            if (!parent) return;
            [...parent.children].forEach((child, idx) => {
                // Use CSS custom property for reveal delay only
                const delay = `${Math.min(idx * 60, 420)}ms`;
                child.style.setProperty('--reveal-delay', delay);
                child.classList.add('reveal');
            });
        });

        // IMPORTANT: Setup tilt effects and reveal AFTER all content is injected
        if (window.setupTiltEffects) window.setupTiltEffects();
        if (window.setupRevealOnScroll) window.setupRevealOnScroll();

        document.querySelectorAll("[redirect-to]").forEach(el => {
            let key = el.getAttribute("redirect-to");
            if (!key.startsWith("#")) {
                key = `#${key}`;
            }
            // add href for anchors for accessibility and fallback
            if (el.tagName === 'A' && !el.getAttribute('href')) {
                el.setAttribute('href', key);
            }
            el.addEventListener("click", (evt) => {
                const target = document.querySelector(key);
                if (!target) return;
                // prevent default jumps (esp. if element is an <a>)
                if (evt) evt.preventDefault();
                const top = target.getBoundingClientRect().top + window.pageYOffset;
                animateScrollTo(top, 1000);
            });
            el.style.cursor = "pointer";
        });

    } catch (err) {
        console.error("Translation loading failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    setupScrollCueAutoHide();
    
    // Re-scale iframe previews on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(scaleIframePreviews, 100);
    }, { passive: true });
});

function setupScrollCueAutoHide() {
    const hero = document.querySelector('.hero');
    const cue = document.querySelector('.scroll-cue');
    if (!hero || !cue) return;

    const getViewportHeight = () => (window.visualViewport && window.visualViewport.height) || window.innerHeight;

    const update = () => {
        const heroHeight = hero.getBoundingClientRect().height;
        const viewportHeight = getViewportHeight();
        const fits = Math.ceil(heroHeight) <= Math.ceil(viewportHeight + 1);
        cue.style.display = fits ? '' : 'none';
        cue.setAttribute('aria-hidden', String(!fits));
    };

    // Track hero size and viewport changes
    const ro = new ResizeObserver(update);
    ro.observe(hero);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update);
    window.addEventListener('load', update);

    requestAnimationFrame(update);
    setTimeout(update, 300);
}
