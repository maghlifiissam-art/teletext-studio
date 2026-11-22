/*
 * Property 29: URL encode/decode round trip.
 *
 * decode(encode(ps)) is structurally identical to ps: same page count, page
 * numbers, Fastext targets, and all cell fields (Req. 9.2, 9.3, 9.4, 9.6).
 *
 * **Validates: Requirements 9.2, 9.3, 9.4, 9.6**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  COLS,
  ROWS,
  FASTEXT_KEYS,
  newPage,
  newPageSet,
  addPage,
} from "../../scripts/model.js";
import { encode, decode } from "../../scripts/urlcodec.js";
import { arbCell, arbRow, arbCol, arbPageNumber } from "./_arbitraries.js";

// Small sets of sparse pages: enough cell variety to exercise every token,
// fast enough for async property runs.
const arbSmallSet = fc
  .uniqueArray(arbPageNumber, { minLength: 1, maxLength: 4 })
  .chain((numbers) =>
    fc
      .tuple(
        ...numbers.map((n) =>
          fc.array(fc.tuple(arbRow, arbCol, arbCell), { minLength: 0, maxLength: 40 })
        )
      )
      .map((writesPerPage) => {
        const ps = newPageSet();
        numbers.forEach((n, i) => {
          const page = newPage(n);
          for (const [r, c, cell] of writesPerPage[i]) {
            // Scope to reachable cells: in mosaic mode the character is
            // meaningless (switchMode resets it to space), so the codec
            // stores it only for text cells.
            page.cells[r][c] = cell.mode === "mosaic" ? { ...cell, char: 0x20 } : cell;
          }
          addPage(ps, page);
        });
        return ps;
      })
  );

function expectSamePageSet(actual, expected) {
  expect([...actual.pages.keys()].sort((a, b) => a - b)).toEqual(
    [...expected.pages.keys()].sort((a, b) => a - b)
  );
  for (const [n, page] of expected.pages) {
    const other = actual.pages.get(n);
    expect(other).toBeDefined();
    expect(other.number).toBe(page.number);
    for (const key of FASTEXT_KEYS) {
      expect(other.fastext[key]).toBe(page.fastext[key]);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // JSON.stringify normalizes -0 to 0: serialization is byte-oriented
        // and cannot preserve the sign of a zero char/colour code.
        expect(JSON.stringify(other.cells[r][c])).toBe(JSON.stringify(page.cells[r][c]));
      }
    }
  }
}

describe("Property 29: URL encode/decode round trip", () => {
  it("decode(encode(ps)) is structurally identical to ps", async () => {
    await fc.assert(
      fc.asyncProperty(arbSmallSet, async (ps) => {
        const url = await encode(ps, "https://example.com/teletext/");
        const { ps: decoded, error } = await decode(url);
        expect(error).toBeNull();
        expectSamePageSet(decoded, ps);
      }),
      { numRuns: 25 }
    );
  });
});
