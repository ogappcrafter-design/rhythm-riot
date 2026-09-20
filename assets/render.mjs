// Renders the icon/splash SVGs to exact-size PNGs using the preinstalled Chromium.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const jobs = [
  { svg: 'assets/icon.svg', out: 'assets/icon.png', w: 1024, h: 1024 },
  { svg: 'assets/splash.svg', out: 'assets/splash.png', w: 2732, h: 2732 },
  { svg: 'assets/splash.svg', out: 'assets/splash-dark.png', w: 2732, h: 2732 },
];

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
for (const j of jobs) {
  const svg = readFileSync(j.svg, 'utf8');
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
  const html = `<!doctype html><html><body style="margin:0">${svg.replace(/width="\d+"/, `width="${j.w}"`).replace(/height="\d+"/, `height="${j.h}"`)}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buf = await page.locator('svg').screenshot({ omitBackground: false });
  writeFileSync(j.out, buf);
  await page.close();
  console.log('wrote', j.out, `${j.w}x${j.h}`);
}
await browser.close();
