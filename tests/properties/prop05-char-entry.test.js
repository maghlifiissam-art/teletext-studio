// Feature: teletext-studio, Property 5: Character entry writes the selected cell
// enterChar writes the character (mapped through the Charset) into the
// selected cell.
// Validates: Requirements 1.3

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { CHARSET } from "../../scripts/model.js";
import { makeEditor } from "../_editorHelper.js";
import { arbRow, arbCol, arbCharCode } from "./_arbitraries.js";

describe("Property 5: Character entry writes the selected cell", () => {
  it("the selected cell receives the charset-mapped character; out-of-repertoire input becomes space", () => {
    fc.assert(
      fc.property(arbRow, arbCol, arbCharCode, (row, col, code) => {
        const { editor, page } = makeEditor();
        editor.selectCell(row, col);
        const glyph = CHARSET.codeToUnicode(code);
        editor.enterChar(glyph);
        const expected = CHARSET.unicodeToCode(glyph);
        expect(page.cells[row][col].char).toBe(expected === -1 ? 0x20 : expected);
      }),
      { numRuns: 100 },
    );
  });

  it("a character outside the repertoire is written as space (0x20)", () => {
    const { editor, page } = makeEditor();
    editor.selectCell(0, 0);
    editor.enterChar("€"); // not in the teletext repertoire
    expect(page.cells[0][0].char).toBe(0x20);
  });
});
