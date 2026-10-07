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
  ownerPtr: number; // the specific finger/pointer holding this sustain (-1 = none)
  ownerLane: number; // that finger's current lane — must track the moving point to keep the slide
  endLane: number; // the lane a slide finishes on (= lane for taps/holds)
  hasEndCap: boolean; // a slide whose tail lands on a tap you must press to finish
  isSlideEnd: boolean; // a tap that caps the end of a slide (telegraphed specially)
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
const SLIDE_GRACE_MS = 360; // how long the tracking finger can be off the path before it breaks (forgiving)
const SLIDE_TOL = 1.1; // how far (in lanes) the tracking finger may trail the moving point (forgiving)
const HOLD_RELEASE_WINDOW = 180; // lifting within this of the end still completes the sustain
const DOT_SPRITE_SIZE = 320; // high-res note sprites (≈3× display size) so orbs/stars stay razor-crisp

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
const HOLD_BODY: RGB = [64, 255, 242]; // hold (freeze) bodies — bright electric cyan, glowing hot
const SLIDE_BODY: RGB = [255, 108, 220]; // slide bodies — hot neon magenta, clearly different from holds
const FREEZE_FAIL: RGB = [255, 60, 80]; // a sustain turns red when you drop it

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
  private pointers = new Map<number, number>(); // active fingers → the lane each is currently over
  private activeSustains: RuntimeNote[] = []; // holds + slides currently being held

  private flowStars: FlowStar[] = [];
  private sparkRings: { x: number; y: number; t0: number }[] = []; // brief gold-dust fizzle on each hit
  private dotSprites = new Map<number, HTMLCanvasElement>();
  private swirlSprites = new Map<number, HTMLCanvasElement>();
  private starSprites = new Map<number, HTMLCanvasElement>(); // glowing 3D stars (100+ combo)

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
        ownerPtr: -1,
        ownerLane: -1,
        endLane: isSlide && n.path && n.path.length >= 2 ? clampLane(n.path[n.path.length - 1].lane) : lane,
        hasEndCap: false,
        isSlideEnd: false,
      };
    });
    // Link each slide to the tap that caps its end (same lane as the slide finishes, landing within
    // a small window of the slide's tail). Both get telegraphed so it's obvious you tap to finish.
    for (const s of this.notes) {
      if (!s.isSlide) continue;
      const endT = s.holdEndMs;
      for (const t of this.notes) {
        if (t === s || t.isHold) continue;
        if (t.lane === s.endLane && Math.abs(t.timeMs - endT) <= 140) {
          s.hasEndCap = true;
          t.isSlideEnd = true;
          break;
        }
      }
    }
    this.resize();
  }

  resize(): void {
    const { canvas } = this.opts;
    const rect = canvas.getBoundingClientRect();
    // Render density is capped at 2× — the scene is gradient/effect-heavy, and a full 3× backing
    // store (≈2.25× more pixels to fill every frame) is the single biggest cause of lag on phones.
    // 2× still looks crisp; sprites are pre-rendered at high resolution so they stay sharp.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    canvas.width = Math.round(this.w * this.dpr);
    canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'medium';
    this.particles.resize(this.w, this.h);
    this.dotSprites.clear();
    this.swirlSprites.clear();
    this.starSprites.clear();
    this.initFlow();
  }

  private initFlow(): void {
    const count = Math.round(44 * this.opts.visualIntensity);
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
    this.swirlSprites.clear();
    this.starSprites.clear();
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

  // ---- input (per-finger, so slides require a real drag) --------------
  private syncPressed(): void {
    this.lanePressed.fill(false);
    for (const l of this.pointers.values()) {
      if (l >= 0 && l < this.laneCount) this.lanePressed[l] = true;
    }
  }

  /** A finger goes down on `lane`. Judges a tap/sustain-head there and, if it starts a sustain,
   *  binds THIS finger as the one that must hold/drag it to the end. */
  pointerDown(ptr: number, lane: number): void {
    if (!this.running || this.paused || this.finished) return;
    if (lane < 0 || lane >= this.laneCount) return;
    this.pointers.set(ptr, lane);
    this.syncPressed();
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
      // This finger now owns the sustain; updateSustains() keeps it alive only while THIS finger
      // stays on the moving point (so a slide must be dragged, not two-finger-held).
      n.holdActive = true;
      n.graceMs = 0;
      n.ownerPtr = ptr;
      n.ownerLane = lane;
      if (!this.activeSustains.includes(n)) this.activeSustains.push(n);
    }
  }

  /** A held finger moves to a new lane (dragging). Updates the lane of any sustain it owns. */
  pointerMove(ptr: number, lane: number): void {
    if (!this.pointers.has(ptr)) return;
    if (lane < 0 || lane >= this.laneCount) return;
    this.pointers.set(ptr, lane);
    this.syncPressed();
    this.laneFlash[lane] = 1;
    for (const n of this.activeSustains) {
      if (n.ownerPtr === ptr) n.ownerLane = lane;
    }
  }

  /** A finger lifts. Any sustain it owns resolves now — O.K. if it reached (near) the end, else
   *  BAD (you let go before finishing the drag). */
  pointerUp(ptr: number): void {
    if (!this.pointers.has(ptr)) return;
    this.pointers.delete(ptr);
    this.syncPressed();
    if (!this.running || this.paused || this.finished) return;
    const t = this.opts.clock.getPositionMs() - this.opts.latencyOffsetMs;
    for (const n of [...this.activeSustains]) {
      if (n.ownerPtr !== ptr) continue;
      if (t >= n.holdEndMs - HOLD_RELEASE_WINDOW) this.completeHold(n);
      else this.breakHold(n);
    }
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
      // Brief gold-dust fizzle ring right where the note was hit (the orb "sparkles out").
      this.sparkRings.push({ x, y: this.receptorY, t0: performance.now() });
      if (this.sparkRings.length > 40) this.sparkRings.shift();
      this.comboPop = Math.max(this.comboPop, 1); // combo-counter kick
      // MARVELOUS is a cosmetic top tier for a very tight Perfect.
      const marvelous = j === 'perfect' && err <= this.diffChart.hitWindowMs.perfect * 0.5;
      this.spawnFloater(
        marvelous ? 'MARVELOUS' : JUDGE_LABEL[j],
        marvelous ? MARVELOUS_COLOR : JUDGE_COLORS[j],
        j !== 'good',
      );
      // Combo-tier milestones — visual only, no chime. 50 = HOT COMBO (rainbow notes + sparkles +
      // grid glow); 100 = STAR POWER (note heads become glowing swirling stars).
      if (this.combo >= 100 && this.lastComboTier < 100) {
        this.lastComboTier = 100;
        this.comboPop = 1.8;
        this.spawnFloater('STAR POWER!', MARVELOUS_COLOR, true);
      } else if (this.combo >= 50 && this.lastComboTier < 50) {
        this.lastComboTier = 50;
        this.comboPop = 1.8;
        this.spawnFloater('HOT COMBO!', '#ff8a3c', true);
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
    n.ownerPtr = -1;
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
    n.ownerPtr = -1;
    n.holdBrokenAt = performance.now();
    this.activeSustains = this.activeSustains.filter((s) => s !== n);
    this.combo = 0; // dropping a hold/slide breaks the streak
    this.lastComboTier = 0;
    this.consecutiveMiss += 1;
    this.missFlash = 1;
    // Unmistakable "you let go / wandered off the path" feedback — red flash + "BAD".
    this.spawnFloater('BAD', '#ff4d6a', true);
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
      // The OWNING finger must stay on the moving point: for a straight hold that's its lane; for a
      // slide it's the point travelling across the lanes, so you must drag to follow it. If that
      // finger lifted (shouldn't reach here — pointerUp resolves it) treat it as gone.
      if (n.ownerPtr < 0 || !this.pointers.has(n.ownerPtr)) {
        this.breakHold(n);
        continue;
      }
      const reqF = this.laneAt(n, t);
      if (Math.abs(n.ownerLane - reqF) <= SLIDE_TOL) {
        n.graceMs = 0;
      } else {
        n.graceMs += dt;
        if (n.graceMs > SLIDE_GRACE_MS) this.breakHold(n); // drifted off the path → BAD
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

  // ---- glowing 3D orb sprite cache -----------------------------------
  /** A smooth luminous 3D orb (glass sphere with an inner glow) in the beat color. The swirling
   *  flow inside is a separate sprite (getSwirlSprite) blitted rotating on top each frame. */
  private getOrbSprite(key: number, color: RGB): HTMLCanvasElement {
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
    const bright = lightenRGB(color, 0.75);
    const deep = darkenRGB(color, 0.55);

    // 1) Outer glow halo.
    c.save();
    c.shadowColor = rgbCss(bright, 1);
    c.shadowBlur = S * 0.32;
    c.fillStyle = rgbCss(color, 0.85);
    c.beginPath();
    c.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 2) Luminous sphere body — bright core (offset up-left) fading to a deep rim = 3D + inner glow.
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.08, cx, cy, R * 1.05);
    g.addColorStop(0, rgbCss(lightenRGB(color, 0.9), 1));
    g.addColorStop(0.35, rgbCss(bright, 1));
    g.addColorStop(0.7, rgbCss(color, 1));
    g.addColorStop(1, rgbCss(deep, 1));
    c.fillStyle = g;
    c.fillRect(cx - R, cy - R, R * 2, R * 2);

    // 3) Rim light along the lower-right edge (glassy sphere).
    c.strokeStyle = rgbCss(lightenRGB(color, 0.6), 0.5);
    c.lineWidth = S * 0.03;
    c.beginPath();
    c.arc(cx, cy, R * 0.94, Math.PI * 0.05, Math.PI * 0.95);
    c.stroke();
    c.restore();

    // 4) Soft specular hotspot, top-left, for the glossy pop.
    const hl = c.createRadialGradient(cx - R * 0.38, cy - R * 0.42, 0, cx - R * 0.38, cy - R * 0.42, R * 0.6);
    hl.addColorStop(0, 'rgba(255,255,255,0.9)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl;
    c.beginPath();
    c.arc(cx - R * 0.34, cy - R * 0.36, R * 0.42, 0, Math.PI * 2);
    c.fill();

    // 5) Thin dark edge so it reads cleanly on bright lanes.
    c.strokeStyle = 'rgba(0,0,0,0.28)';
    c.lineWidth = S * 0.016;
    c.beginPath();
    c.arc(cx, cy, R + S * 0.006, 0, Math.PI * 2);
    c.stroke();

    this.dotSprites.set(key, cv);
    return cv;
  }

  /** The swirling energy inside the orb: soft luminous arms spiralling out from a bright core, on a
   *  transparent disc. Blitted with 'lighter' and rotated over time so the flow appears to churn. */
  private getSwirlSprite(key: number, color: RGB): HTMLCanvasElement {
    const cached = this.swirlSprites.get(key);
    if (cached) return cached;
    const S = DOT_SPRITE_SIZE;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const c = cv.getContext('2d')!;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.32;
    const wisp = lightenRGB(color, 0.55);
    c.lineCap = 'round';

    // Fade everything toward the rim so the swirl stays inside the glass.
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();

    // 3 spiral arms.
    const arms = 3;
    for (let a = 0; a < arms; a++) {
      const a0 = (a / arms) * Math.PI * 2 + (key % 3) * 0.4;
      c.beginPath();
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const rad = R * (0.12 + 0.82 * t);
        const ang = a0 + t * 2.4; // ~140° of curl
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.shadowColor = rgbCss(wisp, 1);
      c.shadowBlur = S * 0.06;
      // wide soft base
      c.strokeStyle = rgbCss(wisp, 0.28);
      c.lineWidth = S * 0.06;
      c.stroke();
      // bright thin core
      c.strokeStyle = rgbCss(lightenRGB(color, 0.85), 0.6);
      c.lineWidth = S * 0.022;
      c.stroke();
    }

    // Bright luminous core.
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.4);
    core.addColorStop(0, 'rgba(255,255,255,0.85)');
    core.addColorStop(0.5, rgbCss(lightenRGB(color, 0.7), 0.5));
    core.addColorStop(1, rgbCss(color, 0));
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, R * 0.4, 0, Math.PI * 2);
    c.fill();
    c.restore();

    this.swirlSprites.set(key, cv);
    return cv;
  }

  /** A glowing 3D five-point star in the beat color — used for note heads once the combo passes
   *  100 ("star power"). Bevelled with a bright up-left core → deep rim for depth, wrapped in a
   *  colored glow. The swirl sprite still churns on top so the stars read as living energy. */
  private getStarSprite(key: number, color: RGB): HTMLCanvasElement {
    const cached = this.starSprites.get(key);
    if (cached) return cached;
    const S = DOT_SPRITE_SIZE;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const c = cv.getContext('2d')!;
    const cx = S / 2;
    const cy = S / 2;
    const outer = S * 0.4;
    const inner = outer * 0.46;
    const bright = lightenRGB(color, 0.8);
    const deep = darkenRGB(color, 0.5);

    const starPath = (ro: number, ri: number) => {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? ro : ri;
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
    };

    // 1) Outer glow halo in the star shape.
    c.save();
    c.shadowColor = rgbCss(bright, 1);
    c.shadowBlur = S * 0.34;
    c.fillStyle = rgbCss(color, 0.9);
    starPath(outer * 0.92, inner * 0.92);
    c.fill();
    c.restore();

    // 2) 3D body: a radial gradient offset up-left (lit core → deep rim) clipped to the star.
    c.save();
    starPath(outer, inner);
    c.clip();
    const g = c.createRadialGradient(cx - outer * 0.3, cy - outer * 0.34, outer * 0.06, cx, cy, outer * 1.05);
    g.addColorStop(0, rgbCss(lightenRGB(color, 0.95), 1));
    g.addColorStop(0.35, rgbCss(bright, 1));
    g.addColorStop(0.7, rgbCss(color, 1));
    g.addColorStop(1, rgbCss(deep, 1));
    c.fillStyle = g;
    c.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
    c.restore();

    // 3) Bright edge stroke + thin dark keyline so it reads on any lane.
    starPath(outer, inner);
    c.strokeStyle = rgbCss(lightenRGB(color, 0.7), 0.85);
    c.lineWidth = S * 0.02;
    c.lineJoin = 'round';
    c.stroke();
    starPath(outer + S * 0.004, inner);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = S * 0.012;
    c.stroke();

    // 4) Specular pop on the top-left point.
    const hl = c.createRadialGradient(cx - outer * 0.3, cy - outer * 0.4, 0, cx - outer * 0.3, cy - outer * 0.4, outer * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.85)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl;
    c.beginPath();
    c.arc(cx - outer * 0.28, cy - outer * 0.34, outer * 0.34, 0, Math.PI * 2);
    c.fill();

    this.starSprites.set(key, cv);
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

    // Combo tiers: 50 = "hot combo" (rainbow notes + side sparkles + grid glow), 100 = star power
    // (notes become glowing swirling stars, grid glow maxes out).
    const comboGlow = this.combo >= 100 ? 1 : this.combo >= 50 ? 0.7 : 0;
    this.drawPlayfield(cw, moodNorm, beatPulse);
    this.drawGridRoad(cw, songMs, beatPulse, moodNorm, comboGlow);
    this.drawLanes(cw, comboGlow, beatPulse, moodNorm);
    this.particles.draw(ctx, cw.particle, moodNorm, false);
    this.drawNotes(songMs);
    this.drawReceptors(cw, moodNorm, beatPulse);
    this.drawHitSparks(performance.now());
    this.drawGauge(cw, moodNorm);
    if (this.combo >= 50) this.drawSideSparkles(songMs);
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

  /** A full synthwave / retrowave scene BEHIND the flat note grid: a neon grid road flowing toward
   *  the viewer, a banded retro SUN on the horizon, glowing wireframe MOUNTAINS, and a STARFIELD —
   *  the note grid floats above it (lo-fi music-video look). The grid stays matrix-green; the sun,
   *  mountains and reflection take the song's palette so each track gets its own neon sky. No car. */
  private drawGridRoad(cw: ReturnType<typeof moodColorway>, songMs: number, beatPulse: number, moodNorm: number, comboGlow: number): void {
    const ctx = this.ctx;
    const top = this.receptorY - this.laneW * 0.7; // horizon (far)
    const bot = this.spawnY + 30; // near / viewer
    const h = bot - top;
    if (h <= 10) return;
    const cx = this.w / 2;
    const GREEN: RGB = [46, 255, 128];
    const DIM: RGB = [18, 132, 70];
    const RAIN: RGB = [150, 255, 180];
    const sunCol = cw.glow;
    const sunHot = lightenRGB(cw.glow, 0.85);
    const mtnCol = lightenRGB(cw.note, 0.35);
    const pulse = 0.6 + beatPulse * 0.4;
    const fOuter = this.laneW * (this.laneCount / 2 + 4.5); // very wide near plane = road opens up at you
    const depthX = (f: number, sf: number) => cx + f * (0.006 + 0.994 * sf); // strong convergence to a point
    const skyTop = Math.max(this.gaugeY + 14, top - this.h * 0.14); // sky band above the horizon

    // ======================= SKY (farthest — sun, mountains, stars) ===================
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, skyTop, this.w, top - skyTop);
    ctx.clip();
    // Dark sky with a warm glow pooling at the horizon.
    const sky = ctx.createLinearGradient(0, skyTop, 0, top);
    sky.addColorStop(0, 'rgba(0,1,6,0.92)');
    sky.addColorStop(1, rgbCss(darkenRGB(sunCol, 0.55), 0.85));
    ctx.fillStyle = sky;
    ctx.fillRect(0, skyTop, this.w, top - skyTop);

    // Stars (deterministic positions, twinkling).
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < 64; s++) {
      const sx = (Math.sin(s * 12.9898) * 0.5 + 0.5) * this.w;
      const sy = skyTop + (Math.sin(s * 78.233) * 0.5 + 0.5) * (top - skyTop) * 0.95;
      const tw = 0.4 + 0.6 * (Math.sin(songMs / 600 + s) * 0.5 + 0.5);
      const r = 0.7 + (Math.sin(s * 3.7) * 0.5 + 0.5) * 0.9;
      ctx.fillStyle = `rgba(220,240,255,${0.5 * tw})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Banded retro SUN rising from the horizon — wide radius so a big, prominent half-sun fills the
    // horizon (most of the disc sits below it, the classic synthwave sunset).
    const sunR = this.laneW * 1.35;
    const sunGlow = ctx.createRadialGradient(cx, top, 0, cx, top, sunR * 1.7);
    sunGlow.addColorStop(0, rgbCss(sunHot, 0.6 * pulse + comboGlow * 0.2));
    sunGlow.addColorStop(0.5, rgbCss(sunCol, 0.28 * pulse));
    sunGlow.addColorStop(1, rgbCss(sunCol, 0));
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, skyTop, this.w, top - skyTop);
    // Sun disc.
    ctx.globalCompositeOperation = 'source-over';
    const disc = ctx.createLinearGradient(cx, top - sunR, cx, top);
    disc.addColorStop(0, rgbCss(sunHot, 1));
    disc.addColorStop(0.55, rgbCss(sunCol, 1));
    disc.addColorStop(1, rgbCss(darkenRGB(sunCol, 0.2), 1));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, top, sunR, Math.PI, 2 * Math.PI);
    ctx.fill();
    // Scanline bands cut across the lower part of the sun (classic synthwave sun).
    ctx.fillStyle = 'rgba(0,1,6,0.92)';
    for (let b = 0; b < 9; b++) {
      const by = top - (b * b) * (sunR * 0.012) - 1;
      const bh = 1.5 + b * 0.6;
      if (by < top - sunR) break;
      ctx.fillRect(cx - sunR, by - bh, sunR * 2, bh);
    }

    // Glowing wireframe MOUNTAINS along the horizon (far dim ridge, near bright ridge).
    const drawRidge = (maxH: number, col: RGB, alpha: number, seedOff: number, lw: number) => {
      const steps = 30;
      ctx.beginPath();
      ctx.moveTo(0, top);
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * this.w;
        const n =
          Math.sin(i * 1.7 + seedOff) * 0.5 +
          Math.sin(i * 0.6 + seedOff * 2) * 0.32 +
          Math.sin(i * 3.3 + seedOff) * 0.18;
        const hgt = maxH * (0.3 + 0.7 * (n * 0.5 + 0.5));
        ctx.lineTo(x, top - hgt);
      }
      ctx.lineTo(this.w, top);
      ctx.closePath();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,1,5,0.95)'; // black silhouette
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgbCss(col, alpha);
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    drawRidge((top - skyTop) * 0.95, darkenRGB(mtnCol, 0.2), 0.4 * pulse, 2.1, 1.3); // far
    drawRidge((top - skyTop) * 0.62, mtnCol, 0.72 * pulse + comboGlow * 0.15, 11.3, 1.8); // near
    ctx.restore();

    // ============================ ROAD FLOOR ==========================================
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, this.w, h);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Black floor — darkest at the horizon so the grid recedes into black.
    const floor = ctx.createLinearGradient(0, top, 0, bot);
    floor.addColorStop(0, 'rgba(0,0,0,0.92)');
    floor.addColorStop(0.5, 'rgba(0,8,3,0.78)');
    floor.addColorStop(1, 'rgba(0,12,5,0.5)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, top, this.w, h);

    ctx.globalCompositeOperation = 'lighter';

    // Sun reflection shimmering down the floor (palette-colored, narrow at horizon, widening to you).
    const refl = ctx.createLinearGradient(0, top, 0, bot);
    refl.addColorStop(0, rgbCss(sunHot, 0.18 * pulse));
    refl.addColorStop(1, rgbCss(sunCol, 0));
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.moveTo(cx - 3, top);
    ctx.lineTo(cx + 3, top);
    ctx.lineTo(cx + this.laneW * 0.85, bot);
    ctx.lineTo(cx - this.laneW * 0.85, bot);
    ctx.closePath();
    ctx.fill();

    // Converging vertical rails — FEW, WIDE, thick neon lines that strongly converge to the
    // vanishing point (like the reference clips: a big road you're flying straight down).
    for (let i = -2; i <= this.laneCount + 2; i += 1) {
      const xBot = i * this.laneW;
      const f = xBot - cx;
      const edgeFade = 1 - Math.min(1, Math.abs(f) / (this.w * 1.1));
      ctx.strokeStyle = rgbCss(GREEN, (0.06 + 0.2 * edgeFade) * pulse + comboGlow * 0.07);
      ctx.lineWidth = 1.8 + edgeFade * 2.2;
      ctx.beginPath();
      ctx.moveTo(depthX(f, 0), top);
      ctx.lineTo(xBot, bot);
      ctx.stroke();
    }

    // Flowing horizontal rungs — FEW and WIDE APART, with a very steep perspective curve so the
    // cells are tiny at the horizon and huge up close, rushing head-on at you (flying down the road).
    const rungs = 15;
    const speed = 0.00036 + moodNorm * 0.00042; // faster = stronger "coming at you"
    const phase = ((songMs * speed) % 1 + 1) % 1;
    for (let i = 0; i < rungs; i++) {
      const p = (i / rungs + phase) % 1;
      const sf = Math.pow(p, 3.5); // very steep bunching → big near cells
      const y = top + h * sf;
      const halfW = fOuter * (0.006 + 0.994 * sf);
      const a = (0.03 + 0.6 * sf) * pulse + comboGlow * 0.12;
      const col = sf > 0.45 ? GREEN : DIM;
      ctx.strokeStyle = rgbCss(col, a * 0.5); // bloom underlay
      ctx.lineWidth = 2 + sf * 6;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, y);
      ctx.lineTo(cx + halfW, y);
      ctx.stroke();
      ctx.strokeStyle = rgbCss(col, a); // bright core
      ctx.lineWidth = 0.8 + sf * 2.6;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, y);
      ctx.lineTo(cx + halfW, y);
      ctx.stroke();
    }

    // Digital rain — subtle streaks falling down the perspective toward you.
    const drops = this.laneCount * 6;
    for (let d = 0; d < drops; d++) {
      const seed = d * 1.37;
      const lane01 = Math.sin(seed * 12.9) * 0.5 + 0.5;
      const f = (lane01 - 0.5) * 2 * fOuter;
      const t = ((songMs * (0.0003 + Math.abs(Math.sin(seed)) * 0.00018)) + (seed % 1)) % 1;
      const sf = Math.pow(t, 2.6);
      const y = top + h * sf;
      const x = depthX(f, sf);
      const len = 6 + sf * 26;
      ctx.strokeStyle = rgbCss(RAIN, (0.1 + 0.62 * sf) * pulse);
      ctx.lineWidth = 0.8 + sf * 1.9;
      ctx.beginPath();
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();

    // Bright horizon line sealing the sky to the floor.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgbCss(sunHot, 0.55 * pulse + comboGlow * 0.2);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(this.w, top);
    ctx.stroke();
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

  private drawLanes(cw: ReturnType<typeof moodColorway>, comboGlow: number, beatPulse: number, moodNorm: number): void {
    const ctx = this.ctx;
    const top = this.receptorY - this.laneW * 0.7;
    const bot = this.spawnY + 30;
    const glowC = lightenRGB(cw.glow, 0.4);
    // The whole grid breathes on the beat; it swells further at hot/star combo tiers.
    const pulse = 0.55 + beatPulse * 0.45; // 0.55..1 across the beat (always clearly lit)
    const baseGlow = (0.2 + moodNorm * 0.16) * pulse + comboGlow * 0.22;

    // ---- Thick, GLOWING lane lines --------------------------------------------
    // Straight vertical lines with a strong multi-pass bloom (wide halo → mid glow → bright core)
    // so they read as luminous bars clearly in FRONT of the perspective road behind them (the road
    // owns the horizontal lattice now). Finished with a crisp mint keyline.
    const drawLine = (x: number) => {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bot);
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i <= this.laneCount; i++) {
      const x = i * this.laneW;
      // 1) wide outer halo
      drawLine(x);
      ctx.strokeStyle = rgbCss(glowC, baseGlow * 0.4);
      ctx.lineWidth = 20 + comboGlow * 12 + beatPulse * 8;
      ctx.stroke();
      // 2) mid glow
      drawLine(x);
      ctx.strokeStyle = rgbCss(glowC, baseGlow * 0.75);
      ctx.lineWidth = 10 + comboGlow * 7 + beatPulse * 4;
      ctx.stroke();
      // 3) bright core
      drawLine(x);
      ctx.strokeStyle = rgbCss(glowC, baseGlow + 0.22);
      ctx.lineWidth = 5.5 + comboGlow * 5 + beatPulse * 2;
      ctx.stroke();
    }
    ctx.restore();
    // Crisp mint keyline so the lanes stay razor-legible over the glow.
    for (let i = 0; i <= this.laneCount; i++) {
      const edge = i === 0 || i === this.laneCount;
      drawLine(i * this.laneW);
      ctx.strokeStyle = `rgba(214,255,228,${0.32 + comboGlow * 0.25})`;
      ctx.lineWidth = edge ? 4.6 : 3.4;
      ctx.lineCap = 'round';
      ctx.stroke();
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
    const rainbow = this.combo >= 50; // hot combo → rainbow note heads
    const stars = this.combo >= 100; // star power → note heads become glowing swirling stars
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
      // Visible whenever the hold's span overlaps the playfield: draw as soon as the HEAD starts
      // its approach (even if the tail is still far below the screen — long holds trail off the
      // bottom) and keep drawing until the TAIL has fully passed. (The old test culled long holds
      // whose tail hadn't entered yet, so their body/tail went missing until the very end.)
      if (!broken && (headDelta > APPROACH_MS || tailDelta < -goodWin)) continue;
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
      const body = broken ? FREEZE_FAIL : HOLD_BODY;

      ctx.save();
      if (broken) ctx.globalAlpha = Math.max(0, 1 - brokenAge / 480);
      // Cheap hot glow: a wide, soft additive stroke under the body (no shadowBlur — that's a major
      // per-frame cost on phones).
      if (!broken) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgbCss(lightenRGB(body, 0.4), 0.28 * pulse);
        ctx.lineWidth = wBar + (active ? 12 : 7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, top + r);
        ctx.lineTo(x, bot - r);
        ctx.stroke();
        ctx.restore();
      }
      const grad = ctx.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, rgbCss(lightenRGB(body, 0.55), (active ? 1 : 0.9) * pulse));
      grad.addColorStop(1, rgbCss(body, active ? 0.95 : 0.8));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x - r, top, wBar, Math.max(4, bot - top), r);
      ctx.fill();
      ctx.strokeStyle = rgbCss(lightenRGB(body, 0.85), active ? 1 : 0.85);
      ctx.lineWidth = active ? 4 : 3;
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

    // Glowing 3D orb note heads (rising up the lanes), with the energy swirling inside.
    for (const n of this.notes) {
      if (n.judged && !n.holdActive) continue;
      if (n.holdActive) {
        // While held, the head rides the receptor line — and for a slide it slides sideways to
        // the lane you must currently be on, showing you where to drag.
        const beat = 1 + 0.06 * Math.sin(songMs / 90);
        const followLane = n.isSlide ? this.laneAt(n, tapMs) : n.lane;
        this.drawOrb(keyFor(n), colorFor(n), this.laneCenterX(followLane), this.receptorY, noteSize * 1.06 * beat, 1, songMs, n.timeMs, stars);
        continue;
      }
      const delta = n.timeMs - tapMs;
      if (delta > APPROACH_MS || delta < -goodWin) continue;
      const p = this.progressFor(delta);
      const y = this.yFor(p);
      const x = this.laneCenterX(n.lane);
      const alpha = Math.min(1, p * 6); // fade in as it appears at the bottom
      // Floor shadow so each note reads as FLOATING above the lo-fi road behind it.
      this.drawNoteShadow(x, y, noteSize, alpha);
      // End-cap tap (the note that finishes a slide): pulsing white ring so it's obviously a PRESS.
      if (n.isSlideEnd) {
        const pr = 0.5 + 0.5 * Math.sin(songMs / 130);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * pr})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, noteSize * 0.5 + 4 + pr * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      this.drawOrb(keyFor(n), colorFor(n), x, y, noteSize * (n.isSlideEnd ? 1.1 : 1), alpha, songMs, n.timeMs, stars);
    }
  }

  /** A soft elliptical shadow cast below a note onto the road — the grounding cue that makes the
   *  note (and the whole grid) read as floating above the lo-fi floor. */
  private drawNoteShadow(x: number, y: number, size: number, alpha: number): void {
    const ctx = this.ctx;
    const sy = y + size * 0.62;
    const rw = size * 0.44;
    const rh = size * 0.16;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x, sy);
    ctx.scale(1, rh / rw);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, `rgba(0,0,0,${0.5 * alpha})`);
    g.addColorStop(0.6, `rgba(0,0,0,${0.28 * alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Draw a glowing note head plus its swirling inner flow (rotated over time) at (x,y). When
   *  `star` is set (100+ combo) the body is a slowly-spinning glowing 3D star instead of an orb. */
  private drawOrb(key: number, color: RGB, x: number, y: number, size: number, alpha: number, songMs: number, phase: number, star = false): void {
    const ctx = this.ctx;
    if (star) {
      // The whole star gently spins for the "swirling" read.
      const sp = size * 1.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate((songMs * 0.0016 + phase * 0.0013) % (Math.PI * 2));
      ctx.drawImage(this.getStarSprite(key, color), -sp / 2, -sp / 2, sp, sp);
      ctx.restore();
    } else {
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.getOrbSprite(key, color), x - size / 2, y - size / 2, size, size);
    }
    // Swirling energy — rotated by time (+ a per-note phase) and blended additively so it reads as
    // luminous flow churning inside the glass / star.
    const swirl = this.getSwirlSprite(key, color);
    const s = size * (star ? 0.7 : 0.9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.9;
    ctx.translate(x, y);
    ctx.rotate((-songMs * 0.0013 - phase * 0.0011) % (Math.PI * 2));
    ctx.drawImage(swirl, -s / 2, -s / 2, s, s);
    ctx.restore();
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
    const body = broken ? FREEZE_FAIL : SLIDE_BODY;
    const N = 22;
    const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const t = startT + ((endT - startT) * i) / N;
      const p = Math.max(0, Math.min(1, this.progressFor(t - tapMs)));
      pts.push([this.laneCenterX(this.laneAt(n, t)), this.yFor(p)]);
    }
    // Smooth the polyline into a flowing curve (quadratic through segment midpoints) so the ribbon
    // reads as a single smooth stroke rather than faceted segments.
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    };

    ctx.save();
    if (broken) ctx.globalAlpha = Math.max(0, 1 - brokenAge / 480);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1) wide soft outer glow (additive, cheap — no shadowBlur).
    if (!broken) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      trace();
      ctx.strokeStyle = rgbCss(lightenRGB(body, 0.35), active ? 0.26 : 0.18);
      ctx.lineWidth = wBar + (active ? 14 : 9);
      ctx.stroke();
      ctx.restore();
    }
    // 2) glassy body.
    trace();
    ctx.strokeStyle = rgbCss(lightenRGB(body, active ? 0.4 : 0.26), active ? 0.95 : 0.82);
    ctx.lineWidth = wBar;
    ctx.stroke();
    // 3) bright core.
    trace();
    ctx.strokeStyle = rgbCss(lightenRGB(body, 0.9), active ? 1 : 0.92);
    ctx.lineWidth = wBar * 0.3;
    ctx.stroke();
    // 4) thin white sheen + energy flowing along the ribbon (replaces the old cheap dashes).
    if (!broken) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      trace();
      ctx.strokeStyle = `rgba(255,255,255,${active ? 0.5 : 0.3})`;
      ctx.lineWidth = Math.max(1.5, wBar * 0.12);
      ctx.stroke();
      const flow = 3;
      for (let k = 0; k < flow; k++) {
        const f = ((songMs / 620) + k / flow) % 1;
        const idx = Math.min(pts.length - 1, Math.floor(f * (pts.length - 1)));
        const [px, py] = pts[idx];
        ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - f) + 0.2})`;
        ctx.beginPath();
        ctx.arc(px, py, wBar * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5) END NODE — an obvious target where the slide finishes. When a tap caps the end, add a
    //    pulsing outer ring + a down-chevron so it's clear you PRESS to finish.
    const tailIsEnd = n.holdEndMs <= tapMs + APPROACH_MS + 1;
    if (tailIsEnd && !broken) {
      const [ex, ey] = pts[pts.length - 1];
      const pr = 0.5 + 0.5 * Math.sin(songMs / 140);
      const baseR = this.laneW * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgbCss(lightenRGB(body, 0.6), 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey, baseR, 0, Math.PI * 2);
      ctx.stroke();
      if (n.hasEndCap) {
        ctx.strokeStyle = rgbCss(lightenRGB(body, 0.5), 0.3 + 0.4 * pr);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ex, ey, baseR + 5 + pr * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgbCss(lightenRGB(body, 0.85), 0.95);
        ctx.lineWidth = 4;
        const cy = ey - baseR - 9 - pr * 4;
        ctx.beginPath();
        ctx.moveTo(ex - 9, cy - 7);
        ctx.lineTo(ex, cy);
        ctx.lineTo(ex + 9, cy - 7);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /** A brief, premium gold-dust "fizzle" ring right where a note was hit — the orb sparkles out.
   *  Shows for a fraction of a second, slightly smaller than the orb, additive gold for a 3D glow. */
  private drawHitSparks(now: number): void {
    if (!this.sparkRings.length) return;
    const ctx = this.ctx;
    const LIFE = 165;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.sparkRings.length - 1; i >= 0; i--) {
      const s = this.sparkRings[i];
      const age = now - s.t0;
      if (age >= LIFE) {
        this.sparkRings.splice(i, 1);
        continue;
      }
      const k = age / LIFE;
      const ease = 1 - Math.pow(1 - k, 2);
      const rad = this.laneW * (0.15 + 0.17 * ease); // slightly smaller than the orb, expands a touch
      const fade = Math.pow(1 - k, 1.5);
      const n = 18;
      for (let p = 0; p < n; p++) {
        const ang = (p / n) * Math.PI * 2 + s.t0 * 0.0007;
        const jr = rad * (0.88 + 0.22 * Math.sin(p * 3.1 + s.t0));
        const px = s.x + Math.cos(ang) * jr;
        const py = s.y + Math.sin(ang) * jr;
        const sz = (1.4 + 1.3 * (Math.sin(p * 1.7) * 0.5 + 0.5)) * (0.55 + fade);
        ctx.fillStyle = `rgba(255,226,150,${0.72 * fade})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fill();
      }
      // Thin bright ring outline for the crisp "sparkle out" read.
      ctx.strokeStyle = `rgba(255,240,200,${0.4 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
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
    const tier = this.combo >= 50 ? RAINBOW[Math.floor(performance.now() / 110) % RAINBOW.length] : glow;
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
