// Feature: teletext-studio, Mosaic input from pointer and touch events (task 6.14)
// sextantFromPoint maps both pointer and touch coordinates to the correct
// sextant bit (0..5) in the 2x3 grid.
// Validates: Requirements 3.5

import { describe, it, expect } from "vitest";

import { createMosaicEditor } from "../../scripts/editor.js";
import { newPageSet, newPage, addPage } from "../../scripts/model.js";

function makeMosaic() {
  const ps = newPageSet();
  addPage(ps, newPage(100));
  return createMosaicEditor(ps, 100);
}

// A 12x10 cell at the origin: 2 columns of 6px, 3 rows of ~3.33px.
const RECT = { left: 0, top: 0, width: 12, height: 10 };

describe("sextantFromPoint (pointer and touch)", () => {
  it("maps a point in each of the six sextants to its bit", () => {
    const mosaic = makeMosaic();
    // Top-left (bit 0), top-right (bit 1), middle-left (bit 2),
    // middle-right (bit 3), bottom-left (bit 4), bottom-right (bit 5).
    const cases = [
      [1, 1, 0],
      [10, 1, 1],
      [1, 5, 2],
      [10, 5, 3],
      [1, 9, 4],
      [10, 9, 5],
    ];
    for (const [x, y, bit] of cases) {
      // PointerEvent-style coordinates.
      expect(mosaic.sextantFromPoint(RECT, x, y)).toBe(bit);
      // Touch-style coordinates (Touch objects expose the same client x/y).
      const touch = { clientX: x, clientY: y };
      expect(mosaic.sextantFromPoint(RECT, touch.clientX, touch.clientY)).toBe(bit);
    }
  });

  it("clamps points outside the cell to the edge sextants", () => {
    const mosaic = makeMosaic();
    expect(mosaic.sextantFromPoint(RECT, -5, -5)).toBe(0);
    expect(mosaic.sextantFromPoint(RECT, 500, 500)).toBe(5);
  });

  it("toggleSextantAt inverts the bit addressed by a pointer position", () => {
    const ps = newPageSet();
    addPage(ps, newPage(100));
    const mosaic = createMosaicEditor(ps, 100);
    const bit = mosaic.sextantFromPoint(RECT, 10, 5); // middle-right
    mosaic.toggleSextantAt(0, 0, bit);
    expect(ps.pages.get(100).cells[0][0].mosaic).toBe(1 << 3);
  });
});
