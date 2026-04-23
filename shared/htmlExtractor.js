import { JSDOM } from "jsdom";

class Extractor {
    constructor() {
        this.textCounter = 1;
        this.imageCounter = 1;
        this.iconCounter = 1;
        this.enJson = {};
        this.imagesJson = {};
        this.iconsJson = {};
        this.titleUsed = false;
        this.descriptionUsed = false;
    }

    generateIconKey() {
        return `icon_${this.iconCounter}`;
    }

    extractFontAwesomeClass(element) {
        if (element.tagName !== 'I') return null;

        const classList = Array.from(element.classList || []);
        const iconClass = classList.find(cls =>
            cls.startsWith('fa-') &&
            !['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'].includes(cls) &&
            cls !== 'fa'
        );

        const hasPrefix = classList.some(cls =>
            ['fas', 'far', 'fal', 'fat', 'fad', 'fab', 'fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-brands'].includes(cls)
        );

        if (iconClass && hasPrefix) {
            return iconClass;
        }

        return null;
    }

    generateTextKey(text, element = null) {
        if (element && element.id === 'title' && !this.titleUsed) {
            this.titleUsed = true;
            return 'title';
        }
        if (element && element.id === 'description' && !this.descriptionUsed) {
            this.descriptionUsed = true;
            return 'description';
        }

        const cleanText = text.replace(/[^\w\s]/g, '').trim();
        const words = cleanText.split(/\s+/).filter(word => word.length > 0);

        if (words.length === 0) return `text_${this.textCounter}`;

        let key = words.slice(0, 3)
            .map((word, index) =>
                index === 0 ? word.toLowerCase() :
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');

        let originalKey = key;
        let counter = 1;
        while (this.enJson.hasOwnProperty(key)) {
            key = `${originalKey}_${counter}`;
            counter++;
        }

        return key;
    }

    generateImageKey() {
        return `image_${this.imageCounter}`;
    }

    hasExtractableTextContent(element) {
        const inlineTags = ['STRONG', 'EM', 'B', 'I', 'SPAN', 'A', 'U', 'MARK', 'SMALL', 'SUB', 'SUP'];

        const children = Array.from(element.children);
        if (children.length > 0 && children.every(child => child.tagName === 'A')) {
            return false;
        }

        for (let child of element.childNodes) {
            if (child.nodeType === 1) {
                if (child.tagName === 'BR') {
                    return false;
                }
                if (!inlineTags.includes(child.tagName)) {
                    return false;
                }
                if (!this.hasExtractableTextContent(child)) {
                    return false;
                }
            } else if (child.nodeType === 3) {
                // text node
            }
        }
        return element.textContent.trim().length > 0;
    }

    wrapTextNodes(element) {
        const document = element.ownerDocument;
        const childNodes = Array.from(element.childNodes);

        for (let node of childNodes) {
            if (node.nodeType === 3) {
                const text = node.textContent.trim();
                if (text) {
                    const span = document.createElement('span');
                    const textKey = this.generateTextKey(text);
                    span.setAttribute('data-text-id', textKey);
                    span.textContent = '';
                    this.enJson[textKey] = text;
                    this.textCounter++;

                    node.parentNode.replaceChild(span, node);
                }
            }
        }
    }

    shouldSkipElement(element) {
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'HEAD'];
        return skipTags.includes(element.tagName);
    }

    processElement(element) {
        if (this.shouldSkipElement(element)) {
            if (element.tagName === 'HEAD') {
                const children = Array.from(element.children);
                for (let child of children) {
                    this.processElement(child);
                }
            }
            return;
        }

        if (element.tagName === 'TITLE') {
            const titleText = element.textContent.trim();
            if (titleText) {
                const textKey = this.generateTextKey(titleText, element);
                element.setAttribute('data-title-text-id', textKey);
                element.textContent = '';
                this.enJson[textKey] = titleText;
                this.textCounter++;
            }
            return;
        }

        if (element.tagName === 'META') {
            const content = element.getAttribute('content');
            const name = element.getAttribute('name') || element.getAttribute('property');

            if (content && content.trim() && name) {
                const textKey = this.generateTextKey(content, element);
                element.setAttribute('data-meta-content-id', textKey);
                element.removeAttribute('content');
                this.enJson[textKey] = content.trim();
                this.textCounter++;
            }
            return;
        }

        if (element.tagName === 'IMG') {
            const src = element.getAttribute('src');
            if (src) {
                const imageKey = this.generateImageKey();
                element.setAttribute('data-image-src', imageKey);
                element.removeAttribute('src');
                this.imagesJson[imageKey] = src;
                this.imageCounter++;
            }

            const alt = element.getAttribute('alt');
            if (alt && alt.trim()) {
                const textKey = this.generateTextKey(alt, element);
                element.setAttribute('data-alt-text-id', textKey);
                element.removeAttribute('alt');
                this.enJson[textKey] = alt.trim();
                this.textCounter++;
            }
        }

        const iconClass = this.extractFontAwesomeClass(element);
        if (iconClass) {
            const iconKey = this.generateIconKey();
            element.setAttribute('data-icon-id', iconKey);
            this.iconsJson[iconKey] = iconClass;
            this.iconCounter++;
            return;
        }

        const style = element.getAttribute('style');
        if (style && style.includes('background-image')) {
            const matches = style.match(/background-image\s*:\s*url\(['"]?([^'")]+)['"]?\)/);
            if (matches) {
                const imageKey = this.generateImageKey();
                element.setAttribute('data-bg-image', imageKey);
                const newStyle = style.replace(/background-image\s*:\s*url\(['"]?[^'")]+['"]?\)\s*;?/, '').trim();
                if (newStyle) {
                    element.setAttribute('style', newStyle);
                } else {
                    element.removeAttribute('style');
                }
                this.imagesJson[imageKey] = matches[1];
                this.imageCounter++;
            }
        }

        const title = element.getAttribute('title');
        if (title && title.trim()) {
            const textKey = this.generateTextKey(title, element);
            element.setAttribute('data-title-text-id', textKey);
            element.removeAttribute('title');
            this.enJson[textKey] = title.trim();
            this.textCounter++;
        }

        if (['BUTTON', 'INPUT', 'TEXTAREA'].includes(element.tagName)) {
            let text = '';

            if (element.tagName === 'BUTTON') {
                text = element.textContent.trim();
                if (text) {
                    element.textContent = '';
                }
            } else if (element.tagName === 'INPUT') {
                const placeholder = element.getAttribute('placeholder');
                const value = element.getAttribute('value');
                text = placeholder || value || '';
                if (placeholder) {
                    element.removeAttribute('placeholder');
                }
                if (value) {
                    element.removeAttribute('value');
                }
            } else if (element.tagName === 'TEXTAREA') {
                const placeholder = element.getAttribute('placeholder');
                text = placeholder || element.textContent.trim();
                if (placeholder) {
                    element.removeAttribute('placeholder');
                }
                if (element.textContent.trim()) {
                    element.textContent = '';
                }
            }

            if (text) {
                const textKey = this.generateTextKey(text, element);
                element.setAttribute('data-text-id', textKey);
                this.enJson[textKey] = text;
                this.textCounter++;
            }
        }

        else if (this.hasExtractableTextContent(element)) {
            if (!element.hasAttribute('data-text-id')) {
                const text = element.textContent.trim();
                if (text) {
                    const textKey = this.generateTextKey(text, element);
                    element.setAttribute('data-text-id', textKey);
                    element.textContent = '';
                    this.enJson[textKey] = text;
                    this.textCounter++;
                }
            } else {
                const existingKey = element.getAttribute('data-text-id');
                const text = element.textContent.trim();
                if (text && !this.enJson[existingKey]) {
                    this.enJson[existingKey] = text;
                    element.textContent = '';
                }
            }
        }
        else {
            this.wrapTextNodes(element);
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.processElement(child);
        }
    }

    injectTextContent(element, langData, imageData, iconData = {}) {
        if (this.shouldSkipElement(element)) {
            if (element.tagName === 'HEAD') {
                const children = Array.from(element.children);
                for (let child of children) {
                    this.injectTextContent(child, langData, imageData, iconData);
                }
            }
            return;
        }

        const textId = element.getAttribute('data-text-id');
        if (textId && langData[textId]) {
            if (element.tagName === 'BUTTON') {
                element.textContent = langData[textId];
            } else if (element.tagName === 'TEXTAREA') {
                element.textContent = langData[textId];
            } else if (element.tagName === 'INPUT') {
                const inputType = element.getAttribute('type');
                if (inputType === 'submit' || inputType === 'button') {
                    element.setAttribute('value', langData[textId]);
                } else {
                    element.setAttribute('placeholder', langData[textId]);
                }
            } else {
                element.textContent = langData[textId];
            }
        }

        const altTextId = element.getAttribute('data-alt-text-id');
        if (altTextId && langData[altTextId]) {
            element.setAttribute('alt', langData[altTextId]);
        }

        const titleTextId = element.getAttribute('data-title-text-id');
        if (titleTextId && langData[titleTextId]) {
            if (element.tagName === 'TITLE') {
                element.textContent = langData[titleTextId];
            } else {
                element.setAttribute('title', langData[titleTextId]);
            }
        }

        const metaContentId = element.getAttribute('data-meta-content-id');
        if (metaContentId && langData[metaContentId]) {
            element.setAttribute('content', langData[metaContentId]);
        }

        const imageSrc = element.getAttribute('data-image-src');
        if (imageSrc && imageData[imageSrc]) {
            element.setAttribute('src', imageData[imageSrc]);
        }

        const bgImage = element.getAttribute('data-bg-image');
        if (bgImage && imageData[bgImage]) {
            const currentStyle = element.getAttribute('style') || '';
            const bgImageStyle = `background-image: url('${imageData[bgImage]}')`;
            const newStyle = currentStyle ? `${currentStyle}; ${bgImageStyle}` : bgImageStyle;
            element.setAttribute('style', newStyle);
        }

        const iconId = element.getAttribute('data-icon-id');
        if (iconId && iconData[iconId]) {
            const iconClass = iconData[iconId];
            if (!element.classList.contains(iconClass)) {
                element.classList.add(iconClass);
            }
        }

        const children = Array.from(element.children);
        for (let child of children) {
            this.injectTextContent(child, langData, imageData, iconData);
        }
    }
}

export function extractFromDom(dom) {
    const document = dom.window.document;
    const extractor = new Extractor();

    if (document.head) {
        extractor.processElement(document.head);
    }
    if (document.body) {
        extractor.processElement(document.body);
    }

    return {
        skeletonHtml: dom.serialize(),
        langs: extractor.enJson,
        images: extractor.imagesJson,
        icons: extractor.iconsJson,
    };
}

export function extractFromHtml(htmlString) {
    return extractFromDom(new JSDOM(htmlString));
}

export function injectIntoSkeleton(skeletonHtml, langs, images, icons = {}) {
    const dom = new JSDOM(skeletonHtml);
    const document = dom.window.document;
    const extractor = new Extractor();

    if (document.head) {
        extractor.injectTextContent(document.head, langs, images, icons);
    }
    if (document.body) {
        extractor.injectTextContent(document.body, langs, images, icons);
    }

    return dom.serialize();
}

export function extractAndInject(htmlString) {
    const { skeletonHtml, langs, images, icons } = extractFromHtml(htmlString);
    const processedHtml = injectIntoSkeleton(skeletonHtml, langs, images, icons);
    return { processedHtml, langs, images, icons };
}
