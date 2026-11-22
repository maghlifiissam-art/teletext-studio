// Feature: teletext-studio, Property 8: No selection is a no-op
// When the cursor is null, enterChar and deleteCell leave the Page
// byte-identical.
// Validates: Requirements 1.7, 1.8

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { makeEditor } from "../_editorHelper.js";
import { arbCharCode } from "./_arbitraries.js";

describe("Property 8: No selection is a no-op", () => {
  it("enterChar with a null cursor leaves the page byte-identical", () => {
    fc.assert(
      fc.property(arbCharCode, (code) => {
        const { editor, page } = makeEditor();
        const before = JSON.stringify(page);
        editor.enterChar(String.fromCharCode(0x20 + (code % 95)));
        expect(JSON.stringify(page)).toBe(before);
      }),
      { numRuns: 100 },
    );
  });

  it("deleteCell with a null cursor leaves the page byte-identical", () => {
    const { editor, page } = makeEditor();
    const before = JSON.stringify(page);
    editor.deleteCell();
    expect(JSON.stringify(page)).toBe(before);
  });
});
