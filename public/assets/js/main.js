/**
 * Main entry point (ES module). Loaded after config.js, which defines
 * window.SITE_CONFIG.
 *
 * - applySiteConfig: fills contact links/text from the config
 * - header, mobile menu, testimonials carousel, scroll reveal
 * - consult-type preselection for CTAs that point at the contact form
 * - forms: delegated to forms.js
 *
 * Nothing touches the DOM at import time, so applySiteConfig can be unit tested.
 */
import { CONSULT_TYPES, initForms, normalizePhone, whatsappLink } from './forms.js';

const FALLBACK_HREF = '#contacto';
const DEFAULT_WA_TEXT = 'Hola Claudia, quiero más información';
const BOOKING_WA_TEXT = 'Hola Claudia, quiero agendar mi sesión gratuita';

// data-link / data-hide-if-empty keys -> config field.
const CONFIG_FIELD = {
  whatsapp: 'whatsappNumber',
  email: 'email',
  instagram: 'instagramUrl',
  facebook: 'facebookUrl',
  linkedin: 'linkedinUrl',
};

// ============================================================================
// Config-driven links
// ============================================================================

function resolveLink(kind, config, el) {
  switch (kind) {
    case 'whatsapp':
      return whatsappLink(config.whatsappNumber, el.dataset.waText || DEFAULT_WA_TEXT);
    case 'email':
      return config.email ? `mailto:${config.email}` : null;
    case 'booking':
      return config.bookingUrl || whatsappLink(config.whatsappNumber, BOOKING_WA_TEXT);
    default:
      return config[CONFIG_FIELD[kind]] || null;
  }
}

function resolveText(kind, config) {
  switch (kind) {
    case 'email':
      return config.email || null;
    case 'whatsapp': {
      const digits = normalizePhone(config.whatsappNumber);
      return digits ? `+${digits}` : null;
    }
    case 'instagram': {
      const handle = String(config.instagramUrl ?? '')
        .split(/[?#]/)[0]
        .split('/')
        .filter(Boolean)
        .pop();
      return config.instagramUrl && handle ? `@${handle}` : null;
    }
    default:
      return null;
  }
}

function isConfigured(key, config) {
  if (key === 'booking') return Boolean(config.bookingUrl || config.whatsappNumber);
  return Boolean(config[CONFIG_FIELD[key]]);
}

function hide(el) {
  el.hidden = true;
  el.style.display = 'none';
}

function show(el) {
  el.hidden = false;
  el.style.display = '';
}

export function applySiteConfig(config = {}, root = document) {
  for (const el of root.querySelectorAll('[data-link]')) {
    const href = resolveLink(el.dataset.link, config, el) || FALLBACK_HREF;
    el.setAttribute('href', href);
    if (/^https?:/.test(href)) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
  }

  for (const el of root.querySelectorAll('[data-config-text]')) {
    const value = resolveText(el.dataset.configText, config);
    if (value) el.textContent = value;
  }

  for (const el of root.querySelectorAll('[data-hide-if-empty]')) {
    const key = el.dataset.hideIfEmpty || el.dataset.link;
    if (key && !isConfigured(key, config)) hide(el);
  }

  // The testimonials ship hidden. They appear only when enabled in the config
  // AND the carousel actually has slides, so an empty section never renders.
  const track = root.querySelectorAll('#testimonials-track')[0];
  const showTestimonials = Boolean(config.showTestimonials) && Boolean(track?.children?.length);
  for (const el of root.querySelectorAll('#testimonios, [href="#testimonios"]')) {
    if (showTestimonials) show(el);
    else hide(el);
  }
}

// ============================================================================
// Contact form: preselect the consult type from a CTA
// ============================================================================

/** Sets the contact select to a known consult type. Returns whether it changed. */
export function selectConsultType(type, root = document) {
  const select = root.querySelector('#contact-type');
  if (!select || !Object.hasOwn(CONSULT_TYPES, type)) return false;
  select.value = type;
  return true;
}

/** Links with data-consult-type="..." keep their #contacto href and also preselect the type. */
export function initConsultTypeLinks(root = document) {
  for (const link of root.querySelectorAll('[data-consult-type]')) {
    link.addEventListener('click', () => selectConsultType(link.dataset.consultType, root));
  }
}

// ============================================================================
// Header: shadow once the page is scrolled
// ============================================================================

function initHeader() {
  const header = document.querySelector('[data-sticky-header]');
  if (!header) return;
  const threshold = Number(header.dataset.stickyThreshold) || 50;
  let ticking = false;

  const update = () => {
    const scrolled = window.scrollY > threshold;
    header.classList.toggle('shadow-md', scrolled);
    header.classList.toggle('bg-white', scrolled);
    header.classList.toggle('bg-white/95', !scrolled);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

// ============================================================================
// Mobile menu
// ============================================================================

function initMobileMenu() {
  const button = document.getElementById('mobile-menu-button');
  const menu = document.getElementById('mobile-menu');
  if (!button || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(menu.classList.contains('hidden')));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
      setOpen(false);
      button.focus();
    }
  });
}

// ============================================================================
// Testimonials carousel
// ============================================================================

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function visibleSlides() {
  if (window.innerWidth >= 1024) return 3;
  if (window.innerWidth >= 768) return 2;
  return 1;
}

function initCarousel() {
  const track = document.getElementById('testimonials-track');
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  const container = track?.closest('[data-carousel]');
  if (!track || !prev || !next || !container) return;

  const total = track.children.length;
  const interval = Number(container.dataset.carouselInterval) || 5000;
  const autoplayWanted = container.dataset.carouselAutoplay === 'true' && !reducedMotion();
  let index = 0;
  let timer = null;

  const maxIndex = () => Math.max(0, total - visibleSlides());
  const render = () => {
    index = Math.min(index, maxIndex());
    track.style.transform = `translateX(-${(index * 100) / visibleSlides()}%)`;
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    track.setAttribute('aria-live', 'polite');
  };
  const start = () => {
    if (!autoplayWanted || timer) return;
    track.setAttribute('aria-live', 'off');
    timer = setInterval(() => {
      index = index >= maxIndex() ? 0 : index + 1;
      render();
    }, interval);
  };

  prev.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    render();
  });
  next.addEventListener('click', () => {
    index = Math.min(maxIndex(), index + 1);
    render();
  });
  window.addEventListener('resize', render);

  // Pause while the user hovers or focuses anything inside the carousel.
  container.addEventListener('mouseenter', stop);
  container.addEventListener('mouseleave', start);
  container.addEventListener('focusin', stop);
  container.addEventListener('focusout', (e) => {
    if (!container.contains(e.relatedTarget)) start();
  });

  render();
  start();
}

// ============================================================================
// Scroll reveal
// ============================================================================

// CSS hides `.js [data-animate]:not([data-revealed])`; setting the attribute shows it.
// Two failsafes keep content from staying hidden:
//  - JS: after REVEAL_FAILSAFE_MS everything still hidden is shown WITHOUT animating.
//  - CSS: a slightly later animation in input.css, only for the case where this script never runs.
// Once an element carries data-revealed it never animates again, so neither failsafe can cause a flash.
export const REVEAL_FAILSAFE_MS = 4000;

/** Shows and animates an element, unless it is already visible. Returns whether it animated. */
export function playReveal(el) {
  if (el.hasAttribute('data-revealed')) return false;
  el.setAttribute('data-revealed', '');
  el.classList.add(`animate-${el.dataset.animate}`);
  return true;
}

/** Shows every element that is still hidden, without animation. Returns how many were revealed. */
export function revealRemaining(items) {
  let count = 0;
  for (const el of items) {
    if (el.hasAttribute('data-revealed')) continue;
    el.setAttribute('data-revealed', '');
    count++;
  }
  return count;
}

function initScrollReveal() {
  const items = document.querySelectorAll('[data-animate]');
  if (!items.length) return;

  if (reducedMotion() || !('IntersectionObserver' in window)) {
    revealRemaining(items);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        setTimeout(() => playReveal(el), Number(el.dataset.animateDelay) || 0);
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );
  items.forEach((el) => observer.observe(el));

  setTimeout(() => {
    revealRemaining(items);
    observer.disconnect();
  }, REVEAL_FAILSAFE_MS);
}

// ============================================================================
// Init
// ============================================================================

function init() {
  const config = globalThis.SITE_CONFIG ?? {};
  // Each step is isolated so one failure cannot stop the rest (or leave content hidden).
  for (const step of [
    () => applySiteConfig(config, document),
    initHeader,
    initMobileMenu,
    () => initConsultTypeLinks(document),
    initCarousel,
    initScrollReveal,
    () => initForms(document, config),
  ]) {
    try {
      step();
    } catch (error) {
      console.error(error);
    }
  }
}

if (typeof document !== 'undefined') init();
