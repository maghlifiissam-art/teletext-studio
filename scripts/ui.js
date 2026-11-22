/*
 * scripts/ui.js — UI wiring, language/RTL toggle, soft input.
 *
 * Wires the toolbar controls to the Editor, the page canvas to the Renderer
 * and FlashController, the Fastext bar to the Navigator, and the
 * English/Arabic language-direction toggle (Req. 11, 12). The toggle only
 * ever changes presentation attributes and label text; the PageSet model is
 * untouched (Req. 12.4).
 *
 * Every function takes its DOM objects as arguments so the wiring is
 * testable under jsdom without a browser.
 */

import { COLS, ROWS, PALETTE, CHARSET, getPage, switchMode, toggleSextant } from "./model.js";
import { renderToDOM } from "./renderer.js";

/** UI strings in both supported languages (Req. 12.1 / 12.2). */
export const STRINGS = {
  en: {
    "lang-toggle": "العربية",
    "mode-text": "Text",
    "mode-mosaic": "Mosaic",
    flash: "Flash",
    conceal: "Conceal",
    reveal: "Reveal",
    "export-png": "Export PNG",
    "share-url": "Copy share URL",
    "new-page": "New page",
    "delete-page": "Delete page",
    "go-to": "Go to",
    "page-not-found": "Page not found",
    "export-failed": "Export failed",
    "too-large": "Too large to share",
    page: "Page",
    "text-colour": "Text",
    "bg-colour": "BG",
    palette: "Characters",
  },
  ar: {
    "lang-toggle": "English",
    "mode-text": "نص",
    "mode-mosaic": "فسيفساء",
    flash: "وميض",
    conceal: "إخفاء",
    reveal: "إظهار",
    "export-png": "تصدير PNG",
    "share-url": "نسخ رابط المشاركة",
    "new-page": "صفحة جديدة",
    "delete-page": "حذف الصفحة",
    "go-to": "انتقل إلى",
    "page-not-found": "الصفحة غير موجودة",
    "export-failed": "فشل التصدير",
    "too-large": "كبير جداً للمشاركة",
    page: "صفحة",
    "text-colour": "النص",
    "bg-colour": "الخلفية",
    palette: "الحروف",
  },
};

export const DEFAULT_LANG = "en";

/**
 * Apply a language/direction to the UI (Req. 12.1 / 12.2 / 12.5).
 *
 * Sets lang/dir attributes on the root element, swaps the text of every
 * [data-i18n] element, and marks the toggle aria-pressed. Pure presentation:
 * it receives no model object and cannot mutate one (Req. 12.4).
 *
 * @param {object} root the root element carrying lang/dir (e.g. document.body)
 * @param {string} lang "en" | "ar"
 */
export function applyLanguage(root, lang) {
  if (!STRINGS[lang]) {
    throw new Error("unsupported language");
  }
  const dir = lang === "ar" ? "rtl" : "ltr";
  root.setAttribute("lang", lang);
  root.setAttribute("dir", dir);
  root.setAttribute("data-lang", lang);
  root.setAttribute("data-dir", dir);
  const strings = STRINGS[lang];
  for (const el of root.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    if (strings[key] !== undefined) {
      el.textContent = strings[key];
    }
  }
  const toggle = root.querySelector("#lang-toggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", lang === "ar" ? "true" : "false");
  }
}

/** The other language (toggle transition). */
export function nextLanguage(lang) {
  return lang === "ar" ? "en" : "ar";
}

/* A small soft-input character palette: printable ASCII favourites plus a
   sample of the Arabic national-option subset (Req. 11.5 / 12.3). */
const PALETTE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-:/()#%".split("");
const ARABIC_CHARS = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي", "ة", "ى", "ء", "أ", "إ", "ؤ", "ئ", "٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function button(doc, key, lang, onClick, extraClass) {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "tt-btn" + (extraClass ? " " + extraClass : "");
  b.setAttribute("data-i18n", key);
  b.textContent = STRINGS[lang][key] ?? key;
  b.addEventListener("click", onClick);
  return b;
}

/**
 * Build the top toolbar: mode, attributes, page controls, export, share.
 * @returns {object} handles used for status display
 */
export function buildTopToolbar(doc, toolbar, ctx) {
  const { editor, lang, actions } = ctx;
  toolbar.textContent = "";

  const modeText = button(doc, "mode-text", lang, () => actions.setMode("text"));
  const modeMosaic = button(doc, "mode-mosaic", lang, () => actions.setMode("mosaic"));
  const flash = button(doc, "flash", lang, () => actions.setFlashing(true));
  const conceal = button(doc, "conceal", lang, () => actions.setConcealed(true));
  const reveal = button(doc, "reveal", lang, () => actions.toggleReveal());
  const exportPng = button(doc, "export-png", lang, () => actions.exportPng());
  const share = button(doc, "share-url", lang, () => actions.shareUrl());
  const newPage = button(doc, "new-page", lang, () => actions.newPage());
  const deletePage = button(doc, "delete-page", lang, () => actions.deletePage());

  const gotoWrap = doc.createElement("span");
  gotoWrap.className = "tt-goto";
  const gotoInput = doc.createElement("input");
  gotoInput.className = "tt-goto-input";
  gotoInput.type = "number";
  gotoInput.min = "100";
  gotoInput.max = "899";
  gotoInput.value = String(editor.state.activePage);
  const gotoBtn = button(doc, "go-to", lang, () => actions.goTo(Number(gotoInput.value)));
  gotoWrap.append(gotoInput, gotoBtn);

  const status = doc.createElement("span");
  status.className = "tt-status";
  status.setAttribute("role", "status");
  const statusPage = doc.createElement("span");
  statusPage.className = "tt-status-page";
  const statusMode = doc.createElement("span");
  statusMode.className = "tt-status-mode";
  const fgChip = doc.createElement("span");
  fgChip.className = "tt-chip tt-chip--fg";
  fgChip.title = "foreground";
  const bgChip = doc.createElement("span");
  bgChip.className = "tt-chip tt-chip--bg";
  bgChip.title = "background";
  const statusMsg = doc.createElement("span");
  statusMsg.className = "tt-status-msg";
  status.append(statusPage, statusMode, fgChip, bgChip, statusMsg);

  toolbar.append(
    modeText, modeMosaic, flash, conceal, reveal,
    exportPng, share, newPage, deletePage, gotoWrap, status
  );
  return { status, statusPage, statusMode, fgChip, bgChip, statusMsg, gotoInput };
}

/**
 * Build the side toolbar: colour swatches and the soft character palette
 * (Req. 11.5). Every control is a >= 44px touch target (styles/main.css).
 */
export function buildSideToolbar(doc, toolbar, ctx) {
  const { editor, actions } = ctx;
  toolbar.textContent = "";

  // Colour groups keep a compact labelled row each; the selected colour is
  // mirrored onto the group label by renderUI.
  const fgWrap = doc.createElement("div");
  fgWrap.className = "tt-swatches tt-swatches--fg";
  const fgLabel = doc.createElement("span");
  fgLabel.className = "tt-swatches-label";
  fgLabel.setAttribute("data-i18n", "text-colour");
  fgLabel.textContent = STRINGS[ctx.lang]["text-colour"];
  fgWrap.appendChild(fgLabel);
  const bgWrap = doc.createElement("div");
  bgWrap.className = "tt-swatches tt-swatches--bg";
  const bgLabel = doc.createElement("span");
  bgLabel.className = "tt-swatches-label";
  bgLabel.setAttribute("data-i18n", "bg-colour");
  bgLabel.textContent = STRINGS[ctx.lang]["bg-colour"];
  bgWrap.appendChild(bgLabel);
  PALETTE.forEach((css, c) => {
    for (const [wrap, set] of [[fgWrap, "fg"], [bgWrap, "bg"]]) {
      const sw = doc.createElement("button");
      sw.type = "button";
      sw.className = "tt-swatch";
      sw.style.backgroundColor = css;
      sw.setAttribute("aria-label", `${set} colour ${c}`);
      sw.addEventListener("click", () => actions.setColour(set, c));
      wrap.appendChild(sw);
    }
  });

  // The full character palette is collapsed by default on narrow screens so
  // the canvas and essential controls share the first viewport; it is also
  // height-contained with its own scroll when open.
  const paletteDetails = doc.createElement("details");
  paletteDetails.className = "tt-palette";
  const narrow =
    typeof matchMedia === "function" && matchMedia("(max-width: 767px)").matches;
  paletteDetails.open = !narrow;
  const summary = doc.createElement("summary");
  summary.className = "tt-palette-summary";
  summary.setAttribute("data-i18n", "palette");
  summary.textContent = STRINGS[ctx.lang].palette;
  paletteDetails.appendChild(summary);

  const chars = doc.createElement("div");
  chars.className = "tt-char-palette";
  for (const ch of [...PALETTE_CHARS, ...ARABIC_CHARS]) {
    if (CHARSET.unicodeToCode(ch) === -1) {
      continue; // outside the teletext charset: never offered
    }
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "tt-char";
    b.textContent = ch;
    b.addEventListener("click", () => actions.enterChar(ch));
    chars.appendChild(b);
  }
  paletteDetails.appendChild(chars);

  toolbar.append(fgWrap, bgWrap, paletteDetails);
}

/**
 * Wire the page canvas: pointer/touch selection (Req. 11.1), mosaic sextant
 * toggles by touch point (Req. 11.5 / 3.5), and keyboard entry.
 */
export function wireCanvas(doc, canvas, ctx) {
  const { editor, mosaic, actions } = ctx;

  canvas.addEventListener("pointerdown", (event) => {
    const cellEl = event.target.closest("[data-row]");
    if (!cellEl) {
      return;
    }
    const row = Number(cellEl.dataset.row);
    const col = Number(cellEl.dataset.col);
    editor.selectCell(row, col); // Req. 11.1: tap selects the cell
    if (canvas.getAttribute("data-mode") === "mosaic") {
      // A mosaic-mode tap edits mosaic content: switch the cell into mosaic
      // mode first when it still holds text, then toggle the tapped sextant.
      const page = getPage(editor.state.current, editor.state.activePage);
      if (page && page.cells[row][col].mode !== "mosaic") {
        page.cells[row][col] = switchMode(page.cells[row][col], "mosaic");
      }
      const rect = cellEl.getBoundingClientRect();
      const bit = mosaic.sextantFromPoint(rect, event.clientX, event.clientY);
      mosaic.toggleSextantAt(row, col, bit);
    }
    actions.render();
  });

  doc.addEventListener("keydown", (event) => {
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      editor.deleteCell();
      actions.render();
    } else if (event.key.length === 1) {
      editor.enterChar(event.key); // Arabic input maps through CHARSET (Req. 12.3)
      actions.render();
    }
  });
}

/**
 * Wire the Fastext bar: tap a coloured link to follow it (Req. 11.3 / 7.3).
 * A rejected target shows the page-not-found indicator (Req. 7.5 / 7.6).
 */
export function wireFastextBar(bar, ctx) {
  const { navigator, editor, actions } = ctx;
  for (const link of bar.querySelectorAll("[data-fastext-key]")) {
    link.addEventListener("click", () => {
      const key = link.getAttribute("data-fastext-key");
      const page = editor.state.current.pages.get(navigator.state.current);
      if (page) {
        navigator.activateFastext(page, key);
        actions.render();
      }
    });
  }
}

/**
 * Wire the language toggle button (Req. 12.5). Switching language never
 * touches the model; it only re-applies presentation state (Req. 12.4).
 */
export function wireLanguageToggle(root, toggle, ctx) {
  toggle.addEventListener("click", () => {
    ctx.lang = nextLanguage(ctx.lang);
    applyLanguage(root, ctx.lang);
    ctx.actions.render();
  });
}

/**
 * Re-render the active page into the canvas and mirror navigation/status
 * state into presentation attributes.
 */
export function renderUI(canvas, status, ctx) {
  const { editor, navigator, flash } = ctx;
  const page = editor.state.current.pages.get(navigator.state.current);
  if (!page) {
    return;
  }
  renderToDOM(canvas, page, { flashOn: flash.flashOn, revealed: navigator.state.revealed });
  canvas.setAttribute("data-page", String(navigator.state.current));

  // Orientation: mark the cursor cell so the editing position is visible.
  if (editor.state.cursor !== null) {
    const { row, col } = editor.state.cursor;
    const el = canvas.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (el) {
      el.classList.add("tt-cursor");
    }
  }

  if (status) {
    const strings = STRINGS[ctx.lang];
    const pageLabel = status.querySelector(".tt-status-page");
    const modeLabel = status.querySelector(".tt-status-mode");
    const msg = status.querySelector(".tt-status-msg");
    const fgChip = status.querySelector(".tt-chip--fg");
    const bgChip = status.querySelector(".tt-chip--bg");
    if (pageLabel) {
      pageLabel.textContent = `${strings.page} ${navigator.state.current}`;
    }
    if (modeLabel) {
      const mode = canvas.getAttribute("data-mode") === "mosaic" ? "mode-mosaic" : "mode-text";
      modeLabel.textContent = strings[mode];
    }
    if (fgChip) {
      fgChip.style.backgroundColor = PALETTE[editor.state.fg];
    }
    if (bgChip) {
      bgChip.style.backgroundColor = PALETTE[editor.state.bg];
    }
    if (msg) {
      msg.textContent = navigator.state.notFound ? strings["page-not-found"] : "";
    }
    status.setAttribute("data-not-found", navigator.state.notFound ? "true" : "false");
  }
}
