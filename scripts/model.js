/*
 * scripts/model.js — Pure data model for Teletext Studio.
 *
 * Layer: Data Model Layer (pure). No DOM, no I/O, no side effects beyond
 * mutating the plain JS objects it is given. Everything else in the app
 * (Renderer, Editor, Navigator, Exporter, URL codec, UI) is a deterministic
 * function of the types defined here.
 *
 * Implements task 2.1:
 *   - PALETTE / FG_DEFAULT / BG_DEFAULT (Req. 2.1, 2.2)
 *   - CHARSET: codeToUnicode / unicodeToCode (Req. 12.3)
 *   - defaultCell / switchMode / toggleSextant (Req. 2.2, 3.2, 3.4, 3.6)
 *   - Page: COLS / ROWS / MIN_PAGE / MAX_PAGE / FASTEXT_KEYS / newPage /
 *     validPageNumber (Req. 1.1, 6.1)
 *   - Page_Set: newPageSet / getPage / addPage / deletePage / renamePage /
 *     nextAvailableNumber (Req. 6.1, 6.4, 6.5, 6.7)
 *
 * The 256-entry charset table lives in assets/charset.json (task 1.3) and is
 * the single source of truth for code <-> glyph mapping.
 */

import charsetData from "../assets/charset.json" with { type: "json" };

/* ------------------------------------------------------------------ */
/* Palette (Req. 2.1). Index is the stored colour value (0..7).        */
/* ------------------------------------------------------------------ */
export const PALETTE = [
  "#000000", // 0 black
  "#FF0000", // 1 red
  "#00FF00", // 2 green
  "#FFFF00", // 3 yellow
  "#0000FF", // 4 blue
  "#FF00FF", // 5 magenta
  "#00FFFF", // 6 cyan
  "#FFFFFF", // 7 white
];

export const FG_DEFAULT = 7; // white (Req. 2.2)
export const BG_DEFAULT = 0; // black (Req. 2.2)

/* ------------------------------------------------------------------ */
/* Grid + page-number constants (Req. 1.1, 6.1).                       */
/* ------------------------------------------------------------------ */
export const COLS = 40;
export const ROWS = 24;
export const MIN_PAGE = 100;
export const MAX_PAGE = 899;

// The four Fastext keys, in the fixed order shown by the Navigator (Req. 7.2).
export const FASTEXT_KEYS = ["red", "green", "yellow", "cyan"];

/* ------------------------------------------------------------------ */
/* Charset (Req. 12.3).                                                 */
/*                                                                     */
/* codeToUnicode(code): 0..255 -> glyph string. Out-of-range or invalid */
/* codes (including -1, the out-of-repertoire sentinel) fall back to   */
/* space (" "), so codeToUnicode(unicodeToCode(ch)) is always a valid   */
/* glyph and out-of-repertoire input maps to space (Property 34).      */
/*                                                                     */
/* unicodeToCode(ch): glyph -> 0..255, or -1 if the character is not in */
/* the repertoire (the caller maps -1 to the space fallback 0x20).     */
/* ------------------------------------------------------------------ */
const codeToUnicodeMap = new Map();
for (const [key, glyph] of Object.entries(charsetData.codeToUnicode)) {
  codeToUnicodeMap.set(Number(key), glyph);
}

const unicodeToCodeMap = new Map();
for (const [glyph, code] of Object.entries(charsetData.unicodeToCode)) {
  unicodeToCodeMap.set(glyph, Number(code));
}

export const CHARSET = {
  codeToUnicode(code) {
    if (!Number.isInteger(code) || code < 0 || code > 255) {
      return " "; // invalid / out-of-range (incl. -1 sentinel) -> blank
    }
    const glyph = codeToUnicodeMap.get(code);
    return glyph !== undefined ? glyph : " ";
  },
  unicodeToCode(ch) {
    if (typeof ch !== "string" || ch.length === 0) {
      return -1;
    }
    const code = unicodeToCodeMap.get(ch);
    return code !== undefined ? code : -1;
  },
};

/* ------------------------------------------------------------------ */
/* Cell (Req. glossary "Cell"; Req. 2, 3, 4, 5).                        */
/*                                                                     */
/* Sextant bit layout (2 columns x 3 rows):                            */
/*   bit0 bit1   <- top row    (left, right)                            */
/*   bit2 bit3   <- middle row (left, right)                            */
/*   bit4 bit5   <- bottom row (left, right)                            */
/* A set bit => sextant filled (drawn in fg); clear => empty (bg).      */
/* ------------------------------------------------------------------ */

/**
 * A fresh default cell: space, fg=white, bg=black, text mode, mosaic=0,
 * no flashing, no conceal (Req. 2.2).
 * @returns {object} a new default Cell
 */
export function defaultCell() {
  return {
    mode: "text",
    char: 0x20,
    mosaic: 0,
    fg: FG_DEFAULT,
    bg: BG_DEFAULT,
    flashing: false,
    concealed: false,
  };
}

/**
 * Switch a cell's mode. Preserves fg and bg (Req. 3.4) and initialises the
 * mosaic pattern to 0 (entering mosaic mode starts from a blank pattern,
 * Req. 3.6). Returns a new cell; the argument is not mutated.
 * @param {object} cell
 * @param {"text"|"mosaic"} mode
 * @returns {object}
 */
export function switchMode(cell, mode) {
  return {
    ...cell,
    mode,
    mosaic: 0,
  };
}

/**
 * Toggle (XOR) one sextant bit of a cell's mosaic pattern (Req. 3.2).
 * `bit` must be an integer in 0..5; any other value is a no-op (returns the
 * cell unchanged) so the pattern stays within the 0..63 range. The toggle is
 * its own inverse (Property 13).
 * @param {object} cell
 * @param {number} bit 0..5
 * @returns {object}
 */
export function toggleSextant(cell, bit) {
  if (!Number.isInteger(bit) || bit < 0 || bit > 5) {
    return cell;
  }
  // Pure XOR of one sextant bit; every other field (mode, fg, bg, char, flags)
  // is preserved, so toggling twice restores the original cell (Property 13).
  return {
    ...cell,
    mosaic: (cell.mosaic ^ (1 << bit)) & 0x3f,
  };
}

/* ------------------------------------------------------------------ */
/* Page (Req. 1.1, 6.1, 7.4).                                          */
/* ------------------------------------------------------------------ */

/**
 * Build a page of 960 default cells (ROWS x COLS) with all Fastext links
 * null (Req. 1.1, 7.4). Each cell is an independent object.
 * @param {number} number page number, expected in 100..899
 * @returns {object}
 */
export function newPage(number) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push(defaultCell());
    }
    cells.push(row);
  }
  return {
    number,
    cells,
    fastext: {
      red: null,
      green: null,
      yellow: null,
      cyan: null,
    },
  };
}

/**
 * True iff n is an integer in the page-number range 100..899 (Req. 6.1).
 * @param {number} n
 * @returns {boolean}
 */
export function validPageNumber(n) {
  return Number.isInteger(n) && n >= MIN_PAGE && n <= MAX_PAGE;
}

/* ------------------------------------------------------------------ */
/* Page_Set (Req. 6). Keyed by page number in 100..899.                */
/* ------------------------------------------------------------------ */

/**
 * @returns {object} an empty PageSet
 */
export function newPageSet() {
  return { pages: new Map() };
}

/**
 * @param {object} ps
 * @param {number} n page number
 * @returns {object|undefined} the Page under n, or undefined
 */
export function getPage(ps, n) {
  return ps.pages.get(n);
}

/**
 * Add (or replace) a page in the set under its own number. Assumes the page
 * number is valid and, for an add, unique (Req. 6.1).
 * @param {object} ps
 * @param {object} page
 */
export function addPage(ps, page) {
  ps.pages.set(page.number, page);
}

/**
 * Remove a page from the set (Req. 6.4). No-op if the number is absent.
 * @param {object} ps
 * @param {number} n page number
 */
export function deletePage(ps, n) {
  ps.pages.delete(n);
}

/**
 * Rename a page from oldN to newN, preserving all content (cells, colours,
 * flags, and Fastext targets) and updating the page's own number field
 * (Req. 6.5). Assumes the rename is valid: oldN exists, newN is in range and
 * unused. Validation/rejection of out-of-range or duplicate targets is the
 * Editor's responsibility (Req. 6.3 / 6.6).
 * @param {object} ps
 * @param {number} oldN
 * @param {number} newN
 */
export function renamePage(ps, oldN, newN) {
  const page = ps.pages.get(oldN);
  if (page === undefined) {
    return;
  }
  ps.pages.delete(oldN);
  page.number = newN;
  ps.pages.set(newN, page);
}

/**
 * The smallest page number in 100..899 that is not yet used, or null if every
 * number in the range is assigned (Req. 6.7).
 * @param {object} ps
 * @returns {number|null}
 */
export function nextAvailableNumber(ps) {
  for (let n = MIN_PAGE; n <= MAX_PAGE; n++) {
    if (!ps.pages.has(n)) {
      return n;
    }
  }
  return null;
}
