import translationsPT from '../assets/langs/pt.json' with { type: 'json' };
// import translationsFR from '../assets/langs/fr.json' with { type: 'json' };

const lang = translationsPT;

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
    const tiltSelectors = ['.feature-item', '.plan-item', '.template-card'];
    const tiltElements = document.querySelectorAll(tiltSelectors.join(','));
    const constrain = 18;
    tiltElements.forEach((el) => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width;
            const dy = (e.clientY - cy) / rect.height;
            const rotateX = (+constrain * dy).toFixed(2);
            const rotateY = (-constrain * dx).toFixed(2);
            el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = '';
        });
    });
}

const injectPlans = (plans) => {
    const container = document.getElementById("plans");
    container.innerHTML = plans.map((plan) => `
        <div class="plan-item">
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
    let container = document.getElementById("benifits");
    benifits.forEach((benifit) => {
        container.innerHTML += `
            <div class="benefit-item">
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <span>${benifit.title}</span>
            </div>
`;
    });
}

const injectTemplates = (templates, selectText) => {
    let container = document.getElementById("templates");
    templates.forEach((template) => {
        const card = document.createElement("div");
        card.className = "template-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="template-image">
                <img src="${template.imageURL}" alt="${template.title}">
            </div>
            <div class="template-content">
                <div class="template-header">
                    <h3>${template.title}</h3>
                    <span class="template-category">${template.subTitle}</span>
                </div>
                <p>${template.description}</p>
                <button class="btn btn-primary btn-full">${selectText}</button>
            </div>
        `;
        card.onclick = () => window.location.href = template.url;
        container.appendChild(card);
    });
};

const injectFeatures = (features) => {
    let container = document.getElementById("features");
    features.forEach((feature) => {
        container.innerHTML += `
            <div class="feature-item">
                <div class="feature-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        ${feature.icon.svg}
                    </svg>
                </div>
                <h3>${feature.title}</h3>
                <p>${feature.description}</p>
            </div>`;
    });
}

const injectHeroFeatures = (heroFeatures) => {
    let container = document.getElementById("hero-features");
    heroFeatures.forEach((heroFeature) => {
        container.innerHTML += `
            <div class="feature-card">
                <div class="feature-icon ${heroFeature.icon.color}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        ${heroFeature.icon.svg}
                    </svg>
                </div>
                <h3>${heroFeature.title}</h3>
                <p>${heroFeature.description}</p>
            </div>`;
    });
}

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

        document.querySelectorAll("[redirect-to]").forEach(el => {
            let key = el.getAttribute("redirect-to");
            if (!key.startsWith("#")) {
                key = `#${key}`;
            }
            el.addEventListener("click", () => {
                const target = document.querySelector(key);
                if (target) {
                    target.scrollIntoView({ behavior: "smooth" });
                    // pulse effect on arrival
                    target.classList.add('section-pulse');
                    setTimeout(() => target.classList.remove('section-pulse'), 600);
                }
            });
            el.style.cursor = "pointer";
        });

        let heroFeatures = lang["hero.features"];
        if (heroFeatures) {
            injectHeroFeatures(heroFeatures);
        }

        let features = lang["features"];
        if (features) {
            injectFeatures(features);
        }

        let templates = lang["templates"];
        if (templates) {
            injectTemplates(templates, lang["template.select"] ?? "Use this template");
        }

        let benifits = lang["getStarted.benifits"];
        if (benifits) {
            injectBenifits(benifits)
        }

        let plans = lang["plans.list"];
        if (plans) {
            injectPlans(plans);
        }

        // Enhance UI interactions
        addRippleEffect();
        setupTiltEffects();

        // Stagger children in grids
        const staggerParents = [
            document.querySelector('.hero-features'),
            document.querySelector('.features-grid'),
            document.querySelector('.plans-grid'),
            document.querySelector('.templates-grid')
        ];
        staggerParents.forEach((parent) => {
            if (!parent) return;
            [...parent.children].forEach((child, idx) => {
                child.style.transitionDelay = `${Math.min(idx * 60, 420)}ms`;
                child.classList.add('reveal');
            });
        });

        // Now observe all reveals (including newly added ones)
        setupRevealOnScroll();

    } catch (err) {
        console.error("Translation loading failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadTranslations();
});
