import translationsEN from '../assets/langs/en.json' with { type: 'json' };

const lang = translationsEN;

function addRippleEffect() {
    document.querySelectorAll('.btn').forEach((button) => {
        button.addEventListener('click', function (e) {
            const existing = this.querySelector('.ripple');
            if (existing) existing.remove();
            const circle = document.createElement('span');
            const diameter = Math.max(this.clientWidth, this.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - (this.getBoundingClientRect().left + radius)}px`;
            circle.style.top = `${e.clientY - (this.getBoundingClientRect().top + radius)}px`;
            circle.classList.add('ripple');
            this.appendChild(circle);
        });
    });
}

function setupRevealOnScroll() {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.14 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function setupTiltEffects() {
    const tiltSelectors = ['.feature-card', '.feature-item', '.plan-item', '.template-card'];
    const tiltElements = document.querySelectorAll(tiltSelectors.join(','));
    tiltElements.forEach((el) => {
        const tilt = 800;
        const constrain = el.classList.contains("feature-card") ? 36 : 18;
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width;
            const dy = (e.clientY - cy) / rect.height;
            const rotateX = (+constrain * dy).toFixed(2);
            const rotateY = (-constrain * dx).toFixed(2);
            el.style.transform = `perspective(${tilt}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = '';
        });
    });
}

function animateScrollTo(targetY, durationMs = 2200) {
    const supportsRAF = 'requestAnimationFrame' in window;
    if (!supportsRAF) {
        window.scrollTo(0, targetY);
        return;
    }
    const startY = window.pageYOffset;
    const distance = targetY - startY;
    const startTime = performance.now();
    const duration = Math.max(0, durationMs);
    // smoother ease with longer ease-out tail
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeInOutCubic(progress);
        window.scrollTo(0, startY + distance * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

const injectPlans = (plans) => {
    const container = document.getElementById("plans");
    container.innerHTML = plans.map((plan) => `
        <div class="plan-item" redirect-to="${plan["redirect-to"]}" >
            <div class="plan-item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    ${plan.svg}
                </svg>
            </div>
            <h3>${plan.name}</h3>
            <h5 style="padding-bottom: 10px;">${plan.price}</h5>
            <ul>
                ${plan.description.map(point => `
                    <li><p>${point}</p></li>
                `).join("")}
            </ul>
        </div>
    `).join("");
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

// Dynamic template loading system
const loadTemplatesFromFolders = async () => {
    try {
        // Load the templates registry
        const registryResponse = await fetch('./templates/templates-registry.json');
        if (!registryResponse.ok) {
            throw new Error('Failed to load templates registry');
        }
        const registry = await registryResponse.json();

        // Detect current language (similar to template loader logic)
        let currentLang = 'en'; // default
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');
        if (langParam && ['en', 'pt'].includes(langParam)) {
            currentLang = langParam;
        } else if (navigator.language.startsWith('pt')) {
            currentLang = 'pt';
        }

        // Load template data for each registered template
        const templatesWithData = await Promise.all(
            registry.templates.map(async (template) => {
                try {
                    // Load template-specific language data
                    const templateLangPath = `./templates/${template.id}/lang_${currentLang}.json`;
                    const templateLangResponse = await fetch(templateLangPath);

                    if (!templateLangResponse.ok) {
                        console.warn(`Language file not found for template ${template.id}, using registry data`);
                        return template;
                    }

                    const templateLangData = await templateLangResponse.json();

                    // Merge registry data with template language data
                    return {
                        ...template,
                        // Use template-specific data where available, fallback to registry
                        name: templateLangData.name || template.name,
                        description: templateLangData.description || template.description,
                        // Add any other template-specific data you want to expose
                        templateData: templateLangData
                    };
                } catch (error) {
                    console.warn(`Error loading data for template ${template.id}:`, error);
                    return template;
                }
            })
        );

        // Sort templates by order
        return templatesWithData.sort((a, b) => (a.order || 999) - (b.order || 999));

    } catch (error) {
        console.error('Error loading templates from folders:', error);
        throw error;
    }
};

const injectTemplates = (templates, selectText) => {
    const container = document.getElementById("templates");
    const fragment = document.createDocumentFragment();

    templates.forEach((template) => {
        const card = document.createElement("div");
        card.className = `template-card ${template.comingSoon ? 'coming-soon' : ''}`;

        const buttonText = template.comingSoon ? 'Coming Soon' : selectText;
        const buttonClass = template.comingSoon ? 'btn btn-secondary btn-full' : 'btn btn-primary btn-full';

        card.innerHTML = `
            <div class="template-image">
                <img src="${template.imageURL}" alt="${template.title}">
                ${template.comingSoon ? '<div class="coming-soon-badge">Coming Soon</div>' : ''}
            </div>
            <div class="template-content">
                <div class="template-header">
                    <h3>${template.title}</h3>
                    <span class="template-category">${template.subTitle}</span>
                </div>
                <p>${template.description}</p>
                <button class="${buttonClass}" ${template.comingSoon ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;

        // Handle click events
        if (!template.comingSoon && template.url && template.url !== '#') {
            card.style.cursor = "pointer";
            card.onclick = () => {
                // Check if it's a template URL (contains templates/)
                if (template.url.includes('templates/')) {
                    window.location.href = template.url;
                } else {
                    // Handle other types of URLs (external links, etc.)
                    window.open(template.url, '_blank');
                }
            };
        } else if (template.comingSoon) {
            card.style.cursor = "default";
            card.onclick = (e) => {
                e.stopPropagation();
                // Optional: Show a notification or modal about coming soon
                showComingSoonNotification(template.title);
            };
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
};

const showComingSoonNotification = (templateName) => {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = 'notification coming-soon-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h4>Coming Soon!</h4>
            <p>The ${templateName} template is currently in development. Check back soon!</p>
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

        // Load templates dynamically from template folders
        loadTemplatesFromFolders().then(templates => {
            if (templates && templates.length > 0) {
                injectTemplates(templates, lang["template.select"] ?? "Use this template");
            }
        }).catch(error => {
            console.error('Error loading templates:', error);
            // Fallback to language file templates if dynamic loading fails
            let templates = lang["templates"];
            if (templates) {
                injectTemplates(templates, lang["template.select"] ?? "Use this template");
            }
        });

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

        // IMPORTANT: Setup tilt effects AFTER all content is injected
        setupTiltEffects();

        // Enhance other UI interactions
        addRippleEffect();

        // Now observe all reveals (including newly added ones)
        setupRevealOnScroll();

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

// Stars background animation for hero
(() => {
    const canvas = document.querySelector('.stars');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, dpr;
    let stars = [];
    let shooting = [];

    function resize() {
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initStars() {
        const count = Math.max(5, Math.floor((width * height) / 18000)); // density
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 1.1 + 0.2,
            a: Math.random() * 0.6 + 0.3,
            tw: Math.random() * 0.02 + 0.005,
            t: Math.random() * Math.PI * 2
        }));
    }

    function spawnShootingStar() {
        if (shooting.length > 2) return;
        const fromTop = Math.random() < 0.5;
        const startX = fromTop ? Math.random() * width * 0.6 : width * (0.4 + Math.random() * 0.6);
        const startY = fromTop ? -20 : Math.random() * height * 0.5;
        const speed = 600 + Math.random() * 600; // px/s
        const angle = (Math.PI / 4) + Math.random() * (Math.PI / 8); // down-right
        shooting.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.6 + Math.random() * 0.6,
            age: 0
        });
    }

    let last = performance.now();
    function tick(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        ctx.clearRect(0, 0, width, height);

        // aurora-friendly dark sky gradient
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, 'rgba(12, 18, 32, 0.2)');
        g.addColorStop(1, 'rgba(12, 18, 32, 0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        // twinkling stars
        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            s.t += s.tw;
            const alpha = s.a + Math.sin(s.t) * 0.25;
            ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // shooting stars
        for (let i = shooting.length - 1; i >= 0; i--) {
            const sh = shooting[i];
            sh.age += dt;
            if (sh.age > sh.life) { shooting.splice(i, 1); continue; }
            const px = sh.x, py = sh.y;
            sh.x += sh.vx * dt; sh.y += sh.vy * dt;
            const trail = 120; // px
            const ang = Math.atan2(sh.vy, sh.vx);
            const tx = Math.cos(ang) * -trail;
            const ty = Math.sin(ang) * -trail;
            const grad = ctx.createLinearGradient(px, py, px + tx, py + ty);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + tx, py + ty);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        // occasionally spawn a shooting star
        if (Math.random() < 0.007) spawnShootingStar();

        requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => { resize(); initStars(); });
    ro.observe(canvas);
    resize();
    initStars();
    requestAnimationFrame(tick);
})();
