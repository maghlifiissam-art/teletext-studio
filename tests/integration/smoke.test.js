// @vitest-environment jsdom
/*
 * Task 15.2: Integration and smoke tests.
 *
 * End-to-end wiring over the real modules (model, editor, mosaic editor,
 * renderer, flash, navigator, exporter helpers, URL codec, UI) with jsdom
 * standing in for the browser: edit a page, navigate, toggle language,
 * round-trip through a shareable URL, and render the decoded set.
 */

import { describe, it, expect, beforeEach } from "vitest";

import { newPageSet, newPage, addPage, CHARSET } from "../../scripts/model.js";
import { createEditor, createMosaicEditor } from "../../scripts/editor.js";
import { createNavigator } from "../../scripts/navigator.js";
import { FlashController } from "../../scripts/flash.js";
import { encode, decode } from "../../scripts/urlcodec.js";
import {
  applyLanguage,
  buildTopToolbar,
  buildSideToolbar,
  wireCanvas,
  wireFastextBar,
  wireLanguageToggle,
  renderUI,
} from "../../scripts/ui.js";

function makeApp(withHash) {
  document.body.innerHTML = `
    <header id="toolbar-top"></header>
    <aside id="toolbar-side"></aside>
    <section id="page-canvas"></section>
    <nav id="fastext-bar">
      <button type="button" data-fastext-key="red">Red</button>
      <button type="button" data-fastext-key="green">Green</button>
      <button type="button" data-fastext-key="yellow">Yellow</button>
      <button type="button" data-fastext-key="cyan">Cyan</button>
    </nav>
    <button id="lang-toggle" data-i18n="lang-toggle" aria-pressed="false"></button>`;

  const ps = newPageSet();
  addPage(ps, newPage(100));

  const editor = createEditor(ps, 100);
  const mosaic = createMosaicEditor(ps, 100);
  const navigator = createNavigator(ps, 100);
  const flash = new FlashController();
  const canvas = document.getElementById("page-canvas");

  const ctx = {
    editor,
    mosaic,
    navigator,
    flash,
    lang: "en",
    actions: null,
  };
  const handles = { status: null };
  ctx.actions = {
    render: () => renderUI(canvas, handles.status, ctx),
    setMode: (mode) => {
      editor.setMode(mode);
      canvas.setAttribute("data-mode", mode);
      ctx.actions.render();
    },
    setColour: (which, c) => {
      if (which === "fg") {
        editor.applyFgToSelection(c);
      } else {
        editor.applyBgToSelection(c);
      }
      ctx.actions.render();
    },
    enterChar: (ch) => {
      editor.enterChar(ch);
      ctx.actions.render();
    },
  };

  const top = buildTopToolbar(document, document.getElementById("toolbar-top"), {
    editor,
    lang: ctx.lang,
    actions: ctx.actions,
  });
  handles.status = top.status;
  buildSideToolbar(document, document.getElementById("toolbar-side"), ctx);
  wireCanvas(document, canvas, ctx);
  wireFastextBar(document.getElementById("fastext-bar"), ctx);
  wireLanguageToggle(document.body, document.getElementById("lang-toggle"), ctx);
  applyLanguage(document.body, ctx.lang);
  ctx.actions.render();

  return { ps, editor, mosaic, navigator, canvas, ctx };
}

describe("end-to-end smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("edit, navigate, and share round trip through a URL", async () => {
    const app = makeApp();

    // Type "HI" into the first two cells.
    app.editor.selectCell(0, 0);
    app.ctx.actions.enterChar("H");
    app.ctx.actions.enterChar("I");
    expect(app.ps.pages.get(100).cells[0][0].char).toBe(CHARSET.unicodeToCode("H"));
    expect(app.ps.pages.get(100).cells[0][1].char).toBe(CHARSET.unicodeToCode("I"));

    // Create page 101, link red Fastext to it, and follow the link by tap.
    app.editor.createPage();
    app.editor.setFastext(100, "red", 101);
    app.navigator.goTo(100);
    app.ctx.actions.render();
    document.querySelector('[data-fastext-key="red"]').click();
    expect(app.navigator.state.current).toBe(101);

    // Encode the whole set, decode it fresh, and confirm the content survives.
    const url = await encode(app.ps, "https://studio.example/");
    const { ps: decoded, error } = await decode(url);
    expect(error).toBeNull();
    expect(decoded.pages.size).toBe(2);
    expect(decoded.pages.get(100).cells[0][0].char).toBe(CHARSET.unicodeToCode("H"));
    expect(decoded.pages.get(100).fastext.red).toBe(101);

    // Render the decoded page: the typed glyphs appear in the grid.
    const app2 = makeApp();
    app2.editor.state.current = decoded;
    app2.navigator.goTo(100);
    app2.ctx.actions.render();
    const cells = app2.canvas.querySelectorAll(".tt-cell");
    expect(cells.length).toBe(960);
    expect(app2.canvas.querySelector('[data-row="0"][data-col="0"]').textContent).toBe("H");
  });

  it("mosaic toggle via UI mode + sextant click path", () => {
    const app = makeApp();
    app.ctx.actions.setMode("mosaic");
    app.editor.selectCell(2, 3);
    app.mosaic.toggleSextantAt(2, 3, 0);
    const cell = app.ps.pages.get(100).cells[2][3];
    expect(cell.mosaic).toBe(1);
    app.ctx.actions.render();
    expect(app.canvas.getAttribute("data-mode")).toBe("mosaic");
  });

  it("language toggle keeps the edited content intact and flips direction", () => {
    const app = makeApp();
    app.editor.selectCell(0, 0);
    app.ctx.actions.enterChar("ب");
    const before = JSON.stringify(app.ps.pages.get(100).cells[0][0]);

    document.getElementById("lang-toggle").click();
    expect(document.body.getAttribute("dir")).toBe("rtl");
    expect(JSON.stringify(app.ps.pages.get(100).cells[0][0])).toBe(before);

    document.getElementById("lang-toggle").click();
    expect(document.body.getAttribute("dir")).toBe("ltr");
    expect(JSON.stringify(app.ps.pages.get(100).cells[0][0])).toBe(before);
  });

  it("page-not-found indicator surfaces in the status area", () => {
    const app = makeApp();
    app.navigator.goTo(555); // does not exist
    app.ctx.actions.render();
    const status = document.querySelector(".tt-status");
    expect(status.getAttribute("data-not-found")).toBe("true");
    expect(status.textContent.length).toBeGreaterThan(0);

    app.navigator.goTo(100);
    app.ctx.actions.render();
    expect(status.getAttribute("data-not-found")).toBe("false");
  });

  it("toolbar builds with touch-target controls and both languages of labels", () => {
    makeApp();
    const buttons = document.querySelectorAll("#toolbar-top .tt-btn");
    expect(buttons.length).toBeGreaterThanOrEqual(9);
    const chars = document.querySelectorAll("#toolbar-side .tt-char");
    expect(chars.length).toBeGreaterThan(50); // ASCII + Arabic palette

    applyLanguage(document.body, "ar");
    expect(document.querySelector('[data-i18n="export-png"]').textContent).toMatch(
      /[\u0600-\u06FF]/
    );
  });
});

// Regression: after New page / Go to navigation the editor must edit the
// page the navigator displays (deployed-path desync found 2026-11-23).
describe("navigation keeps editor and navigator on the same page", () => {
  it("typing after New page writes to the new page", async () => {
    const { newPageSet, newPage, addPage, getPage } = await import("../../scripts/model.js");
    const { createEditor } = await import("../../scripts/editor.js");
    const { createNavigator } = await import("../../scripts/navigator.js");
    const ps = newPageSet();
    addPage(ps, newPage(100));
    const editor = createEditor(ps, 100);
    const navigator = createNavigator(ps, 100);
    const n = editor.createPage();
    const r = navigator.goTo(n);
    expect(r.ok).toBe(true);
    expect(editor.setActivePage(r.current)).toBe(true);
    editor.setCursor?.(0, 0);
    editor.state.cursor = { row: 0, col: 0 };
    editor.enterChar("Z");
    expect(getPage(ps, n).cells[0][0].char).not.toBe(0x20);
    expect(getPage(ps, 100).cells[0][0].char).toBe(0x20);
  });

  it("setActivePage rejects a missing page and clears cursor on switch", async () => {
    const { newPageSet, newPage, addPage } = await import("../../scripts/model.js");
    const { createEditor } = await import("../../scripts/editor.js");
    const ps = newPageSet();
    addPage(ps, newPage(100));
    const editor = createEditor(ps, 100);
    editor.state.cursor = { row: 2, col: 2 };
    expect(editor.setActivePage(555)).toBe(false);
    expect(editor.state.activePage).toBe(100);
  });
});

// Regression: colour picked with no region selection must apply to
// subsequently typed characters (deployed-path wiring bug found 2026-11-23:
// the toolbar only ever called applyFgToSelection, never setFg/setBg).
describe("colour selection applies to subsequent entries", () => {
  it("setFg colours the next typed chars, selection paints the region", async () => {
    const { newPageSet, newPage, addPage, getPage } = await import("../../scripts/model.js");
    const { createEditor } = await import("../../scripts/editor.js");
    const ps = newPageSet();
    addPage(ps, newPage(100));
    const editor = createEditor(ps, 100);
    editor.setFg(1); // red
    editor.state.cursor = { row: 0, col: 0 };
    editor.enterChar("R");
    expect(getPage(ps, 100).cells[0][0].fg).toBe(1);
    editor.setFg(3); // yellow
    editor.enterChar("Y");
    expect(getPage(ps, 100).cells[0][1].fg).toBe(3);
  });
});
