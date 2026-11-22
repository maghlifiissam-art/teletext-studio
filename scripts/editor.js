/*
 * scripts/editor.js — Editor and Mosaic_Editor.
 *
 * The Editor owns the editing cursor, the current fg/bg colour selection and
 * page management, and translates user actions into model mutations. It does
 * not touch the DOM; after each mutation the UI re-renders (design: "Editing:
 * user action -> Editor/Mosaic_Editor mutates the Page -> Renderer re-renders").
 *
 * The Mosaic_Editor handles sextant toggling, accepting both pointer and
 * touch coordinates (Req. 3.5).
 *
 * Error handling: invalid page operations throw an Error and leave the
 * PageSet unchanged (Req. 6.3 / 6.6 / 6.7).
 */

import {
  COLS,
  ROWS,
  FASTEXT_KEYS,
  CHARSET,
  validPageNumber,
  getPage,
  addPage,
  deletePage as modelDeletePage,
  renamePage as modelRenamePage,
  nextAvailableNumber,
  newPage,
  switchMode,
  toggleSextant,
} from "./model.js";

/** Space fallback for characters outside the repertoire (Req. 12.3). */
const SPACE_CODE = 0x20;

/**
 * Cursor advance rule (Req. 1.6): row-major successor with wrap at row and
 * page boundaries: (r,39) -> (r+1,0) and (23,39) -> (0,0).
 */
export function advanceCursor(row, col) {
  let c = col + 1;
  let r = row;
  if (c >= COLS) {
    c = 0;
    r = r + 1;
  }
  if (r >= ROWS) {
    r = 0;
  }
  return { row: r, col: c };
}

/**
 * Create an Editor over a PageSet.
 *
 * @param {object} pageSet the current PageSet (model newPageSet() shape)
 * @param {number} activePage the number of the page being edited
 */
export function createEditor(pageSet, activePage) {
  const state = {
    current: pageSet,
    activePage,
    cursor: null, // {row, col} | null (Req. 1.2 / 1.7 / 1.8)
    selection: null, // {row0, col0, row1, col1} | null (Req. 2.5 / 2.6)
    fg: 7, // white, applied to subsequently entered chars (Req. 2.3)
    bg: 0, // black (Req. 2.4)
  };

  function activePage_() {
    const page = getPage(state.current, state.activePage);
    if (page === undefined) {
      throw new Error("active page not found");
    }
    return page;
  }

  /** The region a region-operation applies to: the selection, else the
      single cursor cell, else null. */
  function effectiveRegion() {
    if (state.selection !== null) {
      return state.selection;
    }
    if (state.cursor !== null) {
      return {
        row0: state.cursor.row,
        col0: state.cursor.col,
        row1: state.cursor.row,
        col1: state.cursor.col,
      };
    }
    return null;
  }

  /** Apply fn(cell, r, c) to exactly the cells inside the region (inclusive). */
  function forEachCellInRegion(region, fn) {
    const page = activePage_();
    for (let r = region.row0; r <= region.row1; r++) {
      for (let c = region.col0; c <= region.col1; c++) {
        page.cells[r][c] = fn(page.cells[r][c], r, c);
      }
    }
  }

  return {
    state,

    /** Req. 1.2: place the cursor on exactly {row, col}. */
    selectCell(row, col) {
      state.cursor = { row, col };
    },

    /**
     * Req. 1.3 / 1.6: write the character (mapped through the Charset,
     * out-of-repertoire input becomes space) into the selected cell with the
     * current fg/bg colours, then advance the cursor with wrap.
     * Req. 1.7: no-op when there is no selection.
     */
    enterChar(ch) {
      if (state.cursor === null) {
        return;
      }
      const code = CHARSET.unicodeToCode(ch);
      const page = activePage_();
      const { row, col } = state.cursor;
      page.cells[row][col] = {
        ...page.cells[row][col],
        char: code === -1 ? SPACE_CODE : code,
        fg: state.fg,
        bg: state.bg,
      };
      state.cursor = advanceCursor(row, col);
    },

    /**
     * Req. 1.4: clear the selected cell's character to space (0x20).
     * Req. 1.8: no-op when there is no selection.
     */
    deleteCell() {
      if (state.cursor === null) {
        return;
      }
      const page = activePage_();
      const { row, col } = state.cursor;
      page.cells[row][col] = { ...page.cells[row][col], char: SPACE_CODE };
    },

    /** Req. 2.3: set the foreground applied to subsequent entries. */
    setFg(c) {
      state.fg = c;
    },

    /** Req. 2.4: set the background applied to subsequent entries. */
    setBg(c) {
      state.bg = c;
    },

    /** Req. 2.5: set the foreground on exactly the cells inside the region. */
    applyFgToSelection(c) {
      const region = effectiveRegion();
      if (region === null) {
        return;
      }
      forEachCellInRegion(region, (cell) => ({ ...cell, fg: c }));
    },

    /** Req. 2.6: set the background on exactly the cells inside the region. */
    applyBgToSelection(c) {
      const region = effectiveRegion();
      if (region === null) {
        return;
      }
      forEachCellInRegion(region, (cell) => ({ ...cell, bg: c }));
    },

    /**
     * Req. 3.4 / 3.6: switch the mode of the selected cell(s); fg/bg are
     * preserved and the mosaic pattern is initialised to 0 (model switchMode).
     */
    setMode(mode) {
      const region = effectiveRegion();
      if (region === null) {
        return;
      }
      forEachCellInRegion(region, (cell) => switchMode(cell, mode));
    },

    /** Req. 4.3 / 4.4: set the flashing flag on exactly the selected cells. */
    setFlashing(on) {
      const region = effectiveRegion();
      if (region === null) {
        return;
      }
      forEachCellInRegion(region, (cell) => ({ ...cell, flashing: on }));
    },

    /** Req. 5.5: set the concealed flag on exactly the selected cells. */
    setConcealed(on) {
      const region = effectiveRegion();
      if (region === null) {
        return;
      }
      forEachCellInRegion(region, (cell) => ({ ...cell, concealed: on }));
    },

    /**
     * Req. 6.2: assign the smallest unused number in 100..899 and add a new
     * page. Req. 6.7: when every number is assigned, throws and leaves the
     * PageSet unchanged.
     * @returns {number} the assigned page number
     */
    createPage() {
      const n = nextAvailableNumber(state.current);
      if (n === null) {
        throw new Error("page set full");
      }
      addPage(state.current, newPage(n));
      return n;
    },

    /** Req. 6.4: remove a page. Clears the cursor if the active page goes. */
    deletePage(n) {
      modelDeletePage(state.current, n);
      if (state.activePage === n) {
        state.cursor = null;
        state.selection = null;
      }
    },

    /**
     * Req. 6.5: rename a page preserving all content.
     * Req. 6.3 / 6.6: an out-of-range or duplicate target throws and leaves
     * the PageSet unchanged.
     */
    renamePage(oldN, newN) {
      if (!validPageNumber(newN)) {
        throw new Error("page number out of range");
      }
      if (getPage(state.current, newN) !== undefined) {
        throw new Error("page number already in use");
      }
      modelRenamePage(state.current, oldN, newN);
      if (state.activePage === oldN) {
        state.activePage = newN;
      }
    },

    /**
     * Req. 7.4: assign a Fastext target (a page number or null) to one of the
     * four colour keys of a page.
     */
    setFastext(pageNumber, key, target) {
      if (!FASTEXT_KEYS.includes(key)) {
        throw new Error("unknown fastext key");
      }
      if (target !== null && !validPageNumber(target)) {
        throw new Error("page number out of range");
      }
      const page = getPage(state.current, pageNumber);
      if (page === undefined) {
        throw new Error("page not found");
      }
      page.fastext[key] = target;
    },
  };
}

/**
 * Create a Mosaic_Editor over the same PageSet/active page as the Editor.
 */
export function createMosaicEditor(pageSet, activePage) {
  return {
    /** Req. 3.2: invert one sextant bit of the given cell. */
    toggleSextantAt(row, col, bit) {
      const page = getPage(pageSet, activePage);
      if (page === undefined) {
        throw new Error("active page not found");
      }
      page.cells[row][col] = toggleSextant(page.cells[row][col], bit);
    },

    /**
     * Derive the sextant bit (0..5) from a pointer or touch position within
     * the cell's 2x3 grid (Req. 3.5). Works identically for pointer and touch
     * coordinates because both arrive as client x/y in the same space.
     *
     * Bit layout (row-major): 0 1 / 2 3 / 4 5.
     *
     * @param {object} cellRect {left, top, width, height} of the cell element
     * @param {number} x client x of the pointer/touch point
     * @param {number} y client y of the pointer/touch point
     * @returns {number} 0..5, clamped to the cell bounds
     */
    sextantFromPoint(cellRect, x, y) {
      const fx = Math.min(Math.max((x - cellRect.left) / cellRect.width, 0), 0.999999);
      const fy = Math.min(Math.max((y - cellRect.top) / cellRect.height, 0), 0.999999);
      const col = fx < 0.5 ? 0 : 1;
      const row = Math.floor(fy * 3);
      return row * 2 + col;
    },
  };
}
