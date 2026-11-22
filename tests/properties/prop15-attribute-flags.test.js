// Feature: teletext-studio, Property 15: Attribute flags apply to the selection
// setFlashing(b) sets flashing == b and setConcealed(b) sets concealed == b on
// exactly the selected cells.
// Validates: Requirements 4.3, 4.4, 5.5

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { ROWS, COLS } from "../../scripts/model.js";
import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol, arbBool } from "./_arbitraries.js";

const arbRegion = fc
  .tuple(arbRow, arbCol, arbRow, arbCol)
  .map(([r1, c1, r2, c2]) => ({
    row0: Math.min(r1, r2),
    col0: Math.min(c1, c2),
    row1: Math.max(r1, r2),
    col1: Math.max(c1, c2),
  }));

describe("Property 15: Attribute flags apply to the selection", () => {
  it("flags take the requested value on exactly the selected cells; others keep theirs", () => {
    fc.assert(
      fc.property(arbRegion, arbBool, arbBool, (region, flashing, concealed) => {
        const { editor, page } = makeEditor();
        const before = page.cells.map((row) => row.map((cell) => ({ ...cell })));

        editor.state.selection = region;
        editor.setFlashing(flashing);
        editor.setConcealed(concealed);

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const inside =
              r >= region.row0 && r <= region.row1 && c >= region.col0 && c <= region.col1;
            const cell = page.cells[r][c];
            if (inside) {
              expect(cell.flashing).toBe(flashing);
              expect(cell.concealed).toBe(concealed);
            } else {
              expect(cell.flashing).toBe(before[r][c].flashing);
              expect(cell.concealed).toBe(before[r][c].concealed);
            }
          }
        }
      }),
      { numRuns: 20 },
    );
  });
});
