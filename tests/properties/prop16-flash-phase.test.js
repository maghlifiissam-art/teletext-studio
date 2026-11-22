// Feature: teletext-studio, Property 16: Flashing visibility follows the phase
// A flashing cell's content is visible when flashOn is true and hidden when
// false; non-flashing cells are unaffected by the phase.
// Validates: Requirements 4.1

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { computeCellVisual } from "../../scripts/renderer.js";
import { arbCell } from "./_arbitraries.js";

describe("Property 16: Flashing visibility follows the phase", () => {
  it("flashing cells are visible iff flashOn; non-flashing cells are always visible", () => {
    fc.assert(
      fc.property(arbCell, fc.boolean(), (cell, flashOn) => {
        const visual = computeCellVisual(cell, { flashOn, revealed: true });
        if (cell.flashing) {
          expect(visual.visible).toBe(flashOn);
        } else {
          expect(visual.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("toggling the phase twice restores the original visibility", () => {
    fc.assert(
      fc.property(arbCell, (cell) => {
        const on = computeCellVisual(cell, { flashOn: true, revealed: true });
        const off = computeCellVisual(cell, { flashOn: false, revealed: true });
        const onAgain = computeCellVisual(cell, { flashOn: true, revealed: true });
        expect(onAgain.visible).toBe(on.visible);
        if (cell.flashing) {
          expect(off.visible).toBe(false);
          expect(on.visible).toBe(true);
        } else {
          expect(off.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
