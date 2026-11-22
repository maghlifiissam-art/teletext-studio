/*
 * Property 28: Export renders fully visible.
 *
 * The export render pass draws every cell with its content shown: flashing
 * and concealed cells render exactly as if flashOn=true and revealed=true
 * (Req. 8.3, 8.4).
 *
 * **Validates: Requirements 8.3, 8.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { newPage } from "../../scripts/model.js";
import { renderPageForExport } from "../../scripts/exporter.js";
import { arbCell, arbRow, arbCol, arbPageNumber } from "./_arbitraries.js";

// Sparse pages whose written cells always carry flashing and/or concealed
// flags, so the assertion only holds if export forces full visibility.
const arbFlaggedSparsePage = fc
  .tuple(
    arbPageNumber,
    fc.array(fc.tuple(arbRow, arbCol, arbCell), { minLength: 1, maxLength: 20 })
  )
  .map(([number, writes]) => {
    const page = newPage(number);
    for (const [r, c, cell] of writes) {
      page.cells[r][c] = { ...cell, flashing: true, concealed: true };
    }
    return page;
  });

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

describe("Property 28: Export renders fully visible", () => {
  it("flashing and concealed cells are drawn with their content shown", () => {
    fc.assert(
      fc.property(arbFlaggedSparsePage, (page) => {
        const ctx = recordingCtx();
        renderPageForExport(ctx, page);

        let textCells = 0;
        let mosaicCells = 0;
        for (const row of page.cells) {
          for (const cell of row) {
            if (cell.mode === "text") {
              textCells++;
            } else {
              mosaicCells++;
            }
          }
        }

        // Every text cell, flagged or not, produced a glyph draw.
        const texts = ctx.calls.filter((c) => c.op === "fillText");
        expect(texts.length).toBe(textCells);

        // Every mosaic cell, flagged or not, tiled all six sextants.
        const rects = ctx.calls.filter((c) => c.op === "fillRect");
        expect(rects.length).toBe(textCells + mosaicCells * 6);
      }),
      { numRuns: 100 }
    );
  });
});
