/*
 * scripts/renderer.js — Rendering subsystem.
 *
 * Layer: Subsystem Layer. Produces a visual representation of a Page on two
 * backends that share one palette, one charset, and one sextant geometry, so
 * the on-screen grid and the PNG export never diverge.
 *
 * Implements task 4.1:
 *   - computeCellVisual(cell, opts) -> CellVisual (pure single source of truth
 *     for what a cell shows — used by both backends and by the property tests)
 *   - renderToDOM(container, page, opts)  — DOM CSS-grid of 960 cell elements
 *   - renderToCanvas(ctx, page, opts)     — 12x10 px per cell -> 480x240 (Req. 8.2)
 *
 * Rendering rules (all encoded in computeCellVisual):
 *   - Background drawn in PALETTE[cell.bg]; foreground content in PALETTE[cell.fg]
 *     (Req. 2.7 / 3.3).
 *   - Text mode draws CHARSET.codeToUnicode(cell.char); mosaic mode draws the
 *     6-bit sextant pattern (set sextant -> fg, clear sextant -> bg).
 *   - Flashing (Req. 4.1): when flashOn === false, a flashing cell shows only its
 *     background (content hidden).
 *   - Conceal (Req. 5.1-5.4): when revealed === false, a concealed cell shows only
 *     its background; when true, content is shown.
 *   - PNG export passes flashOn = true (Req. 8.3) and revealed = true (Req. 8.4).
 */

import {
  PALETTE,
  CHARSET,
  COLS,
  ROWS,
} from "./model.js";

/* ------------------------------------------------------------------ */
/* Shared geometry for canvas export (Req. 8.2).                       */
/*                                                                     */
/* Each cell is 12x10 px; the whole page is 40x12 = 480 wide and       */
/* 24x10 = 240 tall. The 2-column x 3-row sextant grid divides the     */
/* 12x10 cell as [6,6] x [4,3,3] (a deterministic integer split that    */
/* sums to 12 and 10).                                                  */
/* ------------------------------------------------------------------ */
export const EXPORT_CELL_W = 12;
export const EXPORT_CELL_H = 10;

export const SEXTANT_COL_W = [6, 6];
export const SEXTANT_ROW_H = [4, 3, 3]; // top, middle, bottom (sums to 10)

// Pre-computed sextant origins (offsets from the cell's top-left).
const SEXTANT_COL_X = [0, SEXTANT_COL_W[0]]; // [0, 6]
const SEXTANT_ROW_Y = [
  0,
  SEXTANT_ROW_H[0],
  SEXTANT_ROW_H[0] + SEXTANT_ROW_H[1],
]; // [0, 4, 7]

/* ------------------------------------------------------------------ */
/* Render options + the pure render plan.                              */
/*                                                                     */
/* flashOn affects only flashing cells (Req. 4.1); revealed affects   */
/* only concealed cells (Req. 5.1-5.4). Both default to true so a bare  */
/* call renders a fully-visible page (matching PNG export, Req. 8.3/8.4).*/
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} RenderOpts
 * @property {boolean} revealed
 * @property {boolean} flashOn
 */

/**
 * @typedef {Object} CellVisual
 * @property {string|typeof MOSAIC} content  glyph to draw, or "mosaic"
 * @property {number} mosaic                 sextant pattern (0..63), meaningful when content === "mosaic"
 * @property {number} fg                     visible foreground colour index (0..7)
 * @property {number} bg                     visible background colour index (0..7)
 * @property {boolean} visible               false => cell shows ONLY its background
 */

const MOSAIC = "mosaic";

/**
 * Pure single source of truth for what a cell shows. Both backends (DOM,
 * canvas) consume this, so the rendering rules are testable without a DOM or
 * canvas (used by the property-based tests).
 *
 * The returned fg/bg are always the cell's own colour indices — visibility is
 * reported separately via `visible`. When `visible` is false the cell shows
 * only its background; the caller must not draw the foreground content.
 *
 * @param {object} cell
 * @param {RenderOpts} [opts]
 * @returns {CellVisual}
 */
export function computeCellVisual(cell, opts) {
  const flashOn = opts ? opts.flashOn !== false : true;
  const revealed = opts ? opts.revealed !== false : true;

  let visible = true;
  // Flashing (Req. 4.1): hidden when the phase is off.
  if (cell.flashing && !flashOn) {
    visible = false;
  }
  // Conceal (Req. 5.1-5.4): hidden until revealed.
  if (cell.concealed && !revealed) {
    visible = false;
  }

  const content =
    cell.mode === "mosaic" ? MOSAIC : CHARSET.codeToUnicode(cell.char);

  return {
    content,
    mosaic: cell.mosaic,
    fg: cell.fg,
    bg: cell.bg,
    visible,
  };
}

/**
 * The colour index a sextant bit is drawn in for a mosaic CellVisual: a set
 * sextant draws in the foreground colour, a clear sextant in the background
 * colour (Req. 3.3). Pure — used by renderToCanvas and by the property tests.
 *
 * @param {CellVisual} visual
 * @param {number} bit 0..5 (2 columns x 3 rows, row-major)
 * @returns {number} colour index 0..7
 */
export function sextantColourIndex(visual, bit) {
  return (visual.mosaic & (1 << bit)) !== 0 ? visual.fg : visual.bg;
}

/* ------------------------------------------------------------------ */
/* Canvas backend (PNG export). 12x10 px per cell -> 480x240 (Req. 8.2).*/
/* ------------------------------------------------------------------ */

/**
 * Render a page to a 2D canvas context at 12x10 px per cell (480x240 total).
 * Flashing and conceal are resolved through computeCellVisual, so this draws
 * the fully-visible export when called with flashOn=true, revealed=true
 * (Req. 8.3 / 8.4).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} page
 * @param {RenderOpts} [opts]
 */
export function renderToCanvas(ctx, page, opts) {
  const flashOn = opts ? opts.flashOn !== false : true;
  const revealed = opts ? opts.revealed !== false : true;

  const totalW = EXPORT_CELL_W * COLS; // 480
  const totalH = EXPORT_CELL_H * ROWS; // 240

  // Clear any prior content so a re-render starts from a blank canvas.
  if (typeof ctx.clearRect === "function") {
    ctx.clearRect(0, 0, totalW, totalH);
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = page.cells[r][c];
      const visual = computeCellVisual(cell, { flashOn, revealed });
      drawCellCanvas(ctx, visual, c * EXPORT_CELL_W, r * EXPORT_CELL_H);
    }
  }
}

/**
 * Draw one cell's visual at the given pixel origin.
 *
 * - Hidden cell (visible === false): only the background is drawn.
 * - Visible mosaic cell: the six sextants tile the 12x10 cell; each set
 *   sextant is filled in fg and each clear sextant in bg.
 * - Visible text cell: the background is filled, then the glyph is drawn in fg.
 */
function drawCellCanvas(ctx, visual, x, y) {
  if (visual.visible && visual.content === "mosaic") {
    let bit = 0;
    for (let row = 0; row < 3; row++) {
      const sy = y + SEXTANT_ROW_Y[row];
      const sh = SEXTANT_ROW_H[row];
      for (let col = 0; col < 2; col++) {
        const sx = x + SEXTANT_COL_X[col];
        const sw = SEXTANT_COL_W[col];
        ctx.fillStyle = PALETTE[sextantColourIndex(visual, bit)];
        ctx.fillRect(sx, sy, sw, sh);
        bit++;
      }
    }
    return;
  }

  // Background fills the whole cell for both text and hidden cells.
  ctx.fillStyle = PALETTE[visual.bg];
  ctx.fillRect(x, y, EXPORT_CELL_W, EXPORT_CELL_H);

  if (visual.visible) {
    // Text glyph, centred in the cell, drawn in the foreground colour.
    ctx.fillStyle = PALETTE[visual.fg];
    ctx.font = `${EXPORT_CELL_H}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(visual.content, x + EXPORT_CELL_W / 2, y + EXPORT_CELL_H / 2);
  }
}

/* ------------------------------------------------------------------ */
/* DOM backend (editing surface). A CSS-grid of 960 cell elements.    */
/*                                                                     */
/* Flashing and conceal are driven by container-level attributes        */
/* (data-flash-phase / data-revealed) plus per-cell data attributes, so */
/* the FlashController toggles a single attribute and CSS hides the     */
/* affected cells synchronously (Req. 4.2). The existing stylesheet    */
/* hides flashing/concealed text cells via `color: transparent`.       */
/* ------------------------------------------------------------------ */

/**
 * Render a page into a container as a 40x24 CSS-grid of cell elements.
 *
 * @param {HTMLElement} container
 * @param {object} page
 * @param {RenderOpts} [opts]
 */
export function renderToDOM(container, page, opts) {
  const flashOn = opts ? opts.flashOn !== false : true;
  const revealed = opts ? opts.revealed !== false : true;

  // Container-level phase attributes drive CSS-driven flashing/conceal so all
  // cells share one phase synchronously (Req. 4.2).
  container.setAttribute("data-flash-phase", flashOn ? "on" : "off");
  container.setAttribute("data-revealed", revealed ? "true" : "false");

  // Rebuild the 960 cell elements. The container holds only cells, so this is
  // a clean, correct re-render with no stale state.
  container.textContent = "";

  const fragment =
    typeof document !== "undefined" && document.createDocumentFragment
      ? document.createDocumentFragment()
      : null;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = page.cells[r][c];
      const visual = computeCellVisual(cell, { flashOn, revealed });
      const el = createCellElement(cell, visual, r, c);
      if (fragment !== null) {
        fragment.appendChild(el);
      } else {
        container.appendChild(el);
      }
    }
  }

  if (fragment !== null) {
    container.appendChild(fragment);
  }
}

/**
 * Build one cell element. The cell always carries its colours and the
 * per-cell flags that CSS uses for flashing/conceal; content (text glyph or
 * the 2x3 sextant grid) is always rendered so CSS can reveal it by toggling
 * the container attributes.
 */
function createCellElement(cell, visual, row, col) {
  const el = document.createElement("div");
  el.className = "tt-cell";
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  el.dataset.mode = cell.mode;
  if (cell.flashing) el.dataset.flashing = "true";
  if (cell.concealed) el.dataset.concealed = "true";
  el.style.backgroundColor = PALETTE[visual.bg];
  el.style.color = PALETTE[visual.fg];

  if (visual.content === "mosaic") {
    el.classList.add("tt-cell--mosaic");
    // Lay the six sextants out as a 2x3 CSS sub-grid of the cell. Each set
    // sextant is filled in fg; each clear sextant shows the cell background.
    el.style.display = "grid";
    el.style.gridTemplateColumns = "1fr 1fr";
    el.style.gridTemplateRows = "1fr 1fr 1fr";
    let bit = 0;
    for (let srow = 0; srow < 3; srow++) {
      for (let scol = 0; scol < 2; scol++) {
        const sub = document.createElement("div");
        sub.style.background = PALETTE[sextantColourIndex(visual, bit)];
        el.appendChild(sub);
        bit++;
      }
    }
  } else {
    el.classList.add("tt-cell--text");
    el.textContent = visual.content;
  }

  return el;
}
