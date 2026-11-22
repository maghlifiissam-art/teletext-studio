// Feature: teletext-studio, Property 12: Mosaic geometry
// A mosaic cell has exactly six sextant positions arranged as 2 columns x 3
// rows, and its pattern is always an integer in 0..63.
// Validates: Requirements 3.1

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol } from "./_arbitraries.js";

describe("Property 12: Mosaic geometry", () => {
  it("any sequence of sextant toggles keeps the pattern an integer in 0..63 over exactly 6 bits", () => {
    fc.assert(
      fc.property(
        arbRow,
        arbCol,
        fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 0, maxLength: 30 }),
        (row, col, bits) => {
          const { mosaic, page } = makeEditor();
          for (const bit of bits) {
            mosaic.toggleSextantAt(row, col, bit);
          }
          const pattern = page.cells[row][col].mosaic;
          expect(Number.isInteger(pattern)).toBe(true);
          expect(pattern).toBeGreaterThanOrEqual(0);
          expect(pattern).toBeLessThanOrEqual(63);
          // Exactly six sextants exist: bits 0..5, so bit 6 and above never set.
          expect(pattern & ~0x3f).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
