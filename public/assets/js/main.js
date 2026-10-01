/**
 * Landing Components Library - Main JavaScript
 * Entry point for all interactive components
 *
 * Modules:
 * - carousel.js    : Carousels and sliders
 * - accordion.js   : Collapsible accordions
 * - tabs.js        : Tab navigation
 * - modal.js       : Modal dialogs
 * - countdown.js   : Countdown timers
 * - forms.js       : Form validation and enhancement
 * - mobile-menu.js : Mobile navigation
 *
 * Usage:
 * Include all JS files before closing </body>:
 *   <script src="assets/js/carousel.js"></script>
 *   <script src="assets/js/accordion.js"></script>
 *   <script src="assets/js/tabs.js"></script>
 *   <script src="assets/js/modal.js"></script>
 *   <script src="assets/js/countdown.js"></script>
 *   <script src="assets/js/forms.js"></script>
 *   <script src="assets/js/mobile-menu.js"></script>
 *   <script src="assets/js/main.js"></script>
 */

(function() {
    'use strict';

    // ==========================================================================
    // Utility Functions
    // ==========================================================================

    /**
     * Debounce function to limit execution rate
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function to limit execution to once per interval
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==========================================================================
    // Smooth Scroll
    // ==========================================================================

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#' || targetId === '#!') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Update URL without scroll
                    history.pushState(null, null, targetId);
                }
            });
        });
    }

    // ==========================================================================
    // Sticky Header
    // ==========================================================================

    function initStickyHeader() {
        const header = document.querySelector('[data-sticky-header]');
        if (!header) return;

        const threshold = parseInt(header.getAttribute('data-sticky-threshold') || '100');

        function handleScroll() {
            if (window.scrollY > threshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', throttle(handleScroll, 100), { passive: true });
        handleScroll();
    }

    // ==========================================================================
    // Dropdown Menus
    // ==========================================================================

    function initDropdowns() {
        const dropdowns = document.querySelectorAll('[data-dropdown]');

        dropdowns.forEach(dropdown => {
            const trigger = dropdown.querySelector('[data-dropdown-trigger]');
            const menu = dropdown.querySelector('[data-dropdown-menu]');

            if (!trigger || !menu) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menu.classList.contains('open');

                // Close all other dropdowns
                document.querySelectorAll('[data-dropdown-menu].open').forEach(m => {
                    if (m !== menu) m.classList.remove('open');
                });

                menu.classList.toggle('open', !isOpen);
                trigger.setAttribute('aria-expanded', !isOpen);
            });

            // Keyboard support
            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    trigger.click();
                }
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('[data-dropdown-menu].open').forEach(menu => {
                menu.classList.remove('open');
            });
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('[data-dropdown-menu].open').forEach(menu => {
                    menu.classList.remove('open');
                });
            }
        });
    }

    // ==========================================================================
    // Copy to Clipboard
    // ==========================================================================

    function initCopyToClipboard() {
        document.querySelectorAll('[data-copy]').forEach(button => {
            button.addEventListener('click', async () => {
                const text = button.getAttribute('data-copy');
                const targetId = button.getAttribute('data-copy-target');
                const copyText = targetId ?
                    document.getElementById(targetId)?.value || document.getElementById(targetId)?.textContent :
                    text;

                if (!copyText) return;

                try {
                    await navigator.clipboard.writeText(copyText);

                    const originalText = button.textContent;
                    const originalHtml = button.innerHTML;

                    button.textContent = 'Copied!';
                    button.classList.add('copied');

                    setTimeout(() => {
                        button.innerHTML = originalHtml;
                        button.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            });
        });
    }

    // ==========================================================================
    // Toast Notifications
    // ==========================================================================

    window.showToast = function(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'px-4 py-3 rounded-lg shadow-lg text-white transform translate-x-full transition-transform duration-300';

        const bgColors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500'
        };

        toast.classList.add(bgColors[type] || bgColors.info);
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full');
            toast.classList.add('translate-x-0');
        });

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('translate-x-0');
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // ==========================================================================
    // Scroll Animations (Intersection Observer)
    // ==========================================================================

    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('[data-animate]');

        if (animatedElements.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const animation = entry.target.getAttribute('data-animate');
                    const delay = entry.target.getAttribute('data-animate-delay') || '0';

                    setTimeout(() => {
                        entry.target.classList.add(`animate-${animation}`);
                        entry.target.style.opacity = '1';
                    }, parseInt(delay));

                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        animatedElements.forEach(el => {
            el.style.opacity = '0';
            observer.observe(el);
        });
    }

    // ==========================================================================
    // Lazy Loading Images
    // ==========================================================================

    function initLazyLoading() {
        const lazyImages = document.querySelectorAll('[data-lazy-src]');

        if (lazyImages.length === 0) return;

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.getAttribute('data-lazy-src');
                        img.removeAttribute('data-lazy-src');
                        img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px'
            });

            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            lazyImages.forEach(img => {
                img.src = img.getAttribute('data-lazy-src');
            });
        }
    }

    // ==========================================================================
    // Back to Top Button
    // ==========================================================================

    function initBackToTop() {
        const button = document.querySelector('[data-back-to-top]');
        if (!button) return;

        const threshold = parseInt(button.getAttribute('data-show-at') || '300');

        function handleScroll() {
            if (window.scrollY > threshold) {
                button.classList.add('visible');
                button.classList.remove('hidden');
            } else {
                button.classList.remove('visible');
                button.classList.add('hidden');
            }
        }

        button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        window.addEventListener('scroll', throttle(handleScroll, 100), { passive: true });
        handleScroll();
    }

    // ==========================================================================
    // Video Play Button
    // ==========================================================================

    function initVideoPlayButtons() {
        document.querySelectorAll('[data-video-play]').forEach(button => {
            button.addEventListener('click', () => {
                const videoId = button.getAttribute('data-video-play');
                const video = document.getElementById(videoId);

                if (video) {
                    if (video.paused) {
                        video.play();
                        button.classList.add('playing');
                    } else {
                        video.pause();
                        button.classList.remove('playing');
                    }
                }
            });
        });
    }

    // ==========================================================================
    // Initialize All Components
    // ==========================================================================

    function init() {
        // Core functionality
        initSmoothScroll();
        initStickyHeader();
        initDropdowns();
        initCopyToClipboard();
        initScrollAnimations();
        initLazyLoading();
        initBackToTop();
        initVideoPlayButtons();

        // Initialize module components if loaded
        // These will auto-init if their scripts are included,
        // but we call them here for manual initialization
        if (typeof window.initCarousels === 'function') {
            window.initCarousels();
        }
        if (typeof window.initAccordions === 'function') {
            window.initAccordions();
        }
        if (typeof window.initTabs === 'function') {
            window.initTabs();
        }
        if (typeof window.initModals === 'function') {
            window.initModals();
        }
        if (typeof window.initCountdowns === 'function') {
            window.initCountdowns();
        }
        if (typeof window.initForms === 'function') {
            window.initForms();
        }
        if (typeof window.initMobileMenus === 'function') {
            window.initMobileMenus();
        }

        console.log('Landing Components Library initialized');
    }

    // ==========================================================================
    // Export Utilities
    // ==========================================================================

    window.LCL = {
        debounce,
        throttle,
        showToast: window.showToast,
        init
    };

    // ==========================================================================
    // Run Initialization
    // ==========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
