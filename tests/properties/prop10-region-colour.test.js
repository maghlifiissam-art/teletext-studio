// Feature: teletext-studio, Property 10: Region colour application
// applyFgToSelection(c)/applyBgToSelection(c) set the colour on exactly the
// cells inside the region, leaving outside cells unchanged.
// Validates: Requirements 2.5, 2.6

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { ROWS, COLS } from "../../scripts/model.js";
import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol, arbColour } from "./_arbitraries.js";

const arbRegion = fc
  .tuple(arbRow, arbCol, arbRow, arbCol)
  .map(([r1, c1, r2, c2]) => ({
    row0: Math.min(r1, r2),
    col0: Math.min(c1, c2),
    row1: Math.max(r1, r2),
    col1: Math.max(c1, c2),
  }));

describe("Property 10: Region colour application", () => {
  it("applyFgToSelection sets fg on exactly the region's cells; applyBgToSelection sets bg on exactly the region's cells", () => {
    fc.assert(
      fc.property(arbRegion, arbColour, arbColour, (region, fg, bg) => {
        const { editor, page } = makeEditor();
        const before = page.cells.map((row) => row.map((cell) => ({ ...cell })));

        editor.state.selection = region;
        editor.applyFgToSelection(fg);
        editor.applyBgToSelection(bg);

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const inside =
              r >= region.row0 && r <= region.row1 && c >= region.col0 && c <= region.col1;
            const cell = page.cells[r][c];
            if (inside) {
              expect(cell.fg).toBe(fg);
              expect(cell.bg).toBe(bg);
            } else {
              expect(cell.fg).toBe(before[r][c].fg);
              expect(cell.bg).toBe(before[r][c].bg);
            }
          }
        }
      }),
      { numRuns: 20 },
    );
  });
});
