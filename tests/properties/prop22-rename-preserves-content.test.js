// Feature: teletext-studio, Property 22: Rename preserves page content
// For any valid rename from oldN to newN, the page stored under newN is
// content-identical to the page that was under oldN — every cell's char, mosaic
// pattern, mode, colours, flags, and all four Fastext link targets are
// preserved.
// Validates: Requirements 6.5

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { addPage, newPageSet, renamePage } from "../../scripts/model.js";
import { arbPage, arbPageNumber } from "./_arbitraries.js";

describe("Property 22: Rename preserves page content", () => {
  it("after a valid rename, the page under the new number preserves all cells, colours, flags, and fastext targets", () => {
    fc.assert(
      fc.property(arbPage, arbPageNumber, (page, newN) => {
        fc.pre(newN !== page.number);
        const oldN = page.number;

        const ps = newPageSet();
        addPage(ps, page);

        // Snapshot the content (cells + fastext) before the rename.
        const snapshotCells = JSON.parse(JSON.stringify(page.cells));
        const snapshotFastext = JSON.parse(JSON.stringify(page.fastext));

        renamePage(ps, oldN, newN);

        expect(ps.pages.has(newN)).toBe(true);
        expect(ps.pages.has(oldN)).toBe(false);

        const renamed = ps.pages.get(newN);
        expect(renamed.number).toBe(newN);
        expect(renamed.cells).toEqual(snapshotCells);
        expect(renamed.fastext).toEqual(snapshotFastext);
      }),
      { numRuns: 100 },
    );
  });
});
