import ptPT from '../assets/langs/pt_pt.json';

const injectBenifits = (benifits) => {
    let container = document.getElementById("benifits");
    benifits.forEach((benifit) => {
        container += `
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
        const translations = await ptPT.json();

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) {
                el.textContent = translations[key];
            } else {
                console.warn(`Missing translation for key: ${key}`);
            }
        });

        let heroFeatures = ptPT["hero.features"];
        if (heroFeatures) {
            injectHeroFeatures(heroFeatures);
        }

        let features = ptPT["features"];
        if (features) {
            injectFeatures();
        }

        let templates = ptPT["templates"];
        if (templates) {
            injectTemplates(templates, ptPT["template.select"] ?? "Use this template");
        }

        let benifits = ptPT["benifits"];
        if (benifits) {
            injectBenifits(benifits)
        }

    } catch (err) {
        console.error("Translation loading failed:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadTranslations();
});
