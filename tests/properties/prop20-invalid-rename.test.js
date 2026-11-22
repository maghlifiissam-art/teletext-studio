// Feature: teletext-studio, Property 20: Invalid rename is rejected and preserves state
// An out-of-range or duplicate rename target is rejected with an error and
// the PageSet is unchanged.
// Validates: Requirements 6.3, 6.6

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { MIN_PAGE, MAX_PAGE } from "../../scripts/model.js";
import { createEditor } from "../../scripts/editor.js";
import { arbNonEmptyPageSet } from "./_arbitraries.js";

describe("Property 20: Invalid rename is rejected and preserves state", () => {
  it("out-of-range targets throw and preserve the PageSet", () => {
    fc.assert(
      fc.property(
        arbNonEmptyPageSet,
        fc.oneof(
          fc.integer({ min: -1000, max: MIN_PAGE - 1 }),
          fc.integer({ min: MAX_PAGE + 1, max: 100000 }),
          fc.double().filter((x) => !Number.isInteger(x)),
        ),
        (ps, badTarget) => {
          const editor = createEditor(ps, [...ps.pages.keys()][0]);
          const before = JSON.stringify([...ps.pages.keys()].sort((a, b) => a - b));
          expect(() => editor.renamePage([...ps.pages.keys()][0], badTarget)).toThrow();
          expect(JSON.stringify([...ps.pages.keys()].sort((a, b) => a - b))).toBe(before);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("duplicate targets throw and preserve the PageSet", () => {
    fc.assert(
      fc.property(arbNonEmptyPageSet, (ps) => {
        const keys = [...ps.pages.keys()];
        const editor = createEditor(ps, keys[0]);
        const before = JSON.stringify(keys.slice().sort((a, b) => a - b));
        // Renaming the first page onto itself, or onto any existing number,
        // is a duplicate and must be rejected.
        const target = keys[keys.length > 1 ? 1 : 0];
        expect(() => editor.renamePage(keys[0], target)).toThrow();
        expect(JSON.stringify([...ps.pages.keys()].sort((a, b) => a - b))).toBe(before);
      }),
      { numRuns: 30 },
    );
  });
});
