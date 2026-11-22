# Design Document

## Introduction

This document specifies the technical design for **Teletext Studio**, a client-side web application that recreates 1980s broadcast teletext (BBC Ceefax / ITV ORACLE) as a creative page-design tool. The design derives directly from `requirements.md` and is detailed enough that the task list can be generated from it without further design decisions.

The application is plain HTML, CSS, and JavaScript with **no build step, no backend, no accounts, and no external/AI services**. It is statically hostable at zero cost. Everything runs in the browser: editing 40×24 teletext pages, mosaic/block graphics via sextant cells, flashing and conceal modes, page-set management with 3-digit page numbers (100–899), Fastext navigation, PNG export, and shareable-URL import/export.

### Research Conducted

The following areas were researched to inform key technical decisions; findings are cited inline where they affect the design.

1. **In-browser lossless compression.** The Compression Streams API (`CompressionStream` / `DecompressionStream`) supports the `gzip`, `deflate`, and `deflate-raw` formats and is now supported across all three browser engines (Chrome 80+, Edge 80+, Firefox 113+, Safari 16.4+). `deflate-raw` is the most compact because it omits the gzip/zlib header and checksum overhead, so it is the right choice for a size-constrained URL payload. Using the built-in API means **no external compression library** is needed, which keeps the app dependency-free and consistent with the no-build, zero-cost constraints. ([web.dev: Compression Streams](https://web.dev/blog/compressionstreams), [MDN: Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API))
2. **Teletext mosaic / sextant representation.** Authentic teletext "alpha-mosaic" graphics divide each character cell into a 2-column × 3-row grid of six sub-cells ("sextants"). Unicode 13.0 added a "Symbols for Legacy Computing" block (U+1FB00–U+1FBFF) containing exactly these 60+ sextant glyphs, confirming the 2×3 / six-sub-cell model and the 64-combination space (2⁶). Font support for that Unicode block is uneven and does not give per-cell foreground/background colour control, so this design uses an **internal 6-bit pattern** rather than rendering Unicode sextant glyphs. ([Wikipedia: Symbols for Legacy Computing](https://en.wikipedia.org/wiki/Symbols_for_Legacy_Computing))
3. **PNG export.** Canvas 2D `toBlob('image/png')` / `toDataURL('image/png')` are standard, dependency-free, and sufficient.
4. **base64url.** URL-safe base64 (`-` and `_` instead of `+` and `/`, stripped `=` padding) is the standard way to embed binary in a URL fragment.

## Overview

Teletext Studio is structured as a single-page application with a clear separation between a **pure data model** (Page / Cell / Page_Set), an **editing subsystem**, a **rendering subsystem**, a **navigation subsystem**, and **I/O subsystems** (PNG export, URL encode/decode). The UI is a thin layer that wires user actions to subsystem calls and reflects model state.

The core invariant is that all behaviour is driven by the pure data model, and all output paths (screen, PNG, shareable URL) are deterministic functions of that model. This makes the system testable: the URL encode/decode round-trip, grid dimension invariants, page-number range invariants, and mosaic-toggle behaviour are all expressible as properties over the model.

### High-Level Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rendering surface for editing | DOM CSS-grid of 960 cell elements | Per-cell click/touch targeting, easy selection/cursor, CSS-driven flashing and conceal via container-level class toggles |
| Rendering surface for PNG | Offscreen `<canvas>` at 12×10 px per cell → 480×240 px | Exact pixel dimensions required by Req. 8.2; `toBlob` produces the PNG |
| Display vs. export rendering | Two backends sharing one geometry/colour model | DOM is best for interaction; canvas is required for exact-pixel export. Both consult the same Page data and the same palette/sextant definitions |
| Compression | `deflate-raw` via `CompressionStream` | Built-in, dependency-free, most compact format, all-browser support |
| URL encoding | base64url | URL-safe binary embedding |
| Flashing cadence | Single 500 ms timer toggling a container attribute | Guarantees synchronous flashing of all cells (Req. 4.2) without per-cell timers |
| Character storage | Single-byte code into a 256-entry Teletext Charset | Guarantees the 4000-char single-page URL limit (Req. 9.7) and supports Arabic via a national-option subset (Req. 12.3) |

## Architecture

The system is layered into four tiers. Each tier depends only on the tier below it; the UI never reaches past the subsystem tier, and the I/O subsystems never touch the DOM.

```mermaid
flowchart TB
    subgraph UI["UI Layer (HTML/CSS/JS)"]
        UIToolbar[Toolbars & Controls]
        UICanvas[Page Canvas (DOM grid)]
        UILang[Language / RTL Toggle]
    end

    subgraph Subsystems["Subsystem Layer"]
        Editor[Editor]
        Mosaic[Mosaic_Editor]
        Navigator[Navigator]
        Renderer[Renderer]
        Flash[FlashController]
        Exporter[Exporter]
        Enc[URL_Encoder]
        Dec[URL_Decoder]
    end

    subgraph Model["Data Model Layer (pure)"]
        PageSet[Page_Set]
        Page[Page]
        Cell[Cell]
        Palette[Palette]
        Charset[Charset]
    end

    subgraph IOTargets["I/O Targets"]
        Blob[PNG Blob / download]
        URLHash[URL hash]
        LocalState[App state]
    end

    UIToolbar --> Editor
    UIToolbar --> Mosaic
    UIToolbar --> Navigator
    UICanvas --> Renderer
    Editor --> Model
    Mosaic --> Model
    Navigator --> Model
    Renderer --> Model
    Flash --> Renderer
    Exporter --> Renderer
    Exporter --> Blob
    Enc --> Model
    Dec --> Model
    Enc --> URLHash
    Dec --> URLHash
    UILang --> UI
```

Data flow at a glance:

- **Editing:** user action → `Editor`/`Mosaic_Editor` mutates the `Page` (in `Page_Set`) → `Renderer` re-renders the DOM grid → `FlashController` drives flashing.
- **Browsing:** viewer action → `Navigator` selects a `Page` from `Page_Set` → `Renderer` renders it (read-only) → Fastext links route to the next `Page`.
- **PNG export:** `Exporter` calls `Renderer.renderToCanvas` at 12×10 px → `canvas.toBlob('image/png')` → download.
- **URL share/import:** `URL_Encoder` serialises `Page_Set` → `deflate-raw` → `base64url` → URL hash; `URL_Decoder` reverses it, rebuilding `Page_Set`.

### Static-File Layout (no build step)

```
/teletext-studio/
  index.html            # single page, links CSS + JS
  styles/
    main.css            # grid, controls, responsive, RTL, touch targets
  scripts/
    model.js            # Palette, Charset, Cell, Page, Page_Set (pure)
    renderer.js         # renderToDOM, renderToCanvas
    flash.js            # FlashController
    editor.js           # Editor + Mosaic_Editor
    navigator.js        # Navigator
    exporter.js         # PNG export
    urlcodec.js         # URL_Encoder + URL_Decoder (serialize, compress, base64url)
    ui.js                # wiring, language/RTL toggle, mobile/touch
    main.js             # bootstrap, load URL hash on startup
  assets/
    charset.json        # 256-entry Teletext Charset table (Latin + Arabic)
```

Each script is a plain ES module loaded with `<script type="module" src="...">`. No bundler, no transpiler, no package manager required. This satisfies Req. 10 (client-side, no build, no backend, no third-party runtime calls).

## Components and Interfaces

The interfaces below use TypeScript-style signatures to communicate contracts precisely; the implementation is plain JavaScript ES modules. `Page`, `Cell`, and `Page_Set` types are defined in Data Models.

### Palette and Charset (model.js)

```ts
// Authentic 8-colour teletext palette. Index is the stored colour value (0..7).
const PALETTE: readonly string[] = [
  "#000000", // 0 black
  "#FF0000", // 1 red
  "#00FF00", // 2 green
  "#FFFF00", // 3 yellow
  "#0000FF", // 4 blue
  "#FF00FF", // 5 magenta
  "#00FFFF", // 6 cyan
  "#FFFFFF", // 7 white
];
const FG_DEFAULT = 7; // white  (Req. 2.2)
const BG_DEFAULT = 0; // black  (Req. 2.2)

// 256-entry single-byte character repertoire.
// 0x00..0x7F : Latin/ASCII printable subset (0x20 = space is the default glyph).
// 0x80..0xFF : Arabic national-option subset (basic letters + presentation forms).
// Provides code <-> unicode mappings used by the Editor and the URL codec.
interface Charset {
  codeToUnicode(code: number): string;        // 0..255 -> glyph string
  unicodeToCode(ch: string): number;         // glyph -> 0..255, or -1 if unsupported (fallback)
}
const CHARSET: Charset;
```

### Cell (model.js)

```ts
type ColourIndex = number;   // 0..7
type Mode = "text" | "mosaic";

interface Cell {
  mode: Mode;                 // text/mosaic flag (Req. glossary "Cell")
  char: number;               // single-byte charset code 0..255 (text mode); 0x20 default
  mosaic: number;             // 6-bit sextant fill pattern 0..63 (mosaic mode); 0 default (Req. 3.6)
  fg: ColourIndex;            // foreground colour (Req. 2)
  bg: ColourIndex;            // background colour (Req. 2)
  flashing: boolean;          // Req. 4
  concealed: boolean;          // Req. 5
}

function defaultCell(): Cell;            // space, fg=white, bg=black, text, no flags, mosaic=0
function switchMode(cell: Cell, mode: Mode): Cell;  // preserves fg & bg (Req. 3.4)
function toggleSextant(cell: Cell, bit: number): Cell; // XOR bit 0..5 (Req. 3.2); idempotent inverse
```

Sextant bit layout (2 columns × 3 rows):

```
bit0  bit1     <- top row    (left, right)
bit2  bit3     <- middle row (left, right)
bit4  bit5     <- bottom row (left, right)
```

A set bit means the sextant is filled (drawn in `fg`); a clear bit is empty (drawn in `bg`). Toggling a bit is `mosaic ^= (1 << bit)`, which is its own inverse.

### Page (model.js)

```ts
const COLS = 40;
const ROWS = 24;
const MIN_PAGE = 100;
const MAX_PAGE = 899;
const FASTEXT_KEYS = ["red", "green", "yellow", "cyan"] as const;

interface FastextLinks { red: number | null; green: number | null; yellow: number | null; cyan: number | null; }

interface Page {
  number: number;                 // 100..899 (Req. 6.1)
  cells: Cell[][];                 // cells[row][col], ROWS × COLS  (Req. 1.1)
  fastext: FastextLinks;           // targets 100..899 or null  (Req. 7.4)
}

function newPage(number: number): Page;        // 960 default cells, all fastext null
function validPageNumber(n: number): boolean;  // Number.isInteger && 100 <= n <= 899
```

### Page_Set (model.js)

```ts
interface PageSet {
  pages: Map<number, Page>;        // keyed by page number 100..899 (Req. 6.1)
}

function newPageSet(): PageSet;
function getPage(ps: PageSet, n: number): Page | undefined;
function addPage(ps: PageSet, p: Page): void;             // assumes number unique & valid
function deletePage(ps: PageSet, n: number): void;        // Req. 6.4
function renamePage(ps: PageSet, oldN: number, newN: number): void; // moves page, preserves content (Req. 6.5)
function nextAvailableNumber(ps: PageSet): number | null; // smallest unused 100..899, or null if full (Req. 6.7)
```

### Editor (editor.js)

Owns the editing cursor and the current foreground/background colour selection, and translates user actions into model mutations. It does **not** touch the DOM directly; after each mutation it notifies the UI/Renderer.

```ts
interface EditorState {
  current: PageSet;
  activePage: number;             // page being edited
  cursor: { row: number; col: number } | null;   // selected cell, or null (Req. 1.2 / 1.7 / 1.8)
  selection: { row0: number; col0: number; row1: number; col1: number } | null; // region (Req. 2.5/2.6)
  fg: ColourIndex;                // applied to subsequently entered chars (Req. 2.3)
  bg: ColourIndex;               // applied to subsequently entered chars (Req. 2.4)
}

interface Editor {
  selectCell(row: number, col: number): void;        // Req. 1.2
  enterChar(ch: string): void;                        // write to selected cell, advance cursor (Req. 1.3 / 1.6); no-op if no selection (Req. 1.7)
  deleteCell(): void;                                  // clear selected cell to space (Req. 1.4); no-op if no selection (Req. 1.8)
  setFg(c: ColourIndex): void;                         // Req. 2.3
  setBg(c: ColourIndex): void;                         // Req. 2.4
  applyFgToSelection(c: ColourIndex): void;           // Req. 2.5
  applyBgToSelection(c: ColourIndex): void;            // Req. 2.6
  setMode(mode: Mode): void;                          // switch active/selected cell(s); preserve fg/bg (Req. 3.4); init mosaic=0 (Req. 3.6)
  setFlashing(on: boolean): void;                     // Req. 4.3 / 4.4
  setConcealed(on: boolean): void;                    // Req. 5.5
  createPage(): number;                                // assign unique number (Req. 6.2) or error if full (Req. 6.7)
  deletePage(n: number): void;                         // Req. 6.4
  renamePage(oldN: number, newN: number): void;        // reject out-of-range (Req. 6.3) or duplicate (Req. 6.6)
  setFastext(page: number, key: FastextKey, target: number | null): void; // Req. 7.4
}

// Cursor advance rule (Req. 1.6):
function advanceCursor(row: number, col: number): { row: number; col: number } {
  let c = col + 1;
  let r = row;
  if (c >= COLS) { c = 0; r = r + 1; }
  if (r >= ROWS) { r = 0; }      // last cell of page wraps to first cell
  return { row: r, col: c };
}
```

### Mosaic_Editor (editor.js)

Handles sextant toggling for the active/selected cell(s), accepting input from both pointer and touch (Req. 3.5).

```ts
interface MosaicEditor {
  toggleSextantAt(row: number, col: number, bit: number): void;  // Req. 3.2 (invert)
  // bit is derived from pointer/touch position within the cell's 2×3 grid
  sextantFromPoint(cellRect: DOMRect, x: number, y: number): number; // 0..5
}
```

### Renderer (renderer.js)

Produces a visual representation of a `Page`. Two backends share the same palette, charset, and sextant geometry so screen and export never diverge.

```ts
interface RenderOpts { revealed: boolean; flashOn: boolean; } // flashOn affects only flashing cells (Req. 4.1); revealed affects only concealed cells (Req. 5.1-5.4)

interface Renderer {
  renderToDOM(container: HTMLElement, page: Page, opts: RenderOpts): void;
  renderToCanvas(ctx: CanvasRenderingContext2D, page: Page, opts: RenderOpts): void; // cellW=12, cellH=10 (Req. 8.2)
}

// Shared geometry for canvas export. Cell = 12x10; 2 sextant cols of 6px; rows total 10 -> [4,3,3] (deterministic integer split).
const EXPORT_CELL_W = 12, EXPORT_CELL_H = 10;
const SEXTANT_COL_W = [6, 6];
const SEXTANT_ROW_H = [4, 3, 3]; // top, middle, bottom  (sums to 10)

// Pure visual plan: the single source of truth for "what a cell shows".
// Both backends (DOM, canvas) consume CellVisual, so rendering rules are
// testable without a DOM or canvas (used by the property-based tests).
interface CellVisual {
  content: string | "mosaic";   // glyph to draw, or "mosaic" (draw the sextant pattern)
  mosaic: number;               // sextant pattern (only when content === "mosaic")
  fg: ColourIndex;              // visible foreground colour
  bg: ColourIndex;              // visible background colour
  visible: boolean;             // false => cell shows ONLY its background (flashing-hidden or concealed-hidden)
}
function computeCellVisual(cell: Cell, opts: RenderOpts): CellVisual;
```

Rendering rules implemented by both backends (all encoded in `computeCellVisual`):

- Background of every cell is drawn in `PALETTE[cell.bg]`; foreground content in `PALETTE[cell.fg]` (Req. 2.7 / 3.3).
- **Text mode:** draw `CHARSET.codeToUnicode(cell.char)`.
- **Mosaic mode:** for each set sextant bit, fill that sub-rectangle in `fg`; clear sextants show `bg`.
- **Flashing** (Req. 4.1): when `flashOn === false`, a `flashing` cell shows only its background (content hidden). When `true`, content is shown.
- **Conceal** (Req. 5.1–5.4): when `revealed === false`, a `concealed` cell shows only its background; when `true`, content is shown.
- PNG export always passes `flashOn = true` (Req. 8.3) and `revealed = true` (Req. 8.4).

### FlashController (flash.js)

A single timer drives all flashing cells synchronously (Req. 4.2: one on/off cycle per second, 0.5 s visible / 0.5 s hidden).

```ts
interface FlashController {
  start(onTick: (flashOn: boolean) => void): void;  // toggles flashOn every 500ms
  stop(): void;
}
// Implementation: a single interval/rAF accumulator. Each tick flips a boolean and
// calls onTick, which the UI maps to a container attribute (data-flash-phase="on"|"off").
// CSS hides flashing-cell content when phase is "off", guaranteeing sync across all cells.
```

### Navigator (navigator.js)

Lets a viewer browse a `Page_Set` by number and via Fastext links (Req. 7).

```ts
interface NavigatorState { current: number; } // displayed page number

interface Navigator {
  goTo(n: number): { ok: boolean; current: number };  // Req. 7.1 (found) / 7.6 (not found -> stay, show indicator)
  activateFastext(page: Page, key: FastextKey): { ok: boolean; current: number }; // Req. 7.3 / 7.5
  requestReveal(): void;   // Req. 5.3
  requestHide(): void;     // Req. 5.4
}
```

### Exporter (exporter.js)

```ts
interface Exporter {
  exportPng(page: Page): Promise<void>; // renderToCanvas -> toBlob('image/png') -> download (Req. 8.1 / 8.2)
  // flashOn=true, revealed=true (Req. 8.3 / 8.4)
  // On failure -> notify with error, page unchanged (Req. 8.5)
}
```

### URL_Encoder / URL_Decoder (urlcodec.js)

```ts
interface UrlCodec {
  encode(ps: PageSet): string;            // payload = base64url(deflate-raw(serialize(ps))); URL = base + "#t=" + payload (Req. 9.1 / 9.6)
  encodePage(p: Page): string;            // single-page URL (Req. 9.7)
  decode(url: string): PageSet;           // reverse; on invalid/altered -> error + empty PageSet (Req. 9.3 / 9.5)
}

// Pipeline helpers (pure, testable):
function serialize(ps: PageSet): Uint8Array;
function deserialize(bytes: Uint8Array): PageSet;
function compress(bytes: Uint8Array): Uint8Array;     // deflate-raw via CompressionStream
function decompress(bytes: Uint8Array): Uint8Array;   // inflate-raw via DecompressionStream
function base64url(bytes: Uint8Array): string;
function unbase64url(s: string): Uint8Array;
```

## Data Models

### In-Memory Representation

The model is plain JS objects/arrays:

- `PageSet.pages` is a `Map<number, Page>` keyed by page number.
- `Page.cells` is a `ROWS × COLS` (24 × 40) array of arrays of `Cell`.
- `Cell` is a flat object with the fields in the interface above. Colour and content are stored as small integers (colour 0–7, char 0–255, mosaic 0–63, plus boolean flags and a mode tag). This keeps memory small and makes serialization a direct byte copy.

Default cell: `{ mode: "text", char: 0x20, mosaic: 0, fg: 7, bg: 0, flashing: false, concealed: false }`.

### Teletext Charset

A 256-entry table maps the single-byte `char` code to a Unicode glyph and back:

- `0x20` → space (the default/blank glyph).
- `0x21`–`0x7E` → printable ASCII subset (letters, digits, punctuation).
- `0x80`–`0xFF` → Arabic national-option subset (basic Arabic letters and presentation forms), enabling Arabic entry and RTL rendering (Req. 12.3) while keeping storage to one byte per cell.

Out-of-repertoire characters entered by the user fall back to space (`0x20`). This is the constraint that lets the single-page URL guarantee the 4000-character limit (see Serialization size analysis).

### Serialization Format (URL codec)

The codec serializes a `PageSet` to a compact, versioned, byte-oriented format, compresses it with `deflate-raw`, and base64url-encodes the result. The format is **lossless** and **self-describing** (magic + version) so the decoder can reject foreign/altered data (Req. 9.5).

**Byte layout (version 1):**

```
[ magic: 2 bytes ]  0x54 0x54  ("TT")
[ version: 1 byte ] 0x01
[ pageCount: varint ]
for each page:
  [ pageNumber: 2 bytes BE ]        100..899
  [ fastext: 4 × 2 bytes BE ]       red, green, yellow, cyan targets (0 = null)
  [ cell stream: 960 cells ]
```

**Cell stream** is emitted in row-major order (row 0 col 0 → row 23 col 39). It uses run-length encoding of default cells, which is where most teletext pages compress heavily:

- `0x00` **RUN_DEFAULT** `[count: 1 byte, 1..255]` — emit `count` default cells. Multiple tokens cover runs > 255.
- `0x01` **CELL_TEXT** `[charCode: 1 byte]` `[attrs: 1 byte]` — a text cell.
- `0x02` **CELL_MOSAIC** `[pattern: 1 byte, 0..63]` `[attrs: 1 byte]` — a mosaic cell.

`attrs` byte packs all per-cell state into 8 bits:

```
bits 7..5 : fg   (0..7)
bits 4..2 : bg   (0..7)
bit  1    : flashing
bit  0    : concealed
```

Mode is implied by the token (`CELL_TEXT` ⇒ text, `CELL_MOSAIC` ⇒ mosaic). This avoids a separate mode bit and keeps every non-default cell at exactly 3 bytes.

**Decode** reverses each token, reconstructing `Cell` objects and restoring the default cell for `RUN_DEFAULT` runs. A mismatched magic, an unsupported version, a truncated stream, or a failed `inflate-raw` causes the decoder to abort and return an empty `PageSet` with an error (Req. 9.5).

**Round-trip losslessness:** `deserialize(serialize(ps))` is structurally identical to `ps` for every valid `PageSet` (same page count, same page numbers, same fastext targets, and same `Cell` fields at every row/col). This is the primary correctness property (see Correctness Properties).

### URL Construction

```
shareURL = baseURL + "#t=" + base64url(deflateRaw(serialize(pageSet)))
```

Using the URL **hash** (`#`) keeps the payload client-side only (no server round-trip, Req. 10) and avoids re-encoding issues. On load, `main.js` reads `location.hash`; if present and valid, `URL_Decoder.decode` rebuilds the `PageSet`; otherwise an empty `PageSet` with a single default page (100) is created.

### Serialization Size Analysis

The format is designed so the hard limits in Req. 9 hold:

- **Single page (Req. 9.7 ≤ 4000 chars).** Worst case (no default runs, every cell distinct): `3 (header) + 1 (count) + 2 (number) + 8 (fastext) + 960 × 3 (cells) = 2894` raw bytes. `deflate-raw` on near-incompressible data adds at most a few bytes of block overhead, so ≤ ~2950 bytes. `base64url` expands by 4/3 → ≤ ~3934 chars. With a `#t=` prefix and a short base URL, the total stays under 4000. The single-byte charset is what makes this guarantee possible.
- **Whole page set (Req. 9.1 ≤ 30000 chars).** A full 800-page set of maximally distinct content cannot fit in 30000 chars, and that is expected: the encoder measures the final URL length and, if it exceeds 30000, surfaces the "too large to share" error **without producing a URL** (Req. 9.8). Typical page sets (predominantly default cells and repeated attributes) compress far below the limit thanks to `RUN_DEFAULT` and `deflate-raw`.

### Mobile / Touch Model

- Touch on a cell selects it (Req. 11.1); touch on a Fastext key navigates (Req. 11.3). Mosaic sextants accept touch (Req. 3.5).
- All non-canvas interactive controls are ≥ 44 × 44 CSS px (Req. 11.2).
- Below 768 px viewport width, CSS reflows controls and scales the canvas so no horizontal scrolling is needed (Req. 11.4).
- A soft input method (on-screen character palette, colour swatches, sextant grid) lets users without a physical keyboard select cells, enter characters, toggle sextants, and set colours (Req. 11.5).

### RTL / Arabic Model

The language/direction toggle sets `<html dir>` and `lang`, flips the UI layout via CSS logical properties, and switches labels. The Editor accepts Arabic characters (mapped through the Charset) and the Renderer draws them RTL within each cell (Req. 12.2–12.4). Toggling language/direction changes only UI presentation and never mutates `Page` content (Req. 12.4).

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The following properties were derived from the acceptance criteria (see the prework analysis) and then reflected on to remove redundancy: criteria that describe the same invariant (e.g. 1.1 and 1.5 grid dimensions; 5.1 and 5.2 conceal-hide; 9.2/9.3/9.6 subsumed by the round-trip 9.4) are consolidated, and criteria sharing one mechanism (e.g. fg/bg region application, flashing/conceal flag application, navigation-to-existing for both direct entry and Fastext) are merged into single comprehensive properties. Non-testable or non-property criteria (UI layout, touch-target sizing, timing cadence, offline/static-hosting constraints) are excluded here and addressed by unit/integration/smoke tests in the Testing Strategy.

Rendering properties are expressed against the pure `computeCellVisual(cell, opts)` function (see Renderer), so they are verifiable without a DOM or canvas.

### Property 1: Grid dimension invariant
*For any* Page, the `cells` array has exactly 24 rows and each row has exactly 40 columns, with no cells added, removed, or merged.
**Validates: Requirements 1.1, 1.5**

### Property 2: Default cell invariant
*For any* newly created Page, every one of its 960 cells equals the default cell: space (`0x20`), foreground white (7), background black (0), text mode, mosaic pattern 0, flashing false, concealed false.
**Validates: Requirements 2.2**

### Property 3: Palette invariant
*For any* invocation, the palette has exactly eight colours in the fixed order black, red, green, yellow, blue, magenta, cyan, white with the specified hex values.
**Validates: Requirements 2.1**

### Property 4: Cursor selection places the cursor
*For any* valid row r and column c, `selectCell(r, c)` sets the editor cursor to exactly `{ row: r, col: c }`.
**Validates: Requirements 1.2**

### Property 5: Character entry writes the selected cell
*For any* selected cell and any supported character, `enterChar` writes that character (mapped through the Charset) into the selected cell.
**Validates: Requirements 1.3**

### Property 6: Deletion clears to space
*For any* selected cell, `deleteCell` sets that cell's character to space (`0x20`).
**Validates: Requirements 1.4**

### Property 7: Cursor advances with wrap
*For any* cursor position (r, c), after writing a character the cursor moves to the row-major successor: (r, c+1), wrapping (r, 39) → (r+1, 0) and (23, 39) → (0, 0).
**Validates: Requirements 1.6**

### Property 8: No selection is a no-op
*For any* Page and any input, when the cursor is null, `enterChar` and `deleteCell` leave the Page byte-identical.
**Validates: Requirements 1.7, 1.8**

### Property 9: Colour selection applies to subsequent entries
*For any* colour c, after `setFg(c)` / `setBg(c)` every subsequently entered character has that foreground/background colour, until a different colour is selected.
**Validates: Requirements 2.3, 2.4**

### Property 10: Region colour application
*For any* rectangular region and any colour c, `applyFgToSelection(c)` / `applyBgToSelection(c)` sets that colour on exactly the cells inside the region and leaves cells outside the region unchanged.
**Validates: Requirements 2.5, 2.6**

### Property 11: Render uses cell foreground and background (text and mosaic)
*For any* cell and render options, the rendered foreground equals `PALETTE[cell.fg]` and background equals `PALETTE[cell.bg]`; in mosaic mode each set sextant draws in the foreground colour and each clear sextant in the background colour.
**Validates: Requirements 2.7, 3.3**

### Property 12: Mosaic geometry
*For any* cell in mosaic mode, there are exactly six sextant positions arranged as 2 columns × 3 rows, and the mosaic pattern is an integer in 0..63.
**Validates: Requirements 3.1**

### Property 13: Sextant toggle is its own inverse
*For any* cell and any sextant bit b in 0..5, `toggleSextant(toggleSextant(cell, b), b)` equals the original cell, and a single toggle flips exactly that bit.
**Validates: Requirements 3.2**

### Property 14: Mode switch preserves colours and initialises mosaic
*For any* cell, switching between text and mosaic mode preserves the cell's foreground and background colours, and entering mosaic mode sets the mosaic pattern to 0.
**Validates: Requirements 3.4, 3.6**

### Property 15: Attribute flags apply to the selection
*For any* selection and any boolean b, `setFlashing(b)` sets `flashing == b` and `setConcealed(b)` sets `concealed == b` on exactly the selected cells.
**Validates: Requirements 4.3, 4.4, 5.5**

### Property 16: Flashing visibility follows the phase
*For any* flashing cell, its content is rendered visible when `flashOn` is true and hidden (only background shown) when `flashOn` is false; non-flashing cells are unaffected by the phase.
**Validates: Requirements 4.1**

### Property 17: Concealed visibility follows reveal (round trip)
*For any* concealed cell, its content is hidden (only background shown) when not revealed and shown when revealed; revealing then hiding restores the hidden state. Non-concealed cells are unaffected by reveal state.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 18: Page-number range invariant
*For any* PageSet, every key in `pages` is an integer in the range 100..899.
**Validates: Requirements 6.1**

### Property 19: New page assigns a unique in-range number, or errors when full
*For any* PageSet that has at least one unused number in 100..899, `createPage` returns an unused number in that range and adds a page under it; when all 800 numbers are assigned, `createPage` signals an error and leaves the PageSet unchanged.
**Validates: Requirements 6.2, 6.7**

### Property 20: Invalid rename is rejected and preserves state
*For any* rename target that is out of range (100..899) or already used by another page, the rename is rejected with an error and the PageSet is left unchanged.
**Validates: Requirements 6.3, 6.6**

### Property 21: Delete removes the page
*For any* PageSet containing page number n, after `deletePage(n)` the page is absent from the PageSet and the page count decreases by exactly one.
**Validates: Requirements 6.4**

### Property 22: Rename preserves page content
*For any* valid rename from oldN to newN, the page stored under newN is content-identical to the page that was under oldN — every cell's char, mosaic pattern, mode, colours, flags, and all four Fastext link targets are preserved.
**Validates: Requirements 6.5**

### Property 23: Navigation to an existing target succeeds
*For any* existing page number n, direct entry `goTo(n)` succeeds and sets the current page to n; for any Fastext key whose target t exists, `activateFastext` succeeds and sets the current page to t.
**Validates: Requirements 7.1, 7.3**

### Property 24: Four Fastext keys
*For any* displayed page, the Navigator exposes exactly four Fastext keys in the fixed order red, green, yellow, cyan.
**Validates: Requirements 7.2**

### Property 25: Fastext target assignment
*For any* page, key, and target value, after `setFastext(page, key, target)` the page's `fastext[key]` equals the target.
**Validates: Requirements 7.4**

### Property 26: Missing navigation target is rejected, current unchanged
*For any* direct page-number entry or Fastext activation whose target does not exist in the Page_Set (or is null), navigation is rejected with a page-not-found indicator and the current page is unchanged.
**Validates: Requirements 7.5, 7.6**

### Property 27: Export dimension invariant
*For any* page, `renderToCanvas` produces an image of exactly 480 × 240 pixels, with each cell occupying a 12 × 10 pixel region at position (col × 12, row × 10).
**Validates: Requirements 8.2**

### Property 28: Export renders fully visible
*For any* flashing or concealed cell, the exported render shows the cell's content (equivalent to `flashOn == true` and `revealed == true`), matching a non-flashing, non-concealed cell's appearance.
**Validates: Requirements 8.3, 8.4**

### Property 29: URL encode/decode round trip
*For any* PageSet ps, `decode(encode(ps))` is structurally identical to ps — same page count, same page numbers, same Fastext targets, and the same char, mosaic pattern, mode, foreground, background, flashing, and concealed for every cell of every page.
**Validates: Requirements 9.2, 9.3, 9.4, 9.6**

### Property 30: Single-page URL size bound
*For any* Page, `encodePage` produces a shareable URL whose total length is no more than 4000 characters.
**Validates: Requirements 9.7**

### Property 31: Page-set URL size bound on success
*For any* PageSet that encodes without the too-large error, the resulting shareable URL is no more than 30000 characters.
**Validates: Requirements 9.1**

### Property 32: Oversized page set is rejected
*For any* PageSet whose encoded shareable URL would exceed 30000 characters, `encode` signals a "too large to share" error and produces no shareable URL.
**Validates: Requirements 9.8**

### Property 33: Invalid URL decodes to an empty Page_Set
*For any* input that was not produced by the encoder (truncated, wrong magic, unsupported version, or corrupted/altered payload), `decode` signals an invalid-URL error and loads an empty PageSet.
**Validates: Requirements 9.5**

### Property 34: Charset round trip
*For every* supported character (including the Arabic subset), `codeToUnicode(unicodeToCode(ch)) == ch`; out-of-repertoire input maps to the fallback (space) rather than a valid distinct code.
**Validates: Requirements 12.3**

### Property 35: Language/direction toggle preserves the model
*For any* PageSet, toggling the UI language and text direction leaves the PageSet byte-identical (no Page or Cell is mutated).
**Validates: Requirements 12.4**

## Error Handling

The system reports errors at well-defined boundaries and, for validation errors, guarantees the model is left unchanged so the user can correct the input.

| Source | Condition | Response | Model effect |
|---|---|---|---|
| Editor (Req. 6.3) | Page number entered outside 100..899 | Error message "page number out of range" | PageSet unchanged |
| Editor (Req. 6.6) | Page number already in use | Error message "page number already in use" | PageSet unchanged |
| Editor (Req. 6.7) | All 800 numbers assigned, new page requested | Error message "no page number available" | No page created |
| Navigator (Req. 7.5) | Fastext target missing/absent | Page-not-found indicator | Current page unchanged |
| Navigator (Req. 7.6) | Entered page number missing | Page-not-found indicator | Current page unchanged |
| Exporter (Req. 8.5) | PNG export cannot complete (e.g. `toBlob` unavailable/fails) | Error message "export failed" | Current page unchanged |
| URL_Decoder (Req. 9.5) | URL not produced by encoder or altered (bad magic/version, decompression failure, truncation) | Error message "invalid URL" | Load an empty PageSet |
| URL_Encoder (Req. 9.8) | Page-set URL would exceed 30000 chars | Error message "page set too large to share" | No URL produced |

Design principles for errors:

- **Validation before mutation.** Every mutating Editor/Navigator action validates its inputs first; if invalid, it returns an error and does not touch the model. This makes the "state unchanged" guarantees in Req. 6.3/6.6/6.7/7.5/7.6 directly testable (Properties 20, 26).
- **Pure codec errors.** `URL_Decoder` treats any decompression failure, magic/version mismatch, or length mismatch as an invalid URL (Req. 9.5), returning an empty PageSet rather than a partially-reconstructed one, so the app never loads corrupt state.
- **No silent failures.** Every error surfaces a visible message; there is no error path that silently mutates or silently drops data.
- **Recoverability.** All error paths leave the user on a consistent, usable state (current page retained, or an empty set for invalid URLs), so the user can always continue working.

## Testing Strategy

### Dual testing approach

The project uses three complementary test layers.

**1. Property-based tests (PBT)** — validate the universal properties in the Correctness Properties section. These target the pure layers: the data model, the URL codec (`serialize`/`deserialize`/`compress`/`decompress`/`base64url`), and `computeCellVisual` (the pure render plan). Rendering properties are checked against `computeCellVisual` output rather than DOM/canvas pixels, keeping them fast and deterministic.

- **Library:** [fast-check](https://fast-check.dev/) (JavaScript property-based testing library; runs under Node, no build step required for the app itself).
- **Iterations:** each property test runs a minimum of 100 random cases.
- **Tagging:** every property test is annotated with a comment tag in the format **`Feature: teletext-studio, Property {number}: {property text}`** referencing the design property it validates.
- **Generators:** custom fast-check arbitraries for `Cell` (random mode, char 0..255, mosaic 0..63, colours 0..7, flags), `Page` (random number 100..899, random cells, random fastext targets), and `PageSet` (random subset of 100..899 with random pages). Out-of-range, empty, and full page sets are generated as edge-case arbitraries.
- **One test per property:** each of the 35 properties is implemented as a single property-based test (round-trip, invariant, idempotence, and error-condition properties as appropriate).

**2. Unit / example tests** — cover specific scenarios and edge cases that are not universal properties:

- Mosaic input from both pointer and touch events (Req. 3.5).
- Language/RTL toggle UI state transitions and Arabic RTL rendering within a cell (Req. 12.2, 12.3 visual part).
- Flashing cadence using a fake/controllable clock: phase toggles every 500 ms and all flashing cells share one phase (Req. 4.2).
- PNG export error path when `toBlob` fails (Req. 8.5).
- Touch selection and touch Fastext activation wiring (Req. 11.1, 11.3).
- Specific representative pages rendered to canvas/DOM and compared to expected visuals (examples complementing the render properties).

**3. Integration / smoke tests** — verify environment and non-functional constraints that do not vary with input:

- **Offline operation (Req. 10.6):** after initial load the app runs with the network disabled.
- **No runtime third-party calls (Req. 10.4):** load the app in a network-monitored harness and assert no outbound requests at runtime.
- **No-build / static hosting (Req. 10.2, 10.5):** the app works when served as static files with no build step.
- **Touch targets ≥ 44 × 44 px (Req. 11.2):** inspect computed sizes of controls in the rendered (touch) UI.
- **Responsive no-horizontal-scroll (Req. 11.4):** render at viewport widths below 768 px and assert no horizontal overflow.
- **Touch-only operation (Req. 11.5):** each core action (select cell, enter char, toggle sextant, set colours) is reachable via on-screen controls.
- **Default UI state and toggle control presence (Req. 12.1, 12.5):** fresh load is English/LTR and the language toggle is present and visible.

### Running the tests

The application itself has **no build step**. The test suite is separate tooling and is run on demand (not shipped with the app). Use single-execution mode only:

- Property and unit tests: `npx vitest --run` (or `node --test`).
- Integration/smoke tests: a Playwright or similar browser harness with `--run`-style single execution.

Long-running/watch mode is not used for automated checks; developers run the dev server manually as needed.

### Why PBT applies here

The feature is dominated by pure functions with large input spaces and universal invariants: serialisation round-trips, bit-toggle idempotence, range/dimension invariants, and a size-bounded codec. These are exactly the cases where property-based testing outperforms example-based testing, so PBT is the primary correctness strategy, complemented by example and smoke tests for the UI, timing, and deployment concerns that are not universal properties.
