/*
 * Property 23: Navigation to an existing target succeeds.
 *
 * For any non-empty PageSet, goTo(n) with an existing page number succeeds
 * and sets current to n (Req. 7.1); activateFastext with a key whose target
 * exists succeeds and sets current to that target (Req. 7.3).
 *
 * **Validates: Requirements 7.1, 7.3**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { addPage, newPage } from "../../scripts/model.js";
import { createNavigator, FASTEXT_KEYS } from "../../scripts/navigator.js";
import { arbNonEmptyPageSet, arbPageNumber } from "./_arbitraries.js";

describe("Property 23: Navigation to an existing target succeeds", () => {
  it("goTo(n) succeeds and sets current to n for an existing page", () => {
    fc.assert(
      fc.property(arbNonEmptyPageSet, (ps) => {
        const numbers = [...ps.pages.keys()];
        const start = numbers[0];
        const nav = createNavigator(ps, start);
        for (const n of numbers) {
          const result = nav.goTo(n);
          expect(result).toEqual({ ok: true, current: n });
          expect(nav.state.current).toBe(n);
          expect(nav.state.notFound).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("activateFastext succeeds and sets current to an existing target", () => {
    fc.assert(
      fc.property(
        arbNonEmptyPageSet,
        arbPageNumber,
        fc.integer({ min: 0, max: 3 }),
        (ps, targetNumber, keyIndex) => {
          fc.pre(!ps.pages.has(targetNumber));
          const target = newPage(targetNumber);
          addPage(ps, target);
          const numbers = [...ps.pages.keys()];
          const current = numbers.find((n) => n !== targetNumber);
          const nav = createNavigator(ps, current);
          const page = ps.pages.get(current);
          const key = FASTEXT_KEYS[keyIndex];
          page.fastext[key] = targetNumber;
          const result = nav.activateFastext(page, key);
          expect(result).toEqual({ ok: true, current: targetNumber });
          expect(nav.state.current).toBe(targetNumber);
          expect(nav.state.notFound).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
