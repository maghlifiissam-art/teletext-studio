// Feature: teletext-studio, Property 11: Render uses cell foreground and background
// The rendered visible foreground equals PALETTE[cell.fg], the background
// equals PALETTE[cell.bg]; a set mosaic sextant draws in fg, a clear one in bg.
// Validates: Requirements 2.7, 3.3

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { PALETTE } from "../../scripts/model.js";
import {
  computeCellVisual,
  sextantColourIndex,
} from "../../scripts/renderer.js";
import {
  arbCell,
  arbMosaic,
  arbSextantBit,
  arbColour,
  arbBool,
} from "./_arbitraries.js";

describe("Property 11: Render uses cell foreground and background", () => {
  it("computeCellVisual reports the cell's own fg/bg colour indices for any cell", () => {
    fc.assert(
      fc.property(arbCell, (cell) => {
        const visual = computeCellVisual(cell);
        expect(PALETTE[visual.fg]).toBe(PALETTE[cell.fg]);
        expect(PALETTE[visual.bg]).toBe(PALETTE[cell.bg]);
        expect(visual.fg).toBe(cell.fg);
        expect(visual.bg).toBe(cell.bg);
      }),
      { numRuns: 100 },
    );
  });

  it("a set mosaic sextant draws in the foreground colour, a clear sextant in the background colour", () => {
    fc.assert(
      fc.property(arbMosaic, arbSextantBit, arbColour, arbColour, (mosaic, bit, fg, bg) => {
        const visual = { content: "mosaic", mosaic, fg, bg, visible: true };
        const idx = sextantColourIndex(visual, bit);
        const expected = (mosaic & (1 << bit)) !== 0 ? fg : bg;
        expect(idx).toBe(expected);
        expect(PALETTE[idx]).toBe(PALETTE[expected]);
      }),
      { numRuns: 100 },
    );
  });

  it("visibility options never alter the reported fg/bg colours", () => {
    fc.assert(
      fc.property(arbCell, arbBool, arbBool, (cell, flashOn, revealed) => {
        const visual = computeCellVisual(cell, { flashOn, revealed });
        expect(visual.fg).toBe(cell.fg);
        expect(visual.bg).toBe(cell.bg);
      }),
      { numRuns: 100 },
    );
  });
});
