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

// Enabled in T2 (Tailwind build)
test.todo('does not use the Tailwind CDN');

test.todo('links the compiled stylesheet');

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

test.todo('has no inline tailwind.config script');
