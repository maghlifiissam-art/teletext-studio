// Feature: teletext-studio, Property 6: Deletion clears to space
// deleteCell sets the selected cell's character to space (0x20).
// Validates: Requirements 1.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol, arbCharCode } from "./_arbitraries.js";

describe("Property 6: Deletion clears to space", () => {
  it("after entering any character, deleteCell restores the cell's char to 0x20", () => {
    fc.assert(
      fc.property(arbRow, arbCol, arbCharCode, (row, col, code) => {
        const { editor, page } = makeEditor();
        editor.selectCell(row, col);
        editor.enterChar(String.fromCharCode(0x20 + (code % 95))); // any ASCII
        editor.selectCell(row, col); // the cursor advanced after the write
        editor.deleteCell();
        expect(page.cells[row][col].char).toBe(0x20);
      }),
      { numRuns: 100 },
    );
  });
});
