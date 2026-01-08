// ============================================================================
// Mobile Menu Toggle
// ============================================================================

const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const menuIcon = document.getElementById('menu-icon');
const closeIcon = document.getElementById('close-icon');

mobileMenuToggle.addEventListener('click', () => {
    const isOpen = !mobileMenu.classList.contains('hidden');
    
    if (isOpen) {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
    } else {
        mobileMenu.classList.remove('hidden');
        menuIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
    }
});

// Close menu when a link is clicked
const mobileMenuLinks = mobileMenu.querySelectorAll('a');
mobileMenuLinks.forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
    });
});

// ============================================================================
// Testimonials Carousel
// ============================================================================

const testimonials = [
    {
        quote: "The best coffee I've ever had. Brewstone has completely changed my morning ritual.",
        author: "Sarah M.",
        role: "Regular since 2019",
    },
    {
        quote: "Not just great coffee — the atmosphere makes you want to stay for hours. It's my second home.",
        author: "James K.",
        role: "Local Writer",
    },
    {
        quote: "Their lavender honey latte is absolutely divine. I drive 30 minutes just for it.",
        author: "Elena R.",
        role: "Coffee Enthusiast",
    },
];

let currentTestimonial = 0;

const testimonialContent = document.querySelector('#testimonial-content p');
const testimonialAuthor = document.getElementById('testimonial-author');
const testimonialRole = document.getElementById('testimonial-role');
const testimonialDots = document.getElementById('testimonial-dots');
const prevButton = document.getElementById('prev-testimonial');
const nextButton = document.getElementById('next-testimonial');

// Create dots for testimonials
function createDots() {
    testimonialDots.innerHTML = '';
    testimonials.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = `w-2 h-2 rounded-full transition-colors ${
            index === currentTestimonial ? 'bg-accent' : 'bg-border'
        }`;
        dot.setAttribute('aria-label', `Go to testimonial ${index + 1}`);
        dot.addEventListener('click', () => setTestimonial(index));
        testimonialDots.appendChild(dot);
    });
}

// Set testimonial content
function setTestimonial(index) {
    currentTestimonial = index;
    const testimonial = testimonials[index];
    
    testimonialContent.textContent = `"${testimonial.quote}"`;
    testimonialAuthor.textContent = testimonial.author;
    testimonialRole.textContent = testimonial.role;
    
    createDots();
}

// Navigation buttons
prevButton.addEventListener('click', () => {
    currentTestimonial = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
    setTestimonial(currentTestimonial);
});

nextButton.addEventListener('click', () => {
    currentTestimonial = (currentTestimonial + 1) % testimonials.length;
    setTestimonial(currentTestimonial);
});

// Initialize testimonials
setTestimonial(0);

// ============================================================================
// Year in Footer
// ============================================================================

document.getElementById('year').textContent = new Date().getFullYear();

// ============================================================================
// Smooth Scroll Enhancement
// ============================================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============================================================================
// Contact Form
// ============================================================================

const contactForm = document.querySelector('#contact form');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = contactForm.querySelector('input[type="email"]');
        
        if (emailInput.value) {
            // Simple validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(emailInput.value)) {
                // Simulate form submission
                const button = contactForm.querySelector('button');
                const originalText = button.textContent;
                button.textContent = 'Subscribed!';
                button.disabled = true;
                
                setTimeout(() => {
                    emailInput.value = '';
                    button.textContent = originalText;
                    button.disabled = false;
                }, 2000);
            } else {
                alert('Please enter a valid email address');
            }
        }
    });
}

// ============================================================================
// Intersection Observer for Animations
// ============================================================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for fade-in animation
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(section);
});

// ============================================================================
// Header scroll effect
// ============================================================================

const header = document.querySelector('header');
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    
    // Add slight transparency effect when scrolling
    if (currentScroll > 10) {
        header.style.borderBottomColor = 'var(--border)';
    } else {
        header.style.borderBottomColor = 'transparent';
    }
    
    lastScrollTop = currentScroll;
});

// ============================================================================
// Image lazy loading (optional enhancement)
// ============================================================================

if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    observer.unobserve(img);
                }
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}
