/*
 * Shared fast-check arbitraries for the property-based tests.
 *
 * Generators for Cell, Page, and PageSet, plus the small primitive ranges the
 * model uses. PageSet generators produce unique page numbers in 100..899.
 *
 * Imported by the per-property test files so they stay small and focused.
 */

import fc from "fast-check";

import {
  COLS,
  ROWS,
  MIN_PAGE,
  MAX_PAGE,
  newPage,
  newPageSet,
  addPage,
} from "../../scripts/model.js";

/* ---- primitives --------------------------------------------------- */
export const arbColour = fc.integer({ min: 0, max: 7 });
export const arbCharCode = fc.integer({ min: 0, max: 255 });
export const arbMosaic = fc.integer({ min: 0, max: 63 });
export const arbSextantBit = fc.integer({ min: 0, max: 5 });
export const arbMode = fc.constantFrom("text", "mosaic");
export const arbRow = fc.integer({ min: 0, max: ROWS - 1 });
export const arbCol = fc.integer({ min: 0, max: COLS - 1 });
export const arbPageNumber = fc.integer({ min: MIN_PAGE, max: MAX_PAGE });
export const arbBool = fc.boolean();

/* ---- cell --------------------------------------------------------- */
export const arbCell = fc.record({
  mode: arbMode,
  char: arbCharCode,
  mosaic: arbMosaic,
  fg: arbColour,
  bg: arbColour,
  flashing: arbBool,
  concealed: arbBool,
});

/* ---- page --------------------------------------------------------- */
const arbFastextTarget = fc.oneof(fc.constant(null), arbPageNumber);

const arbFastext = fc.record({
  red: arbFastextTarget,
  green: arbFastextTarget,
  yellow: arbFastextTarget,
  cyan: arbFastextTarget,
});

function pageFromFlat(number, flatCells, fastext) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    cells.push(flatCells.slice(r * COLS, (r + 1) * COLS));
  }
  return { number, cells, fastext };
}

// A page with random content (every cell independently random).
export const arbPage = fc
  .record({
    number: arbPageNumber,
    flatCells: fc.array(arbCell, { minLength: ROWS * COLS, maxLength: ROWS * COLS }),
    fastext: arbFastext,
  })
  .map(({ number, flatCells, fastext }) => pageFromFlat(number, flatCells, fastext));

// A page with random content at a fixed number.
export function arbPageWithNumber(number) {
  return fc
    .record({
      flatCells: fc.array(arbCell, { minLength: ROWS * COLS, maxLength: ROWS * COLS }),
      fastext: arbFastext,
    })
    .map(({ flatCells, fastext }) => pageFromFlat(number, flatCells, fastext));
}

/* ---- page set ------------------------------------------------------ */
// Unique page numbers, each carrying a randomly-contented page.
export const arbPageSet = fc
  .uniqueArray(arbPageNumber, { minLength: 0, maxLength: 20 })
  .chain((numbers) => {
    if (numbers.length === 0) {
      return fc.constant(newPageSet());
    }
    return fc.tuple(...numbers.map((n) => arbPageWithNumber(n))).map((pages) => {
      const ps = newPageSet();
      for (const p of pages) {
        addPage(ps, p);
      }
      return ps;
    });
  });

// A non-empty page set (used by tests that need a page to act on).
export const arbNonEmptyPageSet = arbPageSet.filter((ps) => ps.pages.size > 0);

/* ---- charset ------------------------------------------------------ */
// Any single Unicode code point (BMP or astral), excluding surrogates.
export const arbAnyCodePoint = fc
  .integer({ min: 0, max: 0x10ffff })
  .filter((cp) => cp < 0xd800 || cp > 0xdfff)
  .map((cp) => String.fromCodePoint(cp));

// Any code point in the single-byte charset range (used to derive glyphs).
export const arbCharCodePoint = fc.integer({ min: 0, max: 255 });
