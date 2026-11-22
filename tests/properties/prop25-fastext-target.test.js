// Feature: teletext-studio, Property 25: Fastext target assignment
// After setFastext(page, key, target), the page's fastext[key] equals the
// target.
// Validates: Requirements 7.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { FASTEXT_KEYS } from "../../scripts/model.js";
import { makeEditor } from "../_editorHelper.js";
import { arbPageNumber } from "./_arbitraries.js";

describe("Property 25: Fastext target assignment", () => {
  it("sets the given key to the given target (number or null)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FASTEXT_KEYS),
        fc.oneof(fc.constant(null), arbPageNumber),
        (key, target) => {
          const { editor, page } = makeEditor();
          editor.setFastext(100, key, target);
          expect(page.fastext[key]).toBe(target);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("rejects an out-of-range target", () => {
    const { editor } = makeEditor();
    expect(() => editor.setFastext(100, "red", 99)).toThrow();
    expect(() => editor.setFastext(100, "red", 900)).toThrow();
  });
});
