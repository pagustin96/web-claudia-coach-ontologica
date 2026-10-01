# Feature: landing-production

## Objective
Finish design and implementation of the Claudia Viviana Samudio landing page and make it deployable on the Vercel free plan.

## Problem
The prototype uses the Tailwind Play CDN, discards form submissions, contains fake contact data and stock placeholders, lacks the floating WhatsApp button, favicon, OG tags and privacy page, and has no deploy configuration. The repo root contains a 54 MB LFS PDF and a docx that must not be published.

## Decisions (user-approved)
- Add a "Bienestar Consciente 360" B2B section (source: `proyecto gimnasios 2026 (1).docx`).
- Forms via Web3Forms (no backend).
- Brand palette from the logo: teal (~#00A99D) primary, amber (~#FBB03B) accent.
- Only `public/` is served (Vercel `outputDirectory`).

## Constraints
- Static site, Vercel free plan, no server code.
- Artifacts in Spanish for UI copy (existing project language), English for code/comments.
- Conventional commits, no AI attribution.
- Strict TDD: on (source: user global config). Runner: `node --test tests/` (`npm test`).
- Delivery strategy: ask-on-risk. Push/PR/deploy are user decisions.

## Tasks
- [x] T1 Scaffold + test harness (`public/`, `src/css/`, `.gitignore`, `package.json`, `vercel.json`, `tests/site.test.mjs`) — route: delegated writer
- [x] T2 Tailwind build + brand palette (drop CDN/inline styles, compiled `output.css`) — route: delegated writer
- [x] T3 Images (Pillow script, trimmed logo, favicon set, og-image, local placeholders) — route: delegated writer
- [x] T4 JS consolidation (`config.js`, `forms.js` test-first, inline scripts into `main.js`) — route: delegated writer
- [ ] T5 Content + design pass (identity, Bienestar 360, WhatsApp float, agenda CTA, testimonials gate) — route: delegated writer
- [ ] T6 SEO + legal (meta/OG, robots, sitemap, `privacidad.html`) — route: delegated writer
- [ ] T7 Deploy readiness (browser verification, README, `vercel build`) — route: inline + verifier

## Acceptance criteria
- `npm test` green; `npm run build` produces minified `public/assets/css/output.css`.
- No CDN Tailwind, no fake contact literals outside `config.js`, every referenced local asset exists.
- All sections render at 375px and 1280px without console errors.
- Forms POST well-formed payloads to Web3Forms with honeypot.

## Progress / evidence
_(updated per task with commit hashes)_

- T1 done, commit `3c41210`. RED: `node --test tests/*.test.mjs` failed with ENOENT on `public/index.html`. After the moves, (c) failed on `assets/css/variables.css` and `favicon.ico` (dangling refs removed: variables.css is now imported by input.css, favicon set arrives in T3). GREEN: (c) passes; (a), (b), (d) kept as `test.todo` (honest: RED until T2). Rationale: node 24 treats `node --test tests/` as a module path, so the runner is `node --test tests/*.test.mjs`. Logo moved to `public/assets/images/logo-source.jpeg` (T3 processes it).
- T2 done, commit `423315e`. RED: with (a), (b), (d) enabled plus output.css tests, 5 of 6 failed. GREEN: `npm test` (pretest builds) 6/6 pass; every class in index.html resolves in output.css (scripted check); output.css 25.9 KB minified. Rationale: palette as RGB-channel CSS variables mapped in tailwind.config.js so opacity modifiers work; `animate-fade-in/slide-up` safelisted because main.js builds them at runtime; buttons use primary-700 (5.36:1 with white), accent buttons dark text (9.7:1); removed unused color families (secondary/success/error/surface/background) and dark-mode block; Tailwind default gray/green/yellow/pink/purple/blue/red still used by index.html and main.js (left to T5 design pass).
- Review follow-ups (commit `7e8e38b`): vercel.json header sources use plain groups (path-to-regexp rejects `(?:`), images cache `max-age=604800, stale-while-revalidate=86400` (filenames are unhashed, no `immutable`), css/js 1h. site.test.mjs now checks every `class` token against output.css as an escaped selector (verified non-vacuous by injecting `btn-secondary`, `card-bordered`, `md:w-[13px]`; real HTML had no missing classes) plus vercel.json assertions; substring needles replaced by boundary regexes.
- T3 done, commit "feat: add processed logo, favicon set, og image and local placeholders" (hash `37a787f`). RED: `tests/assets.test.mjs` 8 of 9 failed (favicon set, manifest, logo variants, logo-source still deployed, Unsplash hotlinks, no icon links, invert filter, img width/height). GREEN: `npm test` 16/16 pass. Rationale: `scripts/build-images.py` (Pillow only, idempotent, verified by identical checksums on rerun) turns the JPEG into transparent PNGs by recoloring ink to exact brand colors with soft alpha (clean edges, amber figure not translucent); `logo-white.png` replaces the `brightness-0 invert` hack; the mark is isolated at the empty row band above the script; source moved to `assets-src/` so it is not deployed; Unsplash images downloaded once as local webp (8 unique photos, placeholders to be replaced with Claudia's real photos in T5/pending data); every img has width/height/alt, hero `fetchpriority="high"`, rest lazy.
- T3 review follow-ups (commit `a71d0fb`): `build-images.py` single `ink_strength`, loud failure when no TTF is found (no bitmap fallback), named OG constants, `primary_*` naming, `split_mark` guard for inkless images, docstring now "deterministic on hosts with the same fonts"; rerun gave byte-identical outputs (sha256 verified). `assets.test.mjs` now compares each local `<img>` width/height with the real pixel size read by `tests/helpers/image-size.mjs` (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X). RED: breaking the logo width (509 -> 500) failed with `logo.png: html 500x160, file 509x160`; restored, GREEN 17/17. "Compiled Tailwind CSS" comment moved directly above the stylesheet link.
- T4 done, commit `feat: config-driven contact links and web3forms submissions` (hash: see git log). RED: new `forms.test.mjs`, `main.test.mjs`, `config.test.mjs` and 8 new `site.test.mjs` cases: 13 of 30 tests failed (modules and config.js missing, forms/links/scripts markup absent). GREEN: `npm test` 63/63 pass. Rationale: `forms.js` is a DOM-free ES module (validation, payload, honeypot, `submitForm` with injectable fetch, `whatsappLink`, `initForms` wiring); `main.js` is now a module that exports a testable `applySiteConfig(config, root)` and only runs `init()` when `document` exists; unused library boilerplate (dropdowns, clipboard, toast, lazy-load, back-to-top, video) was dropped along with the toast-only fake form handler; one header-scroll implementation; carousel has reduced-motion (no autoplay), pause on hover/focus, labelled controls, slide `aria-roledescription`; scroll reveal hides only under `html.js` via `.js [data-animate]:not([data-revealed])` with a 4s CSS failsafe so a script failure cannot leave the page blank, reduced motion shows everything, no IntersectionObserver reveals all. `npm test` passes `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` because the browser ES modules live in a typeless package. Verified in headless Chrome: no console errors, empty config hides testimonials, empty-value contact links and the floating WhatsApp button. Deliberately left for T5: booking CTA markup (`data-link="booking"` is supported and tested but no element uses it yet), testimonials still ship fake text in the HTML (hidden by config), privacy/terms links still `href="#"` (T6), agenda dashed placeholder, copy rewrite.

## Next step
T5.

## Pending data from Claudia
WhatsApp number, email, socials, domain, Web3Forms key, booking URL, photo, bio, credentials, real testimonials, lead-magnet guide.
