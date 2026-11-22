// Feature: teletext-studio, Property 9: Colour selection applies to subsequent entries
// After setFg(c)/setBg(c), every subsequently entered character has that
// colour until changed.
// Validates: Requirements 2.3, 2.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { makeEditor } from "../_editorHelper.js";
import { arbColour, arbRow, arbCol } from "./_arbitraries.js";

describe("Property 9: Colour selection applies to subsequent entries", () => {
  it("characters entered after setFg/setBg carry exactly those colours until changed", () => {
    fc.assert(
      fc.property(arbColour, arbColour, arbRow, arbCol, arbColour, (fg1, bg1, row, col, fg2) => {
        const { editor, page } = makeEditor();
        editor.selectCell(row, col);
        editor.setFg(fg1);
        editor.setBg(bg1);
        editor.enterChar("A");
        editor.enterChar("B");
        const c1 = page.cells[row][col];
        const next = col + 1 < 40 ? page.cells[row][col + 1] : null;
        expect(c1.fg).toBe(fg1);
        expect(c1.bg).toBe(bg1);
        if (next) {
          expect(next.fg).toBe(fg1);
          expect(next.bg).toBe(bg1);
        }
        // Changing the colour affects only subsequent entries.
        editor.setFg(fg2);
        editor.enterChar("C");
        const prev = editor.state.cursor; // advanced past the third write
        void prev;
        const third = col + 2 < 40 ? page.cells[row][col + 2] : null;
        if (third) {
          expect(third.fg).toBe(fg2);
          expect(c1.fg).toBe(fg1); // earlier entry unchanged
        }
      }),
      { numRuns: 100 },
    );
  });
});
