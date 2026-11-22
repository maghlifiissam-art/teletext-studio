/*
 * Property 30: Single-page URL size bound.
 *
 * encodePage produces a URL of at most 4000 characters for any Page,
 * including worst-case pages where every cell carries incompressible random
 * content (Req. 9.7).
 *
 * **Validates: Requirements 9.7**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { encodePage, PAGE_URL_LIMIT } from "../../scripts/urlcodec.js";
import { arbPage } from "./_arbitraries.js";
import { randomContentPage } from "./_randomPage.js";

const BASE = "https://teletext-studio.example.com/editor";

describe("Property 30: Single-page URL size bound", () => {
  it("stays within 4000 characters for arbitrary pages", async () => {
    await fc.assert(
      fc.asyncProperty(arbPage, async (page) => {
        const url = await encodePage(page, BASE);
        expect(url.length).toBeLessThanOrEqual(PAGE_URL_LIMIT);
      }),
      { numRuns: 10 }
    );
  });

  it("stays within 4000 characters for incompressible worst-case pages", async () => {
    // Uniform random cells are the size worst case (design: ~2894 raw bytes).
    for (let seed = 1; seed <= 5; seed++) {
      const url = await encodePage(randomContentPage(100 + seed, seed), BASE);
      expect(url.length).toBeLessThanOrEqual(PAGE_URL_LIMIT);
    }
  });
});
