/*
 * Property 33: Invalid URL decodes to an empty Page_Set.
 *
 * Truncated, wrong-magic, unsupported-version, or corrupted payloads signal
 * an invalid-URL error and load an empty PageSet (Req. 9.5).
 *
 * **Validates: Requirements 9.5**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { newPageSet, newPage, addPage } from "../../scripts/model.js";
import {
  encode,
  decode,
  serialize,
  compress,
  base64url,
} from "../../scripts/urlcodec.js";
import { arbPage } from "./_arbitraries.js";

async function expectInvalid(url) {
  const { ps, error } = await decode(url);
  expect(error).not.toBeNull();
  expect(ps.pages.size).toBe(0);
}

describe("Property 33: Invalid URL decodes to an empty Page_Set", () => {
  it("payloads with bad magic, bad version, or truncation are rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPage,
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 1, max: 20 }),
        async (page, corruption, cut) => {
          const ps = newPageSet();
          addPage(ps, page);
          const raw = serialize(ps);

          let mutated;
          if (corruption === 0) {
            mutated = Uint8Array.from(raw); // wrong magic
            mutated[0] = mutated[0] ^ 0xff;
          } else if (corruption === 1) {
            mutated = Uint8Array.from(raw); // unsupported version
            mutated[2] = 0x7f;
          } else {
            mutated = raw.slice(0, Math.max(1, raw.length - cut)); // truncated
          }

          const url = "https://example.com/#t=" + base64url(await compress(mutated));
          await expectInvalid(url);
        }
      ),
      { numRuns: 25 }
    );
  });

  it("truncated base64url payloads are rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPage,
        fc.integer({ min: 4, max: 60 }),
        async (page, cut) => {
          const ps = newPageSet();
          addPage(ps, page);
          const url = await encode(ps, "https://example.com/");
          const payload = url.slice(url.indexOf("#t=") + 3);
          fc.pre(payload.length > cut);

          // A truncated deflate stream cannot be inflated.
          await expectInvalid("https://example.com/#t=" + payload.slice(0, -cut));
        }
      ),
      { numRuns: 25 }
    );
  });

  it("a payload whose compressed stream is overwritten is rejected", async () => {
    const ps = newPageSet();
    addPage(ps, newPage(100));
    const url = await encode(ps, "https://example.com/");
    const payload = url.slice(url.indexOf("#t=") + 3);
    // Overwriting the start of a deflate stream destroys its block structure.
    const wrecked = "________" + payload.slice(8);
    await expectInvalid("https://example.com/#t=" + wrecked);
  });

  it("URLs without a payload or with foreign characters are rejected", async () => {
    await expectInvalid("https://example.com/");
    await expectInvalid("https://example.com/#other=abc");
    await expectInvalid("https://example.com/#t=not!valid*base64");
    await expectInvalid("");
  });
});
