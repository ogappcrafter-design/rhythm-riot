import type { DifficultyChart, TrackChart, Difficulty } from './chartTypes';
import type { Palette } from '../data/palettes';
import { moodColorway, rgbCss } from './colors';
import {
  EMPTY_TOTALS,
  JUDGEMENT_SCORE,
  accuracyPercent,
  judgeTiming,
  letterGrade,
  perfectPercent,
  starRating,
  totalNotes,
  type Judgement,
  type RunTotals,
} from './grading';
import { MoodSystem } from './moodSystem';
import { ParticleField } from './particles';
import { sampleMoodCurve } from './chartLoader';
import { sfx, speak } from '../audio/sfx';
import type { AudioClock } from './audioClock';
import type { RGB } from '../data/palettes';

export interface RunResult {
  trackId: string;
  difficulty: Difficulty;
  totals: RunTotals;
  accuracy: number;
  perfectPercent: number;
  vibeScore: number;
  grade: ReturnType<typeof letterGrade>;
  stars: number;
}

export interface HudState {
  score: number;
  combo: number;
  accuracy: number;
  progress: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  chart: TrackChart;
  difficulty: Difficulty;
  palette: Palette;
  clock: AudioClock;
  latencyOffsetMs: number;
  visualIntensity: number;
  hapticsEnabled: boolean;
  sfxVolume: number;
  onHud: (s: HudState) => void;
  onFinish: (r: RunResult) => void;
}

interface RuntimeNote {
  timeMs: number;
  lane: number;
  colorClass: number;
  isHold: boolean; // hold OR slide (any sustained note)
  isSlide: boolean;
  path: { tMs: number; lane: number }[]; // lane over time (single point for a straight hold)
  holdEndMs: number;
  judged: boolean;
  judgement: Judgement | null;
  hit: boolean;
  holdActive: boolean;
  holdDone: boolean;
  holdBroken: boolean;
  holdBrokenAt: number; // perf time the freeze was dropped (for the red-fail flash)
  graceMs: number; // how long the required lane hasn't been held (slides/holds break past a grace)
}

interface FloatingJudge {
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
  big: boolean;
}

interface FlowStar {
  x: number;
  y: number;
  z: number; // 0..1 depth (bigger = closer/faster)
  r: number;
  tw: number; // twinkle phase
}

// ---- DDR-style playfield geometry (flat lanes, notes rise into top receptors) ----
const APPROACH_MS = 1300; // snappy DDR-ish scroll speed
const GAUGE_Y_FRAC = 0.076; // groove/dance gauge, tucked just under the top HUD
const RECEPTOR_FRAC = 0.205; // stationary receptor targets near the top
const SPAWN_FRAC = 0.72; // notes appear here (just above the pads) and rise to the receptors
const SLIDE_GRACE_MS = 140; // how long you can be off a sustain's required lane before it breaks
const DOT_SPRITE_SIZE = 128;

// DDR judgement labels + colors. MARVELOUS is a cosmetic top tier for very tight Perfects.
const JUDGE_LABEL: Record<Judgement, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const JUDGE_COLORS: Record<Judgement, string> = {
  perfect: '#ffe14d',
  great: '#4dff88',
  good: '#38b6ff',
  miss: '#ff4d6a',
};
const MARVELOUS_COLOR = '#c8f9ff';

// Beat-subdivision note-glow colors (chart note.c): red 4th, blue 8th, yellow 16th, green triplet.
const NOTE_COLORS: RGB[] = [
  [255, 64, 92],
  [56, 182, 255],
  [255, 214, 64],
  [72, 232, 120],
];
const FREEZE_BODY: RGB = [86, 235, 132]; // freeze (hold) bodies — green when held
const FREEZE_FAIL: RGB = [255, 60, 80]; // freeze turns red when you drop it

// Facet colors sprinkled across the disco-ball notes for the prismatic look.
const PRISM: RGB[] = [
  [255, 90, 140],
  [255, 200, 90],
  [120, 255, 170],
  [90, 210, 255],
  [190, 130, 255],
  [255, 120, 220],
];

// Bright hues cycled through notes once the player passes a 100 combo.
const RAINBOW: RGB[] = [
  [255, 96, 128],
  [255, 176, 64],
  [255, 240, 96],
  [120, 255, 150],
  [96, 208, 255],
  [190, 128, 255],
];
const ENCOURAGE = ['KEEP GOING!', "DON'T GIVE UP!", 'YOU GOT THIS!', 'SHAKE IT OFF!'];

function lightenRGB(c: RGB, t: number): RGB {
  return [
    Math.round(c[0] + (255 - c[0]) * t),
    Math.round(c[1] + (255 - c[1]) * t),
    Math.round(c[2] + (255 - c[2]) * t),
  ];
}
function darkenRGB(c: RGB, t: number): RGB {
  return [Math.round(c[0] * (1 - t)), Math.round(c[1] * (1 - t)), Math.round(c[2] * (1 - t))];
}
export class GameEngine {
  private opts: EngineOptions;
  private ctx: CanvasRenderingContext2D;
  private diffChart: DifficultyChart;
  private laneCount: number;

  private notes: RuntimeNote[] = [];
  private mood = new MoodSystem();
  private particles = new ParticleField();

  private totals: RunTotals = { ...EMPTY_TOTALS };
  private combo = 0;
  private maxCombo = 0;
  private score = 0;

  private floaters: FloatingJudge[] = [];
  private laneFlash: number[] = []; // pad-press / hit wash per lane
  private hitPop: number[] = []; // successful-hit step explosion per lane (decays 1→0)
  private lanePressed: boolean[] = [];
  private activeSustains: RuntimeNote[] = []; // holds + slides currently being held

  private flowStars: FlowStar[] = [];
  private dotSprites = new Map<number, HTMLCanvasElement>();

  private raf = 0;
  private running = false;
  private paused = false;
  private lastFrame = 0;
  private finished = false;
  private audioEndedAt = 0; // perf time the audio 'ended' event fired (0 = not yet)
  private nearEndSince = 0; // perf time position first reached the song end (stall fallback)
  private lastComboTier = 0; // 0 / 50 / 100 — for milestone SFX + effects
  private consecutiveMiss = 0;
  private comboPop = 0; // per-hit combo-counter kick, decays to 0
  private missFlash = 0; // red screen-edge flash, decays to 0
  private encourageUntil = 0; // perf time the encouragement banner stops
  private encourageText = '';
  private beatMs = 500;

  private dpr = 1;
  private w = 0;
  private h = 0;
  private hudAccum = 0;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    const ctx = opts.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.diffChart = opts.chart.difficulties[opts.difficulty];
    this.laneCount = this.diffChart.laneCount;
    this.beatMs = 60000 / Math.max(1, opts.chart.bpm);
    this.laneFlash = new Array(this.laneCount).fill(0);
    this.hitPop = new Array(this.laneCount).fill(0);
    this.lanePressed = new Array(this.laneCount).fill(false);
    this.notes = this.diffChart.notes.map((n) => {
      const isSlide = n.type === 'slide' && !!n.holdMs;
      const isHold = (n.type === 'hold' || isSlide) && !!n.holdMs;
      const lane = Math.min(n.lane, this.laneCount - 1);
      const clampLane = (l: number) => Math.max(0, Math.min(this.laneCount - 1, l));
      const path =
        isSlide && n.path && n.path.length >= 2
          ? n.path.map((p) => ({ tMs: p.tMs, lane: clampLane(p.lane) }))
          : [{ tMs: n.timeMs, lane }];
      return {
        timeMs: n.timeMs,
        lane,
        colorClass: Math.max(0, Math.min(NOTE_COLORS.length - 1, n.c ?? 0)),
        isHold,
        isSlide,
        path,
        holdEndMs: isHold ? n.timeMs + (n.holdMs ?? 0) : n.timeMs,
        judged: false,
        judgement: null,
        hit: false,
        holdActive: false,
        holdDone: false,
        holdBroken: false,
        holdBrokenAt: 0,
        graceMs: 0,
      };
    });
    this.resize();
  }

  resize(): void {
    const { canvas } = this.opts;
    const rect = canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    canvas.width = Math.round(this.w * this.dpr);
    canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.particles.resize(this.w, this.h);
    this.dotSprites.clear();
    this.initFlow();
  }

  private initFlow(): void {
    const count = Math.round(70 * this.opts.visualIntensity);
    this.flowStars = [];
    for (let i = 0; i < count; i++) {
      const z = Math.random();
      this.flowStars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z,
        r: 0.5 + z * 1.8,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // When the real audio track ends, currentTime stops advancing (and the clock clamps
    // position to it), so the frame loop can't reach the finish threshold on its own — the
    // 'ended' event is what drives the results screen for a real track.
    this.opts.clock.onEnd(() => {
      if (!this.audioEndedAt) this.audioEndedAt = performance.now();
    });
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = performance.now();
  }
  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.dotSprites.clear();
  }

  // ---- geometry -------------------------------------------------------
  private get gaugeY() {
    return this.h * GAUGE_Y_FRAC;
  }
  private get receptorY() {
    return this.h * RECEPTOR_FRAC;
  }
  private get spawnY() {
    return this.h * SPAWN_FRAC;
  }
  private get laneW() {
    return this.w / this.laneCount;
  }
  private laneCenterX(lane: number): number {
    return (lane + 0.5) * this.laneW;
  }
  /** Progress toward the receptor: 0 at spawn (bottom), 1 at the receptor (hit moment). */
  private progressFor(deltaMs: number): number {
    return 1 - deltaMs / APPROACH_MS;
  }
  private yFor(p: number): number {
    return this.spawnY + (this.receptorY - this.spawnY) * p; // rises upward as p→1
  }
  /** The lane a sustained note occupies at time t (interpolated along a slide's path). */
  private laneAt(n: RuntimeNote, t: number): number {
    const p = n.path;
    if (p.length < 2) return p[0].lane;
    if (t <= p[0].tMs) return p[0].lane;
    const last = p[p.length - 1];
    if (t >= last.tMs) return last.lane;
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i].tMs) {
        const a = p[i - 1];
        const b = p[i];
        const f = (t - a.tMs) / Math.max(1, b.tMs - a.tMs);
        return a.lane + (b.lane - a.lane) * f;
      }
    }
    return last.lane;
  }

  // ---- input ----------------------------------------------------------
  pressLane(lane: number): void {
    if (!this.running || this.paused || this.finished) return;
    if (lane < 0 || lane >= this.laneCount) return;
    this.lanePressed[lane] = true;
    this.laneFlash[lane] = 1;

    const songMs = this.opts.clock.getPositionMs();
    const tapMs = songMs - this.opts.latencyOffsetMs;
    const win = this.diffChart.hitWindowMs;

    let bestIdx = -1;
    let bestErr = Infinity;
    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.judged || n.lane !== lane) continue;
      const err = Math.abs(n.timeMs - tapMs);
      if (err <= win.good && err < bestErr) {
        bestErr = err;
        bestIdx = i;
      }
      if (n.timeMs - tapMs > win.good) break;
    }
    if (bestIdx === -1) return;

    const n = this.notes[bestIdx];
    const j = judgeTiming(bestErr, win);
    this.judgeHead(n, j, bestErr);
    if (n.isHold && j !== 'miss') {
      // Start tracking this sustain; updateSustains() keeps it alive while the required lane
      // (which moves for a slide) stays held, and resolves it O.K./N.G.
      n.holdActive = true;
      n.graceMs = 0;
      if (!this.activeSustains.includes(n)) this.activeSustains.push(n);
    }
  }

  releaseLane(lane: number): void {
    if (lane < 0 || lane >= this.laneCount) return;
    this.lanePressed[lane] = false;
    // Sustains are no longer resolved on release directly — updateSustains() watches lanePressed
    // against each sustain's required (possibly moving) lane, so a slide survives finger moves and
    // only fails after a short grace of not following the path.
  }

  private judgeHead(n: RuntimeNote, j: Judgement, err = Infinity): void {
    n.hit = j !== 'miss';
    n.judged = true;
    n.judgement = j;
    this.totals[j] += 1;
    const x = this.laneCenterX(n.lane);
    if (j === 'miss') {
      this.combo = 0;
      this.lastComboTier = 0;
      this.missFlash = 1; // red screen-edge flash
      this.consecutiveMiss += 1;
      this.spawnFloater('MISS', JUDGE_COLORS.miss, true);
      // Encouragement after 5 misses in a row ("keep going / don't give up") — spoken + banner.
      if (this.consecutiveMiss % 5 === 0) {
        sfx.play('rally');
        this.encourageText = ENCOURAGE[(this.consecutiveMiss / 5 - 1) % ENCOURAGE.length];
        this.encourageUntil = performance.now() + 1600;
        speak(this.encourageText, this.opts.sfxVolume);
      }
    } else {
      this.consecutiveMiss = 0;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const comboMul = 1 + (Math.min(this.combo, 100) / 100) * 0.5;
      this.score += Math.round(JUDGEMENT_SCORE[j] * comboMul);
      this.hitPop[n.lane] = 1; // step-zone explosion
      this.comboPop = Math.max(this.comboPop, 1); // combo-counter kick
      // MARVELOUS is a cosmetic top tier for a very tight Perfect.
      const marvelous = j === 'perfect' && err <= this.diffChart.hitWindowMs.perfect * 0.5;
      this.spawnFloater(
        marvelous ? 'MARVELOUS' : JUDGE_LABEL[j],
        marvelous ? MARVELOUS_COLOR : JUDGE_COLORS[j],
        j !== 'good',
      );
      // Combo-tier milestones (50 = grid glow, 100 = rainbow + sparkles) — visual only, no chime.
      if (this.combo >= 100 && this.lastComboTier < 100) {
        this.lastComboTier = 100;
        this.comboPop = 1.8;
      } else if (this.combo >= 50 && this.lastComboTier < 50) {
        this.lastComboTier = 50;
        this.comboPop = 1.8;
      }
    }
    const energy = sampleMoodCurve(this.opts.chart, n.timeMs);
    this.mood.registerJudgement(j, this.combo, energy);

    if (j !== 'miss') {
      const strength = j === 'perfect' ? 1 : j === 'great' ? 0.7 : 0.4;
      this.particles.emitBurst(x, this.receptorY, moodColorway(this.opts.palette, this.mood.moodNorm).glow, strength, this.opts.visualIntensity);
      this.laneFlash[n.lane] = 1;
    }
    // No per-hit tone on a successful note — those pitched ticks layer over and muddy the music.
    // A miss still gets its (non-musical) thud so mistakes are still audible.
    if (j === 'miss') sfx.play('miss');
    if (this.opts.hapticsEnabled && j === 'perfect') {
      const nav = navigator as Navigator & { vibrate?: (p: number) => boolean };
      if (typeof nav.vibrate === 'function') {
        try {
          nav.vibrate(8);
        } catch {
          /* unsupported */
        }
      }
    }
  }

  private completeHold(n: RuntimeNote): void {
    if (n.holdDone || n.holdBroken) return;
    n.holdDone = true;
    n.holdActive = false;
    this.activeSustains = this.activeSustains.filter((s) => s !== n);
    const bonus = 120 + Math.round((n.holdEndMs - n.timeMs) / 12);
    this.score += bonus;
    const endLane = Math.round(this.laneAt(n, n.holdEndMs));
    const x = this.laneCenterX(endLane);
    this.hitPop[endLane] = 1;
    this.particles.emitBurst(x, this.receptorY, moodColorway(this.opts.palette, this.mood.moodNorm).glow, 1, this.opts.visualIntensity);
    this.laneFlash[endLane] = 1;
    this.spawnFloater(n.isSlide ? 'CLEAR!' : 'O.K.!', '#8effc0', true);
    // Completing a freeze/slide is celebrated visually (burst + CLEAR!) — no pitched tone over the music.
  }

  private breakHold(n: RuntimeNote): void {
    if (n.holdDone || n.holdBroken) return;
    n.holdBroken = true;
    n.holdActive = false;
    n.holdBrokenAt = performance.now();
    this.activeSustains = this.activeSustains.filter((s) => s !== n);
    this.combo = 0; // dropping a hold/slide breaks the streak
    this.lastComboTier = 0;
    this.consecutiveMiss += 1;
    this.missFlash = 1;
    // Unmistakable "you let go / wandered off the path" feedback — red flash + "NG!" (No Good).
    this.spawnFloater('NG!', '#ff4d6a', true);
    sfx.play('miss');
  }

  private spawnFloater(text: string, color: string, big: boolean): void {
    // A single, centered judgement banner (DDR-style) — replaces any previous one so
    // simultaneous judgements never stack or overlap on screen.
    this.floaters = [{ text, color, x: this.w / 2, y: this.receptorY + this.h * 0.12, life: 1, big }];
  }

  // ---- main loop ------------------------------------------------------
  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = now - this.lastFrame;
    this.lastFrame = now;
    if (this.paused) {
      this.drawPausedTint();
      return;
    }
    if (dt > 60) dt = 60;

    const songMs = this.opts.clock.getPositionMs();
    this.autoMiss(songMs);
    this.updateSustains(songMs, dt);
    this.mood.update(dt);
    this.particles.update(dt, this.mood.moodNorm, this.opts.visualIntensity);
    this.updateFlow(dt);
    for (let i = 0; i < this.laneFlash.length; i++) {
      const target = this.lanePressed[i] ? 0.5 : 0;
      this.laneFlash[i] = Math.max(target, this.laneFlash[i] - dt / 190);
      if (this.hitPop[i] > 0) this.hitPop[i] = Math.max(0, this.hitPop[i] - dt / 320);
    }
    if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - dt / 260);
    if (this.missFlash > 0) this.missFlash = Math.max(0, this.missFlash - dt / 450);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt / 620;
      f.y -= (dt / 1000) * 26;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }

    this.render(songMs);
    this.emitHud(songMs, dt);

    // ---- reliable song-end detection ----
    if (!this.finished) {
      const durMs = this.opts.chart.durationMs;
      const near = songMs >= durMs - 60;
      if (near && !this.nearEndSince) this.nearEndSince = now;
      if (!near) this.nearEndSince = 0;
      const endedByEvent = this.audioEndedAt > 0 && now - this.audioEndedAt >= 350;
      const endedByStall = this.nearEndSince > 0 && now - this.nearEndSince >= 1200; // audio froze at end
      const endedByFallback = songMs >= durMs + 600; // silent/fallback clock isn't clamped
      if (endedByEvent || endedByStall || endedByFallback) this.finish();
    }
  };

  private autoMiss(songMs: number): void {
    const tapMs = songMs - this.opts.latencyOffsetMs;
    const goodWin = this.diffChart.hitWindowMs.good;
    for (const n of this.notes) {
      if (n.judged) continue;
      if (n.timeMs < tapMs - goodWin) this.judgeHead(n, 'miss');
      else break;
    }
  }

  private updateSustains(songMs: number, dt: number): void {
    const t = songMs - this.opts.latencyOffsetMs;
    // Iterate a copy — complete/break mutate activeSustains.
    for (const n of [...this.activeSustains]) {
      if (t >= n.holdEndMs) {
        this.completeHold(n); // followed the path all the way through → O.K./CLEAR
        continue;
      }
      // The lane you must be holding right now (moves along a slide's path).
      const required = Math.round(this.laneAt(n, t));
      if (this.lanePressed[required]) {
        n.graceMs = 0;
      } else {
        n.graceMs += dt;
        if (n.graceMs > SLIDE_GRACE_MS) this.breakHold(n); // let go / wandered off → N.G.
      }
    }
  }

  private emitHud(songMs: number, dt: number): void {
    this.hudAccum += dt;
    if (this.hudAccum < 80) return;
    this.hudAccum = 0;
    this.opts.onHud({
      score: this.score,
      combo: this.combo,
      accuracy: accuracyPercent(this.totals),
      progress: Math.min(1, songMs / this.opts.chart.durationMs),
      perfect: this.totals.perfect,
      great: this.totals.great,
      good: this.totals.good,
      miss: this.totals.miss,
    });
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    const t = { ...this.totals, maxCombo: this.maxCombo, score: this.score };
    const n = totalNotes(t);
    const acc = accuracyPercent(t);
    this.opts.onFinish({
      trackId: this.opts.chart.trackId,
      difficulty: this.opts.difficulty,
      totals: t,
      accuracy: acc,
      perfectPercent: perfectPercent(t),
      vibeScore: this.mood.vibeScore(),
      grade: letterGrade(acc, t.miss, n),
      stars: starRating(acc, t.miss, n),
    });
  }

  // ---- flow background ------------------------------------------------
  private updateFlow(dt: number): void {
    const mn = this.mood.moodNorm;
    const speed = (14 + mn * 40) * (dt / 1000);
    for (const s of this.flowStars) {
      s.y += speed * (0.4 + s.z);
      s.tw += dt / 900;
      if (s.y > this.h + 4) {
        s.y = -4;
        s.x = Math.random() * this.w;
      }
    }
  }

  // ---- disco-ball dot sprite cache -----------------------------------
  /** A 3D round glowing note: a faceted mirror-ball with prismatic tiles and a colored halo. */
  private getDotSprite(key: number, color: RGB): HTMLCanvasElement {
    const cached = this.dotSprites.get(key);
    if (cached) return cached;
    const S = DOT_SPRITE_SIZE;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const c = cv.getContext('2d')!;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.34;

    // Outer glow halo in the beat-color (keeps the color coding legible).
    c.save();
    c.shadowColor = rgbCss(lightenRGB(color, 0.25), 1);
    c.shadowBlur = S * 0.3;
    c.fillStyle = rgbCss(color, 0.9);
    c.beginPath();
    c.arc(cx, cy, R * 0.94, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Sphere body — clipped to the ball.
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();
    const bg = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.15);
    bg.addColorStop(0, '#3c4256');
    bg.addColorStop(1, '#080a14');
    c.fillStyle = bg;
    c.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Mirror-ball facet tiles with sphere shading + prismatic sparkle.
    const tile = R * 0.32;
    const Lx = -0.5;
    const Ly = -0.62;
    const Lz = 0.6;
    for (let gy = -R; gy < R; gy += tile) {
      for (let gx = -R; gx < R; gx += tile) {
        const px = (gx + tile * 0.5) / R;
        const py = (gy + tile * 0.5) / R;
        const r2 = px * px + py * py;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const diff = Math.max(0, px * Lx + py * Ly + nz * Lz);
        const h = ((Math.floor(gx) * 73856093) ^ (Math.floor(gy) * 19349663) ^ (key * 83492791)) >>> 0;
        const rnd = (h % 1000) / 1000;
        let shade = 0.2 + 0.95 * diff + (rnd - 0.5) * 0.28;
        shade = Math.max(0.05, Math.min(1.15, shade));
        let base: RGB = [214, 221, 236];
        if (rnd < 0.36) {
          const pc = PRISM[h % PRISM.length];
          base = [pc[0] * 0.6 + 120, pc[1] * 0.6 + 120, pc[2] * 0.6 + 120];
        }
        c.fillStyle = `rgb(${Math.min(255, base[0] * shade) | 0},${Math.min(255, base[1] * shade) | 0},${Math.min(255, base[2] * shade) | 0})`;
        c.fillRect(cx + gx + 1, cy + gy + 1, tile - 1.6, tile - 1.6);
        if (diff > 0.82 && rnd > 0.55) {
          c.fillStyle = 'rgba(255,255,255,0.85)';
          c.fillRect(cx + gx + tile * 0.3, cy + gy + tile * 0.3, tile * 0.4, tile * 0.4);
        }
      }
    }

    // Big soft specular highlight (top-left) for the glassy 3D pop.
    const hl = c.createRadialGradient(cx - R * 0.4, cy - R * 0.45, 0, cx - R * 0.4, cy - R * 0.45, R * 0.75);
    hl.addColorStop(0, 'rgba(255,255,255,0.8)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl;
    c.fillRect(cx - R, cy - R, R * 2, R * 2);
    c.restore();

    // Colored rim ring (beat-color identity) + a thin dark edge for contrast.
    c.strokeStyle = rgbCss(lightenRGB(color, 0.45), 0.95);
    c.lineWidth = S * 0.022;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = S * 0.018;
    c.beginPath();
    c.arc(cx, cy, R + S * 0.014, 0, Math.PI * 2);
    c.stroke();

    this.dotSprites.set(key, cv);
    return cv;
  }

  // ---- render ---------------------------------------------------------
  private render(songMs: number): void {
    const ctx = this.ctx;
    const moodNorm = this.mood.moodNorm;
    const cw = moodColorway(this.opts.palette, moodNorm);
    const phase = (((songMs % this.beatMs) + this.beatMs) % this.beatMs) / this.beatMs;
    const beatPulse = Math.pow(1 - phase, 3); // 1 right on the beat → 0

    // Background gradient (mood-graded)
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, rgbCss(cw.bgGlow));
    grad.addColorStop(0.5, rgbCss(cw.bgDeep));
    grad.addColorStop(1, rgbCss(cw.bgDeep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Beat-synced ambient flash — the whole scene breathes on the tempo (subtle).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgbCss(cw.glow, 0.02 + beatPulse * 0.05 * (0.4 + moodNorm));
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();

    this.drawFlow(cw.particle, moodNorm);

    const comboGlow = this.combo >= 100 ? 1 : this.combo >= 50 ? 0.6 : 0;
    this.drawPlayfield(cw, moodNorm, beatPulse);
    this.drawLanes(cw, comboGlow);
    this.particles.draw(ctx, cw.particle, moodNorm, false);
    this.drawNotes(songMs);
    this.drawReceptors(cw, moodNorm, beatPulse);
    this.drawGauge(cw, moodNorm);
    if (this.combo >= 100) this.drawSideSparkles(songMs);
    this.drawCombo(moodNorm, cw.glow);
    this.drawFloaters();
    this.drawMissFlash();
    this.drawEncouragement();
  }

  /** Dark vertical playfield panel so the bright arrows pop (DDR keeps a dim column strip). */
  private drawPlayfield(cw: ReturnType<typeof moodColorway>, moodNorm: number, beatPulse: number): void {
    const ctx = this.ctx;
    const top = this.receptorY - this.laneW * 0.7;
    const g = ctx.createLinearGradient(0, top, 0, this.spawnY + 30);
    g.addColorStop(0, 'rgba(3,4,12,0.15)');
    g.addColorStop(0.5, 'rgba(3,4,12,0.5)');
    g.addColorStop(1, 'rgba(3,4,12,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, this.w, this.spawnY - top + 30);

    // Beat-synced glow bar across the receptor line.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgbCss(cw.glow, (0.05 + moodNorm * 0.08) * (0.4 + beatPulse * 0.6));
    ctx.fillRect(0, this.receptorY - this.laneW * 0.55, this.w, this.laneW * 1.1);
    ctx.restore();
  }

  private drawFlow(color: RGB, moodNorm: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.flowStars) {
      const tw = 0.55 + 0.45 * Math.sin(s.tw);
      const a = (0.05 + s.z * 0.18) * tw * (0.6 + moodNorm * 0.5);
      ctx.fillStyle = rgbCss(color, a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLanes(cw: ReturnType<typeof moodColorway>, comboGlow: number): void {
    const ctx = this.ctx;
    const top = this.receptorY - this.laneW * 0.7;
    const bot = this.spawnY + 30;
    // Vertical lane dividers (flat — DDR columns).
    for (let i = 0; i <= this.laneCount; i++) {
      const x = i * this.laneW;
      const lg = ctx.createLinearGradient(0, top, 0, bot);
      lg.addColorStop(0, `rgba(255,255,255,${0.12 + comboGlow * 0.2})`);
      lg.addColorStop(1, 'rgba(255,255,255,0.03)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = i === 0 || i === this.laneCount ? 2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bot);
      ctx.stroke();
    }
    // Combo glow columns at 50+/100+.
    if (comboGlow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i <= this.laneCount; i++) {
        const x = i * this.laneW;
        ctx.strokeStyle = rgbCss(lightenRGB(cw.glow, 0.3), 0.12 * comboGlow);
        ctx.lineWidth = 4 + comboGlow * 5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bot);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Pressed-lane wash (from receptor downward).
    for (let lane = 0; lane < this.laneCount; lane++) {
      const flash = this.laneFlash[lane];
      if (flash <= 0.01) continue;
      const cx = this.laneCenterX(lane);
      const wash = ctx.createLinearGradient(0, this.receptorY, 0, bot);
      wash.addColorStop(0, rgbCss(cw.glow, 0.22 * flash));
      wash.addColorStop(1, rgbCss(cw.glow, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(cx - this.laneW / 2, this.receptorY, this.laneW, bot - this.receptorY);
    }
  }

  private drawNotes(songMs: number): void {
    const ctx = this.ctx;
    const tapMs = songMs - this.opts.latencyOffsetMs;
    const goodWin = this.diffChart.hitWindowMs.good;
    const rainbow = this.combo >= 100;
    const rainbowHi = Math.floor(songMs / 110) % RAINBOW.length;
    const noteSize = this.laneW * 0.62;

    const colorFor = (n: RuntimeNote): RGB => (rainbow ? RAINBOW[rainbowHi] : NOTE_COLORS[n.colorClass]);
    const keyFor = (n: RuntimeNote): number => (rainbow ? 100 + rainbowHi : n.colorClass);
    const now = performance.now();

    // Freeze (hold) bodies first, behind the note heads. You must HOLD the whole way down;
    // a dropped freeze turns red and fades so the miss is unmistakable.
    for (const n of this.notes) {
      if (!n.isHold || n.holdDone) continue;
      const broken = n.holdBroken;
      const brokenAge = broken ? now - n.holdBrokenAt : 0;
      if (broken && brokenAge > 480) continue;
      const headDelta = n.timeMs - tapMs;
      const tailDelta = n.holdEndMs - tapMs;
      if (n.isSlide) {
        // Visible for the whole approach so you can read the drag path coming.
        if (!broken && (headDelta > APPROACH_MS || tailDelta < -goodWin)) continue;
        this.drawSlideBody(n, tapMs, songMs, broken, brokenAge);
        continue;
      }
      if (!broken && (tailDelta > APPROACH_MS || headDelta < -goodWin)) continue;
      const pHead = Math.max(0, Math.min(1, this.progressFor(headDelta)));
      const pTail = Math.max(0, Math.min(1, this.progressFor(tailDelta)));
      const yHead = n.holdActive ? this.receptorY : this.yFor(pHead);
      const yTail = this.yFor(pTail);
      const x = this.laneCenterX(n.lane);
      const wBar = this.laneW * 0.34;
      const active = n.holdActive;
      const top = Math.min(yHead, yTail);
      const bot = Math.max(yHead, yTail);
      const r = wBar / 2;
      const pulse = active ? 0.78 + 0.22 * Math.sin(songMs / 80) : 1;
      const body = broken ? FREEZE_FAIL : FREEZE_BODY;

      ctx.save();
      if (broken) ctx.globalAlpha = Math.max(0, 1 - brokenAge / 480);
      const grad = ctx.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, rgbCss(lightenRGB(body, 0.2), (active ? 0.95 : 0.72) * pulse));
      grad.addColorStop(1, rgbCss(darkenRGB(body, 0.25), active ? 0.9 : 0.6));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x - r, top, wBar, Math.max(4, bot - top), r);
      ctx.fill();
      ctx.strokeStyle = rgbCss(lightenRGB(body, active ? 0.6 : 0.3), active ? 0.95 : 0.7);
      ctx.lineWidth = active ? 4 : 2.5;
      ctx.stroke();
      // Flowing shimmer down the body (arrows off when broken).
      if (!broken) {
        ctx.setLineDash([9, 11]);
        ctx.lineDashOffset = (songMs / 10) % 20;
        ctx.strokeStyle = `rgba(255,255,255,${active ? 0.6 : 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, top + r);
        ctx.lineTo(x, bot - r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Round disco-ball note heads (rising up the lanes).
    for (const n of this.notes) {
      if (n.judged && !n.holdActive) continue;
      if (n.holdActive) {
        // While held, the head rides the receptor line — and for a slide it slides sideways to
        // the lane you must currently be on, showing you where to drag.
        const beat = 1 + 0.06 * Math.sin(songMs / 90);
        const followLane = n.isSlide ? this.laneAt(n, tapMs) : n.lane;
        const sprite = this.getDotSprite(keyFor(n), colorFor(n));
        this.blitDot(sprite, this.laneCenterX(followLane), this.receptorY, noteSize * 1.06 * beat, 1);
        continue;
      }
      const delta = n.timeMs - tapMs;
      if (delta > APPROACH_MS || delta < -goodWin) continue;
      const p = this.progressFor(delta);
      const y = this.yFor(p);
      const x = this.laneCenterX(n.lane);
      const alpha = Math.min(1, p * 6); // fade in as it appears at the bottom
      const sprite = this.getDotSprite(keyFor(n), colorFor(n));
      this.blitDot(sprite, x, y, noteSize, alpha);
    }
  }

  private blitDot(sprite: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  /** A SLIDE body: a thick ribbon that snakes across lanes along the note's path (drag to follow). */
  private drawSlideBody(n: RuntimeNote, tapMs: number, songMs: number, broken: boolean, brokenAge: number): void {
    const ctx = this.ctx;
    const active = n.holdActive;
    const startT = active ? tapMs : n.timeMs; // from the receptor if held, else from the head
    const endT = Math.min(n.holdEndMs, tapMs + APPROACH_MS);
    if (endT <= startT) return;
    const wBar = this.laneW * 0.3;
    const body = broken ? FREEZE_FAIL : FREEZE_BODY;
    const N = 20;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const t = startT + ((endT - startT) * i) / N;
      const p = Math.max(0, Math.min(1, this.progressFor(t - tapMs)));
      pts.push([this.laneCenterX(this.laneAt(n, t)), this.yFor(p)]);
    }
    ctx.save();
    if (broken) ctx.globalAlpha = Math.max(0, 1 - brokenAge / 480);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    // Thick body.
    ctx.strokeStyle = rgbCss(lightenRGB(body, active ? 0.35 : 0.18), active ? 0.92 : 0.66);
    ctx.lineWidth = wBar;
    ctx.stroke();
    // Bright core.
    ctx.strokeStyle = rgbCss(lightenRGB(body, active ? 0.8 : 0.55), active ? 0.95 : 0.75);
    ctx.lineWidth = wBar * 0.34;
    ctx.stroke();
    // Flowing shimmer (off when broken).
    if (!broken) {
      ctx.setLineDash([9, 12]);
      ctx.lineDashOffset = (songMs / 10) % 21;
      ctx.strokeStyle = `rgba(255,255,255,${active ? 0.65 : 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Stationary ring receptors at the top; pulse on the beat, burst on a hit. */
  private drawReceptors(cw: ReturnType<typeof moodColorway>, moodNorm: number, beatPulse: number): void {
    const ctx = this.ctx;
    for (let lane = 0; lane < this.laneCount; lane++) {
      const x = this.laneCenterX(lane);
      const y = this.receptorY;
      const pop = this.hitPop[lane];
      const rr = this.laneW * 0.3 * (1 + beatPulse * 0.08 + pop * 0.22);

      // Soft persistent halo so the target is always legible.
      const halo = ctx.createRadialGradient(x, y, 0, x, y, this.laneW * 0.5);
      halo.addColorStop(0, rgbCss(cw.glow, 0.1 + beatPulse * 0.08 + pop * 0.3));
      halo.addColorStop(1, rgbCss(cw.glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - this.laneW * 0.5, y - this.laneW * 0.5, this.laneW, this.laneW);

      // Ring target — outer ring, faint inner disc, center pip.
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + moodNorm * 0.25})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.94, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgbCss(lightenRGB(cw.glow, 0.3), 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rr * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // Hit burst — bright ring flash + expanding ring.
      if (pop > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgbCss(lightenRGB(cw.glow, 0.5), 0.85 * pop);
        ctx.lineWidth = 4 + pop * 3;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgbCss(lightenRGB(cw.glow, 0.4), 0.5 * pop);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, this.laneW * (0.32 + (1 - pop) * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** DDR-style "GROOVE" dance gauge driven by the mood meter. */
  private drawGauge(cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    const labelW = 62;
    const x = 16 + labelW;
    const y = this.gaugeY;
    const w = this.w - 16 - x;
    const h = 10;
    const danger = moodNorm < 0.3;

    // "GROOVE" label.
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = danger ? `rgba(255,90,110,${0.7 + 0.3 * Math.abs(Math.sin(performance.now() / 200))})` : rgbCss(lightenRGB(cw.glow, 0.3), 0.85);
    ctx.fillText('GROOVE', 16, y + h / 2);
    ctx.restore();

    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    // Fill (mood-colored when healthy, hot + pulsing in the danger zone).
    const fillW = Math.max(0, Math.min(1, moodNorm)) * w;
    if (fillW > 2) {
      ctx.save();
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      if (danger) {
        g.addColorStop(0, '#ff5566');
        g.addColorStop(1, '#ffb144');
        ctx.globalAlpha = 0.7 + 0.3 * Math.abs(Math.sin(performance.now() / 160));
      } else {
        g.addColorStop(0, rgbCss(cw.glow));
        g.addColorStop(1, rgbCss(lightenRGB(cw.note, 0.2)));
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, fillW, h, h / 2);
      ctx.fill();
      // Bright leading edge.
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.roundRect(x + fillW - 3, y, 3, h, 1.5);
      ctx.fill();
      ctx.restore();
    }
    // Segment ticks.
    ctx.strokeStyle = 'rgba(4,5,14,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 12; i++) {
      const tx = x + (w / 12) * i;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx, y + h);
      ctx.stroke();
    }
  }

  /** Big centered combo counter (number over "COMBO"), below the receptors. */
  private drawCombo(moodNorm: number, glow: RGB): void {
    if (this.combo < 2) return;
    const ctx = this.ctx;
    const scale = (1 + (Math.min(this.combo, 100) / 100) * 0.5 + moodNorm * 0.18) * (1 + this.comboPop * 0.12);
    const size = 48 * scale;
    const cx = this.w / 2;
    const cy = this.h * 0.44;
    const tier = this.combo >= 100 ? RAINBOW[Math.floor(performance.now() / 110) % RAINBOW.length] : glow;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Soft colored glow behind the number.
    ctx.font = `900 italic ${size}px system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(tier, 0.32);
    ctx.fillText(`${this.combo}`, cx, cy + 2);
    // Dark outline for readability against bright arrows, then a bright white face.
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = 'rgba(4,5,14,0.65)';
    ctx.strokeText(`${this.combo}`, cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(`${this.combo}`, cx, cy);
    // "COMBO" label.
    ctx.font = `800 ${size * 0.26}px system-ui, sans-serif`;
    ctx.lineWidth = size * 0.05;
    ctx.strokeText('COMBO', cx, cy + size * 0.56);
    ctx.fillStyle = rgbCss(lightenRGB(tier, 0.2), 0.97);
    ctx.fillText('COMBO', cx, cy + size * 0.56);
    ctx.restore();
  }

  private drawFloaters(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const a = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.globalAlpha = a;
      // Punch-in: the label slams big at spawn, then settles within the first ~18% of its life.
      const age = 1 - f.life;
      const punch = age < 0.18 ? 1 + ((0.18 - age) / 0.18) * (f.big ? 0.4 : 0.28) : 1;
      const isMiss = f.text === 'MISS';
      const size = (f.big ? 30 : 22) * punch + (isMiss ? Math.sin(f.life * 40) * (1 - f.life) * 4 : 0);
      const shake = isMiss ? Math.sin(f.life * 40) * (1 - f.life) * 5 : 0;
      ctx.font = `900 italic ${size}px system-ui, sans-serif`;
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = 'rgba(4,5,14,0.6)';
      ctx.strokeText(f.text, f.x + shake, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x + shake, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Red vignette pulse at the screen edges when you miss. */
  private drawMissFlash(): void {
    if (this.missFlash <= 0.01) return;
    const ctx = this.ctx;
    const a = this.missFlash;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.28, this.w / 2, this.h / 2, this.h * 0.62);
    g.addColorStop(0, 'rgba(255,40,70,0)');
    g.addColorStop(1, `rgba(255,30,60,${0.5 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawEncouragement(): void {
    const now = performance.now();
    if (now >= this.encourageUntil) return;
    const remain = (this.encourageUntil - now) / 1600;
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = 1 + (1 - remain) * 0.15;
    ctx.globalAlpha = Math.min(1, remain * 2);
    ctx.font = `900 italic ${Math.round(40 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,120,140,0.35)';
    ctx.fillText(this.encourageText, this.w / 2, this.h * 0.56);
    ctx.fillStyle = '#ffe28a';
    ctx.fillText(this.encourageText, this.w / 2, this.h * 0.56 - 2);
    ctx.restore();
  }

  private drawSideSparkles(songMs: number): void {
    if (this.opts.visualIntensity < 0.4) return;
    const ctx = this.ctx;
    const per = 9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hueBase = Math.floor(songMs / 110) % RAINBOW.length;
    for (let side = 0; side < 2; side++) {
      const baseX = side === 0 ? 14 : this.w - 14;
      for (let i = 0; i < per; i++) {
        const seed = i * 97 + side * 13;
        const t = ((songMs / 1400) + i / per) % 1;
        const y = this.h - t * this.h;
        const x = baseX + Math.sin(songMs / 300 + seed) * 10;
        const tw = 0.5 + 0.5 * Math.sin(songMs / 120 + seed);
        const col = RAINBOW[(hueBase + i) % RAINBOW.length];
        const rr = 1.5 + tw * 2.5;
        ctx.fillStyle = rgbCss(col, 0.5 * tw);
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawPausedTint(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3,4,12,0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
