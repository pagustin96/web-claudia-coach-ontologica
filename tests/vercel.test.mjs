import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import routingUtils from '@vercel/routing-utils';

const { getTransformedRoutes } = routingUtils;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

// getTransformedRoutes validates vercel.json the way the platform does and turns
// every header `source` (path-to-regexp) into a plain regex in `routes[].src`.
const { routes, error } = getTransformedRoutes({ headers: config.headers, cleanUrls: config.cleanUrls });
const cacheRoutes = (path) =>
  (routes ?? []).filter((r) => r.headers?.['Cache-Control'] && new RegExp(r.src).test(path));
const cacheOf = (path) => cacheRoutes(path).map((r) => r.headers['Cache-Control']);

test('Vercel accepts every headers[].source pattern', () => {
  assert.equal(error, null, error?.message);
  assert.equal(config.headers.length > 0, true);
});

test('image paths get the long image cache rule only', () => {
  assert.deepEqual(cacheOf('/assets/images/logo.png'), ['public, max-age=604800, stale-while-revalidate=86400']);
});

test('css and js paths get the short cache rule and not the image one', () => {
  assert.deepEqual(cacheOf('/assets/js/main.js'), ['public, max-age=3600']);
  assert.deepEqual(cacheOf('/assets/css/output.css'), ['public, max-age=3600']);
});

test('cleanUrls is on, because the /privacidad canonical and sitemap entry depend on it', () => {
  assert.equal(config.cleanUrls, true);
});
