// Feature: teletext-studio, Property 7: Cursor advances with wrap
// After writing a character, the cursor moves to the row-major successor:
// (r,39) -> (r+1,0), and (23,39) -> (0,0).
// Validates: Requirements 1.6

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { COLS, ROWS } from "../../scripts/model.js";
import { advanceCursor } from "../../scripts/editor.js";
import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol } from "./_arbitraries.js";

describe("Property 7: Cursor advances with wrap", () => {
  it("advanceCursor is the row-major successor with wrap at row and page ends", () => {
    fc.assert(
      fc.property(arbRow, arbCol, (row, col) => {
        const next = advanceCursor(row, col);
        const linear = (row * COLS + col + 1) % (ROWS * COLS);
        expect(next).toEqual({ row: Math.floor(linear / COLS), col: linear % COLS });
      }),
      { numRuns: 100 },
    );
  });

  it("enterChar advances the cursor by the same rule, including (23,39) -> (0,0)", () => {
    const { editor } = makeEditor();
    editor.selectCell(ROWS - 1, COLS - 1);
    editor.enterChar("A");
    expect(editor.state.cursor).toEqual({ row: 0, col: 0 });

    editor.selectCell(3, COLS - 1);
    editor.enterChar("A");
    expect(editor.state.cursor).toEqual({ row: 4, col: 0 });
  });
});
