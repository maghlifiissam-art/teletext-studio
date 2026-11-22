// Feature: teletext-studio, Property 3: Palette invariant
// The palette has exactly eight colours in the fixed order black, red,
// green, yellow, blue, magenta, cyan, white with the specified hex values.
// Validates: Requirements 2.1

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { PALETTE } from "../../scripts/model.js";

const EXPECTED_PALETTE = [
  "#000000", // black
  "#FF0000", // red
  "#00FF00", // green
  "#FFFF00", // yellow
  "#0000FF", // blue
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFFFFF", // white
];

describe("Property 3: Palette invariant", () => {
  it("always reports exactly eight colours in the fixed order with the specified hex values", () => {
    fc.assert(
      fc.property(fc.nat(), () => {
        expect(PALETTE).toHaveLength(8);
        expect(PALETTE).toEqual(EXPECTED_PALETTE);
      }),
      { numRuns: 100 },
    );
  });
});
