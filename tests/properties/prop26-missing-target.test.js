/*
 * Property 26: Missing navigation target is rejected, current unchanged.
 *
 * Direct entry of a page number that does not exist, or Fastext activation
 * whose target is missing or null, is rejected with the page-not-found
 * indicator and the current page unchanged (Req. 7.5, 7.6).
 *
 * **Validates: Requirements 7.5, 7.6**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { FASTEXT_KEYS, createNavigator } from "../../scripts/navigator.js";
import { arbNonEmptyPageSet, arbPageNumber } from "./_arbitraries.js";

describe("Property 26: Missing navigation target is rejected, current unchanged", () => {
  it("goTo(missing) is rejected with the indicator set and current unchanged", () => {
    fc.assert(
      fc.property(arbNonEmptyPageSet, arbPageNumber, (ps, missing) => {
        fc.pre(!ps.pages.has(missing));
        const start = [...ps.pages.keys()][0];
        const nav = createNavigator(ps, start);
        const result = nav.goTo(missing);
        expect(result).toEqual({ ok: false, current: start });
        expect(nav.state.current).toBe(start);
        expect(nav.state.notFound).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("activateFastext with a missing target is rejected and current unchanged", () => {
    fc.assert(
      fc.property(
        arbNonEmptyPageSet,
        arbPageNumber,
        fc.integer({ min: 0, max: 3 }),
        (ps, missing, keyIndex) => {
          fc.pre(!ps.pages.has(missing));
          const start = [...ps.pages.keys()][0];
          const nav = createNavigator(ps, start);
          const page = ps.pages.get(start);
          page.fastext[FASTEXT_KEYS[keyIndex]] = missing;
          const result = nav.activateFastext(page, FASTEXT_KEYS[keyIndex]);
          expect(result).toEqual({ ok: false, current: start });
          expect(nav.state.current).toBe(start);
          expect(nav.state.notFound).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("activateFastext with a null target is rejected and current unchanged", () => {
    fc.assert(
      fc.property(arbNonEmptyPageSet, fc.integer({ min: 0, max: 3 }), (ps, keyIndex) => {
        const start = [...ps.pages.keys()][0];
        const nav = createNavigator(ps, start);
        const page = ps.pages.get(start);
        page.fastext[FASTEXT_KEYS[keyIndex]] = null;
        const result = nav.activateFastext(page, FASTEXT_KEYS[keyIndex]);
        expect(result).toEqual({ ok: false, current: start });
        expect(nav.state.current).toBe(start);
        expect(nav.state.notFound).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
