/*
 * Property 24: Four Fastext keys.
 *
 * The Navigator exposes exactly four Fastext keys, in the fixed order
 * red, green, yellow, cyan (Req. 7.2).
 *
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { newPageSet, newPage, addPage } from "../../scripts/model.js";
import { createNavigator } from "../../scripts/navigator.js";
import { arbPageNumber } from "./_arbitraries.js";

describe("Property 24: Four Fastext keys", () => {
  it("exposes exactly red, green, yellow, cyan in that order", () => {
    fc.assert(
      fc.property(arbPageNumber, (n) => {
        const ps = newPageSet();
        addPage(ps, newPage(n));
        const nav = createNavigator(ps, n);
        expect(nav.fastextKeys).toEqual(["red", "green", "yellow", "cyan"]);
      }),
      { numRuns: 100 }
    );
  });
});
