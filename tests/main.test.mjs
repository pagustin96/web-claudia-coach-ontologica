import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySiteConfig, initConsultTypeLinks, selectConsultType, playReveal, revealRemaining, REVEAL_FAILSAFE_MS } from '../public/assets/js/main.js';
import { initForms } from '../public/assets/js/forms.js';
import { FakeElement, createDocument } from './helpers/fake-dom.mjs';

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

const withTrack = (count) => ({ ...el({ id: 'testimonials-track' }), children: Array.from({ length: count }, () => el()) });

test('showTestimonials=false hides the section and its nav links', () => {
  const section = el({ id: 'testimonios' });
  const nav = el({ href: '#testimonios' });
  const other = el({ href: '#servicios' });
  applySiteConfig({ ...EMPTY, showTestimonials: false }, fakeRoot([section, nav, other, withTrack(2)]));
  assert.equal(section.style.display, 'none');
  assert.equal(nav.style.display, 'none');
  assert.equal(other.style.display, undefined);
});

test('showTestimonials=true with slides reveals the section shipped hidden', () => {
  const section = el({ id: 'testimonios' });
  const nav = el({ href: '#testimonios' });
  section.hidden = nav.hidden = true;
  section.style.display = nav.style.display = 'none';
  applySiteConfig({ ...EMPTY, showTestimonials: true }, fakeRoot([section, nav, withTrack(3)]));
  for (const node of [section, nav]) {
    assert.equal(node.hidden, false);
    assert.ok(!node.style.display);
  }
});

test('showTestimonials=true but an empty track keeps the section hidden', () => {
  const section = el({ id: 'testimonios' });
  const nav = el({ href: '#testimonios' });
  applySiteConfig({ ...EMPTY, showTestimonials: true }, fakeRoot([section, nav, withTrack(0)]));
  assert.equal(section.style.display, 'none');
  assert.equal(nav.style.display, 'none');
});

test('a missing track also keeps the section hidden', () => {
  const section = el({ id: 'testimonios' });
  applySiteConfig({ ...EMPTY, showTestimonials: true }, fakeRoot([section]));
  assert.equal(section.style.display, 'none');
});

// --- consult type preselection --------------------------------------------------

function consultFixture(initial = 'personal') {
  const doc = createDocument();
  const select = doc.createElement('select');
  select.id = 'contact-type';
  select.setAttribute('id', 'contact-type');
  select.value = initial;
  select.options = ['personal', 'empresa', 'charla'].map((value) => ({ value }));
  doc.body.append(select);
  return { doc, select };
}

test('selectConsultType preselects a known consult type in the contact select', () => {
  const { doc, select } = consultFixture();
  assert.equal(selectConsultType('empresa', doc), true);
  assert.equal(select.value, 'empresa');
});

test('selectConsultType ignores unknown types and a missing select', () => {
  const { doc, select } = consultFixture('charla');
  assert.equal(selectConsultType('otro', doc), false);
  assert.equal(select.value, 'charla');
  assert.equal(selectConsultType('empresa', createDocument()), false);
});

test('clicking a [data-consult-type] link preselects the type', () => {
  const { doc, select } = consultFixture();
  const link = doc.createElement('a');
  link.dataset.consultType = 'empresa';
  doc.body.append(link);
  initConsultTypeLinks(doc);
  link.dispatch('click', {});
  assert.equal(select.value, 'empresa');
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

test('pages without the landing sections (privacidad, 404) do not break the init steps', () => {
  const empty = fakeRoot([]);
  assert.doesNotThrow(() => applySiteConfig({ ...EMPTY, showTestimonials: true }, empty));
  assert.doesNotThrow(() => initConsultTypeLinks(empty));
  assert.doesNotThrow(() => initForms(empty, EMPTY));
});

test('the privacy email link and its wrapper are hidden until an email is configured', () => {
  const wrapper = el({ dataset: { hideIfEmpty: 'email' } });
  const link = el({ href: '/#contacto', dataset: { link: 'email', configText: 'email' } });
  applySiteConfig(EMPTY, fakeRoot([wrapper, link]));
  assert.equal(wrapper.hidden, true);
  const wrapper2 = el({ dataset: { hideIfEmpty: 'email' } });
  const link2 = el({ href: '/#contacto', dataset: { link: 'email', configText: 'email' } });
  applySiteConfig({ ...EMPTY, email: 'hola@example.com' }, fakeRoot([wrapper2, link2]));
  assert.equal(wrapper2.hidden, false);
  assert.equal(link2.getAttribute('href'), 'mailto:hola@example.com');
  assert.equal(link2.textContent, 'hola@example.com');
});
