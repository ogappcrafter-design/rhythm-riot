import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

// The clock is TypeScript with no imports: transpile it on the fly so this runs on any Node.
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'src', 'engine', 'audioClock.ts'), 'utf8');
const out = join(mkdtempSync(join(tmpdir(), 'rr-clock-')), 'audioClock.mjs');
writeFileSync(out, transformSync(src, { loader: 'ts', format: 'esm' }).code);
const { AudioClock } = await import(pathToFileURL(out).href);

/**
 * Simulate a phone whose audio element reports currentTime in coarse steps (like Android WebView),
 * read once per display frame. Returns the per-frame positions the game would render with.
 */
function simulate({ stepMs, frameMs = 1000 / 60, frames = 600, jitterMs = 0 }) {
  let perf = 1000;
  const realNow = performance.now;
  performance.now = () => perf;
  try {
    const clock = new AudioClock(300000);
    const audioStart = perf;
    const audio = {
      // currentTime only advances at each step boundary of the true playback position.
      get currentTime() {
        const t = perf - audioStart;
        return (Math.floor(t / stepMs) * stepMs) / 1000;
      },
      set currentTime(_) {},
      play: async () => {},
      pause() {},
    };
    clock.audio = audio;
    clock.running = true;
    const pos = [];
    for (let i = 0; i < frames; i++) {
      perf += frameMs + (jitterMs ? Math.sin(i * 1.7) * jitterMs : 0);
      pos.push({ t: perf - audioStart, p: clock.getPositionMs() });
    }
    return pos;
  } finally {
    performance.now = realNow;
  }
}

for (const stepMs of [10, 23, 46, 100]) {
  test(`clock is smooth and locked to audio when currentTime ticks every ${stepMs} ms`, () => {
    const pos = simulate({ stepMs });
    const settled = pos.slice(60); // after the first second
    let worstStepDev = 0;
    let worstErr = 0;
    for (let i = 1; i < settled.length; i++) {
      const adv = settled[i].p - settled[i - 1].p;
      const dt = settled[i].t - settled[i - 1].t;
      assert.ok(adv >= 0, 'position never runs backwards');
      worstStepDev = Math.max(worstStepDev, Math.abs(adv - dt));
      worstErr = Math.max(worstErr, Math.abs(settled[i].p - settled[i].t));
    }
    // Per-frame motion stays even (no freeze-then-jump): within 2.5 ms of real elapsed time.
    assert.ok(worstStepDev < 2.5, `uneven motion: ${worstStepDev.toFixed(2)} ms`);
    // And the clock stays locked to the true playback position.
    assert.ok(worstErr < stepMs / 2 + 4, `drifted ${worstErr.toFixed(1)} ms from the audio`);
  });
}

test('clock tolerates irregular frame pacing without stutter', () => {
  const pos = simulate({ stepMs: 46, jitterMs: 4 });
  const settled = pos.slice(60);
  for (let i = 1; i < settled.length; i++) {
    const adv = settled[i].p - settled[i - 1].p;
    const dt = settled[i].t - settled[i - 1].t;
    assert.ok(Math.abs(adv - dt) < 3, `frame ${i}: moved ${adv.toFixed(2)} ms in ${dt.toFixed(2)} ms`);
  }
});
