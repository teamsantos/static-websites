/**
 * Contact Form Handler
 * 
 * This module handles contact form submissions for generated websites.
 * It sends form data to the API endpoint and displays appropriate feedback.
 * 
 * Usage:
 * 1. Include this script in your HTML
 * 2. Add a form with id="contact-form" or class="contact-form"
 * 3. Form fields should have name attributes: name, email, message
 * 4. The projectName is extracted from the current hostname
 */

(function() {
    'use strict';

    // Configuration
    const API_ENDPOINT = 'https://api.e-info.click/contact';
    
    // Extract project name from hostname (e.g., "myproject.e-info.click" -> "myproject")
    function getProjectName() {
        const hostname = window.location.hostname;
        // Handle localhost/dev environments
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Try to get from URL param or use a default
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('project') || 'test-project';
        }
        // Extract subdomain from e-info.click domain
        const match = hostname.match(/^([^.]+)\.e-info\.click$/);
        if (match) {
            return match[1];
        }
        // Fallback: use first part of hostname
        return hostname.split('.')[0];
    }

    // Validate email format
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Show success message
    function showSuccess(form, message) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        const originalText = submitBtn.textContent || submitBtn.value;
        
        // Update button
        if (submitBtn.tagName === 'BUTTON') {
            submitBtn.textContent = message || 'Message Sent!';
        } else {
            submitBtn.value = message || 'Message Sent!';
        }
        submitBtn.disabled = true;
        submitBtn.classList.add('success');
        
        // Reset after delay
        setTimeout(() => {
            form.reset();
            if (submitBtn.tagName === 'BUTTON') {
                submitBtn.textContent = originalText;
            } else {
                submitBtn.value = originalText;
            }
            submitBtn.disabled = false;
            submitBtn.classList.remove('success');
        }, 3000);
    }

    // Show error message
    function showError(form, message) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        const originalText = submitBtn.textContent || submitBtn.value;
        
        // Update button
        if (submitBtn.tagName === 'BUTTON') {
            submitBtn.textContent = message || 'Error - Try Again';
        } else {
            submitBtn.value = message || 'Error - Try Again';
        }
        submitBtn.classList.add('error');
        
        // Reset after delay
        setTimeout(() => {
            if (submitBtn.tagName === 'BUTTON') {
                submitBtn.textContent = originalText;
            } else {
                submitBtn.value = originalText;
            }
            submitBtn.classList.remove('error');
        }, 3000);
    }

    // Set loading state
    function setLoading(form, isLoading) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            submitBtn.dataset.originalText = submitBtn.textContent || submitBtn.value;
            if (submitBtn.tagName === 'BUTTON') {
                submitBtn.textContent = 'Sending...';
            } else {
                submitBtn.value = 'Sending...';
            }
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
        }
    }

    // Handle form submission
    async function handleSubmit(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Get form values
        const name = formData.get('name')?.toString().trim();
        const email = formData.get('email')?.toString().trim();
        const message = formData.get('message')?.toString().trim();
        
        // Validate
        if (!name || !email || !message) {
            showError(form, 'Please fill all fields');
            return;
        }
        
        if (!isValidEmail(email)) {
            showError(form, 'Invalid email address');
            return;
        }
        
        // Get project name
        const projectName = getProjectName();
        
        // Prepare payload
        const payload = {
            projectName,
            name,
            email,
            message
        };
        
        setLoading(form, true);
        
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccess(form, data.message || 'Message sent successfully!');
            } else {
                showError(form, data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Contact form error:', error);
            showError(form, 'Network error - please try again');
        } finally {
            setLoading(form, false);
        }
    }

    // Initialize contact forms
    function init() {
        // Find all contact forms
        const forms = document.querySelectorAll('#contact-form, .contact-form, form[data-contact-form]');
        
        forms.forEach(form => {
            // Prevent double initialization
            if (form.dataset.contactFormInitialized) return;
            form.dataset.contactFormInitialized = 'true';
            
            form.addEventListener('submit', handleSubmit);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also observe for dynamically added forms
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Check if the node itself is a contact form
                        if (node.matches && node.matches('#contact-form, .contact-form, form[data-contact-form]')) {
                            if (!node.dataset.contactFormInitialized) {
                                node.dataset.contactFormInitialized = 'true';
                                node.addEventListener('submit', handleSubmit);
                            }
                        }
                        // Check for contact forms within the added node
                        const forms = node.querySelectorAll && node.querySelectorAll('#contact-form, .contact-form, form[data-contact-form]');
                        if (forms) {
                            forms.forEach(form => {
                                if (!form.dataset.contactFormInitialized) {
                                    form.dataset.contactFormInitialized = 'true';
                                    form.addEventListener('submit', handleSubmit);
                                }
                            });
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Expose API for manual use
    window.ContactForm = {
        submit: handleSubmit,
        init: init,
        getProjectName: getProjectName
    };
})();
