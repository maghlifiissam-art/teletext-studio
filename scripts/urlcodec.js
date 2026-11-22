/*
 * scripts/urlcodec.js — URL_Encoder / URL_Decoder.
 *
 * Serializes a PageSet to a compact versioned byte format, compresses it with
 * deflate-raw (Compression Streams API, no external dependency), and embeds
 * it in a shareable URL as base64url after "#t=" (Req. 9.1 / 9.6). Decoding
 * reverses the pipeline; any bad magic, unsupported version, truncation or
 * corruption yields an invalid-URL error and an empty PageSet (Req. 9.5).
 *
 * Byte layout (version 1):
 *   [ magic "TT": 2 bytes ][ version: 0x01 ][ pageCount: varint ]
 *   per page: [ pageNumber: 2 bytes BE ][ fastext: 4 x 2 bytes BE (0 = null) ]
 *             [ cell stream: 960 cells, row-major ]
 * Cell tokens:
 *   0x00 RUN_DEFAULT       [count: 1..255]
 *   0x01 CELL_TEXT         [charCode][attrs]
 *   0x02 CELL_MOSAIC       [pattern: 0..63][attrs]
 *   0x03 CELL_TEXT_MOSAIC  [charCode][pattern: 0..63][attrs]
 * Token 0x03 keeps the mosaic pattern of a text-mode cell: the model allows
 * one (toggleSextant preserves mode), and the round-trip property requires
 * every cell field to survive.
 * attrs byte: bits 7..5 fg, bits 4..2 bg, bit 1 flashing, bit 0 concealed.
 *
 * Size budget (Req. 9): worst-case single page is ~2894 raw bytes, so
 * encodePage stays under 4000 characters (Req. 9.7); encode enforces the
 * 30000-character page-set limit with a "too large to share" error (Req. 9.8).
 */

import {
  COLS,
  ROWS,
  FASTEXT_KEYS,
  defaultCell,
  newPageSet,
  addPage,
} from "./model.js";

const MAGIC_HI = 0x54; // "T"
const MAGIC_LO = 0x54;
const VERSION = 0x01;

const TOK_RUN_DEFAULT = 0x00;
const TOK_CELL_TEXT = 0x01;
const TOK_CELL_MOSAIC = 0x02;
const TOK_CELL_TEXT_MOSAIC = 0x03;

export const URL_LIMIT = 30000; // Req. 9.1 / 9.8
export const PAGE_URL_LIMIT = 4000; // Req. 9.7

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_REVERSE = (() => {
  const m = new Map();
  for (let i = 0; i < B64.length; i++) {
    m.set(B64[i], i);
  }
  return m;
})();

export function base64url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) {
      out += B64[((b1 & 0x0f) << 2) | (b2 >> 6)];
    }
    if (i + 2 < bytes.length) {
      out += B64[b2 & 0x3f];
    }
  }
  return out;
}

export function unbase64url(s) {
  const bytes = [];
  let acc = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64_REVERSE.get(ch);
    if (v === undefined) {
      throw new Error("invalid base64url character");
    }
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) {
    throw new Error("invalid base64url padding bits");
  }
  return Uint8Array.from(bytes);
}

function writeVarint(out, n) {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}

function readVarint(bytes, pos) {
  let n = 0;
  let shift = 0;
  for (;;) {
    if (pos >= bytes.length || shift > 28) {
      throw new Error("truncated varint");
    }
    const b = bytes[pos++];
    n |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      return [n, pos];
    }
    shift += 7;
  }
}

function packAttrs(cell) {
  return (
    ((cell.fg & 0x07) << 5) |
    ((cell.bg & 0x07) << 2) |
    (cell.flashing ? 0x02 : 0x00) |
    (cell.concealed ? 0x01 : 0x00)
  );
}

function unpackAttrs(attrs, base) {
  base.fg = (attrs >> 5) & 0x07;
  base.bg = (attrs >> 2) & 0x07;
  base.flashing = (attrs & 0x02) !== 0;
  base.concealed = (attrs & 0x01) !== 0;
  return base;
}

function isDefaultCell(cell) {
  const d = defaultCell();
  return (
    cell.mode === d.mode &&
    cell.char === d.char &&
    cell.mosaic === d.mosaic &&
    cell.fg === d.fg &&
    cell.bg === d.bg &&
    cell.flashing === d.flashing &&
    cell.concealed === d.concealed
  );
}

/** Serialize a PageSet to the versioned byte format (lossless). */
export function serialize(ps) {
  const out = [MAGIC_HI, MAGIC_LO, VERSION];
  const numbers = [...ps.pages.keys()];
  writeVarint(out, numbers.length);
  for (const num of numbers) {
    const page = ps.pages.get(num);
    out.push((page.number >> 8) & 0xff, page.number & 0xff);
    for (const key of FASTEXT_KEYS) {
      const target = page.fastext[key] ?? 0;
      out.push((target >> 8) & 0xff, target & 0xff);
    }
    let r = 0;
    let c = 0;
    let run = 0;
    const flushRun = () => {
      while (run > 0) {
        const n = Math.min(run, 255);
        out.push(TOK_RUN_DEFAULT, n);
        run -= n;
      }
    };
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        const cell = page.cells[r][c];
        if (isDefaultCell(cell)) {
          run++;
          continue;
        }
        flushRun();
        if (cell.mode === "text") {
          if ((cell.mosaic & 0x3f) !== 0) {
            out.push(TOK_CELL_TEXT_MOSAIC, cell.char & 0xff, cell.mosaic & 0x3f, packAttrs(cell));
          } else {
            out.push(TOK_CELL_TEXT, cell.char & 0xff, packAttrs(cell));
          }
        } else {
          out.push(TOK_CELL_MOSAIC, cell.mosaic & 0x3f, packAttrs(cell));
        }
      }
    }
    flushRun();
  }
  return Uint8Array.from(out);
}

/** Reverse serialize(); throws on bad magic, version, or truncation. */
export function deserialize(bytes) {
  let pos = 0;
  const need = (n) => {
    if (pos + n > bytes.length) {
      throw new Error("truncated stream");
    }
  };
  need(3);
  if (bytes[0] !== MAGIC_HI || bytes[1] !== MAGIC_LO) {
    throw new Error("bad magic");
  }
  if (bytes[2] !== VERSION) {
    throw new Error("unsupported version");
  }
  pos = 3;
  let pageCount;
  [pageCount, pos] = readVarint(bytes, pos);
  const ps = newPageSet();
  for (let p = 0; p < pageCount; p++) {
    need(10); // page number + 4 fastext targets
    const number = (bytes[pos] << 8) | bytes[pos + 1];
    pos += 2;
    const fastext = { red: null, green: null, yellow: null, cyan: null };
    for (const key of FASTEXT_KEYS) {
      const target = (bytes[pos] << 8) | bytes[pos + 1];
      pos += 2;
      fastext[key] = target === 0 ? null : target;
    }
    const page = { number, cells: [], fastext };
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push(defaultCell());
      }
      page.cells.push(row);
    }
    let idx = 0; // linear cell index 0..959
    while (idx < ROWS * COLS) {
      need(1);
      const tok = bytes[pos++];
      if (tok === TOK_RUN_DEFAULT) {
        need(1);
        const count = bytes[pos++];
        if (count === 0 || idx + count > ROWS * COLS) {
          throw new Error("invalid run");
        }
        idx += count; // default cells already in place
      } else if (tok === TOK_CELL_TEXT || tok === TOK_CELL_MOSAIC || tok === TOK_CELL_TEXT_MOSAIC) {
        need(tok === TOK_CELL_TEXT_MOSAIC ? 3 : 2);
        const value = bytes[pos++];
        const mosaic = tok === TOK_CELL_TEXT_MOSAIC ? bytes[pos++] : 0;
        const attrs = bytes[pos++];
        const cell = defaultCell();
        if (tok === TOK_CELL_TEXT || tok === TOK_CELL_TEXT_MOSAIC) {
          cell.mode = "text";
          cell.char = value;
        } else {
          cell.mode = "mosaic";
        }
        if (mosaic > 0x3f || (tok === TOK_CELL_MOSAIC && value > 0x3f)) {
          throw new Error("invalid mosaic pattern");
        }
        cell.mosaic = tok === TOK_CELL_MOSAIC ? value & 0x3f : mosaic;
        unpackAttrs(attrs, cell);
        page.cells[Math.floor(idx / COLS)][idx % COLS] = cell;
        idx++;
      } else {
        throw new Error("unknown token");
      }
    }
    if (idx !== ROWS * COLS) {
      throw new Error("cell stream length mismatch");
    }
    if (ps.pages.has(number)) {
      ps.pages.set(number, page); // duplicate number: later page replaces earlier
    } else {
      addPage(ps, page);
    }
  }
  if (pos !== bytes.length) {
    throw new Error("trailing bytes");
  }
  return ps;
}

/** deflate-raw via the Compression Streams API (async). */
export async function compress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** inflate-raw via the Compression Streams API (async). Throws on corrupt input. */
export async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Req. 9.1: encode a PageSet as baseURL + "#t=" + payload.
 * Req. 9.8: throws "too large to share" when the URL would exceed 30000 chars.
 * @returns {Promise<string>}
 */
export async function encode(ps, baseURL = "") {
  const url = baseURL + "#t=" + base64url(await compress(serialize(ps)));
  if (url.length > URL_LIMIT) {
    throw new Error("too large to share");
  }
  return url;
}

/**
 * Req. 9.7: single-page URL, guaranteed at most 4000 characters.
 * @returns {Promise<string>}
 */
export async function encodePage(page, baseURL = "") {
  const ps = newPageSet();
  addPage(ps, page);
  const url = baseURL + "#t=" + base64url(await compress(serialize(ps)));
  if (url.length > PAGE_URL_LIMIT) {
    throw new Error("too large to share");
  }
  return url;
}

/**
 * Req. 9.3 / 9.5: decode a shareable URL. On any invalid or altered input,
 * resolves to { ps: <empty PageSet>, error } instead of throwing.
 * @returns {Promise<{ps: object, error: Error|null}>}
 */
export async function decode(url) {
  try {
    const marker = url.indexOf("#t=");
    if (marker === -1) {
      throw new Error("missing payload");
    }
    const payload = url.slice(marker + 3);
    const bytes = await decompress(unbase64url(payload));
    return { ps: deserialize(bytes), error: null };
  } catch (error) {
    return { ps: newPageSet(), error };
  }
}
