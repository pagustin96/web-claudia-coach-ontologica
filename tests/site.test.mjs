import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');

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
  const missing = localRefs(html).filter((ref) => {
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) return false;
    const target = clean.startsWith('/')
      ? join(publicDir, clean)
      : join(publicDir, decodeURIComponent(clean));
    return !existsSync(target);
  });
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
  for (const m of html.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
    for (const t of m[1].split(/\s+/).filter(Boolean)) tokens.add(t);
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
