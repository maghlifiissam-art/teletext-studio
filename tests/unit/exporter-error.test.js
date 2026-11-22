/*
 * Unit test (task 9.3): PNG export error path.
 *
 * When canvas.toBlob is unavailable or fails, exportPng surfaces an
 * "export failed" error and leaves the page unchanged (Req. 8.5).
 */

import { describe, it, expect } from "vitest";

import { newPage } from "../../scripts/model.js";
import { exportPng } from "../../scripts/exporter.js";

function fakeCtx() {
  return {
    fillStyle: null,
    font: null,
    textAlign: null,
    textBaseline: null,
    clearRect() {},
    fillRect() {},
    fillText() {},
  };
}

describe("exportPng error path", () => {
  it("rejects with 'export failed' when toBlob is unavailable, page unchanged", async () => {
    const page = newPage(100);
    page.cells[0][0] = {
      mode: "text",
      char: 0x41,
      mosaic: 0,
      fg: 3,
      bg: 1,
      flashing: true,
      concealed: true,
    };
    const before = JSON.stringify(page);

    const createCanvas = () => ({ getContext: () => fakeCtx() }); // no toBlob
    await expect(exportPng(page, { createCanvas })).rejects.toThrow(/export failed/i);
    expect(JSON.stringify(page)).toBe(before);
  });

  it("rejects with 'export failed' when toBlob yields null, page unchanged", async () => {
    const page = newPage(101);
    const before = JSON.stringify(page);

    const createCanvas = () => ({
      getContext: () => fakeCtx(),
      toBlob: (cb) => cb(null),
    });
    await expect(exportPng(page, { createCanvas })).rejects.toThrow(/export failed/i);
    expect(JSON.stringify(page)).toBe(before);
  });

  it("rejects with 'export failed' when toBlob throws, page unchanged", async () => {
    const page = newPage(102);
    const before = JSON.stringify(page);

    const createCanvas = () => ({
      getContext: () => fakeCtx(),
      toBlob: () => {
        throw new Error("boom");
      },
    });
    await expect(exportPng(page, { createCanvas })).rejects.toThrow(/export failed/i);
    expect(JSON.stringify(page)).toBe(before);
  });

  it("downloads the blob on success", async () => {
    const page = newPage(103);
    const blob = new Blob(["png"], { type: "image/png" });
    const downloads = [];
    const createCanvas = () => ({
      getContext: () => fakeCtx(),
      toBlob: (cb) => cb(blob),
    });
    await exportPng(page, {
      createCanvas,
      download: (b, name) => downloads.push({ b, name }),
    });
    expect(downloads).toEqual([{ b: blob, name: "teletext-page-103.png" }]);
  });
});
