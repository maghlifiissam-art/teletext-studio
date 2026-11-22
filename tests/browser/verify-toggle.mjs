import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const ROOT = process.cwd() + "/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const p = req.url.split("?")[0].split("#")[0];
    const f = join(ROOT, p === "/" ? "index.html" : p);
    res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
    res.end(await readFile(f));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8932, r));
const browser = await chromium.launch();
let fail = 0;
for (const lang of ["en", "ar"]) {
  const page = await browser.newPage({ viewport: { width: 375, height: 700 }, hasTouch: true });
  await page.goto("http://127.0.0.1:8932/", { waitUntil: "networkidle" });
  if (lang === "ar") await page.locator("#lang-toggle").click();
  // Every toolbar control fully inside the viewport horizontally and not
  // overlapped by the language toggle.
  const report = await page.evaluate(() => {
    const t = document.getElementById("lang-toggle").getBoundingClientRect();
    const out = { overlaps: [], clipped: [] };
    for (const el of document.querySelectorAll("#toolbar-top button, #toolbar-top input, #fastext-bar button")) {
      const r = el.getBoundingClientRect();
      if (r.left < 0 || r.right > 375) out.clipped.push(el.textContent.trim() || el.className);
      const intersect = !(r.right <= t.left || r.left >= t.right || r.bottom <= t.top || r.top >= t.bottom);
      if (intersect) out.overlaps.push(el.textContent.trim() || el.className);
    }
    return out;
  });
  const ok = report.overlaps.length === 0 && report.clipped.length === 0;
  if (!ok) fail = 1;
  console.log(lang, ok ? "PASS" : "FAIL", JSON.stringify(report));
  await page.screenshot({ path: `/downloads/teletext-mobile-${lang}.png` });
  await page.close();
}
await browser.close(); server.close();
process.exit(fail);
