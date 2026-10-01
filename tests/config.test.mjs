import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public/assets/js/config.js');

function load() {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), sandbox);
  return sandbox.window.SITE_CONFIG;
}

test('config.js is a classic script that defines window.SITE_CONFIG', () => {
  const cfg = load();
  assert.ok(cfg && typeof cfg === 'object');
});

test('contact fields default to empty strings (not configured yet)', () => {
  const cfg = load();
  for (const k of ['whatsappNumber', 'email', 'instagramUrl', 'facebookUrl', 'linkedinUrl', 'web3formsKey', 'bookingUrl']) {
    assert.equal(cfg[k], '', k);
  }
});

test('siteUrl and showTestimonials have their safe defaults', () => {
  const cfg = load();
  assert.equal(cfg.siteUrl, 'https://claudia-samudio.vercel.app');
  assert.equal(cfg.showTestimonials, false);
});

test('config.js documents that siteUrl feeds canonical/OG tags (T6)', () => {
  assert.match(readFileSync(file, 'utf8'), /siteUrl\s+Public site URL, used for canonical\/OG \(T6\)\./);
});
