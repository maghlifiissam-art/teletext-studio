// Feature: teletext-studio, Property 1: Grid dimension invariant
// For any Page, the cells array has exactly 24 rows and each row has exactly 40
// columns, with no cells added, removed, or merged.
// Validates: Requirements 1.1, 1.5

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { COLS, ROWS, newPage } from "../../scripts/model.js";
import { arbPageNumber } from "./_arbitraries.js";

describe("Property 1: Grid dimension invariant", () => {
  it("a new page always has exactly 24 rows of exactly 40 columns", () => {
    fc.assert(
      fc.property(arbPageNumber, (n) => {
        const page = newPage(n);
        expect(page.cells).toHaveLength(ROWS);
        for (const row of page.cells) {
          expect(row).toHaveLength(COLS);
        }
      }),
      { numRuns: 100 },
    );
  });
});
