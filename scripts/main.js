/*
 * scripts/main.js — Application bootstrap and startup URL hash loading.
 *
 * On load: if location.hash carries a valid "#t=" payload, decode it into a
 * PageSet (Req. 9.3); on invalid/altered input, show the invalid-URL error
 * and start from an empty PageSet with a single default page 100 (Req. 9.5).
 * Then initialise Editor, Mosaic_Editor, Renderer, FlashController,
 * Navigator, Exporter, URL_Encoder and the UI, and start the shared flash
 * clock (Req. 4.2).
 */

import { newPageSet, newPage, addPage, nextAvailableNumber } from "./model.js";
import { createEditor, createMosaicEditor } from "./editor.js";
import { createNavigator } from "./navigator.js";
import { FlashController } from "./flash.js";
import { exportPng } from "./exporter.js";
import { encode, decode } from "./urlcodec.js";
import {
  DEFAULT_LANG,
  STRINGS,
  applyLanguage,
  buildTopToolbar,
  buildSideToolbar,
  wireCanvas,
  wireFastextBar,
  wireLanguageToggle,
  renderUI,
} from "./ui.js";

async function bootstrap() {
  const doc = document;
  const root = doc.body;
  const canvas = doc.getElementById("page-canvas");
  const topToolbar = doc.getElementById("toolbar-top");
  const sideToolbar = doc.getElementById("toolbar-side");
  const fastextBar = doc.getElementById("fastext-bar");
  const langToggle = doc.getElementById("lang-toggle");

  // Startup URL hash loading (Req. 9.3 / 9.5).
  let pageSet = null;
  let startupError = null;
  if (doc.location && doc.location.hash.startsWith("#t=")) {
    const result = await decode(doc.location.href);
    pageSet = result.ps;
    startupError = result.error;
  }
  if (pageSet === null || pageSet.pages.size === 0) {
    pageSet = newPageSet();
    addPage(pageSet, newPage(100));
  }
  const startPage = [...pageSet.pages.keys()][0];

  const editor = createEditor(pageSet, startPage);
  const mosaic = createMosaicEditor(pageSet, startPage);
  const navigator = createNavigator(pageSet, startPage);
  const flash = new FlashController();

  const ctx = {
    editor,
    mosaic,
    navigator,
    flash,
    lang: DEFAULT_LANG,
    actions: null, // wired below
  };

  let statusHandle = null;

  const strings = () => STRINGS[ctx.lang];
  const actions = {
    render() {
      renderUI(canvas, statusHandle ? statusHandle.status : null, ctx);
      if (statusHandle) {
        statusHandle.gotoInput.value = String(navigator.state.current);
      }
    },
    setMode: (mode) => {
      editor.setMode(mode);
      canvas.setAttribute("data-mode", mode);
      actions.render();
    },
    setFlashing: (on) => {
      editor.setFlashing(on);
      actions.render();
    },
    setConcealed: (on) => {
      editor.setConcealed(on);
      actions.render();
    },
    toggleReveal() {
      if (navigator.state.revealed) {
        navigator.requestHide();
      } else {
        navigator.requestReveal();
      }
      actions.render();
    },
    setColour: (which, c) => {
      // Req. 2.5/2.6: a multi-cell region is painted exactly. Otherwise
      // (cursor only or nothing selected) the colour applies to subsequent
      // entries (Req. 2.3/2.4).
      if (editor.state.selection) {
        if (which === "fg") {
          editor.applyFgToSelection(c);
        } else {
          editor.applyBgToSelection(c);
        }
      } else if (which === "fg") {
        editor.setFg(c);
      } else {
        editor.setBg(c);
      }
      actions.render();
    },
    enterChar: (ch) => {
      editor.enterChar(ch);
      actions.render();
    },
    goTo: (n) => {
      const r = navigator.goTo(n);
      if (r.ok) {
        editor.setActivePage(r.current);
      }
      actions.render();
    },
    newPage: () => {
      if (nextAvailableNumber(editor.state.current) !== null) {
        const n = editor.createPage();
        navigator.goTo(n);
        editor.setActivePage(n);
        actions.render();
      }
    },
    deletePage: () => {
      editor.deletePage(navigator.state.current);
      const remaining = [...editor.state.current.pages.keys()];
      if (remaining.length > 0) {
        navigator.goTo(remaining[0]);
        editor.setActivePage(remaining[0]);
      }
      actions.render();
    },
    exportPng: async () => {
      const page = editor.state.current.pages.get(navigator.state.current);
      try {
        await exportPng(page);
      } catch {
        actions.showError("export-failed"); // Req. 8.5
      }
    },
    shareUrl: async () => {
      let url;
      try {
        url = await encode(editor.state.current, doc.location.href.split("#")[0]);
      } catch {
        actions.showError("too-large"); // Req. 9.8: the URL itself is oversized
        return;
      }
      try {
        await navigator_clipboard(url);
        actions.showError("link-copied"); // informational: the copy worked
      } catch {
        // Clipboard denied or unavailable: never misreport as oversized;
        // offer the URL in a selectable field instead (Req. 9.8 honest fallback).
        actions.showManualCopy(url);
      }
    },
    showManualCopy(url) {
      if (statusHandle) {
        let box = doc.getElementById("tt-manual-copy");
        if (!box) {
          box = doc.createElement("input");
          box.id = "tt-manual-copy";
          box.type = "text";
          box.readOnly = true;
          box.className = "tt-manual-copy";
          box.setAttribute("aria-label", "Share URL");
          statusHandle.status.after(box);
        }
        box.value = url;
        box.hidden = false;
        box.focus();
        box.select();
      }
      actions.showError("copy-failed");
    },
    showError(key) {
      if (statusHandle) {
        (statusHandle.statusMsg ?? statusHandle.status).textContent = strings()[key] ?? key;
      }
    },
  };
  ctx.actions = actions;

  async function navigator_clipboard(text) {
    if (
      globalThis.navigator &&
      globalThis.navigator.clipboard &&
      globalThis.navigator.clipboard.writeText
    ) {
      await globalThis.navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("clipboard unavailable");
  }

  statusHandle = buildTopToolbar(doc, topToolbar, { editor, lang: ctx.lang, actions });
  buildSideToolbar(doc, sideToolbar, { editor, actions, lang: ctx.lang });
  wireCanvas(doc, canvas, ctx);
  wireFastextBar(fastextBar, ctx);
  wireLanguageToggle(root, langToggle, ctx);
  applyLanguage(root, ctx.lang);

  // Shared flash clock drives the container phase attribute (Req. 4.2).
  flash.start((flashOn) => {
    canvas.setAttribute("data-flash-phase", flashOn ? "on" : "off");
  });

  if (startupError !== null) {
    actions.showError("page-not-found"); // invalid URL: reported, empty set loaded
  }
  actions.render();
}

if (typeof document !== "undefined") {
  bootstrap();
}

export { bootstrap };
