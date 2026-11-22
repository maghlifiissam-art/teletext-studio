// Feature: teletext-studio, Property 14: Mode switch preserves colours and
// initialises mosaic
// For any cell, switching between text and mosaic mode preserves the cell's
// foreground and background colours, and entering mosaic mode sets the mosaic
// pattern to 0.
// Validates: Requirements 3.4, 3.6

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { switchMode } from "../../scripts/model.js";
import { arbCell, arbMode } from "./_arbitraries.js";

describe("Property 14: Mode switch preserves colours and initialises mosaic", () => {
  it("preserves fg/bg on every mode switch and initialises the mosaic pattern to 0", () => {
    fc.assert(
      fc.property(arbCell, arbMode, (cell, mode) => {
        const switched = switchMode(cell, mode);

        expect(switched.mode).toBe(mode);
        // Colours are preserved in both directions.
        expect(switched.fg).toBe(cell.fg);
        expect(switched.bg).toBe(cell.bg);
        // The mosaic pattern is initialised to 0 (entering mosaic starts blank).
        expect(switched.mosaic).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
