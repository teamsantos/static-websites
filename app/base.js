// Base JavaScript utilities shared across the application

// Stars background animation system
class StarsAnimation {
    constructor() {
        this.canvases = document.querySelectorAll('.stars');
        if (!this.canvases.length) return;

        this.canvasInstances = [];
        this.last = performance.now();

        // Initialize each canvas
        this.canvases.forEach((canvas, index) => {
            const instance = {
                canvas: canvas,
                ctx: canvas.getContext('2d'),
                width: 0,
                height: 0,
                dpr: 1,
                stars: [],
                shooting: [],
                index: index
            };
            this.canvasInstances.push(instance);
        });

        this.init();
    }

    init() {
        this.canvasInstances.forEach(instance => {
            this.resize(instance);
            this.initStars(instance);
        });
        this.tick();
        this.bindEvents();
    }

    resize(instance) {
        instance.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = instance.canvas.getBoundingClientRect();
        instance.width = rect.width;
        instance.height = rect.height;
        instance.canvas.width = Math.floor(instance.width * instance.dpr);
        instance.canvas.height = Math.floor(instance.height * instance.dpr);
        instance.ctx.setTransform(instance.dpr, 0, 0, instance.dpr, 0, 0);
    }

    initStars(instance) {
        const count = Math.max(5, Math.floor((instance.width * instance.height) / 18000)); // density
        instance.stars = Array.from({ length: count }, () => ({
            x: Math.random() * instance.width,
            y: Math.random() * instance.height,
            r: Math.random() * 1.1 + 0.2,
            a: Math.random() * 0.6 + 0.3,
            tw: Math.random() * 0.02 + 0.005,
            t: Math.random() * Math.PI * 2
        }));
    }

    spawnShootingStar() {
        // Create shooting star for each canvas instance
        this.canvasInstances.forEach(instance => {
            if (instance.shooting.length > 1) return; // Limit per canvas
            const fromTop = Math.random() < 0.5;
            const startX = fromTop ? Math.random() * instance.width * 0.6 : instance.width * (0.4 + Math.random() * 0.6);
            const startY = fromTop ? -20 : Math.random() * instance.height * 0.5;
            const speed = 600 + Math.random() * 600; // px/s
            const angle = (Math.PI / 4) + Math.random() * (Math.PI / 8); // down-right
            instance.shooting.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.6,
                age: 0
            });
        });
    }

    tick(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000);
        this.last = now;

        // Render each canvas instance
        this.canvasInstances.forEach(instance => {
            const { ctx, width, height, stars, shooting } = instance;

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
        });

        // occasionally spawn a shooting star
        if (Math.random() < 0.007) this.spawnShootingStar();

        requestAnimationFrame(this.tick.bind(this));
    }

    bindEvents() {
        // Create a single ResizeObserver for all canvases
        const ro = new ResizeObserver((entries) => {
            entries.forEach(entry => {
                // Find the corresponding instance
                const instance = this.canvasInstances.find(inst => inst.canvas === entry.target);
                if (instance) {
                    this.resize(instance);
                    this.initStars(instance);
                }
            });
        });

        // Observe all canvases
        this.canvasInstances.forEach(instance => {
            ro.observe(instance.canvas);
        });

        // Check for new canvases periodically (for dynamic content)
        this.checkInterval = setInterval(() => {
            this.checkForNewCanvases();
        }, 1000);
    }

    checkForNewCanvases() {
        const currentCanvases = document.querySelectorAll('.stars');
        const existingCanvases = this.canvasInstances.map(inst => inst.canvas);
        const newCanvases = Array.from(currentCanvases).filter(canvas =>
            !existingCanvases.includes(canvas)
        );

        // Initialize new canvases
        newCanvases.forEach((canvas, index) => {
            const instance = {
                canvas: canvas,
                ctx: canvas.getContext('2d'),
                width: 0,
                height: 0,
                dpr: 1,
                stars: [],
                shooting: [],
                index: this.canvasInstances.length + index
            };

            // Only initialize if canvas is visible and has dimensions
            const rect = canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.canvasInstances.push(instance);
                this.resize(instance);
                this.initStars(instance);

                // Start observing the new canvas
                const ro = new ResizeObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.target === canvas) {
                            this.resize(instance);
                            this.initStars(instance);
                        }
                    });
                });
                ro.observe(canvas);
            }
        });
    }

    // Method to manually reinitialize a specific canvas
    reinitializeCanvas(canvasElement) {
        const instance = this.canvasInstances.find(inst => inst.canvas === canvasElement);
        if (instance) {
            // Force resize and reinitialize
            this.resize(instance);
            this.initStars(instance);
        } else {
            // If not found, it might be a new canvas - check for it
            this.checkForNewCanvases();
        }
    }

    // Cleanup method
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }
}

// Language detection utility
class LanguageDetector {
    static detect() {
        // Check URL for language parameter
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');

        if (langParam && ['en', 'pt'].includes(langParam)) {
            return langParam;
        }

        // Default to English or detect from browser
        return navigator.language.startsWith('pt') ? 'pt' : 'en';
    }
}

// Smooth scroll animation utility
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

// Button ripple effect utility
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

// Reveal on scroll utility
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

// Tilt effects utility
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

// Initialize base utilities when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize stars animation if canvas exists
    window.starsAnimationInstance = new StarsAnimation();

    // Add ripple effects to buttons
    addRippleEffect();

    // Setup reveal on scroll
    setupRevealOnScroll();

    // Setup tilt effects
    setupTiltEffects();
});

// Export utilities for use in other modules
window.StarsAnimation = StarsAnimation;
window.LanguageDetector = LanguageDetector;
window.animateScrollTo = animateScrollTo;
window.addRippleEffect = addRippleEffect;
window.setupRevealOnScroll = setupRevealOnScroll;
window.setupTiltEffects = setupTiltEffects;