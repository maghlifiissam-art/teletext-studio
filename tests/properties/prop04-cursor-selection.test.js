// Feature: teletext-studio, Property 4: Cursor selection places the cursor
// selectCell(r, c) sets the cursor to exactly {row: r, col: c}.
// Validates: Requirements 1.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol } from "./_arbitraries.js";

describe("Property 4: Cursor selection places the cursor", () => {
  it("selectCell sets the cursor to exactly the given coordinates", () => {
    fc.assert(
      fc.property(arbRow, arbCol, (row, col) => {
        const { editor } = makeEditor();
        editor.selectCell(row, col);
        expect(editor.state.cursor).toEqual({ row, col });
      }),
      { numRuns: 100 },
    );
  });
});
