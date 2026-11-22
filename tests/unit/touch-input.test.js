// @vitest-environment jsdom
/*
 * Unit test (task 12.4): touch selection and touch Fastext activation
 * wiring (Req. 11.1, 11.3).
 */

import { describe, it, expect, beforeEach } from "vitest";

import { wireCanvas, wireFastextBar, renderUI } from "../../scripts/ui.js";
import { newPageSet, newPage, addPage } from "../../scripts/model.js";
import { createEditor, createMosaicEditor } from "../../scripts/editor.js";
import { createNavigator } from "../../scripts/navigator.js";
import { FlashController } from "../../scripts/flash.js";

function makeWorld() {
  document.body.innerHTML = `
    <section id="page-canvas"></section>
    <nav id="fastext-bar">
      <button type="button" data-fastext-key="red">Red</button>
      <button type="button" data-fastext-key="green">Green</button>
      <button type="button" data-fastext-key="yellow">Yellow</button>
      <button type="button" data-fastext-key="cyan">Cyan</button>
    </nav>`;

  const ps = newPageSet();
  const p100 = newPage(100);
  const p200 = newPage(200);
  p100.fastext.red = 200;
  addPage(ps, p100);
  addPage(ps, p200);

  const editor = createEditor(ps, 100);
  const mosaic = createMosaicEditor(ps, 100);
  const navigator = createNavigator(ps, 100);
  const flash = new FlashController();
  const canvas = document.getElementById("page-canvas");
  const bar = document.getElementById("fastext-bar");

  const ctx = {
    editor,
    mosaic,
    navigator,
    flash,
    lang: "en",
    actions: { render: () => renderUI(canvas, null, ctx) },
  };
  return { ps, p100, editor, mosaic, navigator, canvas, bar, ctx };
}

function tap(el, x = 1, y = 1) {
  // PointerEvent covers both mouse and touch pointers (Req. 11.1); jsdom
  // lacks the constructor, so a MouseEvent with the pointerdown type stands
  // in: the listener only reads clientX/clientY and the target.
  el.dispatchEvent(
    new MouseEvent("pointerdown", { bubbles: true, clientX: x, clientY: y })
  );
}

describe("touch selection and Fastext activation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("tapping a cell selects exactly that cell (Req. 11.1)", () => {
    const { editor, canvas, ctx } = makeWorld();
    wireCanvas(document, canvas, ctx);
    ctx.actions.render();

    tap(canvas.querySelector('[data-row="5"][data-col="17"]'));
    expect(editor.state.cursor).toEqual({ row: 5, col: 17 });

    tap(canvas.querySelector('[data-row="0"][data-col="0"]'));
    expect(editor.state.cursor).toEqual({ row: 0, col: 0 });
  });

  it("tapping a Fastext link navigates to its target (Req. 11.3)", () => {
    const { navigator, bar, ctx } = makeWorld();
    wireFastextBar(bar, ctx);

    bar.querySelector('[data-fastext-key="red"]').click();
    expect(navigator.state.current).toBe(200);
    expect(navigator.state.notFound).toBe(false);
  });

  it("tapping a Fastext link with a null target shows page-not-found and stays", () => {
    const { navigator, bar, ctx } = makeWorld();
    wireFastextBar(bar, ctx);

    bar.querySelector('[data-fastext-key="green"]').click(); // null target
    expect(navigator.state.current).toBe(100);
    expect(navigator.state.notFound).toBe(true);
  });

  it("exposes exactly the four Fastext colour keys in fixed order (Req. 7.2)", () => {
    const { bar } = makeWorld();
    const keys = [...bar.querySelectorAll("[data-fastext-key]")].map((b) =>
      b.getAttribute("data-fastext-key")
    );
    expect(keys).toEqual(["red", "green", "yellow", "cyan"]);
  });
});
