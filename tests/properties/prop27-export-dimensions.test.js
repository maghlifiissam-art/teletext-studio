// Feature: teletext-studio, Property 27: Export dimension invariant
// renderToCanvas renders the page at exactly 480x240 pixels, each cell in a
// 12x10 region at position (col*12, row*10).
// Validates: Requirements 8.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { COLS, ROWS, PALETTE, newPage } from "../../scripts/model.js";
import {
  renderToCanvas,
  EXPORT_CELL_W,
  EXPORT_CELL_H,
} from "../../scripts/renderer.js";
import {
  arbCell,
  arbRow,
  arbCol,
  arbPageNumber,
} from "./_arbitraries.js";

/* A cheap sparse page: a fresh page with up to 12 cells overwritten by
   arbitrary cells. Full 960-cell arbitrary pages are needlessly slow to
   generate and shrink; sparse pages exercise the same drawing paths. */
const arbSparsePage = fc
  .tuple(
    arbPageNumber,
    fc.array(fc.tuple(arbRow, arbCol, arbCell), { minLength: 0, maxLength: 12 }),
  )
  .map(([number, writes]) => {
    const page = newPage(number);
    for (const [r, c, cell] of writes) {
      page.cells[r][c] = cell;
    }
    return page;
  });

/* A recording stand-in for a 2D canvas context. */
function recordingCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: null,
    font: null,
    textAlign: null,
    textBaseline: null,
    clearRect(x, y, w, h) {
      calls.push({ op: "clearRect", x, y, w, h });
    },
    fillRect(x, y, w, h) {
      calls.push({ op: "fillRect", x, y, w, h, style: this.fillStyle });
    },
    fillText(text, x, y) {
      calls.push({ op: "fillText", text, x, y, style: this.fillStyle });
    },
  };
}

describe("Property 27: Export dimension invariant", () => {
  it("cell geometry is exactly 12x10 and the page totals 480x240", () => {
    expect(EXPORT_CELL_W).toBe(12);
    expect(EXPORT_CELL_H).toBe(10);
    expect(EXPORT_CELL_W * COLS).toBe(480);
    expect(EXPORT_CELL_H * ROWS).toBe(240);
  });

  it("every drawing call lands inside the correct 12x10 cell region at (col*12, row*10)", () => {
    fc.assert(
      fc.property(arbSparsePage, (page) => {
        const ctx = recordingCtx();
        renderToCanvas(ctx, page);

        // Starts by clearing exactly the 480x240 export area.
        expect(ctx.calls[0]).toEqual({ op: "clearRect", x: 0, y: 0, w: 480, h: 240 });

        const rects = ctx.calls.filter((c) => c.op === "fillRect");
        expect(rects.length).toBeGreaterThan(0);
        for (const r of rects) {
          // Each rect must lie fully inside one cell's 12x10 region.
          // Mosaic sextants subdivide the cell into 6px columns and 4/3/3px
          // rows, so only containment within a single cell is asserted.
          const col = Math.floor(r.x / EXPORT_CELL_W);
          const row = Math.floor(r.y / EXPORT_CELL_H);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(COLS);
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(ROWS);
          expect(r.x + r.w).toBeLessThanOrEqual((col + 1) * EXPORT_CELL_W);
          expect(r.y + r.h).toBeLessThanOrEqual((row + 1) * EXPORT_CELL_H);
          expect(r.x + r.w).toBeLessThanOrEqual(480);
          expect(r.y + r.h).toBeLessThanOrEqual(240);
          expect(Object.values(PALETTE)).toContain(r.style);
        }

        const texts = ctx.calls.filter((c) => c.op === "fillText");
        for (const t of texts) {
          // Text is centred in its cell.
          expect(t.x % EXPORT_CELL_W).toBe(EXPORT_CELL_W / 2);
          expect((t.y - EXPORT_CELL_H / 2) % EXPORT_CELL_H).toBe(0);
          expect(Object.values(PALETTE)).toContain(t.style);
        }
      }),
      { numRuns: 25 },
    );
  });
});
