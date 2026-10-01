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
- [ ] T3 Images (Pillow script, trimmed logo, favicon set, og-image, local placeholders) — route: delegated writer
- [ ] T4 JS consolidation (`config.js`, `forms.js` test-first, inline scripts into `main.js`) — route: delegated writer
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

## Next step
T3.

## Pending data from Claudia
WhatsApp number, email, socials, domain, Web3Forms key, booking URL, photo, bio, credentials, real testimonials, lead-magnet guide.
