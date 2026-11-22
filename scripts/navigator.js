/*
 * scripts/navigator.js — Navigator.
 *
 * Browses a PageSet by 3-digit page number and via the four Fastext colour
 * keys (red, green, yellow, cyan, fixed order — Req. 7.2), and toggles
 * conceal visibility for the current page (Req. 5.3 / 5.4).
 *
 * Navigation never throws for a missing target: it reports
 * { ok: false, current } and sets the page-not-found indicator while staying
 * on the current page (Req. 7.5 / 7.6).
 */

import { FASTEXT_KEYS, getPage } from "./model.js";

export { FASTEXT_KEYS };

/**
 * @param {object} pageSet
 * @param {number} initialPage number of the page displayed first
 */
export function createNavigator(pageSet, initialPage) {
  const state = {
    current: initialPage,
    revealed: false, // concealed cells hidden by default (Req. 5.1)
    notFound: false, // page-not-found indicator (Req. 7.5 / 7.6)
  };

  return {
    state,

    /** Exactly the four Fastext keys, fixed order (Req. 7.2). */
    fastextKeys: FASTEXT_KEYS,

    /**
     * Req. 7.1: display page n if it exists.
     * Req. 7.6: otherwise show the page-not-found indicator and stay.
     * @returns {{ok: boolean, current: number}}
     */
    goTo(n) {
      if (getPage(pageSet, n) === undefined) {
        state.notFound = true;
        return { ok: false, current: state.current };
      }
      state.current = n;
      state.notFound = false;
      return { ok: true, current: state.current };
    },

    /**
     * Req. 7.3: follow a Fastext link to its target page.
     * Req. 7.5: a missing or null target shows the page-not-found indicator
     * and stays on the current page.
     * @returns {{ok: boolean, current: number}}
     */
    activateFastext(page, key) {
      if (!FASTEXT_KEYS.includes(key)) {
        throw new Error("unknown fastext key");
      }
      const target = page.fastext[key];
      if (target === null || target === undefined || getPage(pageSet, target) === undefined) {
        state.notFound = true;
        return { ok: false, current: state.current };
      }
      state.current = target;
      state.notFound = false;
      return { ok: true, current: state.current };
    },

    /** Req. 5.3: reveal concealed cells on the current page. */
    requestReveal() {
      state.revealed = true;
    },

    /** Req. 5.4: hide concealed cells again. */
    requestHide() {
      state.revealed = false;
    },
  };
}
