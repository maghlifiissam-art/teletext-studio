# Implementation Plan: Teletext Studio

## Overview

Teletext Studio is a client-side web application with no build step, written in plain HTML, CSS, and JavaScript ES modules. The implementation follows the design document's layered architecture: a pure data model (model.js), a rendering subsystem (renderer.js, flash.js), an editing subsystem (editor.js), a navigation subsystem (navigator.js), I/O subsystems (exporter.js, urlcodec.js), and a UI/bootstrap layer (ui.js, main.js). Each task builds incrementally on prior tasks, ending with full integration. Property-based tests (fast-check under vitest) verify the 35 correctness properties defined in the design, each in its own test file so they can run in parallel. Unit and integration tests cover edge cases and non-functional constraints that are not universal properties.

## Tasks

- [x] 1. Set up project structure and static-file scaffolding
  - [x] 1.1 Create directory structure and `index.html`
    - Create `scripts/`, `styles/`, `assets/`, and `tests/` directories
    - Create `index.html` linking `styles/main.css` and loading `scripts/main.js` as an ES module (`<script type="module">`)
    - Define the page canvas container, toolbar containers, and Fastext link bar placeholders
    - _Requirements: 10.1, 10.2_
  - [x] 1.2 Create `styles/main.css` with base grid, control, responsive, RTL, and touch-target styles
    - Style the 40×24 cell grid using CSS grid; define the 8-colour teletext palette CSS variables
    - Add responsive rules below 768px viewport width to prevent horizontal scrolling
    - Set minimum 44×44 CSS px touch targets for non-canvas interactive controls
    - Include RTL layout rules via CSS logical properties for the Arabic toggle
    - _Requirements: 11.2, 11.4_
  - [x] 1.3 Create `assets/charset.json` — the 256-entry Teletext Charset table
    - Map codes 0x20–0x7E to printable ASCII glyphs (0x20 = space as the default/blank glyph)
    - Map codes 0x80–0xFF to the Arabic national-option subset (basic letters and presentation forms)
    - Provide both `codeToUnicode` and `unicodeToCode` lookup directions in the JSON structure
    - _Requirements: 12.3_
  - [x] 1.4 Set up test tooling — `package.json` with vitest and fast-check, vitest config
    - Add `package.json` with `vitest` and `fast-check` as devDependencies
    - Configure vitest for single-execution mode (`--run`); no watch mode in automated runs
    - Create `tests/properties/` and `tests/integration/` directories for test files
    - _Requirements: 10.2_

- [x] 2. Implement the pure data model in `scripts/model.js`
  - [x] 2.1 Implement Palette, Charset interface, Cell, Page, and Page_Set
    - Define `PALETTE` (8 colours in fixed order: black, red, green, yellow, blue, magenta, cyan, white), `FG_DEFAULT = 7`, `BG_DEFAULT = 0`
    - Implement `Charset` with `codeToUnicode(code)` and `unicodeToCode(ch)` (returns -1 for out-of-repertoire, mapped to space fallback)
    - Implement `defaultCell()` (space, fg=white, bg=black, text mode, mosaic=0, no flags), `switchMode(cell, mode)` (preserves fg/bg, inits mosaic=0), `toggleSextant(cell, bit)` (XOR bit 0..5)
    - Implement `Page` with `COLS=40`, `ROWS=24`, `MIN_PAGE=100`, `MAX_PAGE=899`, `newPage(number)` (960 default cells, all fastext null), `validPageNumber(n)`
    - Implement `Page_Set` with `newPageSet()`, `getPage()`, `addPage()`, `deletePage()`, `renamePage()` (preserves content), `nextAvailableNumber()` (smallest unused 100..899 or null)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4, 3.6, 6.1_
  - [x]* 2.2 Write property test for palette invariant
    - **Property 3: Palette invariant** — the palette has exactly eight colours in the fixed order black, red, green, yellow, blue, magenta, cyan, white with the specified hex values
    - **Validates: Requirements 2.1**
  - [x]* 2.3 Write property test for charset round trip
    - **Property 34: Charset round trip** — for every supported character (including Arabic subset), `codeToUnicode(unicodeToCode(ch)) == ch`; out-of-repertoire input maps to space
    - **Validates: Requirements 12.3**
  - [x]* 2.4 Write property test for sextant toggle being its own inverse
    - **Property 13: Sextant toggle is its own inverse** — `toggleSextant(toggleSextant(cell, b), b)` equals the original cell; a single toggle flips exactly that bit
    - **Validates: Requirements 3.2**
  - [x]* 2.5 Write property test for mode switch preserving colours and initialising mosaic
    - **Property 14: Mode switch preserves colours and initialises mosaic** — switching between text and mosaic preserves fg/bg, and entering mosaic mode sets pattern to 0
    - **Validates: Requirements 3.4, 3.6**
  - [x]* 2.6 Write property test for grid dimension invariant
    - **Property 1: Grid dimension invariant** — for any Page, the cells array has exactly 24 rows and each row has exactly 40 columns
    - **Validates: Requirements 1.1, 1.5**
  - [x]* 2.7 Write property test for default cell invariant
    - **Property 2: Default cell invariant** — every cell of a new Page equals the default cell (space, fg=white, bg=black, text, mosaic=0, no flags)
    - **Validates: Requirements 2.2**
  - [x]* 2.8 Write property test for page-number range invariant
    - **Property 18: Page-number range invariant** — every key in a PageSet's pages map is an integer in 100..899
    - **Validates: Requirements 6.1**
  - [x]* 2.9 Write property test for delete removing the page
    - **Property 21: Delete removes the page** — after `deletePage(n)`, the page is absent and the count decreases by exactly one
    - **Validates: Requirements 6.4**
  - [x]* 2.10 Write property test for rename preserving page content
    - **Property 22: Rename preserves page content** — after a valid rename, the page under the new number is content-identical (all cells, colours, flags, and Fastext targets preserved)
    - **Validates: Requirements 6.5**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the Renderer in `scripts/renderer.js`
  - [x] 4.1 Implement `computeCellVisual`, `renderToDOM`, and `renderToCanvas`
    - Implement `computeCellVisual(cell, opts)` returning a `CellVisual` (content, mosaic pattern, visible fg/bg, visibility flag) — the pure single source of truth for what a cell shows
    - Apply rendering rules: background in `PALETTE[cell.bg]`, foreground in `PALETTE[cell.fg]`; text mode draws `codeToUnicode(char)`, mosaic mode draws filled sextants in fg / empty in bg
    - Flashing: when `flashOn === false`, a flashing cell shows only its background; Conceal: when `revealed === false`, a concealed cell shows only its background
    - Implement `renderToDOM(container, page, opts)` rendering a DOM CSS-grid of 960 cell elements
    - Implement `renderToCanvas(ctx, page, opts)` at 12×10 px per cell (480×240 total) with sextant geometry `SEXTANT_COL_W=[6,6]`, `SEXTANT_ROW_H=[4,3,3]`
    - _Requirements: 2.7, 3.3, 4.1, 5.1, 5.2, 8.2_
  - [x]* 4.2 Write property test for render using cell foreground and background
    - **Property 11: Render uses cell foreground and background** — rendered fg equals `PALETTE[cell.fg]`, bg equals `PALETTE[cell.bg]`; mosaic set sextants draw in fg, clear in bg
    - **Validates: Requirements 2.7, 3.3**
  - [x]* 4.3 Write property test for flashing visibility following the phase
    - **Property 16: Flashing visibility follows the phase** — a flashing cell's content is visible when `flashOn` is true and hidden when false; non-flashing cells are unaffected
    - **Validates: Requirements 4.1**
  - [x]* 4.4 Write property test for concealed visibility following reveal
    - **Property 17: Concealed visibility follows reveal (round trip)** — concealed content is hidden when not revealed, shown when revealed; revealing then hiding restores hidden state; non-concealed cells are unaffected
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [x]* 4.5 Write property test for export dimension invariant
    - **Property 27: Export dimension invariant** — `renderToCanvas` produces exactly 480×240 pixels, each cell at a 12×10 region at position (col×12, row×10)
    - **Validates: Requirements 8.2**

- [x] 5. Implement the FlashController in `scripts/flash.js`
  - [x] 5.1 Implement `FlashController` with a single timer
    - Implement `start(onTick)` toggling `flashOn` every 500ms (one on/off cycle per second, 0.5s visible / 0.5s hidden) using a single interval/rAF accumulator
    - Implement `stop()` to clear the timer
    - The single timer guarantees all flashing cells share one phase synchronously
    - _Requirements: 4.2_
  - [x]* 5.2 Write unit test for flashing cadence using a controllable fake clock
    - Verify phase toggles every 500ms and all flashing cells share one phase
    - _Requirements: 4.2_

- [x] 6. Implement the Editor and Mosaic_Editor in `scripts/editor.js`
  - [x] 6.1 Implement Editor state, cursor, colour, mode, attribute, page management, and Mosaic_Editor
    - Implement `EditorState` (current PageSet, activePage, cursor, selection, fg, bg)
    - Implement `selectCell(row, col)`, `enterChar(ch)` (write + advance cursor with wrap: (r,39)→(r+1,0), (23,39)→(0,0); no-op if no selection), `deleteCell()` (clear to space; no-op if no selection)
    - Implement `setFg(c)`, `setBg(c)`, `applyFgToSelection(c)`, `applyBgToSelection(c)` for region colour application
    - Implement `setMode(mode)` (preserve fg/bg, init mosaic=0), `setFlashing(on)`, `setConcealed(on)` for selected cells
    - Implement `createPage()` (assign unique number or error if full), `deletePage(n)`, `renamePage(oldN, newN)` (reject out-of-range or duplicate with error, leave state unchanged), `setFastext(page, key, target)`
    - Implement `MosaicEditor` with `toggleSextantAt(row, col, bit)` and `sextantFromPoint(cellRect, x, y)` deriving the sextant bit (0..5) from pointer/touch position in the 2×3 grid
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 2.3, 2.4, 2.5, 2.6, 3.2, 3.4, 3.5, 3.6, 4.3, 4.4, 5.5, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.4_
  - [x]* 6.2 Write property test for cursor selection placing the cursor
    - **Property 4: Cursor selection places the cursor** — `selectCell(r, c)` sets the cursor to exactly `{row: r, col: c}`
    - **Validates: Requirements 1.2**
  - [x]* 6.3 Write property test for character entry writing the selected cell
    - **Property 5: Character entry writes the selected cell** — `enterChar` writes the character (mapped through Charset) into the selected cell
    - **Validates: Requirements 1.3**
  - [x]* 6.4 Write property test for deletion clearing to space
    - **Property 6: Deletion clears to space** — `deleteCell` sets the selected cell's character to space (0x20)
    - **Validates: Requirements 1.4**
  - [x]* 6.5 Write property test for cursor advancing with wrap
    - **Property 7: Cursor advances with wrap** — after writing a character, the cursor moves to the row-major successor with wrap at row and page boundaries
    - **Validates: Requirements 1.6**
  - [x]* 6.6 Write property test for no selection being a no-op
    - **Property 8: No selection is a no-op** — when cursor is null, `enterChar` and `deleteCell` leave the Page byte-identical
    - **Validates: Requirements 1.7, 1.8**
  - [x]* 6.7 Write property test for colour selection applying to subsequent entries
    - **Property 9: Colour selection applies to subsequent entries** — after `setFg(c)`/`setBg(c)`, every subsequently entered character has that colour until changed
    - **Validates: Requirements 2.3, 2.4**
  - [x]* 6.8 Write property test for region colour application
    - **Property 10: Region colour application** — `applyFgToSelection(c)`/`applyBgToSelection(c)` sets the colour on exactly the cells inside the region, leaving outside cells unchanged
    - **Validates: Requirements 2.5, 2.6**
  - [x]* 6.9 Write property test for attribute flags applying to the selection
    - **Property 15: Attribute flags apply to the selection** — `setFlashing(b)` sets `flashing == b` and `setConcealed(b)` sets `concealed == b` on exactly the selected cells
    - **Validates: Requirements 4.3, 4.4, 5.5**
  - [x]* 6.10 Write property test for new page assigning a unique in-range number or erroring when full
    - **Property 19: New page assigns a unique in-range number, or errors when full** — returns an unused number in 100..899 and adds a page; when all 800 are assigned, signals an error and leaves the PageSet unchanged
    - **Validates: Requirements 6.2, 6.7**
  - [x]* 6.11 Write property test for invalid rename being rejected and preserving state
    - **Property 20: Invalid rename is rejected and preserves state** — out-of-range or duplicate target is rejected with an error and the PageSet is unchanged
    - **Validates: Requirements 6.3, 6.6**
  - [x]* 6.12 Write property test for Fastext target assignment
    - **Property 25: Fastext target assignment** — after `setFastext(page, key, target)`, the page's `fastext[key]` equals the target
    - **Validates: Requirements 7.4**
  - [x]* 6.13 Write property test for mosaic geometry
    - **Property 12: Mosaic geometry** — a mosaic cell has exactly six sextant positions arranged as 2 columns × 3 rows, pattern is an integer in 0..63
    - **Validates: Requirements 3.1**
  - [x]* 6.14 Write unit test for mosaic input from pointer and touch events
    - Verify `sextantFromPoint` maps both pointer and touch coordinates to the correct sextant bit (0..5) in the 2×3 grid
    - _Requirements: 3.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the Navigator in `scripts/navigator.js`
  - [x] 8.1 Implement Navigator with `goTo`, `activateFastext`, `requestReveal`, `requestHide`
    - Implement `goTo(n)` — display the page if it exists (Req. 7.1); if not, show page-not-found indicator and stay on current page (Req. 7.6)
    - Implement `activateFastext(page, key)` — navigate to the targeted page number if it exists (Req. 7.3); if target is missing/null, show page-not-found indicator and stay (Req. 7.5)
    - Implement `requestReveal()` / `requestHide()` to toggle concealed cell visibility on the current page
    - Expose exactly four Fastext keys in the fixed order red, green, yellow, cyan (Req. 7.2)
    - _Requirements: 5.3, 5.4, 7.1, 7.2, 7.3, 7.5, 7.6_
  - [x]* 8.2 Write property test for navigation to an existing target succeeding
    - **Property 23: Navigation to an existing target succeeds** — `goTo(n)` succeeds and sets current to n for existing pages; `activateFastext` succeeds and sets current to t for existing targets
    - **Validates: Requirements 7.1, 7.3**
  - [x]* 8.3 Write property test for four Fastext keys
    - **Property 24: Four Fastext keys** — the Navigator exposes exactly four Fastext keys in the fixed order red, green, yellow, cyan
    - **Validates: Requirements 7.2**
  - [x]* 8.4 Write property test for missing navigation target being rejected
    - **Property 26: Missing navigation target is rejected, current unchanged** — direct entry or Fastext activation whose target does not exist (or is null) is rejected with a page-not-found indicator and current page unchanged
    - **Validates: Requirements 7.5, 7.6**

- [x] 9. Implement the Exporter in `scripts/exporter.js`
  - [x] 9.1 Implement `exportPng` with canvas rendering and download
    - Call `renderToCanvas` with `flashOn=true` and `revealed=true` (Req. 8.3, 8.4), then `canvas.toBlob('image/png')` and trigger a download (Req. 8.1)
    - On `toBlob` failure or unavailability, notify the designer with an "export failed" error and leave the page unchanged (Req. 8.5)
    - _Requirements: 8.1, 8.3, 8.4, 8.5_
  - [x]* 9.2 Write property test for export rendering fully visible
    - **Property 28: Export renders fully visible** — flashing or concealed cells render with content shown (equivalent to `flashOn == true` and `revealed == true`)
    - **Validates: Requirements 8.3, 8.4**
  - [x]* 9.3 Write unit test for PNG export error path when toBlob fails
    - Verify the exporter surfaces an "export failed" error and leaves the page unchanged when `toBlob` is unavailable or throws
    - _Requirements: 8.5_

- [x] 10. Implement the URL codec in `scripts/urlcodec.js`
  - [x] 10.1 Implement `URL_Encoder` and `URL_Decoder` with serialize, compress, and base64url
    - Implement `serialize(ps)` producing the versioned byte format (magic "TT", version 1, pageCount varint, per-page header + cell stream with RUN_DEFAULT/CELL_TEXT/CELL_MOSAIC tokens and packed attrs byte)
    - Implement `deserialize(bytes)` reversing each token; reject bad magic/version/truncation with an error + empty PageSet
    - Implement `compress`/`decompress` via `CompressionStream`/`DecompressionStream` with `deflate-raw` format
    - Implement `base64url`/`unbase64url` (URL-safe, stripped padding)
    - Implement `encode(ps)` → `baseURL + "#t=" + base64url(compress(serialize(ps)))`; check 30000-char limit and surface "too large" error without producing a URL (Req. 9.8)
    - Implement `encodePage(p)` → single-page URL within the 4000-char limit (Req. 9.7)
    - Implement `decode(url)` → reverse pipeline; on invalid/altered input, return empty PageSet with error (Req. 9.5)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - [x]* 10.2 Write property test for URL encode/decode round trip
    - **Property 29: URL encode/decode round trip** — `decode(encode(ps))` is structurally identical to ps (same page count, numbers, Fastext targets, and all cell fields)
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.6**
  - [x]* 10.3 Write property test for invalid URL decoding to an empty Page_Set
    - **Property 33: Invalid URL decodes to an empty Page_Set** — truncated, wrong magic, unsupported version, or corrupted payloads signal an invalid-URL error and load an empty PageSet
    - **Validates: Requirements 9.5**
  - [x]* 10.4 Write property test for single-page URL size bound
    - **Property 30: Single-page URL size bound** — `encodePage` produces a URL no more than 4000 characters for any Page
    - **Validates: Requirements 9.7**
  - [x]* 10.5 Write property test for page-set URL size bound on success
    - **Property 31: Page-set URL size bound on success** — for any PageSet that encodes without the too-large error, the resulting URL is no more than 30000 characters
    - **Validates: Requirements 9.1**
  - [x]* 10.6 Write property test for oversized page set being rejected
    - **Property 32: Oversized page set is rejected** — for any PageSet whose encoded URL would exceed 30000 characters, `encode` signals a "too large to share" error and produces no URL
    - **Validates: Requirements 9.8**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement UI wiring, language/RTL toggle, and mobile/touch soft input in `scripts/ui.js`
  - [x] 12.1 Implement UI controls, language/RTL toggle, and on-screen soft input
    - Wire toolbar controls to Editor methods (cell selection, character entry, deletion, colour selection, mode toggle, flashing/conceal toggles, page create/delete/rename, Fastext assignment)
    - Wire the page canvas to Renderer and FlashController; wire Fastext link bar to Navigator
    - Implement the language/direction toggle: set `<html dir>` and `lang`, flip UI layout via CSS logical properties, switch labels (English/LTR default, Arabic/RTL on toggle); toggling changes only UI presentation, never mutates Page content
    - Implement on-screen soft input (character palette, colour swatches, sextant grid) so users without a physical keyboard can select cells, enter characters, toggle sextants, and set colours via touch
    - _Requirements: 1.1, 2.3, 2.4, 3.5, 4.3, 4.4, 5.5, 7.1, 7.4, 11.1, 11.5, 12.1, 12.2, 12.4, 12.5_
  - [x]* 12.2 Write property test for language/direction toggle preserving the model
    - **Property 35: Language/direction toggle preserves the model** — toggling UI language and text direction leaves the PageSet byte-identical
    - **Validates: Requirements 12.4**
  - [x]* 12.3 Write unit test for language/RTL toggle UI state transitions and Arabic RTL rendering
    - Verify the UI defaults to English/LTR, the toggle control is present, switching applies Arabic labels and RTL layout, and Arabic text renders RTL within cells
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  - [x]* 12.4 Write unit test for touch selection and touch Fastext activation wiring
    - Verify tapping a cell selects it via touch input, and tapping a Fastext link navigates to the target page via touch input
    - _Requirements: 11.1, 11.3_

- [x] 13. Implement bootstrap and URL hash loading in `scripts/main.js`
  - [x] 13.1 Implement application bootstrap and startup URL hash loading
    - On load, read `location.hash`; if a valid `#t=` payload is present, call `URL_Decoder.decode` to rebuild the PageSet; otherwise create an empty PageSet with a single default page (100)
    - Initialise the Editor, Renderer, FlashController, Navigator, and UI; start the FlashController
    - Wire the Exporter and URL_Encoder to their UI triggers (PNG export button, share-URL button)
    - _Requirements: 9.3, 10.1, 10.5, 10.6_

- [ ] 14. Refine mobile/touch responsive CSS in `styles/main.css`
  - [ ] 14.1 Refine responsive layout, touch targets, and no-horizontal-scroll behaviour
    - Ensure all non-canvas interactive controls are at least 44×44 CSS px (Req. 11.2)
    - Ensure no horizontal scrolling below 768px viewport width (Req. 11.4); scale the canvas to fit
    - Verify the soft input controls are reachable and usable via touch only (Req. 11.5)
    - _Requirements: 11.2, 11.4, 11.5_

- [ ] 15. Integration and end-to-end wiring
  - [ ] 15.1 Wire all components together and verify end-to-end operation
    - Update `index.html` and `scripts/main.js` to load all modules and connect the full editing → rendering → navigation → export → URL-share flow
    - Verify the app operates with no build step as static files (Req. 10.2, 10.5)
    - Verify all interactive features work after initial load with no network connection (Req. 10.6)
    - _Requirements: 10.1, 10.2, 10.5, 10.6_
  - [ ]* 15.2 Write integration and smoke tests
    - Test offline operation after initial load (Req. 10.6); assert no runtime third-party network calls (Req. 10.4)
    - Verify no-build static hosting works (Req. 10.2, 10.5); verify touch targets ≥ 44×44 px (Req. 11.2)
    - Verify no horizontal scroll below 768px (Req. 11.4); verify touch-only operation for core actions (Req. 11.5)
    - Verify default UI is English/LTR and the language toggle is present (Req. 12.1, 12.5)
    - _Requirements: 10.2, 10.4, 10.5, 10.6, 11.2, 11.4, 11.5, 12.1, 12.5_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests (fast-check, minimum 100 iterations each) validate the 35 universal correctness properties defined in the design document; each property test is in its own file so they run in parallel
- Unit tests cover edge cases and non-property behaviours (mosaic input, flashing cadence, export errors, RTL rendering, touch wiring)
- Integration/smoke tests verify non-functional constraints (offline, no-build, touch targets, responsive, RTL default)
- The implementation is plain JavaScript ES modules with no build step; TypeScript-style signatures in the design are documentation only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12", "6.13", "6.14"] },
    { "id": 6, "tasks": ["5.2"] },
    { "id": 7, "tasks": ["7"] },
    { "id": 8, "tasks": ["8.1", "9.1", "10.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4", "9.2", "9.3", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 10, "tasks": ["11"] },
    { "id": 11, "tasks": ["12.1"] },
    { "id": 12, "tasks": ["12.2", "12.3", "12.4", "13.1", "14.1"] },
    { "id": 13, "tasks": ["15.1"] },
    { "id": 14, "tasks": ["15.2"] },
    { "id": 15, "tasks": ["16"] }
  ]
}
```
