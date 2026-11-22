/*
 * scripts/exporter.js — PNG Exporter.
 *
 * Exports the current page as a 480x240 PNG (Req. 8.1 / 8.2), always rendered
 * fully visible: flashOn=true and revealed=true (Req. 8.3 / 8.4). On any
 * failure of canvas.toBlob, surfaces an "export failed" error and leaves the
 * page unchanged (Req. 8.5).
 *
 * The browser environment is injectable (createCanvas / download) so the
 * error path is unit-testable without a DOM.
 */

import { renderToCanvas, EXPORT_CELL_W, EXPORT_CELL_H } from "./renderer.js";
import { COLS, ROWS } from "./model.js";

/**
 * The exact render pass used for export: fully visible (Req. 8.3 / 8.4).
 * Exported so tests can drive it with a recording context.
 */
export function renderPageForExport(ctx, page) {
  renderToCanvas(ctx, page, { flashOn: true, revealed: true });
}

/**
 * Export a page as a PNG download.
 *
 * @param {object} page
 * @param {object} [env] injectable environment
 * @param {() => object} [env.createCanvas] returns a canvas-like object
 * @param {(blob: Blob, filename: string) => void} [env.download]
 * @returns {Promise<void>} rejects with Error("export failed") on failure
 */
export async function exportPng(page, env = {}) {
  const createCanvas =
    env.createCanvas ??
    (() => {
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_CELL_W * COLS; // 480
      canvas.height = EXPORT_CELL_H * ROWS; // 240
      return canvas;
    });

  const download =
    env.download ??
    ((blob, filename) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });

  let blob;
  try {
    const canvas = createCanvas();
    const ctx = canvas.getContext("2d");
    renderPageForExport(ctx, page);
    if (typeof canvas.toBlob !== "function") {
      throw new Error("canvas.toBlob unavailable");
    }
    blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("canvas.toBlob returned null"));
          }
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    // Req. 8.5: notify with an error; the page is never mutated by export.
    throw new Error("export failed", { cause: err });
  }

  download(blob, `teletext-page-${page.number}.png`);
}
