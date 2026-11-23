// Records a ~2 minute demo of Teletext Studio against the LIVE deployed site.
// Grid = DOM cells: .tt-cell[data-row][data-col] inside section#page-canvas.
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
const btn = (label) => page.locator(`button:has-text("${label}")`).first();

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(3000); // 0:00-0:03 landing

// Title in red
await btn('Red').click();
await cell(2, 5).click();
await page.keyboard.type('TELETEXT STUDIO', { delay: 130 });
await sleep(1600);

// Subtitle in yellow
await btn('Yellow').click();
await cell(4, 5).click();
await page.keyboard.type('CEEFAX 1974, REBORN', { delay: 110 });
await sleep(1800);

// Mosaic graphics
await btn('Mosaic').click();
await sleep(400);
await cell(8, 5).click();
await page.keyboard.type('lkjjkl', { delay: 220 });
await sleep(1600);

// Flash attribute
await btn('Text').click();
await sleep(300);
await btn('Flash').click();
await cell(12, 5).click();
await page.keyboard.type('FLASHING TEXT', { delay: 120 });
await sleep(2600); // let it blink

// Conceal + reveal
await btn('Flash').click(); // toggle flash off
await btn('Conceal').click();
await cell(14, 5).click();
await page.keyboard.type('CONCEALED', { delay: 120 });
await sleep(1200);
await btn('Reveal').click();
await sleep(1600);
await btn('Reveal').click(); // conceal again for the look
await sleep(800);

// New page
await btn('New page').click();
await sleep(1200);
await cell(3, 5).click();
await page.keyboard.type('PAGE TWO: MULTI-PAGE MAGAZINE', { delay: 100 });
await sleep(2000);

// Copy share URL
await btn('Copy share URL').click();
await sleep(1800);

// Arabic RTL toggle and back
await page.locator('#lang-toggle').click();
await sleep(2200);
await page.locator('#lang-toggle').click();
await sleep(1500);

// Go back to page 100 via Go to
await btn('Go to').click();
await sleep(600);
await page.keyboard.type('100', { delay: 200 });
await page.keyboard.press('Enter');
await sleep(2200);

await context.close();
await browser.close();
console.log('recorded');
