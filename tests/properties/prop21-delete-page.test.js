// Feature: teletext-studio, Property 21: Delete removes the page
// For any PageSet containing page number n, after deletePage(n) the page is
// absent from the PageSet and the page count decreases by exactly one.
// Validates: Requirements 6.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { deletePage } from "../../scripts/model.js";
import { arbNonEmptyPageSet } from "./_arbitraries.js";

describe("Property 21: Delete removes the page", () => {
  it("deletePage removes the page and decreases the count by exactly one", () => {
    fc.assert(
      fc.property(arbNonEmptyPageSet, fc.nat(), (ps, seed) => {
        const keys = [...ps.pages.keys()];
        const n = keys[seed % keys.length];
        const before = ps.pages.size;

        deletePage(ps, n);

        expect(ps.pages.has(n)).toBe(false);
        expect(ps.pages.size).toBe(before - 1);
      }),
      { numRuns: 100 },
    );
  });
});
