// Feature: teletext-studio, Property 2: Default cell invariant
// For any newly created Page, every one of its 960 cells equals the default
// cell: space (0x20), foreground white (7), background black (0), text mode,
// mosaic pattern 0, flashing false, concealed false.
// Validates: Requirements 2.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { COLS, ROWS, defaultCell, newPage } from "../../scripts/model.js";
import { arbPageNumber } from "./_arbitraries.js";

describe("Property 2: Default cell invariant", () => {
  it("every cell of a new page equals the default cell and all fastext links are null", () => {
    fc.assert(
      fc.property(arbPageNumber, (n) => {
        const page = newPage(n);
        const def = defaultCell();

        expect(page.number).toBe(n);
        expect(page.cells).toHaveLength(ROWS);
        expect(page.fastext).toEqual({ red: null, green: null, yellow: null, cyan: null });

        for (const row of page.cells) {
          expect(row).toHaveLength(COLS);
          for (const cell of row) {
            expect(cell).toEqual(def);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
