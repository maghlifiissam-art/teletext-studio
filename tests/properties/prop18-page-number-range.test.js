// Feature: teletext-studio, Property 18: Page-number range invariant
// For any PageSet, every key in the pages map is an integer in the range 100..899.
// Validates: Requirements 6.1

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { MIN_PAGE, MAX_PAGE } from "../../scripts/model.js";
import { arbPageSet } from "./_arbitraries.js";

describe("Property 18: Page-number range invariant", () => {
  it("every key in a page set is an integer in 100..899", () => {
    fc.assert(
      fc.property(arbPageSet, (ps) => {
        for (const n of ps.pages.keys()) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(MIN_PAGE);
          expect(n).toBeLessThanOrEqual(MAX_PAGE);
        }
      }),
      { numRuns: 100 },
    );
  });
});
