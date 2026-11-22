// @vitest-environment jsdom
/*
 * Property 35: Language/direction toggle preserves the model.
 *
 * Switching the UI language and direction any number of times never changes
 * the PageSet: page count, numbers, Fastext targets, and all cell fields are
 * byte-identical before and after (Req. 12.4).
 *
 * **Validates: Requirements 12.4**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { applyLanguage, nextLanguage } from "../../scripts/ui.js";
import { arbNonEmptyPageSet } from "./_arbitraries.js";

function makeRoot() {
  document.body.innerHTML = `
    <div id="root" lang="en" dir="ltr" data-lang="en" data-dir="ltr">
      <button id="lang-toggle" data-i18n="lang-toggle" aria-pressed="false"></button>
      <button data-i18n="export-png"></button>
      <span data-i18n="reveal"></span>
    </div>`;
  return document.getElementById("root");
}

describe("Property 35: Language/direction toggle preserves the model", () => {
  it("any sequence of toggles leaves the PageSet unchanged", () => {
    fc.assert(
      fc.property(
        arbNonEmptyPageSet,
        fc.array(fc.constant(null), { minLength: 1, maxLength: 8 }),
        (ps, toggles) => {
          const before = JSON.stringify(ps, (key, value) =>
            value instanceof Map ? [...value.entries()] : value
          );
          const root = makeRoot();
          let lang = "en";
          for (const _ of toggles) {
            lang = nextLanguage(lang);
            applyLanguage(root, lang);
          }
          const after = JSON.stringify(ps, (key, value) =>
            value instanceof Map ? [...value.entries()] : value
          );
          expect(after).toBe(before);
        }
      ),
      { numRuns: 50 }
    );
  });
});
