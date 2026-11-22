// Feature: teletext-studio, Property 13: Sextant toggle is its own inverse
// For any cell and sextant bit b in 0..5, toggleSextant(toggleSextant(cell, b), b)
// equals the original cell, and a single toggle flips exactly that bit.
// Validates: Requirements 3.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { toggleSextant } from "../../scripts/model.js";
import { arbCell, arbSextantBit } from "./_arbitraries.js";

describe("Property 13: Sextant toggle is its own inverse", () => {
  it("toggling a sextant twice restores the original cell and a single toggle flips exactly that bit", () => {
    fc.assert(
      fc.property(arbCell, arbSextantBit, (cell, bit) => {
        const toggled = toggleSextant(cell, bit);
        const restored = toggleSextant(toggled, bit);

        // Own inverse: the round trip equals the original cell exactly.
        expect(restored).toEqual(cell);

        // A single toggle flips exactly bit `bit` and nothing else.
        expect(toggled).toEqual({ ...cell, mosaic: cell.mosaic ^ (1 << bit) });
        expect((toggled.mosaic ^ cell.mosaic) >>> 0).toBe(1 << bit);
      }),
      { numRuns: 100 },
    );
  });
});
