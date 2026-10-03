import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARTS_DIR = join(__dirname, '..', 'src', 'charts');

const manifest = JSON.parse(readFileSync(join(CHARTS_DIR, 'manifest.json'), 'utf8'));
const charts = Object.fromEntries(
  manifest.map((id) => [id, JSON.parse(readFileSync(join(CHARTS_DIR, `${id}.json`), 'utf8'))]),
);

const EXPECTED_LANES = { easy: 3, medium: 4, hard: 4, expert: 5 };
const DIFFS = ['easy', 'medium', 'hard', 'expert'];

test('manifest lists all launch tracks and each has a chart file', () => {
  assert.equal(manifest.length, 8);
  const files = readdirSync(CHARTS_DIR);
  for (const id of manifest) assert.ok(files.includes(`${id}.json`), `${id}.json missing`);
});

for (const id of manifest) {
  const chart = charts[id];

  test(`${id}: has required top-level fields`, () => {
    assert.equal(chart.trackId, id);
    assert.ok(chart.title && typeof chart.title === 'string');
    assert.ok(/\.(mp3|mp4|m4a|ogg|wav|webm)$/.test(chart.audioFile), `unexpected audio ext: ${chart.audioFile}`);
    assert.ok(chart.durationMs > 0);
    assert.ok(chart.bpm > 0);
  });

  test(`${id}: all four difficulties present with correct lane counts + hit windows`, () => {
    for (const d of DIFFS) {
      const dc = chart.difficulties[d];
      assert.ok(dc, `missing ${d}`);
      assert.equal(dc.laneCount, EXPECTED_LANES[d], `${d} lane count`);
      const w = dc.hitWindowMs;
      assert.ok(w.perfect < w.great && w.great < w.good, `${d} windows not widening`);
    }
  });

  test(`${id}: notes are sorted, in-bounds, and lane-valid`, () => {
    for (const d of DIFFS) {
      const dc = chart.difficulties[d];
      assert.ok(dc.notes.length > 0, `${d} empty`);
      let last = -1;
      for (const n of dc.notes) {
        assert.ok(n.timeMs >= 0 && n.timeMs <= chart.durationMs + 1000, `${d} time OOB @${n.timeMs}`);
        assert.ok(n.lane >= 0 && n.lane < dc.laneCount, `${d} lane OOB ${n.lane}`);
        assert.ok(n.type === 'tap' || n.type === 'hold' || n.type === 'slide', `${d} bad type ${n.type}`);
        if (n.type === 'hold' || n.type === 'slide') {
          assert.ok(n.holdMs > 0, `${d} ${n.type} missing holdMs @${n.timeMs}`);
          assert.ok(n.timeMs + n.holdMs <= chart.durationMs + 1000, `${d} ${n.type} tail OOB @${n.timeMs}`);
        }
        if (n.type === 'slide') {
          assert.ok(Array.isArray(n.path) && n.path.length >= 2, `${d} slide missing path @${n.timeMs}`);
          assert.equal(n.path[0].lane, n.lane, `${d} slide path head mismatch @${n.timeMs}`);
          assert.notEqual(n.path[n.path.length - 1].lane, n.lane, `${d} slide doesn't travel @${n.timeMs}`);
          for (const pt of n.path) {
            assert.ok(pt.lane >= 0 && pt.lane < dc.laneCount, `${d} slide path lane OOB ${pt.lane}`);
            assert.ok(pt.tMs >= n.timeMs - 1 && pt.tMs <= n.timeMs + n.holdMs + 1, `${d} slide path time OOB @${pt.tMs}`);
          }
        }
        assert.ok(n.timeMs >= last, `${d} not sorted @${n.timeMs}`);
        last = n.timeMs;
      }
    }
  });

  test(`${id}: difficulty density increases easy < medium < hard <= expert`, () => {
    const c = (d) => chart.difficulties[d].notes.length;
    assert.ok(c('easy') < c('medium'), 'easy<medium');
    assert.ok(c('medium') < c('hard'), 'medium<hard');
    assert.ok(c('expert') > c('hard'), 'expert>hard');
  });

  test(`${id}: easy respects minimum note spacing (beginner-friendly)`, () => {
    const notes = chart.difficulties.easy.notes;
    for (let i = 1; i < notes.length; i++) {
      // Global min spacing is 250ms; allow a tiny rounding tolerance.
      assert.ok(notes[i].timeMs - notes[i - 1].timeMs >= 240, `spacing too tight @${notes[i].timeMs}`);
    }
  });

  test(`${id}: expert is unlock-gated at 90% Perfect on Hard`, () => {
    const req = chart.difficulties.expert.unlockRequirement;
    assert.deepEqual(req, { difficulty: 'hard', minPerfectPercent: 90 });
  });

  test(`${id}: moodCurve samples are normalized and time-sorted`, () => {
    const s = chart.moodCurve.samples;
    assert.ok(s.length > 2);
    let last = -1;
    for (const p of s) {
      assert.ok(p.energy >= 0 && p.energy <= 1, `energy OOB ${p.energy}`);
      assert.ok(p.timeMs > last, 'mood samples not sorted');
      last = p.timeMs;
    }
  });
}

test('generator is deterministic (regenerating reproduces identical charts)', () => {
  const before = manifest.map((id) => readFileSync(join(CHARTS_DIR, `${id}.json`), 'utf8'));
  execSync('node scripts/generateCharts.mjs', { cwd: join(__dirname, '..'), stdio: 'ignore' });
  const after = manifest.map((id) => readFileSync(join(CHARTS_DIR, `${id}.json`), 'utf8'));
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i], before[i], `${manifest[i]} changed on regeneration`);
  }
});
