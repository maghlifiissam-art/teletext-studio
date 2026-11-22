/* Shared helper: an Editor (and MosaicEditor) over a fresh one-page PageSet. */
import { newPageSet, newPage, addPage } from "../scripts/model.js";
import { createEditor, createMosaicEditor } from "../scripts/editor.js";

export function makeEditor(pageNumber = 100) {
  const ps = newPageSet();
  addPage(ps, newPage(pageNumber));
  const editor = createEditor(ps, pageNumber);
  const mosaic = createMosaicEditor(ps, pageNumber);
  return { ps, page: ps.pages.get(pageNumber), editor, mosaic };
}
