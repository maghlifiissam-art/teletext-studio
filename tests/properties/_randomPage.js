/*
 * Deterministic high-entropy page builder for the URL size-bound tests.
 *
 * fast-check's integer generator biases toward small values, which compress
 * well and never reach the worst-case payload size. A mulberry32 PRNG fills
 * every cell with uniform random content, giving the true incompressible
 * worst case the 4000/30000 character limits are designed around.
 */

import { COLS, ROWS, newPage } from "../../scripts/model.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A page whose 960 cells are uniform random content (deterministic). */
export function randomContentPage(number, seed) {
  const rnd = mulberry32(seed);
  const page = newPage(number);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      page.cells[r][c] = {
        mode: rnd() < 0.5 ? "text" : "mosaic",
        char: Math.floor(rnd() * 256),
        mosaic: Math.floor(rnd() * 64),
        fg: Math.floor(rnd() * 8),
        bg: Math.floor(rnd() * 8),
        flashing: rnd() < 0.5,
        concealed: rnd() < 0.5,
      };
    }
  }
  return page;
}
