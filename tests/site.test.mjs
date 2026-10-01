import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
// Every standalone page is held to the same asset and class checks.
const PAGES = ['index.html', 'privacidad.html', '404.html'];
const pageSource = (name) => readFileSync(join(publicDir, name), 'utf8');

const EXTERNAL = /^(https?:|\/\/|mailto:|tel:|#|data:|javascript:)/i;

function localRefs(source) {
  const refs = [];
  for (const m of source.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)) {
    const value = m[1].trim();
    if (!value || EXTERNAL.test(value) || value.includes('wa.me')) continue;
    refs.push(value);
  }
  return refs;
}

test('does not use the Tailwind CDN', () => {
  assert.ok(!html.includes('cdn.tailwindcss.com'));
});

test('links the compiled stylesheet', () => {
  assert.match(html, /<link[^>]+href="assets\/css\/output\.css"/);
});

test('every local src/href resolves to a file under public/', () => {
  const missing = [];
  for (const page of PAGES) {
    for (const ref of localRefs(pageSource(page))) {
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = join(publicDir, decodeURIComponent(clean));
      // cleanUrls: "/" is index.html and "/privacidad" is privacidad.html.
      const found = clean === '/' ? existsSync(join(publicDir, 'index.html')) : existsSync(target) || existsSync(target + '.html');
      if (!found) missing.push(`${page}: ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('has no inline tailwind.config script', () => {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(!inline.some((m) => m[1].includes('tailwind.config')));
});

const css = () => readFileSync(join(publicDir, 'assets/css/output.css'), 'utf8');

test('build output exists and contains brand components', () => {
  const cssPath = join(publicDir, 'assets/css/output.css');
  assert.ok(existsSync(cssPath), 'run `npm run build` first (npm test does it via pretest)');
  const out = css();
  for (const re of [/\.btn-primary[\s{,:]/, /\.btn-accent[\s{,:]/, /\.card[\s{,:]/, /\.container-custom[\s{,:]/, /\.bg-primary-900[\s{,:]/]) {
    assert.match(out, re, `output.css is missing ${re}`);
  }
  assert.ok(!out.includes('#1e3a8a'), 'old navy palette must be gone');
});

// Classes with no CSS meaning: JS hooks or markers. Keep this list small.
const NON_STYLING = new Set([
  'group', // Tailwind marker for group-hover:* variants, emits no rule of its own
  'peer', // Tailwind marker for peer-* variants
]);

// Same escaping Tailwind applies to class names inside selectors.
function escapeSelector(token) {
  return token.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
}

test('every class used in the HTML is generated as a selector', () => {
  const out = css();
  const tokens = new Set();
  for (const page of PAGES) {
    for (const m of pageSource(page).matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
      for (const t of m[1].split(/\s+/).filter(Boolean)) tokens.add(t);
    }
  }
  const missing = [...tokens].filter((t) => {
    if (NON_STYLING.has(t)) return false;
    const re = new RegExp('\\.' + escapeSelector(t).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') + '(?![\\w-])');
    return !re.test(out);
  });
  assert.deepEqual(missing, []);
});

test('vercel.json is valid for the static output', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.equal(cfg.outputDirectory, 'public');
  const headers = cfg.headers ?? [];
  for (const h of headers) {
    assert.ok(!h.source.includes('(?:'), `non-capturing group not supported by path-to-regexp: ${h.source}`);
  }
  for (const h of headers.filter((x) => x.source.startsWith('/assets'))) {
    for (const { value } of h.headers) assert.ok(!/immutable/.test(value), `unhashed assets must not be immutable: ${h.source}`);
  }
});

// --- T4: scripts, config-driven data and forms -------------------------------

test('public/ contains none of the fake contact literals', () => {
  const TEXT = /\.(html|js|mjs|css|json|txt|xml|webmanifest)$/i;
  const FAKE = [/1234567890/, /claudiacoach\.com/, /\+123 456/];
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (TEXT.test(e.name)) {
        const text = readFileSync(p, 'utf8');
        for (const re of FAKE) if (re.test(text)) hits.push(`${p}: ${re}`);
      }
    }
  };
  walk(publicDir);
  assert.deepEqual(hits, []);
});

const JSON_LD = /type="application\/ld\+json"/;

test('the only inline script is the js-class marker in <head> (JSON-LD data blocks aside)', () => {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !JSON_LD.test(m[1]))
    .map((m) => [m[0], m[2]]);
  assert.equal(inline.length, 1, 'exactly one executable inline script expected');
  assert.equal(inline[0][1].trim(), "document.documentElement.classList.add('js')");
  const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));
  assert.ok(head.includes(inline[0][0]), 'the js-class script must be in <head>');
});

test('every JSON-LD block parses as JSON with an @context', () => {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(blocks.length >= 1, 'expected at least one JSON-LD block');
  for (const [, body] of blocks) assert.ok(JSON.parse(body)['@context']);
});

test('config.js loads as a classic script and main.js as a module, at the end of <body>', () => {
  const config = html.indexOf('<script src="assets/js/config.js"></script>');
  const main = html.indexOf('<script type="module" src="assets/js/main.js"></script>');
  assert.ok(config > -1, 'config.js script tag missing');
  assert.ok(main > -1, 'main.js module script tag missing');
  assert.ok(config < main, 'config.js must come before main.js');
  assert.ok(config > html.indexOf('</main>'), 'scripts belong at the end of <body>');
});

test('forms are JS-only: no native POST path, honeypot kept, noscript note inside', () => {
  for (const kind of ['contact', 'lead']) {
    const form = html.match(new RegExp(`<form\\b[^>]*data-form="${kind}"[^>]*>[\\s\\S]*?</form>`))?.[0];
    assert.ok(form, `form[data-form="${kind}"] not found`);
    const open = form.match(/<form\b[^>]*>/)[0];
    assert.match(open, /\bnovalidate\b/);
    assert.ok(!/\baction\s*=/.test(open), 'a native action would bypass buildPayload');
    assert.ok(!/\bmethod\s*=/.test(open), 'a native method would bypass buildPayload');
    for (const name of ['access_key', 'subject', 'from_name']) {
      assert.ok(!new RegExp(`<input[^>]*name="${name}"`).test(form), `hidden ${name} input must not exist`);
    }
    const honeypot = form.match(/<input[^>]*name="botcheck"[^>]*>/)?.[0];
    assert.ok(honeypot, 'honeypot missing');
    assert.match(honeypot, /type="checkbox"/);
    assert.match(honeypot, /class="hidden"/);
    assert.match(honeypot, /tabindex="-1"/);
    assert.match(honeypot, /autocomplete="off"/);
    for (const name of ['name', 'email']) assert.match(form, new RegExp(`name="${name}"`));
    const noscript = form.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    assert.ok(noscript, 'noscript note missing');
    assert.match(noscript, /Para enviar el formulario necesitás JavaScript habilitado\. También podés escribirme por WhatsApp o email\./);
  }
  assert.ok(!/web3forms/i.test(html), 'the endpoint lives only in forms.js');
});

test('contact form has the extra fields and a consultType select', () => {
  const form = html.match(/<form\b[^>]*data-form="contact"[^>]*>[\s\S]*?<\/form>/)[0];
  for (const name of ['phone', 'message', 'privacy']) assert.match(form, new RegExp(`name="${name}"`));
  const select = form.match(/<select\b[^>]*name="consultType"[^>]*>[\s\S]*?<\/select>/)?.[0];
  assert.ok(select, 'select[name=consultType] missing');
  const values = [...select.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, ['personal', 'empresa', 'charla']);
  assert.match(form, /<label[^>]*for="contact-type"/);
});

test('contact links are config-driven, not hard-coded', () => {
  assert.ok(!/href="https?:\/\/(wa\.me|(www\.)?(instagram|facebook|linkedin)\.com)/i.test(html), 'hard-coded contact URL found');
  assert.ok(!/href="mailto:/i.test(html), 'hard-coded mailto found');
  for (const m of html.matchAll(/<a\b[^>]*aria-label="(Instagram|LinkedIn|Facebook)"[^>]*>/g)) {
    assert.match(m[0], /data-link="/, m[0]);
  }
  for (const kind of ['whatsapp', 'email', 'instagram', 'facebook', 'linkedin']) {
    assert.match(html, new RegExp(`data-link="${kind}"`), `no data-link="${kind}" in the page`);
  }
  assert.match(html, /data-config-text="email"/);
  assert.match(html, /data-hide-if-empty/);
});

test('carousel is accessible: labelled controls and described region (slides are added per real testimonial)', () => {
  assert.match(html, /<button[^>]*id="carousel-prev"[^>]*aria-label="[^"]+"/);
  assert.match(html, /<button[^>]*id="carousel-next"[^>]*aria-label="[^"]+"/);
  assert.ok(html.match(/<div[^>]*id="testimonials-track"[^>]*>/));
  assert.match(html, /aria-roledescription="carousel"/);
  assert.equal(
    (html.replace(/<!--[\s\S]*?-->/g, '').match(/aria-roledescription="slide"/g) ?? []).length,
    0,
    'no slide may render until a real testimonial exists'
  );
});

test('animated content is only hidden when JS is available, and reduced motion is honoured', () => {
  const out = css();
  assert.match(out, /\.js \[data-animate\]/, 'hide rule must be scoped to html.js');
  for (const m of out.matchAll(/(.{0,4})\[data-animate\]/g)) {
    assert.equal(m[1], '.js ', 'unscoped [data-animate] rule would hide content without JS');
  }
  assert.match(out, /prefers-reduced-motion:\s*reduce/);
});
