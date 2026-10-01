import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySiteConfig, playReveal, revealRemaining, REVEAL_FAILSAFE_MS } from '../public/assets/js/main.js';
import { FakeElement } from './helpers/fake-dom.mjs';

// Tiny DOM stand-in: just enough for the selectors applySiteConfig uses.
function el({ id, href, dataset = {}, text = '' } = {}) {
  const attrs = {};
  if (id) attrs.id = id;
  if (href !== undefined) attrs.href = href;
  return {
    dataset,
    attrs,
    style: {},
    hidden: false,
    textContent: text,
    setAttribute(k, v) {
      attrs[k] = String(v);
    },
    removeAttribute(k) {
      delete attrs[k];
    },
    getAttribute(k) {
      return k in attrs ? attrs[k] : null;
    },
  };
}

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function matches(node, selector) {
  return selector.split(',').some((part) => {
    const sel = part.trim();
    let m;
    if ((m = sel.match(/^\[data-([\w-]+)\]$/))) return camel(m[1]) in node.dataset;
    if ((m = sel.match(/^\[([\w-]+)="([^"]*)"\]$/))) return node.attrs[m[1]] === m[2];
    if ((m = sel.match(/^#([\w-]+)$/))) return node.attrs.id === m[1];
    throw new Error(`fake DOM does not support selector: ${sel}`);
  });
}

const fakeRoot = (nodes) => ({ querySelectorAll: (sel) => nodes.filter((n) => matches(n, sel)) });

const EMPTY = {
  whatsappNumber: '',
  email: '',
  instagramUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  web3formsKey: '',
  bookingUrl: '',
  showTestimonials: false,
};

test('whatsapp links use the number and the per-element text', () => {
  const a = el({ href: '#contacto', dataset: { link: 'whatsapp', waText: 'Hola, quiero agendar' } });
  const b = el({ href: '#contacto', dataset: { link: 'whatsapp' } });
  applySiteConfig({ ...EMPTY, whatsappNumber: '5491123456789' }, fakeRoot([a, b]));
  assert.equal(a.attrs.href, 'https://wa.me/5491123456789?text=' + encodeURIComponent('Hola, quiero agendar'));
  assert.equal(b.attrs.href, 'https://wa.me/5491123456789?text=' + encodeURIComponent('Hola Claudia, quiero más información'));
  assert.equal(a.attrs.target, '_blank');
  assert.match(a.attrs.rel, /noopener/);
});

test('empty config keeps the #contacto fallback and does not open a new tab', () => {
  const a = el({ href: '#contacto', dataset: { link: 'whatsapp' } });
  a.setAttribute('target', '_blank');
  applySiteConfig(EMPTY, fakeRoot([a]));
  assert.equal(a.attrs.href, '#contacto');
  assert.equal(a.attrs.target, undefined);
});

test('email, instagram, facebook and linkedin links are filled from config', () => {
  const nodes = ['email', 'instagram', 'facebook', 'linkedin'].map((link) => el({ href: '#contacto', dataset: { link } }));
  applySiteConfig(
    {
      ...EMPTY,
      email: 'hola@example.com',
      instagramUrl: 'https://instagram.com/claudia',
      facebookUrl: 'https://facebook.com/claudia',
      linkedinUrl: 'https://linkedin.com/in/claudia',
    },
    fakeRoot(nodes)
  );
  assert.deepEqual(
    nodes.map((n) => n.attrs.href),
    ['mailto:hola@example.com', 'https://instagram.com/claudia', 'https://facebook.com/claudia', 'https://linkedin.com/in/claudia']
  );
});

test('text targets show email, phone and instagram handle', () => {
  const email = el({ text: 'Escríbeme', dataset: { configText: 'email' } });
  const wa = el({ text: 'Escríbeme', dataset: { configText: 'whatsapp' } });
  const ig = el({ text: 'Instagram', dataset: { configText: 'instagram' } });
  applySiteConfig(
    { ...EMPTY, email: 'hola@example.com', whatsappNumber: '5491123456789', instagramUrl: 'https://instagram.com/claudia.samudio/?hl=es' },
    fakeRoot([email, wa, ig])
  );
  assert.equal(email.textContent, 'hola@example.com');
  assert.equal(wa.textContent, '+5491123456789');
  assert.equal(ig.textContent, '@claudia.samudio');
});

test('text targets keep their fallback text when the value is empty', () => {
  const email = el({ text: 'Escríbeme', dataset: { configText: 'email' } });
  applySiteConfig(EMPTY, fakeRoot([email]));
  assert.equal(email.textContent, 'Escríbeme');
});

test('data-hide-if-empty hides elements whose value is not configured', () => {
  const emailRow = el({ dataset: { hideIfEmpty: 'email' } });
  const igLink = el({ href: '#contacto', dataset: { link: 'instagram', hideIfEmpty: '' } });
  const waLink = el({ href: '#contacto', dataset: { link: 'whatsapp', hideIfEmpty: '' } });
  const plain = el({ dataset: { link: 'facebook' } });
  applySiteConfig({ ...EMPTY, email: 'hola@example.com', whatsappNumber: '5491123456789' }, fakeRoot([emailRow, igLink, waLink, plain]));
  assert.equal(emailRow.style.display, undefined);
  assert.equal(waLink.style.display, undefined);
  assert.equal(igLink.style.display, 'none');
  assert.equal(igLink.hidden, true);
  assert.equal(plain.style.display, undefined, 'elements without data-hide-if-empty are never hidden');
});

test('booking link prefers bookingUrl, then WhatsApp, then #contacto', () => {
  const make = () => el({ href: '#agenda', dataset: { link: 'booking' } });

  let a = make();
  applySiteConfig({ ...EMPTY, bookingUrl: 'https://cal.com/claudia', whatsappNumber: '5491123456789' }, fakeRoot([a]));
  assert.equal(a.attrs.href, 'https://cal.com/claudia');

  a = make();
  applySiteConfig({ ...EMPTY, whatsappNumber: '5491123456789' }, fakeRoot([a]));
  assert.equal(a.attrs.href, 'https://wa.me/5491123456789?text=' + encodeURIComponent('Hola Claudia, quiero agendar mi sesión gratuita'));

  a = make();
  applySiteConfig(EMPTY, fakeRoot([a]));
  assert.equal(a.attrs.href, '#contacto');
});

test('showTestimonials=false hides the section and its nav links', () => {
  const section = el({ id: 'testimonios' });
  const nav = el({ href: '#testimonios' });
  const other = el({ href: '#servicios' });
  applySiteConfig({ ...EMPTY, showTestimonials: false }, fakeRoot([section, nav, other]));
  assert.equal(section.style.display, 'none');
  assert.equal(nav.style.display, 'none');
  assert.equal(other.style.display, undefined);
});

test('showTestimonials=true leaves them visible', () => {
  const section = el({ id: 'testimonios' });
  applySiteConfig({ ...EMPTY, showTestimonials: true }, fakeRoot([section]));
  assert.equal(section.style.display, undefined);
});

test('whatsapp text shows the normalized digits of a formatted number', () => {
  const wa = el({ text: 'Escribime', dataset: { configText: 'whatsapp' } });
  applySiteConfig({ ...EMPTY, whatsappNumber: '+54 9 11 2345-6789' }, fakeRoot([wa]));
  assert.equal(wa.textContent, '+5491123456789');
});

test('main.js reuses forms.js normalizePhone instead of its own digit stripping', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public/assets/js/main.js'), 'utf8');
  assert.match(source, /normalizePhone/);
  assert.ok(!/replace\(\/\\D\/g/.test(source), 'duplicate phone normalizer found');
});

// --- scroll reveal -----------------------------------------------------------

const animated = (kind = 'fade-in') => {
  const node = new FakeElement('div');
  node.dataset.animate = kind;
  return node;
};

test('playReveal shows and animates an element that is still hidden', () => {
  const node = animated('slide-up');
  assert.equal(playReveal(node), true);
  assert.ok(node.hasAttribute('data-revealed'));
  assert.ok(node.classList.contains('animate-slide-up'));
});

test('playReveal never restarts the animation of an element already shown by the failsafe', () => {
  const nodes = [animated(), animated('slide-up')];
  assert.equal(revealRemaining(nodes), 2);
  for (const node of nodes) {
    assert.equal(playReveal(node), false);
    assert.ok(!node.className.includes('animate-'), 'no animation class after the failsafe');
  }
});

test('revealRemaining only touches elements that are still hidden', () => {
  const shown = animated();
  playReveal(shown);
  const hidden = animated();
  assert.equal(revealRemaining([shown, hidden]), 1);
  assert.ok(hidden.hasAttribute('data-revealed'));
  assert.ok(!hidden.className.includes('animate-'), 'failsafe reveals without animating');
});

test('the JS failsafe fires before the CSS one, which only covers a dead script', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public/assets/css/output.css'), 'utf8');
  const cssDelay = Number(css.match(/animation:\s*reveal-failsafe\s+[\d.]+s\s+([\d.]+)s/)?.[1]);
  assert.ok(Number.isFinite(cssDelay), 'CSS failsafe animation not found');
  assert.ok(cssDelay * 1000 > REVEAL_FAILSAFE_MS, `CSS failsafe (${cssDelay}s) must come after the JS one (${REVEAL_FAILSAFE_MS}ms)`);
});
