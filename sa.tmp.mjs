import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.SMOKE_URL || 'http://localhost:4180/';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-rhythm-riot/0b38e6c6-434a-5911-b136-96a10db1838f/scratchpad/store';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

// ---- 1. Render vector graphics to PNG (exact sizes, no alpha for Play) ----
async function renderSvg(file, w, h, out) {
  const svg = readFileSync(file, 'utf8');
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#05060f">${svg}</body></html>`, { waitUntil: 'networkidle' });
  const buf = await page.locator('svg').screenshot({ type: 'png' });
  writeFileSync(out, buf);
  await page.close();
  console.log('rendered', out, `${w}x${h}`);
}
await renderSvg('assets/store/feature-graphic.svg', 1024, 500, `${OUT}/feature-graphic-1024x500.png`);
await renderSvg('assets/icon.svg', 512, 512, `${OUT}/play-icon-512.png`);

// ---- 2. Real phone screenshots of the running app (786x1572, ratio 1:2, Play-safe) ----
const fakeSave = {
  settings: { musicVolume: 0.85, sfxVolume: 0.8, haptics: true, visualIntensity: 1, latencyOffsetMs: 0 },
  bests: {
    i_dont_care_tonight: { easy: { score: 128400, accuracy: 96.4, vibeScore: 8210, grade: 'S', stars: 5, perfectPercent: 93, maxCombo: 240, playedAt: Date.now() }, hard: { score: 201300, accuracy: 91.2, vibeScore: 7400, grade: 'A', stars: 4, perfectPercent: 91, maxCombo: 320, playedAt: Date.now() } },
    everyday_g: { medium: { score: 150000, accuracy: 82.1, vibeScore: 5100, grade: 'B', stars: 3, perfectPercent: 61, maxCombo: 140, playedAt: Date.now() } },
  },
  expertUnlocked: { i_dont_care_tonight: true },
  lifetime: { runs: 12, perfect: 1800, great: 400, good: 150, miss: 90, notes: 2440, scoreSum: 900000, bestCombo: 320, playMs: 1830000, firstPlayedAt: Date.now() - 5e6, lastPlayedAt: Date.now() },
  introSeen: true, calibrationDone: true,
};

const page = await browser.newPage({ viewport: { width: 393, height: 786 }, deviceScaleFactor: 2 });
const shot = async (name) => { await page.screenshot({ path: `${OUT}/screenshot-${name}.png`, type: 'png' }); console.log('shot', name); };

await page.addInitScript((save) => { try { localStorage.setItem('rhythm_riot_save_v1', JSON.stringify(save)); } catch {} }, fakeSave);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1300);
await page.mouse.click(196, 380); // skip intro
await page.waitForSelector('.menu-logo', { timeout: 5000 });
await page.waitForTimeout(600);
await shot('1-menu');

await page.getByText('PLAY', { exact: false }).first().click();
await page.waitForSelector('.track-card', { timeout: 5000 });
await page.waitForTimeout(500);
await shot('2-songselect');

// Gameplay on everyday_g (last card), Hard (index 2) for busy visuals
const card = page.locator('.track-card').last();
await card.locator('.diff-gem').nth(2).click();
await page.waitForSelector('.lane-preview', { timeout: 5000 });
await page.getByText('START', { exact: false }).first().click();
await page.waitForSelector('.lane-controls', { timeout: 8000 });
await page.waitForTimeout(3200); // into the song where notes + mood are lively
// tap a couple lanes to light combo/particles right before the shot
for (let i = 0; i < 6; i++) { const b = page.locator('.lane-btn').nth(i % 4); const bx = await b.boundingBox(); if (bx) { await page.mouse.click(bx.x + bx.width/2, bx.y + bx.height/2); await page.waitForTimeout(90);} }
await shot('3-gameplay');

// Profile (populated via injected save)
await page.evaluate(() => location.reload());
await page.waitForTimeout(1500);
await page.mouse.click(196, 380);
await page.waitForSelector('.menu-logo', { timeout: 5000 });
await page.getByText('Profile', { exact: false }).first().click();
await page.waitForSelector('.stat-grid', { timeout: 5000 });
await page.waitForTimeout(500);
await shot('4-profile');

await browser.close();
console.log('DONE');
