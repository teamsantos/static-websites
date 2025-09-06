// Base JavaScript utilities shared across the application

// Stars background animation system
class StarsAnimation {
    constructor() {
        this.canvas = document.querySelector('.stars');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.stars = [];
        this.shooting = [];
        this.last = performance.now();

        this.init();
    }

    init() {
        this.resize();
        this.initStars();
        this.tick();
        this.bindEvents();
    }

    resize() {
        this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = Math.floor(this.width * this.dpr);
        this.canvas.height = Math.floor(this.height * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    initStars() {
        const count = Math.max(5, Math.floor((this.width * this.height) / 18000)); // density
        this.stars = Array.from({ length: count }, () => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            r: Math.random() * 1.1 + 0.2,
            a: Math.random() * 0.6 + 0.3,
            tw: Math.random() * 0.02 + 0.005,
            t: Math.random() * Math.PI * 2
        }));
    }

    spawnShootingStar() {
        if (this.shooting.length > 2) return;
        const fromTop = Math.random() < 0.5;
        const startX = fromTop ? Math.random() * this.width * 0.6 : this.width * (0.4 + Math.random() * 0.6);
        const startY = fromTop ? -20 : Math.random() * this.height * 0.5;
        const speed = 600 + Math.random() * 600; // px/s
        const angle = (Math.PI / 4) + Math.random() * (Math.PI / 8); // down-right
        this.shooting.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.6 + Math.random() * 0.6,
            age: 0
        });
    }

    tick(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000);
        this.last = now;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // aurora-friendly dark sky gradient
        const g = this.ctx.createLinearGradient(0, 0, 0, this.height);
        g.addColorStop(0, 'rgba(12, 18, 32, 0.2)');
        g.addColorStop(1, 'rgba(12, 18, 32, 0.6)');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // twinkling stars
        this.ctx.fillStyle = '#ffffff';
        this.stars.forEach(s => {
            s.t += s.tw;
            const alpha = s.a + Math.sin(s.t) * 0.25;
            this.ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // shooting stars
        for (let i = this.shooting.length - 1; i >= 0; i--) {
            const sh = this.shooting[i];
            sh.age += dt;
            if (sh.age > sh.life) { this.shooting.splice(i, 1); continue; }
            const px = sh.x, py = sh.y;
            sh.x += sh.vx * dt; sh.y += sh.vy * dt;
            const trail = 120; // px
            const ang = Math.atan2(sh.vy, sh.vx);
            const tx = Math.cos(ang) * -trail;
            const ty = Math.sin(ang) * -trail;
            const grad = this.ctx.createLinearGradient(px, py, px + tx, py + ty);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(px + tx, py + ty);
            this.ctx.lineTo(px, py);
            this.ctx.stroke();
        }

        // occasionally spawn a shooting star
        if (Math.random() < 0.007) this.spawnShootingStar();

        requestAnimationFrame(this.tick.bind(this));
    }

    bindEvents() {
        const ro = new ResizeObserver(() => { this.resize(); this.initStars(); });
        ro.observe(this.canvas);
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
    new StarsAnimation();

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