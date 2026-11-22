/*
 * Property 31: Page-set URL size bound on success.
 *
 * For any PageSet that encodes without the too-large error, the resulting
 * URL is at most 30000 characters (Req. 9.1).
 *
 * **Validates: Requirements 9.1**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { newPage, newPageSet, addPage } from "../../scripts/model.js";
import { encode, URL_LIMIT } from "../../scripts/urlcodec.js";
import { arbCell, arbRow, arbCol, arbPageNumber } from "./_arbitraries.js";

const arbSparseSet = fc
  .uniqueArray(arbPageNumber, { minLength: 1, maxLength: 6 })
  .map((numbers) => {
    const ps = newPageSet();
    for (const n of numbers) {
      addPage(ps, newPage(n));
    }
    return ps;
  })
  .chain((ps) =>
    fc
      .array(
        fc.tuple(arbPageNumber, arbRow, arbCol, arbCell),
        { minLength: 0, maxLength: 30 }
      )
      .map((writes) => {
        for (const [n, r, c, cell] of writes) {
          const page = ps.pages.get(n);
          if (page) {
            page.cells[r][c] = cell;
          }
        }
        return ps;
      })
  );

describe("Property 31: Page-set URL size bound on success", () => {
  it("a successfully encoded URL never exceeds 30000 characters", async () => {
    await fc.assert(
      fc.asyncProperty(arbSparseSet, async (ps) => {
        const url = await encode(ps, "https://teletext-studio.example.com/");
        expect(url.length).toBeLessThanOrEqual(URL_LIMIT);
      }),
      { numRuns: 25 }
    );
  });
});
