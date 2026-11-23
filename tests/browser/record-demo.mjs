// Records the Kiroween demo of Teletext Studio against the LIVE deployed site.
// Grid = DOM cells: .tt-cell[data-row][data-col] inside section#page-canvas.
// Mosaic input is POINTER-based: in mosaic mode, tapping a cell toggles the
// sextant bit under the tap point (editor.js/ui.js). Keyboard types text only.
// Writes timing marks to /downloads/demo-raw/timing.json for caption sync.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = 'https://maghlifiissam-art.github.io/teletext-studio/';
const OUT = '/downloads/demo-raw';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
const t0 = Date.now();
const marks = [];
const mark = (name, startMs, endMs) =>
  marks.push({ name, start: +((startMs - t0) / 1000).toFixed(2), end: +((endMs - t0) / 1000).toFixed(2) });

const cell = (r, c) => page.locator(`.tt-cell[data-row="${r}"][data-col="${c}"]`);
const btn = (label) => page.locator(`#toolbar-top button:has-text("${label}")`).first();
const fg = (i) => page.locator('.tt-swatches--fg .tt-swatch').nth(i);
const gotoInput = page.locator('.tt-goto-input, form input').first();

// Toggle one sextant bit of a cell via a pointer tap at the bit's sub-region.
// bit layout: 0=top-left 1=top-right 2=mid-left 3=mid-right 4=bot-left 5=bot-right
async function tapSextant(r, c, bit) {
  const box = await cell(r, c).boundingBox();
  const fx = bit % 2 === 0 ? 0.25 : 0.75;
  const fy = [0.18, 0.5, 0.82][Math.floor(bit / 2)];
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await sleep(45);
}
async function fillCell(r, c) { for (let b = 0; b < 6; b++) await tapSextant(r, c, b); }

let s = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(3000);
mark('intro', s, Date.now());

// Title in red + subtitle in yellow
s = Date.now();
await fg(1).click();
await cell(2, 5).click();
await page.keyboard.type('TELETEXT STUDIO', { delay: 110 });
await sleep(1200);
await fg(3).click();
await cell(4, 5).click();
await page.keyboard.type('CEEFAX 1974, REBORN', { delay: 90 });
await sleep(1400);
mark('colours', s, Date.now());

// Mosaic graphics in cyan, drawn with pointer sextant taps
s = Date.now();
await fg(6).click();
await btn('Mosaic').click();
await sleep(500);
async function drawMosaic() {
  for (const r of [8, 9]) for (let c = 5; c <= 10; c++) await fillCell(r, c);
  for (const b of [0, 2, 4]) await tapSextant(8, 11, b); // left half
  for (const b of [1, 3, 5]) await tapSextant(9, 11, b); // right half
}
await drawMosaic();
let probe = await cell(8, 5).innerHTML();
console.log('mosaic probe cell(8,5):', probe.slice(0, 120));
console.log('canvas data-mode:', await page.locator('#page-canvas').getAttribute('data-mode'));
if (!probe.includes('tt-cell') && !probe.match(/background: rgb\((?!0, 0, 0)/)) {
  console.log('MOSAIC RETRY: blocks not rendered, re-toggling mode and redrawing');
  await btn('Text').click(); await sleep(300);
  await btn('Mosaic').click(); await sleep(500);
  await drawMosaic();
  probe = await cell(8, 5).innerHTML();
  console.log('mosaic probe after retry:', probe.slice(0, 120));
}
await page.screenshot({ path: '/downloads/mosaic-verify.png' });
await sleep(2200);
mark('mosaic', s, Date.now());

// Flash attribute (white text)
s = Date.now();
await fg(7).click();
await btn('Text').click();
await sleep(300);
await btn('Flash').click();
await cell(12, 5).click();
await page.keyboard.type('FLASHING TEXT', { delay: 100 });
await sleep(2800);
await btn('Flash').click();
mark('flash', s, Date.now());

// Conceal + reveal
s = Date.now();
await btn('Conceal').click();
await cell(14, 5).click();
await page.keyboard.type('CONCEALED', { delay: 100 });
await sleep(1400);
mark('conceal', s, Date.now());
s = Date.now();
await btn('Reveal').click();
await sleep(2200);
await btn('Conceal').click();
await sleep(800);
mark('reveal', s, Date.now());

// New page
s = Date.now();
await btn('New page').click();
await sleep(1200);
await fg(2).click();
await cell(3, 5).click();
await page.keyboard.type('PAGE TWO', { delay: 110 });
await sleep(1800);
mark('pages', s, Date.now());

// Copy share URL
s = Date.now();
await btn('Copy share URL').click();
await sleep(2000);
mark('share', s, Date.now());

// Arabic RTL interface, held long enough to read, then back to English
s = Date.now();
await page.locator('#lang-toggle').click();
await sleep(5000);
mark('arabic', s, Date.now());
await page.locator('#lang-toggle').click();
await sleep(1200);

// Back to page 100 via Go to
s = Date.now();
await gotoInput.fill('100');
await btn('Go to').click();
await sleep(3000);
mark('closing', s, Date.now());

writeFileSync(`${OUT}/timing.json`, JSON.stringify(marks, null, 2));
await context.close();
await browser.close();
console.log(JSON.stringify(marks));
