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
      if (which === "fg") {
        editor.applyFgToSelection(c);
      } else {
        editor.applyBgToSelection(c);
      }
      actions.render();
    },
    enterChar: (ch) => {
      editor.enterChar(ch);
      actions.render();
    },
    goTo: (n) => {
      navigator.goTo(n);
      actions.render();
    },
    newPage: () => {
      if (nextAvailableNumber(editor.state.current) !== null) {
        const n = editor.createPage();
        navigator.goTo(n);
        actions.render();
      }
    },
    deletePage: () => {
      editor.deletePage(navigator.state.current);
      const remaining = [...editor.state.current.pages.keys()];
      if (remaining.length > 0) {
        navigator.goTo(remaining[0]);
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
      try {
        const url = await encode(editor.state.current, doc.location.href.split("#")[0]);
        await navigator_clipboard(url);
      } catch {
        actions.showError("too-large"); // Req. 9.8
      }
    },
    showError(key) {
      if (statusHandle) {
        (statusHandle.statusMsg ?? statusHandle.status).textContent = strings()[key] ?? key;
      }
    },
  };
  ctx.actions = actions;

  async function navigator_clipboard(text) {
    if (globalThis.navigator && globalThis.navigator.clipboard) {
      await globalThis.navigator.clipboard.writeText(text);
    }
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
