/*
 * Property 32: Oversized page set is rejected.
 *
 * A PageSet whose encoded URL would exceed 30000 characters makes encode
 * signal a "too large to share" error and produce no URL (Req. 9.8).
 *
 * **Validates: Requirements 9.8**
 */

import { describe, it, expect } from "vitest";

import { newPageSet, addPage } from "../../scripts/model.js";
import { encode, URL_LIMIT } from "../../scripts/urlcodec.js";
import { randomContentPage } from "./_randomPage.js";

describe("Property 32: Oversized page set is rejected", () => {
  it("encode throws 'too large to share' for a set that cannot fit", async () => {
    // Eleven incompressible random-content pages: ~2890 raw bytes each and
    // deflate saves under 20% on this profile, so the base64url payload
    // lands around 34000 characters, well past the limit.
    const ps = newPageSet();
    for (let i = 0; i < 11; i++) {
      addPage(ps, randomContentPage(100 + i, 500 + i));
    }
    await expect(encode(ps, "https://teletext-studio.example.com/")).rejects.toThrow(
      /too large to share/i
    );
  });

  it("the limit constant is 30000", () => {
    expect(URL_LIMIT).toBe(30000);
  });
});
