import translationsEN from '../assets/langs/en.json' with { type: 'json' };
import templateList from '../assets/templates.json' with { type: 'json' };

const lang = translationsEN;
const baseURL = "e-info.click";
const editorURL = `https://editor.${baseURL}?template=`;
const templatesURL = `template.${baseURL}`;

async function createCheckout(product_id) {
    try {
        const response = await fetch("https://pay.e-info.click/checkout-session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: "test@example.com",
                name: `Project-${Date.now()}`,
                html: "<p>Filipe is gay</p>",
                priceId: product_id// Stripe Price ID
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("Checkout creation failed:", error);
            window.templateEditorInstance.ui.showStatus("Failed to create checkout session.", "error");
            return;
        }

        const data = await response.json();
        window.location.href = data.sessionUrl; // Redirect to Stripe checkout
    } catch (err) {
        console.error("Error creating checkout:", err);
        window.templateEditorInstance.ui.showStatus("Something went wrong.", "error");
    }
}

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
        const useText = template.comingSoon ? 'Coming Soon' : selectText;
        const previewText = 'Preview';
        const useButtonClass = `${template.comingSoon ? 'btn btn-secondary btn-full hidden' : 'btn btn-primary btn-full'} `;
        const previewButtonClass = 'btn btn-secondary btn-full';

        card.innerHTML = `
<div class="template-image">
    ${template.comingSoon
                ? `<div class="frame-placeholder">
        <div class="placeholder-content">
            <span>Preview Coming Soon</span>
        </div>
        <div class="coming-soon-badge">Coming Soon</div>
    </div>`
                : `<img 
        src="https://${template.name}.${templatesURL}/assets/images/screenshot.webp" 
        alt="${template.title} Preview"
        loading="lazy"
        class="template-screenshot"
    />`
            }
</div>
<div class="template-content">
    <div class="template-header">
        <h3>${template.title}</h3>
    </div>
    <p>${template.description}</p>

    <button class="${useButtonClass} hidden" ${template.comingSoon ? 'disabled' : ''}>
        ${useText}
    </button>
</div>
<div class="template-content template-button">
    <button class="${useButtonClass}" ${template.comingSoon ? 'disabled' : ''}>
        ${useText}
    </button>
    ${!template.comingSoon ? `<button class="${previewButtonClass}">
        ${previewText}
    </button>` : ''}
</div>
`;
        // Handle click events
        if (!template.comingSoon) {
            card.style.cursor = "pointer";
            
            // Handle "Use this website" button clicks
            const useButtons = card.querySelectorAll('.btn-primary');
            useButtons.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `${editorURL}${template.name}`;
                };
            });
            
            // Handle "Preview" button clicks
            const previewButtons = card.querySelectorAll('.btn-secondary:not(.hidden)');
            previewButtons.forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    window.open(`https://${template.name}.${templatesURL}`, '_blank');
                };
            });
            
            // Card click goes to editor
            card.onclick = () => {
                window.location.href = `${editorURL}${template.name}`;
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
