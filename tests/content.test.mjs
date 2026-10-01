import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const html = read('public/index.html');
// Markup that is actually rendered: comments hold TODOs and the testimonial template.
const live = html.replace(/<!--[\s\S]*?-->/g, '');

const section = (id) => live.match(new RegExp(`<section\\b[^>]*id="${id}"[^>]*>[\\s\\S]*?</section>`))?.[0];

// --- Palette -------------------------------------------------------------------

// Tailwind default colour families that must not leak into the brand design.
// `red` is allowed only for form errors, and those classes live in forms.js.
const OFF_BRAND = 'blue|purple|pink|indigo|green|yellow|gray|rose|orange|red|teal|emerald|cyan|sky|lime|violet|fuchsia|stone|zinc|neutral';
const OFF_BRAND_RE = new RegExp(`\\b(?:bg|text|border|from|to|via|ring|fill|stroke|outline|divide|placeholder|shadow)-(?:${OFF_BRAND})-\\d{2,3}\\b`, 'g');
// Explicit allowlist for index.html. Empty on purpose: WhatsApp green is the `whatsapp`
// token, stars use accent-400 (amber) and error red is injected by forms.js.
const ALLOWLIST = new Set([]);

test('index.html uses only brand tokens and slate neutrals', () => {
  const offenders = [...new Set([...html.matchAll(OFF_BRAND_RE)].map((m) => m[0]))].filter((c) => !ALLOWLIST.has(c));
  assert.deepEqual(offenders, []);
});

test('main.js and forms.js only use red (form errors) outside the brand palette', () => {
  for (const file of ['main.js', 'forms.js']) {
    const source = read('public/assets/js', file);
    const offenders = [...new Set([...source.matchAll(OFF_BRAND_RE)].map((m) => m[0]))].filter((c) => !/-red-\d/.test(c));
    assert.deepEqual(offenders, [], file);
  }
});

test('the WhatsApp button is the only place using the WhatsApp green', () => {
  assert.match(read('tailwind.config.js'), /#25D366/i);
  const users = [...live.matchAll(/<[^>]*class="[^"]*\bbg-whatsapp\b[^"]*"[^>]*>/g)];
  assert.equal(users.length, 1);
  assert.match(users[0][0], /aria-label="[^"]*WhatsApp/);
});

test('white text only sits on primary-700 or darker, never on amber', () => {
  for (const m of live.matchAll(/class="([^"]*)"/g)) {
    const classes = m[1].split(/\s+/);
    if (!classes.some((c) => /^text-white(\/\d+)?$/.test(c))) continue;
    for (const c of classes) {
      const primary = c.match(/^(?:from|to|via|bg)-primary-(\d+)$/);
      if (primary) assert.ok(Number(primary[1]) >= 700, `white text on ${c}: "${m[1]}"`);
      assert.ok(!/^(?:from|to|via|bg)-accent-/.test(c), `white text on amber: "${m[1]}"`);
    }
  }
});

function channels(name) {
  const m = read('src/css/variables.css').match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
  assert.ok(m, `--${name} not found`);
  return [m[1], m[2], m[3]].map(Number);
}
function luminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('text pairs used on teal and amber meet WCAG AA (4.5:1)', () => {
  const white = [255, 255, 255];
  const slate900 = [15, 23, 42];
  const pairs = [
    ['white on primary-700 (btn-primary)', white, channels('color-primary-700')],
    ['white on primary-800 (lead magnet gradient end)', white, channels('color-primary-800')],
    ['white on primary-900 (lead magnet, institutional block)', white, channels('color-primary-900')],
    ['primary-950 on accent-400 (btn-accent)', channels('color-primary-950'), channels('color-accent-400')],
    ['primary-900 on primary-100 (hero badge)', channels('color-primary-900'), channels('color-primary-100')],
    ['primary-800 on primary-50 (badges on tinted sections)', channels('color-primary-800'), channels('color-primary-50')],
    ['primary-700 on white (outline button, links)', channels('color-primary-700'), white],
    ['primary-700 on primary-50 (links on tinted sections)', channels('color-primary-700'), channels('color-primary-50')],
    ['slate-600 on white (body copy)', channels('color-text-secondary'), white],
    ['slate-500 on white (placeholders)', channels('color-text-muted'), white],
    ['slate-900 on whatsapp green (glyph)', slate900, [37, 211, 102]],
  ];
  for (const [label, fg, bg] of pairs) {
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1`);
  }
});

test('the gradient text does not fade into amber (large text still needs 3:1)', () => {
  const css = read('src/css/input.css');
  const rule = css.match(/\.text-gradient\s*\{[^}]*\}/)[0];
  assert.ok(!/accent/.test(rule), rule);
});

// --- Identity ------------------------------------------------------------------

test('title, description and author carry the new identity', () => {
  assert.match(html, /<title>Claudia Viviana Samudio \| Coach Ontológica y Bienestar Consciente<\/title>/);
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '';
  assert.match(description, /Claudia Viviana Samudio/);
  assert.match(description, /Coach Ontológica/);
  assert.match(description, /Bienestar/);
  assert.match(html, /<meta name="author" content="Claudia Viviana Samudio">/);
});

test('the role line and the hero value proposition are present', () => {
  assert.match(live, /Coach Ontológica · Salud, Bienestar y Nutrición Consciente/);
  const h1 = live.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(h1, 'Transformá tu vida desde adentro hacia afuera');
  assert.match(section('inicio'), /coaching ontológico, nutrición consciente y gestión emocional/i);
});

test('bio and credentials are marked as editable placeholders and carry no invented facts', () => {
  const todos = [...html.matchAll(/<!--\s*TODO\(Claudia\):([\s\S]*?)-->/g)].map((m) => m[1].toLowerCase());
  for (const topic of ['bio', 'credential', 'photo', 'guide']) {
    assert.ok(todos.some((t) => t.includes(topic)), `no TODO(Claudia) comment about ${topic}`);
  }
  for (const invented of [/10\+/, /\+\s?200/, /cientos de personas/i, /miembro de la asociaci/i, /certificaci[oó]n internacional/i]) {
    assert.ok(!invented.test(live), `invented claim found: ${invented}`);
  }
  assert.match(live, /Coach Ontológica certificada/);
});

// --- Structure and accessibility -------------------------------------------------

test('there is exactly one h1 and headings never skip a level', () => {
  assert.equal((live.match(/<h1\b/g) ?? []).length, 1);
  let previous = 0;
  for (const m of live.matchAll(/<h([1-6])\b/g)) {
    const level = Number(m[1]);
    assert.ok(level <= previous + 1, `h${level} follows h${previous}`);
    previous = level;
  }
});

test('a skip link is the first focusable element and targets <main>', () => {
  assert.match(live, /<body[^>]*>\s*<a href="#contenido"[^>]*>Saltar al contenido<\/a>/);
  assert.match(live, /<main\b[^>]*id="contenido"/);
  assert.match(live, /<a href="#contenido"[^>]*class="[^"]*sr-only[^"]*focus:not-sr-only/);
});

test('all required section ids exist', () => {
  for (const id of ['inicio', 'que-es', 'servicios', 'bienestar-360', 'sobre-mi', 'testimonios', 'lead-magnet', 'agenda', 'contacto']) {
    assert.ok(section(id), `<section id="${id}"> missing`);
  }
});

test('bienestar-360 sits right after servicios', () => {
  const order = [...live.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(order[order.indexOf('servicios') + 1], 'bienestar-360');
});

test('the mobile menu button exposes aria-expanded and aria-controls', () => {
  const button = live.match(/<button\b[^>]*id="mobile-menu-button"[^>]*>/)?.[0];
  assert.ok(button);
  assert.match(button, /aria-expanded="false"/);
  const controls = button.match(/aria-controls="([^"]+)"/)?.[1];
  assert.equal(controls, 'mobile-menu');
  assert.match(live, new RegExp(`id="${controls}"`));
});

test('interactive targets are at least 44px', () => {
  const button = live.match(/<button\b[^>]*id="mobile-menu-button"[^>]*>/)[0];
  assert.match(button, /\bmin-h-11\b/);
  assert.match(button, /\bmin-w-11\b/);
  const css = read('public/assets/css/output.css');
  assert.match(css, /\.btn\{[^}]*min-height:2\.75rem/);
  const header = live.match(/<header\b[\s\S]*?<\/header>/)[0];
  for (const m of header.matchAll(/<a\b[^>]*href="#[^"]+"[^>]*>/g)) {
    if (/\bbtn\b/.test(m[0])) continue;
    assert.match(m[0], /\bmin-h-11\b|\bpy-3\b/, m[0]);
  }
});

test('no anchor points to a bare "#"', () => {
  assert.ok(!/href="#"/.test(html));
});

test('the privacy links point to privacidad.html', () => {
  const links = [...live.matchAll(/<a\b[^>]*href="privacidad\.html"[^>]*>/g)];
  assert.ok(links.length >= 2, 'form checkbox and footer');
});

test('privacidad.html exists', () => {
  assert.ok(existsSync(join(root, 'public', 'privacidad.html')));
});

// --- Navigation ------------------------------------------------------------------

test('"Empresas" appears in the desktop and the mobile navigation', () => {
  const header = live.match(/<header\b[\s\S]*?<\/header>/)[0];
  const links = [...header.matchAll(/<a\b[^>]*href="#bienestar-360"[^>]*>\s*Empresas\s*<\/a>/g)];
  assert.equal(links.length, 2);
});

// --- Bienestar Consciente 360 ------------------------------------------------------

test('bienestar-360 has the pitch, pillars, two programmes and the institutional block', () => {
  const s = section('bienestar-360');
  assert.match(s, /Bienestar Consciente 360/);
  assert.match(s, /No es una dieta\./);
  assert.match(s, /No es solo entrenar\./);
  assert.match(s, /No es solo coaching\./);
  for (const pillar of ['Nutrición consciente', 'Movimiento inteligente', 'Gestión emocional', 'Mindfulness']) {
    assert.match(s, new RegExp(pillar));
  }
  assert.match(s, /PNL \+ coaching/);
  assert.match(s, /Iniciá tu transformación/);
  assert.match(s, /Transformación profunda 360/);
  assert.match(s, /Todo lo del programa de 3 meses/);
  assert.match(s, /3 meses/);
  assert.match(s, /6 meses/);
  assert.match(s, /Para clubes, gimnasios y empresas/);
  assert.match(s, /Más participación y fidelización/);
  assert.match(s, /Reducción de ausentismo/);
  assert.match(s, /Presencial y online/);
});

test('the 6-month programme is visually highlighted', () => {
  const s = section('bienestar-360');
  const cards = [...s.matchAll(/<div[^>]*data-programme="(3|6)"[^>]*>/g)];
  assert.deepEqual(cards.map((m) => m[1]), ['3', '6']);
  const featured = cards.find((m) => m[1] === '6')[0];
  assert.match(featured, /border-primary-700/);
  assert.match(featured, /shadow-xl/);
  assert.doesNotMatch(cards.find((m) => m[1] === '3')[0], /shadow-xl/);
});

test('bienestar-360 CTAs: WhatsApp for the programme, contact form with consultType=empresa', () => {
  const s = section('bienestar-360');
  const wa = s.match(/<a\b[^>]*data-link="whatsapp"[^>]*>\s*Quiero el programa\s*<\/a>/)?.[0];
  assert.ok(wa, '"Quiero el programa" with data-link="whatsapp"');
  assert.match(wa, /data-wa-text="[^"]*360[^"]*"/);
  const institution = s.match(/<a\b[^>]*>\s*Propuesta para mi institución\s*<\/a>/)?.[0];
  assert.ok(institution);
  assert.match(institution, /href="#contacto"/);
  assert.match(institution, /data-consult-type="empresa"/);
  // The preselected value must exist in the contact select.
  assert.match(live, /<option value="empresa">/);
});

// --- Services ----------------------------------------------------------------------

test('every service has its own call to action, none is a dead link', () => {
  const s = section('servicios');
  const links = [...s.matchAll(/<a\b[^>]*>\s*Más información[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.equal(links.length, 5);
  for (const link of links) {
    assert.match(link, /data-link="whatsapp"[^>]*data-wa-text="[^"]+"|data-consult-type="[^"]+"/, link);
    assert.doesNotMatch(link, /href="#"/);
  }
  const texts = links.map((l) => l.match(/data-wa-text="([^"]+)"/)?.[1]).filter(Boolean);
  assert.equal(new Set(texts).size, texts.length, 'prefilled WhatsApp texts are service-specific');
});

// --- Booking -----------------------------------------------------------------------

test('agenda is a booking card, not a calendar placeholder', () => {
  const s = section('agenda');
  assert.ok(!/border-dashed/.test(s));
  assert.ok(!/integrar/i.test(s));
  assert.match(s, /30 minutos/);
  assert.match(s, /online/i);
  assert.match(s, /sin compromiso/i);
  assert.match(s, /<a\b[^>]*data-link="booking"[^>]*>\s*(?:<svg[\s\S]*?<\/svg>\s*)?Reservar mi sesión gratuita\s*<\/a>/);
  assert.match(s, /<a\b[^>]*data-link="whatsapp"/);
  assert.match(s, /Respondo dentro de las 24 h hábiles/);
});

test('header and hero primary CTAs are booking links', () => {
  const header = live.match(/<header\b[\s\S]*?<\/header>/)[0];
  assert.match(header, /<a\b[^>]*data-link="booking"/);
  assert.match(section('inicio'), /<a\b[^>]*data-link="booking"/);
});

// --- Testimonials ------------------------------------------------------------------

test('no fake testimonials render: no articles, slides, avatars or invented names', () => {
  const s = section('testimonios');
  assert.ok(s, 'testimonials section exists');
  assert.ok(!/<article\b/.test(s));
  assert.ok(!/aria-roledescription="slide"/.test(s));
  assert.ok(!/<img\b/.test(s));
  assert.ok(!/avatar/i.test(live));
  for (const name of ['María García', 'Maria Garcia', 'Carlos Rodr', 'Ana Mart', 'Roberto S', 'Laura Torres']) {
    assert.ok(!html.includes(name), name);
  }
  const track = s.match(/<div[^>]*id="testimonials-track"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1];
  assert.equal(track?.trim(), '', 'carousel track is empty');
});

test('a single commented template documents how to add a real testimonial', () => {
  const templates = html.match(/<!-- Testimonial template: copy per real testimonial -->/g) ?? [];
  assert.equal(templates.length, 1);
  assert.match(html, /<!-- Testimonial template: copy per real testimonial -->\s*<!--[\s\S]*?aria-roledescription="slide"[\s\S]*?-->/);
});

test('the testimonials section and its nav links ship hidden', () => {
  assert.match(live, /<section\b[^>]*id="testimonios"[^>]*\bhidden\b/);
  for (const m of live.matchAll(/<a\b[^>]*href="#testimonios"[^>]*>/g)) assert.match(m[0], /\bhidden\b/, m[0]);
});

// --- Images ------------------------------------------------------------------------

test('every file in public/assets/images is referenced by the HTML, the manifest or the CSS', () => {
  const haystack = [html, read('public/site.webmanifest'), read('src/css/input.css'), read('src/css/variables.css'), read('public/assets/css/output.css')].join('\n');
  const orphans = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpe?g|webp|svg|gif|avif|ico)$/i.test(e.name)) {
        if (!haystack.includes(relative(publicDir, p).split('\\').join('/'))) orphans.push(relative(publicDir, p));
      }
    }
  };
  walk(join(publicDir, 'assets/images'));
  assert.deepEqual(orphans, []);
});

test('the testimonial avatar placeholders are gone', () => {
  const dir = join(publicDir, 'assets/images/placeholders');
  assert.ok(existsSync(dir));
  assert.deepEqual(readdirSync(dir).filter((f) => f.startsWith('avatar-')), []);
});

// --- Lead magnet and floating button -------------------------------------------------

test('lead magnet has a working title and flags the pending PDF', () => {
  const s = section('lead-magnet');
  assert.match(s, /Guía: 7 hábitos para una vida consciente/);
  assert.match(html, /<!--\s*TODO\(Claudia\):[^>]*guide[^>]*PDF[^>]*pending/i);
  assert.match(s, /por email/);
});

test('the floating WhatsApp button has tooltip, label, focus ring and clears mobile content', () => {
  const m = live.match(/<a\b[^>]*class="[^"]*\bfixed\b[^"]*"[^>]*data-link="whatsapp"[^>]*>[\s\S]*?<\/a>|<a\b[^>]*data-link="whatsapp"[^>]*class="[^"]*\bfixed\b[^"]*"[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(m, 'floating button not found');
  assert.match(m, /aria-label="[^"]+"/);
  assert.match(m, /data-hide-if-empty/);
  assert.match(m, /¿Hablamos\?/);
  assert.match(m, /focus-visible:ring/);
  assert.match(m, /group-focus-visible:opacity-100/);
  // Footer reserves room so the fixed button never covers its last line on phones.
  assert.match(live, /<footer\b[^>]*\bpb-24\b/);
});
