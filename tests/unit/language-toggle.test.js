// @vitest-environment jsdom
/*
 * Unit test (task 12.3): language/RTL toggle UI state transitions and
 * Arabic RTL rendering (Req. 12.1-12.5).
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  STRINGS,
  applyLanguage,
  nextLanguage,
  wireLanguageToggle,
  renderUI,
} from "../../scripts/ui.js";
import { newPageSet, newPage, addPage, CHARSET } from "../../scripts/model.js";
import { createEditor } from "../../scripts/editor.js";
import { createNavigator } from "../../scripts/navigator.js";
import { FlashController } from "../../scripts/flash.js";

function makeDom() {
  document.body.innerHTML = `
    <button id="lang-toggle" data-i18n="lang-toggle" aria-pressed="false"></button>
    <button data-i18n="export-png"></button>
    <button data-i18n="reveal"></button>
    <section id="page-canvas"></section>
    <span class="tt-status" role="status"></span>`;
  return {
    root: document.body,
    toggle: document.getElementById("lang-toggle"),
    canvas: document.getElementById("page-canvas"),
    status: document.querySelector(".tt-status"),
  };
}

function makeCtx(page) {
  const ps = newPageSet();
  addPage(ps, page);
  const editor = createEditor(ps, page.number);
  const navigator = createNavigator(ps, page.number);
  const flash = new FlashController();
  return { editor, navigator, flash, lang: "en", actions: { render() {} } };
}

describe("language/RTL toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("switches to Arabic labels and right-to-left direction (Req. 12.2)", () => {
    const { root, toggle } = makeDom();
    applyLanguage(root, "ar");

    expect(root.getAttribute("lang")).toBe("ar");
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(root.getAttribute("data-dir")).toBe("rtl");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-i18n="export-png"]').textContent).toBe(
      STRINGS.ar["export-png"]
    );
    expect(document.querySelector('[data-i18n="reveal"]').textContent).toBe(STRINGS.ar.reveal);
  });

  it("switches back to English labels and left-to-right (Req. 12.1)", () => {
    const { root, toggle } = makeDom();
    applyLanguage(root, "ar");
    applyLanguage(root, "en");

    expect(root.getAttribute("dir")).toBe("ltr");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector('[data-i18n="export-png"]').textContent).toBe(
      STRINGS.en["export-png"]
    );
  });

  it("the toggle button flips language on each click (Req. 12.5)", () => {
    const { root, toggle } = makeDom();
    const ctx = makeCtx(newPage(100));
    wireLanguageToggle(root, toggle, ctx);

    toggle.click();
    expect(ctx.lang).toBe("ar");
    expect(root.getAttribute("dir")).toBe("rtl");

    toggle.click();
    expect(ctx.lang).toBe("en");
    expect(root.getAttribute("dir")).toBe("ltr");
  });

  it("nextLanguage alternates", () => {
    expect(nextLanguage("en")).toBe("ar");
    expect(nextLanguage("ar")).toBe("en");
  });

  it("rejects an unsupported language", () => {
    const { root } = makeDom();
    expect(() => applyLanguage(root, "fr")).toThrow(/unsupported language/);
  });

  it("entered Arabic text renders right-to-left within cells (Req. 12.3)", () => {
    const { canvas } = makeDom();
    const page = newPage(100);
    const ctx = makeCtx(page);

    ctx.editor.selectCell(0, 0);
    ctx.editor.enterChar("ب"); // Arabic letter beh
    // The character survives through the single-byte Arabic charset subset.
    const code = CHARSET.unicodeToCode("ب");
    expect(code).not.toBe(-1);
    expect(page.cells[0][0].char).toBe(code);

    renderUI(canvas, null, ctx);
    const cellEl = canvas.querySelector('[data-row="0"][data-col="0"]');
    expect(cellEl.textContent).toContain("ب");

    // With Arabic on, the rendered canvas sits in an RTL tree.
    applyLanguage(document.body, "ar");
    renderUI(canvas, null, ctx);
    expect(document.body.getAttribute("dir")).toBe("rtl");
    expect(canvas.closest("[dir]").getAttribute("dir")).toBe("rtl");
  });
});
