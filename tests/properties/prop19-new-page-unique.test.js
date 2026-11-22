// Feature: teletext-studio, Property 19: New page assigns a unique in-range number, or errors when full
// createPage returns an unused number in 100..899 and adds the page; when all
// 800 numbers are assigned it signals an error and leaves the PageSet
// unchanged.
// Validates: Requirements 6.2, 6.7

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  MIN_PAGE,
  MAX_PAGE,
  newPage,
  addPage,
  validPageNumber,
} from "../../scripts/model.js";
import { createEditor } from "../../scripts/editor.js";
import { arbPageSet } from "./_arbitraries.js";

describe("Property 19: New page assigns a unique in-range number, or errors when full", () => {
  it("on a non-full set the new number is in range, unused before, and the page is added", () => {
    fc.assert(
      fc.property(arbPageSet, (ps) => {
        const editor = createEditor(ps, [...ps.pages.keys()][0] ?? MIN_PAGE);
        const sizeBefore = ps.pages.size;
        const n = editor.createPage();
        expect(validPageNumber(n)).toBe(true);
        expect(ps.pages.size).toBe(sizeBefore + 1);
        expect(ps.pages.get(n).number).toBe(n);
      }),
      { numRuns: 30 },
    );
  });

  it("on a full set (all 800 numbers) it throws and leaves the set unchanged", () => {
    const ps = { pages: new Map() };
    for (let n = MIN_PAGE; n <= MAX_PAGE; n++) {
      addPage(ps, newPage(n));
    }
    const editor = createEditor(ps, MIN_PAGE);
    const before = ps.pages.size;
    expect(() => editor.createPage()).toThrow();
    expect(ps.pages.size).toBe(before);
  });
});
