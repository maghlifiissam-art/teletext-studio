// Records a ~2 minute demo of Teletext Studio against the LIVE deployed site.
// Grid = DOM cells: .tt-cell[data-row][data-col] inside section#page-canvas.
// Colour swatches: .tt-swatches--fg .tt-swatch (black,red,green,yellow,blue,magenta,cyan,white)
import { chromium } from 'playwright';

const URL = 'https://maghlifiissam-art.github.io/teletext-studio/';
const OUT = '/downloads/demo-raw';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const cell = (r, c) => page.locator(`.tt-cell[data-row="${r}"][data-col="${c}"]`);
const btn = (label) => page.locator(`#toolbar-top button:has-text("${label}")`).first();
const fg = (i) => page.locator('.tt-swatches--fg .tt-swatch').nth(i);
const gotoInput = page.locator('.tt-goto-input, form input').first();

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(3500); // landing

// Title in red
await fg(1).click();
await cell(2, 5).click();
await page.keyboard.type('TELETEXT STUDIO', { delay: 130 });
await sleep(1600);

// Subtitle in yellow
await fg(3).click();
await cell(4, 5).click();
await page.keyboard.type('CEEFAX 1974, REBORN', { delay: 110 });
await sleep(1800);

// Mosaic graphics in cyan
await fg(6).click();
await btn('Mosaic').click();
await sleep(400);
await cell(8, 5).click();
await page.keyboard.type('lkjjkl', { delay: 220 });
await sleep(1800);

// Flash attribute (white text)
await fg(7).click();
await btn('Text').click();
await sleep(300);
await btn('Flash').click();
await cell(12, 5).click();
await page.keyboard.type('FLASHING TEXT', { delay: 120 });
await sleep(2800); // let it blink
await btn('Flash').click(); // flash off

// Conceal + reveal
await btn('Conceal').click();
await cell(14, 5).click();
await page.keyboard.type('CONCEALED', { delay: 120 });
await sleep(1400);
await btn('Reveal').click();
await sleep(1800);
await btn('Conceal').click();
await sleep(1000);

// New page
await btn('New page').click();
await sleep(1200);
await fg(2).click(); // green
await cell(3, 5).click();
await page.keyboard.type('PAGE TWO', { delay: 130 });
await sleep(1800);

// Copy share URL
await btn('Copy share URL').click();
await sleep(1800);

// Arabic RTL toggle and back
await page.locator('#lang-toggle').click();
await sleep(2400);
await page.locator('#lang-toggle').click();
await sleep(1600);

// Back to page 100 via Go to
await gotoInput.fill('100');
await btn('Go to').click();
await sleep(2600);

await context.close();
await browser.close();
console.log('recorded');
