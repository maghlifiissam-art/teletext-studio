// Feature: teletext-studio, Property 17: Concealed visibility follows reveal (round trip)
// Concealed content is hidden when not revealed and shown when revealed;
// revealing then hiding restores the hidden state; non-concealed cells are
// unaffected by the reveal flag.
// Validates: Requirements 5.1, 5.2, 5.3, 5.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { computeCellVisual } from "../../scripts/renderer.js";
import { arbCell } from "./_arbitraries.js";

describe("Property 17: Concealed visibility follows reveal", () => {
  it("concealed cells are visible iff revealed; non-concealed cells are always visible", () => {
    fc.assert(
      fc.property(arbCell, fc.boolean(), (cell, revealed) => {
        const visual = computeCellVisual(cell, { flashOn: true, revealed });
        if (cell.concealed) {
          expect(visual.visible).toBe(revealed);
        } else {
          expect(visual.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("reveal then hide round-trips back to hidden", () => {
    fc.assert(
      fc.property(arbCell, (cell) => {
        const hidden = computeCellVisual(cell, { flashOn: true, revealed: false });
        const shown = computeCellVisual(cell, { flashOn: true, revealed: true });
        const hiddenAgain = computeCellVisual(cell, { flashOn: true, revealed: false });
        expect(hiddenAgain.visible).toBe(hidden.visible);
        if (cell.concealed) {
          expect(hidden.visible).toBe(false);
          expect(shown.visible).toBe(true);
        } else {
          expect(hidden.visible).toBe(true);
          expect(shown.visible).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
