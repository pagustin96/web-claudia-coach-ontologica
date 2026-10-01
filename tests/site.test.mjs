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

test('build output exists and contains brand components', () => {
  const cssPath = join(publicDir, 'assets/css/output.css');
  assert.ok(existsSync(cssPath), 'run `npm run build` first (npm test does it via pretest)');
  const css = readFileSync(cssPath, 'utf8');
  for (const needle of ['.btn-primary', '.btn-accent', '.card', '.container-custom', '.bg-primary-900']) {
    assert.ok(css.includes(needle), `output.css is missing ${needle}`);
  }
  assert.ok(!css.includes('#1e3a8a'), 'old navy palette must be gone');
});

test('every utility/component class used in the HTML is generated', () => {
  const css = readFileSync(join(publicDir, 'assets/css/output.css'), 'utf8');
  const probes = ['bg-primary-100', 'text-primary-900', 'hover\\:bg-primary-900', 'to-accent-50', 'text-accent-600', 'bg-white\\/95', 'animate-fade-in', 'animate-slide-up', 'bg-hero-pattern', 'text-gradient'];
  for (const p of probes) assert.ok(css.includes(p), `output.css is missing .${p}`);
});

