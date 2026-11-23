# Teletext Studio

A browser-based teletext page editor that resurrects the 1970s Ceefax/ORACLE
authoring experience as a modern creative tool. Design authentic teletext
pages on a 40x24 character grid with the original 8-colour palette, mosaic
(sextant) graphics, flash and conceal attributes, then share your pages as
compressed URLs or export them as PNG images.

**Kiroween 2026 entry — Resurrection category.**

## Live demo

Deployed with GitHub Pages. See the link in the repository sidebar
(`https://maghlifiissam-art.github.io/teletext-studio/`).

## Features

- Authentic 40x24 teletext grid with the classic teletext character set,
  rendered on a canvas with per-cell colours, double-height rows, flash and
  conceal/reveal
- Mosaic graphics mode with 2x3 sextant blocks and a dedicated 0-9/A-Z
  mosaic input keyboard
- Multi-page magazine: create, rename, delete and navigate pages (P100-P899)
  with Fastext-coloured quick links
- Seven-colour palette plus black, with regional paint, separate
  text/mosaic/background attributes
- English/Arabic UI toggle with full RTL layout; the page model is preserved
  across language switches
- Share pages as self-contained compressed URLs (fits in 4,000 characters)
  or export the visible page as a PNG
- Touch-first on phones and tablets: tap-to-paint, soft keyboards, responsive
  layout

## Run locally

No build step. Serve the directory with any static file server:

```bash
npx serve .
```

then open the printed URL. Opening `index.html` directly from disk also
works in most browsers.

## Tests

```bash
npm install
npm test          # 81 unit, integration and property-based tests (vitest + fast-check)
node tests/browser/verify.mjs   # 23 real-browser checks (headless Chromium via playwright)
```

## Built with Kiro

This project was developed with [Kiro](https://kiro.dev), using its
spec-driven workflow:

- **Spec authored with Kiro**: the full spec in
  [`.kiro/specs/teletext-studio/`](.kiro/specs/teletext-studio/) —
  `requirements.md` (35 acceptance criteria in EARS notation), `design.md`
  and `tasks.md` (16 implementation tasks) — was produced in Kiro sessions
  and drives the whole implementation.
- **Implemented with Kiro**: project scaffolding and the pure data model
  (`scripts/model.js`) with its 11 property-based tests (Kiro tasks 1-3),
  plus the start of the canvas renderer (`scripts/renderer.js`), begun in
  the same Kiro session (task 4) before the quota ran out.
- **Manual completion**: the Kiro free-tier monthly quota was exhausted
  mid-session during task 4. The renderer and its property tests were
  finished manually, and tasks 5-16 (flash controller, editor and mosaic
  input, navigator, PNG exporter, URL codec, UI wiring, language toggle,
  responsive CSS and integration) were implemented manually; manual commits
  from task 8 onward are marked in their messages. These modules will be
  reviewed and refined with Kiro once the monthly quota resets, and the
  property tests designed in the Kiro spec phase cover every module.

## Tech

Plain HTML, CSS and JavaScript. No frameworks, no build step. Tests use
vitest, fast-check, jsdom and playwright.

## Licence

MIT — see [LICENSE](LICENSE).
