// Feature: teletext-studio, Property 34: Charset round trip
// For every supported character (including the Arabic subset),
// codeToUnicode(unicodeToCode(ch)) == ch; out-of-repertoire input maps to the
// space fallback rather than a valid distinct code.
// Validates: Requirements 12.3

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { CHARSET } from "../../scripts/model.js";
import { arbAnyCodePoint, arbCharCodePoint } from "./_arbitraries.js";

describe("Property 34: Charset round trip", () => {
  it("round-trips every supported character and maps out-of-repertoire input to space", () => {
    fc.assert(
      fc.property(arbAnyCodePoint, (ch) => {
        const code = CHARSET.unicodeToCode(ch);
        const back = CHARSET.codeToUnicode(code);
        if (code === -1) {
          // Out-of-repertoire: not a valid distinct code, and the glyph falls
          // back to space (0x20), never a different character.
          expect(code).toBe(-1);
          expect(back).toBe(" ");
        } else {
          // Supported character (incl. Arabic subset): exact round trip.
          expect(back).toBe(ch);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("round-trips from every single-byte code (codeToUnicode then unicodeToCode then codeToUnicode)", () => {
    fc.assert(
      fc.property(arbCharCodePoint, (code) => {
        const ch = CHARSET.codeToUnicode(code);
        expect(CHARSET.codeToUnicode(CHARSET.unicodeToCode(ch))).toBe(ch);
      }),
      { numRuns: 256 },
    );
  });

  it("has a genuinely populated repertoire: ASCII and Arabic subsets round-trip and out-of-repertoire does not", () => {
    // Printable ASCII: space is the default glyph; letters/digits map distinctly.
    expect(CHARSET.codeToUnicode(0x20)).toBe(" ");
    expect(CHARSET.unicodeToCode(" ")).toBe(0x20);
    expect(CHARSET.codeToUnicode(0x41)).toBe("A");
    expect(CHARSET.unicodeToCode("A")).toBe(0x41);
    expect(CHARSET.codeToUnicode(0x30)).toBe("0");
    expect(CHARSET.unicodeToCode("0")).toBe(0x30);

    // Arabic subset (0x80..0xFF): the first code maps to a non-space Arabic
    // letter and round-trips exactly.
    const firstArabic = CHARSET.codeToUnicode(0x80);
    expect(firstArabic).not.toBe(" ");
    expect(firstArabic.length).toBe(1);
    expect(CHARSET.unicodeToCode(firstArabic)).toBe(0x80);
    expect(CHARSET.codeToUnicode(CHARSET.unicodeToCode(firstArabic))).toBe(firstArabic);

    // 0x00..0x1F and 0x7F have no glyph: they render as space, but space's
    // canonical code is 0x20 (so they do not become a distinct code).
    expect(CHARSET.codeToUnicode(0x00)).toBe(" ");
    expect(CHARSET.codeToUnicode(0x7f)).toBe(" ");
    expect(CHARSET.unicodeToCode(" ")).toBe(0x20);

    // A character outside the repertoire maps to -1, never a distinct code.
    expect(CHARSET.unicodeToCode("é")).toBe(-1);
    expect(CHARSET.unicodeToCode("Ω")).toBe(-1);
    expect(CHARSET.codeToUnicode(CHARSET.unicodeToCode("é"))).toBe(" ");
  });
});
