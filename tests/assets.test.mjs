import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { imageSize } from './helpers/image-size.mjs';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));

test('icon and social files exist', () => {
  for (const f of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.jpg', 'site.webmanifest']) {
    assert.ok(existsSync(join(publicDir, f)), `public/${f} is missing`);
  }
});

test('web manifest is valid JSON with a name', () => {
  const manifest = JSON.parse(readFileSync(join(publicDir, 'site.webmanifest'), 'utf8'));
  assert.ok(manifest.name);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.ok(manifest.icons.length >= 2);
});

test('logo variants exist', () => {
  for (const f of ['logo.png', 'logo-white.png', 'logo-mark.png']) {
    assert.ok(existsSync(join(publicDir, 'assets/images', f)), `${f} is missing`);
  }
});

test('the logo source is not deployed', () => {
  assert.ok(!existsSync(join(publicDir, 'assets/images/logo-source.jpeg')));
});

test('index.html does not hotlink Unsplash', () => {
  assert.ok(!html.includes('images.unsplash.com'));
});

test('head declares icon, apple-touch-icon and manifest links', () => {
  assert.match(head, /<link[^>]+rel="icon"/);
  assert.match(head, /<link[^>]+rel="apple-touch-icon"/);
  assert.match(head, /<link[^>]+rel="manifest"/);
});

test('logo images are not inverted with CSS filters', () => {
  for (const m of html.matchAll(/<img[^>]*logo[^>]*>/g)) {
    assert.ok(!m[0].includes('brightness-0'), m[0]);
    assert.ok(!m[0].includes('invert'), m[0]);
  }
});

const PAGES = ['index.html', 'privacidad.html', '404.html'];
const pageSource = (name) => readFileSync(join(publicDir, name), 'utf8');
const allImgs = () => PAGES.flatMap((page) => [...pageSource(page).matchAll(/<img\b[^>]*>/g)]);

test('every <img> declares width, height and alt', () => {
  for (const m of allImgs()) {
    assert.match(m[0], /\bwidth="\d+"/, m[0]);
    assert.match(m[0], /\bheight="\d+"/, m[0]);
    assert.match(m[0], /\balt="[^"]+"/, m[0]);
  }
});

test('every local <img> width/height match the real pixel size', () => {
  const mismatches = [];
  let checked = 0;
  for (const m of allImgs()) {
    const src = m[0].match(/\bsrc="([^"]+)"/)?.[1];
    if (!src || /^(https?:|\/\/|data:)/i.test(src)) continue;
    const width = Number(m[0].match(/\bwidth="(\d+)"/)?.[1]);
    const height = Number(m[0].match(/\bheight="(\d+)"/)?.[1]);
    const real = imageSize(readFileSync(join(publicDir, src.replace(/^\//, ''))));
    checked++;
    if (real.width !== width || real.height !== height) {
      mismatches.push(`${src}: html ${width}x${height}, file ${real.width}x${real.height}`);
    }
  }
  assert.ok(checked > 0, 'no local <img> checked');
  assert.deepEqual(mismatches, []);
});

test('public/ has no file larger than 500 KB', () => {
  const big = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (statSync(p).size > 500 * 1024) big.push(p);
    }
  };
  walk(publicDir);
  assert.deepEqual(big, []);
});
