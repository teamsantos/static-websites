// Carousel System for Template Images
// Handles carousel functionality for templates with multiple images

class CarouselSystem {
    constructor(container, config) {
        this.container = container;
        this.config = config;
        this.currentIndex = 0;
        this.autoplayInterval = null;
        this.init();
    }

    init() {
        this.createCarouselStructure();
        this.loadImages();
        this.createControls();
        this.bindEvents();

        if (this.config.autoplay) {
            this.startAutoplay();
        }
    }

    createCarouselStructure() {
        this.container.className = 'carousel-container';

        // Create carousel inner container
        this.carouselInner = document.createElement('div');
        this.carouselInner.className = 'carousel-inner';

        // Create carousel items container
        this.carouselItems = document.createElement('div');
        this.carouselItems.className = 'carousel-items';

        this.carouselInner.appendChild(this.carouselItems);
        this.container.appendChild(this.carouselInner);
    }

    loadImages() {
        if (!this.config.images || !Array.isArray(this.config.images)) {
            console.error('No images array found in carousel config');
            return;
        }

        this.config.images.forEach((imageData, index) => {
            const item = document.createElement('div');
            item.className = 'carousel-item';

            const img = document.createElement('img');
            img.src = imageData.src;
            img.alt = imageData.alt || `Carousel image ${index + 1}`;

            img.onerror = () => {
                if (imageData.fallback) {
                    img.src = imageData.fallback;
                }
            };

            item.appendChild(img);
            this.carouselItems.appendChild(item);
        });

        this.updateCarouselPosition();
    }

    createControls() {
        // Create dots navigation
        if (this.config.showDots !== false) {
            this.dotsContainer = document.createElement('div');
            this.dotsContainer.className = 'carousel-dots';

            this.config.images.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
                dot.setAttribute('data-index', index);
                this.dotsContainer.appendChild(dot);
            });

            this.carouselInner.appendChild(this.dotsContainer);
        }

        // Create arrow navigation
        if (this.config.showArrows !== false) {
            this.prevButton = document.createElement('button');
            this.prevButton.className = 'carousel-arrow carousel-prev';
            this.prevButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M15 18l-6-6 6-6"/>
                </svg>
            `;

            this.nextButton = document.createElement('button');
            this.nextButton.className = 'carousel-arrow carousel-next';
            this.nextButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
            `;

            this.carouselInner.appendChild(this.prevButton);
            this.carouselInner.appendChild(this.nextButton);
        }
    }

    bindEvents() {
        // Arrow navigation
        if (this.prevButton) {
            this.prevButton.addEventListener('click', () => this.prev());
        }

        if (this.nextButton) {
            this.nextButton.addEventListener('click', () => this.next());
        }

        // Dot navigation
        if (this.dotsContainer) {
            this.dotsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('carousel-dot')) {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    this.goTo(index);
                }
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prev();
            } else if (e.key === 'ArrowRight') {
                this.next();
            }
        });

        // Pause autoplay on hover
        this.container.addEventListener('mouseenter', () => {
            if (this.autoplayInterval) {
                this.stopAutoplay();
            }
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.config.autoplay) {
                this.startAutoplay();
            }
        });

        // Touch/swipe support
        this.bindTouchEvents();
    }

    bindTouchEvents() {
        let startX = 0;
        let endX = 0;

        this.container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });

        this.container.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            const diff = startX - endX;

            if (Math.abs(diff) > 50) { // Minimum swipe distance
                if (diff > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
        });
    }

    next() {
        this.goTo((this.currentIndex + 1) % this.config.images.length);
    }

    prev() {
        this.goTo((this.currentIndex - 1 + this.config.images.length) % this.config.images.length);
    }

    goTo(index) {
        this.currentIndex = index;
        this.updateCarouselPosition();
        this.updateDots();
    }

    updateCarouselPosition() {
        const translateX = -this.currentIndex * 100;
        this.carouselItems.style.transform = `translateX(${translateX}%)`;
    }

    updateDots() {
        if (!this.dotsContainer) return;

        const dots = this.dotsContainer.querySelectorAll('.carousel-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });
    }

    startAutoplay() {
        if (this.autoplayInterval) return;

        this.autoplayInterval = setInterval(() => {
            this.next();
        }, this.config.interval || 5000);
    }

    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
    }

    destroy() {
        this.stopAutoplay();

        // Remove event listeners
        document.removeEventListener('keydown', this.keydownHandler);

        // Remove carousel elements
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Make CarouselSystem globally available
window.CarouselSystem = CarouselSystem;

// Export for ES6 modules
export default CarouselSystem;