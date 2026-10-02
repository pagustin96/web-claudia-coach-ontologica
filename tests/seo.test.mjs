import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const read = (f) => readFileSync(join(publicDir, f), 'utf8');

const index = read('index.html');
const head = index.slice(index.indexOf('<head'), index.indexOf('</head>'));
const ABSOLUTE_HTTPS = /^https:\/\/[^\s/]+(\/\S*)?$/;

const metaContent = (source, attr, name) =>
  source.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`))?.[1];
const canonical = (source) => source.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)?.[1];
const originOf = (url) => new URL(url).origin;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const lastmods = (xml) => [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
/** "1 de octubre de 2026" -> "2026-10-01" (null when the text does not match). */
function spanishDateToIso(text) {
  const m = text.match(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/i);
  const month = m && MONTHS.indexOf(m[2].toLowerCase()) + 1;
  if (!m || !month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// --- index.html head metadata -------------------------------------------------

test('index.html has an absolute https canonical URL', () => {
  const href = canonical(head);
  assert.ok(href, 'canonical link missing');
  assert.match(href, ABSOLUTE_HTTPS);
});

test('Open Graph tags are present with the expected values', () => {
  assert.equal(metaContent(head, 'property', 'og:type'), 'website');
  assert.equal(metaContent(head, 'property', 'og:locale'), 'es_AR');
  for (const name of ['og:site_name', 'og:title', 'og:description', 'og:image:alt']) {
    assert.ok(metaContent(head, 'property', name), `${name} missing or empty`);
  }
  assert.equal(metaContent(head, 'property', 'og:image:width'), '1200');
  assert.equal(metaContent(head, 'property', 'og:image:height'), '630');
});

test('og:url and og:image are absolute https URLs, og:url equals the canonical', () => {
  const url = metaContent(head, 'property', 'og:url');
  const image = metaContent(head, 'property', 'og:image');
  assert.match(url, ABSOLUTE_HTTPS);
  assert.match(image, ABSOLUTE_HTTPS);
  assert.equal(url, canonical(head));
});

test('the og:image file exists locally', () => {
  const image = metaContent(head, 'property', 'og:image');
  assert.equal(new URL(image).pathname, '/og-image.jpg');
  assert.ok(existsSync(join(publicDir, 'og-image.jpg')));
});

test('Twitter card tags are present with an absolute image', () => {
  assert.equal(metaContent(head, 'name', 'twitter:card'), 'summary_large_image');
  assert.ok(metaContent(head, 'name', 'twitter:title'));
  assert.ok(metaContent(head, 'name', 'twitter:description'));
  assert.match(metaContent(head, 'name', 'twitter:image'), ABSOLUTE_HTTPS);
});

test('theme-color matches the web manifest', () => {
  const manifest = JSON.parse(read('site.webmanifest'));
  assert.equal(metaContent(head, 'name', 'theme-color'), manifest.theme_color);
});

test('JSON-LD describes the professional service without invented contact data', () => {
  const blocks = [...index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1);
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'ProfessionalService');
  assert.match(data.name, /Claudia Viviana Samudio/);
  assert.ok(data.description);
  assert.match(data.url, ABSOLUTE_HTTPS);
  assert.match(data.image, ABSOLUTE_HTTPS);
  assert.equal(data.areaServed, 'AR');
  for (const field of ['address', 'telephone', 'email']) {
    assert.ok(!(field in data), `${field} must be omitted until Claudia provides it`);
  }
  assert.match(index, /<!--\s*TODO[^>]*JSON-LD[\s\S]*?-->/);
});

test('the base-URL TODO comment is present', () => {
  assert.ok(
    index.includes(
      '<!-- TODO: replace base URL when the final domain is set (also robots.txt, sitemap.xml, privacidad.html) -->'
    )
  );
});

// --- robots.txt and sitemap.xml -------------------------------------------------

test('robots.txt allows everything and references the sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent:\s*\*/m);
  assert.ok(!/^Disallow:\s*\S/m.test(robots), 'nothing should be disallowed');
  assert.match(robots, /^Sitemap:\s*https:\/\/\S+\/sitemap\.xml\s*$/m);
});

test('sitemap.xml is well-formed and lists both pages with lastmod', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<url>/g) ?? []).length, (xml.match(/<\/url>/g) ?? []).length);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, 2);
  const origin = originOf(locs[0]);
  assert.deepEqual(locs, [`${origin}/`, `${origin}/privacidad`]);
  for (const date of lastmods(xml)) assert.ok(isIsoDate(date), `lastmod is not a valid YYYY-MM-DD date: ${date}`);
  assert.equal(lastmods(xml).length, 2);
});

// --- privacidad.html ------------------------------------------------------------

const privacy = () => read('privacidad.html');

test('privacidad.html exists with one h1, a canonical and a mention of Ley 25.326', () => {
  assert.ok(existsSync(join(publicDir, 'privacidad.html')));
  const page = privacy();
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  assert.match(canonical(page), ABSOLUTE_HTTPS);
  assert.ok(page.includes('25.326'));
  assert.ok(!/name="robots"[^>]*noindex/i.test(page), 'the privacy page may be indexed');
  assert.match(page, /<!--\s*TODO\(Claudia\): review with a legal professional before launch\s*-->/);
});

test('privacidad.html covers the required policy topics', () => {
  const page = privacy();
  for (const topic of [/Claudia Viviana Samudio/, /Web3Forms/, /Vercel/, /AAIP|Agencia de Acceso a la Información Pública/, /acceso/i, /rectificación/i, /actualización/i, /supresión/i, /cookies/i, /Última actualización:/]) {
    assert.match(page, topic);
  }
  assert.match(page, /data-link="email"[^>]*data-config-text="email"|data-config-text="email"[^>]*data-link="email"/);
  assert.match(page, /formulario de contacto/);
});

test('the privacy page "Última actualización" date matches the sitemap lastmod of /privacidad', () => {
  const shown = privacy().match(/Última actualización:\s*([^<]+)</)?.[1];
  assert.ok(shown, 'Última actualización line missing');
  const iso = spanishDateToIso(shown);
  assert.ok(iso && isIsoDate(iso), `unparsable date: ${shown}`);
  const xml = read('sitemap.xml');
  const entry = xml.match(/<url>\s*<loc>[^<]*\/privacidad<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/)?.[1];
  assert.equal(entry, iso);
});

test('privacidad.html loads the compiled CSS, config.js and main.js', () => {
  const page = privacy();
  assert.match(page, /href="\/assets\/css\/output\.css"/);
  assert.ok(page.includes('<script src="/assets/js/config.js"></script>'));
  assert.ok(page.includes('<script type="module" src="/assets/js/main.js"></script>'));
  assert.ok(page.includes("<script>document.documentElement.classList.add('js')</script>"));
  assert.match(page, /<a\b[^>]*href="\/"[^>]*>[\s\S]*?Volver al inicio/);
});

// --- 404.html -------------------------------------------------------------------

test('404.html is a branded not-found page that links home', () => {
  const page = read('404.html');
  assert.match(page, /Página no encontrada/);
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  assert.match(page, /<a\b[^>]*href="\/"/);
  assert.match(page, /href="\/assets\/css\/output\.css"/);
});

// --- one base URL everywhere ------------------------------------------------------

test('the base URL is consistent across index, privacidad, robots, sitemap and config.js', () => {
  const configUrl = read('assets/js/config.js').match(/siteUrl:\s*'([^']+)'/)?.[1];
  assert.ok(configUrl, 'siteUrl missing in config.js');
  const origin = originOf(configUrl);

  const urls = {
    'index canonical': canonical(head),
    'index og:url': metaContent(head, 'property', 'og:url'),
    'index og:image': metaContent(head, 'property', 'og:image'),
    'index twitter:image': metaContent(head, 'name', 'twitter:image'),
    'privacidad canonical': canonical(privacy()),
    'robots Sitemap': read('robots.txt').match(/^Sitemap:\s*(\S+)/m)?.[1],
  };
  const ld = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  urls['json-ld url'] = ld.url;
  urls['json-ld image'] = ld.image;
  [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].forEach((m, i) => (urls[`sitemap loc ${i}`] = m[1]));

  const mismatches = Object.entries(urls)
    .filter(([, url]) => !url || originOf(url) !== origin)
    .map(([where, url]) => `${where}: ${url}`);
  assert.deepEqual(mismatches, [], `every URL must use ${origin} (config.js siteUrl)`);
});
