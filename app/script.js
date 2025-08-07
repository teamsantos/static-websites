import translationsPT from '../assets/langs/pt.json' with { type: 'json' };
// import translationsFR from '../assets/langs/fr.json' with { type: 'json' };

const lang = translationsPT;

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

    } catch (err) {
        console.error("Translation loading failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadTranslations();
});
