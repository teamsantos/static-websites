/**
 * Input Validation Utilities for E-Info Static Website Generator
 * 
 * This module provides comprehensive validation for all user inputs
 * to prevent injection attacks, malformed data, and resource abuse.
 */

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
export const validateEmail = (email) => {
    if (typeof email !== 'string') return false;
    // RFC 5322 simplified regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
};

/**
 * Validates project name (DNS-safe)
 * Must be lowercase, 3-63 chars, alphanumeric and hyphens only
 * Cannot start/end with hyphen
 * @param {string} projectName - Project name to validate
 * @returns {boolean} - True if valid DNS-safe name
 */
export const validateProjectName = (projectName) => {
    if (typeof projectName !== 'string') return false;
    // DNS labels: 1-63 chars, alphanumeric and hyphens, can't start/end with hyphen
    const dnsRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
    return dnsRegex.test(projectName);
};

/**
 * Validates hex color format
 * @param {string} color - Color value to validate
 * @returns {boolean} - True if valid hex color
 */
export const validateHexColor = (color) => {
    if (typeof color !== 'string') return false;
    // Matches #RGB, #RRGGBB, #RGBA, #RRGGBBAA
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
    return hexRegex.test(color);
};

/**
 * Validates RGB color format
 * @param {string} color - Color value to validate
 * @returns {boolean} - True if valid RGB color
 */
export const validateRGBColor = (color) => {
    if (typeof color !== 'string') return false;
    // Matches rgb(r, g, b) or rgba(r, g, b, a)
    const rgbRegex = /^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;
    return rgbRegex.test(color);
};

/**
 * Validates color value (hex or RGB)
 * @param {string} color - Color value to validate
 * @returns {boolean} - True if valid color
 */
export const validateColor = (color) => {
    return validateHexColor(color) || validateRGBColor(color);
};

/**
 * Validates base64 image data
 * @param {string} imageData - Base64 image data
 * @param {number} maxSizeMB - Maximum file size in MB (default 5)
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateImageData = (imageData, maxSizeMB = 5) => {
    if (typeof imageData !== 'string') {
        return { valid: false, error: 'Image must be a string' };
    }

    if (!imageData.startsWith('data:image/')) {
        return { valid: false, error: 'Invalid image data format. Must be base64 encoded' };
    }

    // Extract base64 content
    const matches = imageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) {
        return { valid: false, error: 'Invalid image data format. Must include MIME type' };
    }

    const [, format, base64Content] = matches;
    const validFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg+xml'];
    
    if (!validFormats.includes(format.toLowerCase())) {
        return { valid: false, error: `Invalid image format. Allowed: ${validFormats.join(', ')}` };
    }

    // Estimate size from base64 (roughly base64 is 33% larger than binary)
    const binarySize = (base64Content.length * 3) / 4;
    const sizeMB = binarySize / (1024 * 1024);

    if (sizeMB > maxSizeMB) {
        return { valid: false, error: `Image too large. Maximum ${maxSizeMB}MB allowed, got ${sizeMB.toFixed(2)}MB` };
    }

    return { valid: true, error: null };
};

/**
 * Validates images object
 * @param {object} images - Object with image data
 * @param {number} maxImages - Maximum number of images
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateImages = (images, maxImages = 5) => {
    if (!images || typeof images !== 'object' || Array.isArray(images)) {
        return { valid: false, error: 'Images must be an object with key-value pairs' };
    }

    const imageKeys = Object.keys(images);
    
    if (imageKeys.length === 0) {
        return { valid: false, error: 'At least one image is required' };
    }

    if (imageKeys.length > maxImages) {
        return { valid: false, error: `Too many images. Maximum ${maxImages} allowed, got ${imageKeys.length}` };
    }

    // Validate each image
    for (const [key, value] of Object.entries(images)) {
        // Check if it's a URL (already uploaded) or base64 data
        if (typeof value === 'string') {
            if (value.startsWith('http://') || value.startsWith('https://')) {
                // It's a URL, assume it's valid
                continue;
            } else if (value.startsWith('data:image/')) {
                // It's base64, validate it
                const result = validateImageData(value);
                if (!result.valid) {
                    return { valid: false, error: `Image '${key}': ${result.error}` };
                }
            } else if (value.startsWith('/')) {
                // It's a path, assume it's valid
                continue;
            } else {
                return { valid: false, error: `Image '${key}': Invalid format. Must be URL, path, or base64` };
            }
        } else {
            return { valid: false, error: `Image '${key}': Value must be a string` };
        }
    }

    return { valid: true, error: null };
};

/**
 * Validates language strings object
 * @param {object} langs - Object with translated strings
 * @param {number} maxStringLength - Maximum string length
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateLanguageStrings = (langs, maxStringLength = 1000) => {
    if (!langs || typeof langs !== 'object' || Array.isArray(langs)) {
        return { valid: false, error: 'Language strings must be an object with key-value pairs' };
    }

    const langKeys = Object.keys(langs);
    
    if (langKeys.length === 0) {
        return { valid: false, error: 'At least one language string is required' };
    }

    // Validate each language string
    for (const [key, value] of Object.entries(langs)) {
        if (typeof value !== 'string') {
            return { valid: false, error: `Language '${key}': Value must be a string` };
        }

        if (value.length === 0) {
            return { valid: false, error: `Language '${key}': Value cannot be empty` };
        }

        if (value.length > maxStringLength) {
            return { valid: false, error: `Language '${key}': Too long. Maximum ${maxStringLength} chars, got ${value.length}` };
        }
    }

    return { valid: true, error: null };
};

/**
 * Validates colors object
 * @param {object} colors - Object with color values
 * @param {string} objectName - Name for error messages
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validateColorsObject = (colors, objectName = 'colors') => {
    if (colors === null || colors === undefined) {
        // Colors are optional
        return { valid: true, error: null };
    }

    if (typeof colors !== 'object' || Array.isArray(colors)) {
        return { valid: false, error: `${objectName} must be an object with key-value pairs` };
    }

    // Validate each color
    for (const [key, value] of Object.entries(colors)) {
        if (typeof value !== 'string') {
            return { valid: false, error: `${objectName} '${key}': Value must be a string` };
        }

        if (!validateColor(value)) {
            return { valid: false, error: `${objectName} '${key}': Invalid color format. Use hex (#RGB, #RRGGBB) or RGB(A)` };
        }
    }

    return { valid: true, error: null };
};

/**
 * Validates a list of template IDs against whitelist
 * @param {string} templateId - Template ID to validate
 * @param {string[]} allowedTemplates - List of allowed template IDs
 * @returns {boolean} - True if template is in whitelist
 */
export const validateTemplate = (templateId, allowedTemplates) => {
    if (typeof templateId !== 'string') return false;
    return allowedTemplates.some(t => t.toLowerCase() === templateId.toLowerCase());
};

/**
 * Validates price ID (Stripe price format)
 * @param {string} priceId - Stripe price ID
 * @returns {boolean} - True if valid Stripe price ID format
 */
export const validatePriceId = (priceId) => {
    if (typeof priceId !== 'string') return false;
    // Stripe price IDs start with 'price_'
    return priceId.startsWith('price_') && priceId.length > 10;
};

/**
 * Comprehensive validation for payment session request
 * @param {object} requestBody - Request body to validate
 * @param {string[]} allowedTemplates - List of allowed template IDs
 * @returns {object} - { valid: boolean, error: string|null }
 */
export const validatePaymentSessionRequest = (requestBody, allowedTemplates = []) => {
    if (!requestBody || typeof requestBody !== 'object') {
        return { valid: false, error: 'Request body must be an object' };
    }

    const { email, projectName, images, priceId, langs, textColors, sectionBackgrounds, templateId } = requestBody;

    // Validate email
    if (!email) {
        return { valid: false, error: 'Missing required field: email' };
    }
    if (!validateEmail(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    // Validate project name
    if (!projectName) {
        return { valid: false, error: 'Missing required field: projectName' };
    }
    if (!validateProjectName(projectName)) {
        return { valid: false, error: 'Invalid project name. Must be 3-63 chars, lowercase, alphanumeric and hyphens only' };
    }

    // Validate price ID
    if (!priceId) {
        return { valid: false, error: 'Missing required field: priceId' };
    }
    if (!validatePriceId(priceId)) {
        return { valid: false, error: 'Invalid priceId format' };
    }

    // Validate template ID
    if (!templateId) {
        return { valid: false, error: 'Missing required field: templateId' };
    }
    if (allowedTemplates.length > 0 && !validateTemplate(templateId, allowedTemplates)) {
        return { valid: false, error: `Invalid template. Allowed: ${allowedTemplates.join(', ')}` };
    }

    // Validate images
    const imagesValidation = validateImages(images);
    if (!imagesValidation.valid) {
        return { valid: false, error: imagesValidation.error };
    }

    // Validate language strings
    const langsValidation = validateLanguageStrings(langs);
    if (!langsValidation.valid) {
        return { valid: false, error: langsValidation.error };
    }

    // Validate text colors (optional)
    if (textColors !== undefined && textColors !== null) {
        const textColorsValidation = validateColorsObject(textColors, 'textColors');
        if (!textColorsValidation.valid) {
            return { valid: false, error: textColorsValidation.error };
        }
    }

    // Validate section backgrounds (optional)
    if (sectionBackgrounds !== undefined && sectionBackgrounds !== null) {
        const sectionBgValidation = validateColorsObject(sectionBackgrounds, 'sectionBackgrounds');
        if (!sectionBgValidation.valid) {
            return { valid: false, error: sectionBgValidation.error };
        }
    }

    return { valid: true, error: null };
};
