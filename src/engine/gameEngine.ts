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
  isHold: boolean;
  holdEndMs: number;
  judged: boolean;
  judgement: Judgement | null;
  hit: boolean;
  holdActive: boolean;
  holdDone: boolean;
  holdBroken: boolean;
}

interface FloatingJudge {
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

interface FlowStar {
  x: number;
  y: number;
  z: number; // 0..1 depth (bigger = closer/faster)
  r: number;
  tw: number; // twinkle phase
}

const APPROACH_MS = 1450;
const TOP_MARGIN_FRAC = 0.05;
const HIT_LINE_FRAC = 0.82;
const HOLD_RELEASE_WINDOW = 170;
const STAR_SPRITE_SIZE = 128;
const JUDGE_COLORS: Record<Judgement, string> = {
  perfect: '#8ef0ff',
  great: '#8bff9b',
  good: '#ffe98a',
  miss: '#ff7a8a',
};
// Bright hues cycled through note stars once the player passes a 200 combo.
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
  private laneFlash: number[] = [];
  private lanePressed: boolean[] = [];
  private activeHoldByLane: number[] = [];

  private flowStars: FlowStar[] = [];
  private starSprites = new Map<number, HTMLCanvasElement>();

  private raf = 0;
  private running = false;
  private paused = false;
  private lastFrame = 0;
  private finished = false;
  private audioEndedAt = 0; // perf time the audio 'ended' event fired (0 = not yet)
  private nearEndSince = 0; // perf time position first reached the song end (stall fallback)
  private lastComboTier = 0; // 0 / 50 / 100 — for milestone SFX + effects
  private consecutiveMiss = 0;
  private missFlash = 0; // red screen-edge flash, decays to 0
  private encourageUntil = 0; // perf time the encouragement banner stops
  private encourageText = '';

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
    this.laneFlash = new Array(this.laneCount).fill(0);
    this.lanePressed = new Array(this.laneCount).fill(false);
    this.activeHoldByLane = new Array(this.laneCount).fill(-1);
    this.notes = this.diffChart.notes.map((n) => {
      const isHold = n.type === 'hold' && !!n.holdMs;
      return {
        timeMs: n.timeMs,
        lane: Math.min(n.lane, this.laneCount - 1),
        isHold,
        holdEndMs: isHold ? n.timeMs + (n.holdMs ?? 0) : n.timeMs,
        judged: false,
        judgement: null,
        hit: false,
        holdActive: false,
        holdDone: false,
        holdBroken: false,
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
    this.starSprites.clear();
  }

  // ---- geometry -------------------------------------------------------
  private get topY() {
    return this.h * TOP_MARGIN_FRAC;
  }
  private get hitY() {
    return this.h * HIT_LINE_FRAC;
  }
  private laneCenterX(lane: number, p: number): number {
    const cx = this.w / 2;
    const bottomHalf = this.w * 0.46;
    const topHalf = this.w * 0.2;
    const half = topHalf + (bottomHalf - topHalf) * p;
    const laneW = (half * 2) / this.laneCount;
    return cx - half + laneW * (lane + 0.5);
  }
  private laneWidthAt(p: number): number {
    const bottomHalf = this.w * 0.46;
    const topHalf = this.w * 0.2;
    const half = topHalf + (bottomHalf - topHalf) * p;
    return (half * 2) / this.laneCount;
  }
  /** Vertical progress (0 top .. 1 hit line) for a given time-until-hit. */
  private progressFor(deltaMs: number): number {
    return 1 - deltaMs / APPROACH_MS;
  }
  private yFor(p: number): number {
    return this.topY + p * (this.hitY - this.topY);
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
    this.judgeHead(n, j);
    if (n.isHold && j !== 'miss') {
      n.holdActive = true;
      this.activeHoldByLane[lane] = bestIdx;
    }
  }

  releaseLane(lane: number): void {
    if (lane < 0 || lane >= this.laneCount) return;
    this.lanePressed[lane] = false;
    const idx = this.activeHoldByLane[lane];
    if (idx < 0) return;
    const n = this.notes[idx];
    const songMs = this.opts.clock.getPositionMs() - this.opts.latencyOffsetMs;
    if (songMs >= n.holdEndMs - HOLD_RELEASE_WINDOW) this.completeHold(n);
    else this.breakHold(n);
    this.activeHoldByLane[lane] = -1;
  }

  private judgeHead(n: RuntimeNote, j: Judgement): void {
    n.hit = j !== 'miss';
    n.judged = true;
    n.judgement = j;
    this.totals[j] += 1;
    if (j === 'miss') {
      this.combo = 0;
      this.lastComboTier = 0;
      this.missFlash = 1; // red screen-edge flash
      this.consecutiveMiss += 1;
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
      // Combo-tier milestones (50 = grid glow, 100 = rainbow + sparkles).
      if (this.combo >= 100 && this.lastComboTier < 100) {
        this.lastComboTier = 100;
        sfx.play('combo200');
      } else if (this.combo >= 50 && this.lastComboTier < 50) {
        this.lastComboTier = 50;
        sfx.play('combo100');
      }
    }
    const energy = sampleMoodCurve(this.opts.chart, n.timeMs);
    this.mood.registerJudgement(j, this.combo, energy);

    const x = this.laneCenterX(n.lane, 1);
    this.spawnFloater(j, x);
    if (j !== 'miss') {
      const strength = j === 'perfect' ? 1 : j === 'great' ? 0.7 : 0.4;
      this.particles.emitBurst(x, this.hitY, moodColorway(this.opts.palette, this.mood.moodNorm).glow, strength, this.opts.visualIntensity);
      this.laneFlash[n.lane] = 1;
    }
    sfx.play(j);
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
    const bonus = 120 + Math.round((n.holdEndMs - n.timeMs) / 12);
    this.score += bonus;
    const x = this.laneCenterX(n.lane, 1);
    this.particles.emitBurst(x, this.hitY, moodColorway(this.opts.palette, this.mood.moodNorm).glow, 1, this.opts.visualIntensity);
    this.laneFlash[n.lane] = 1;
    this.spawnFloater('perfect', x);
    sfx.play('great');
  }

  private breakHold(n: RuntimeNote): void {
    if (n.holdDone || n.holdBroken) return;
    n.holdBroken = true;
    n.holdActive = false;
    this.combo = 0; // dropping a hold breaks the streak
    sfx.play('uiBack');
  }

  private spawnFloater(j: Judgement, x: number): void {
    this.floaters.push({ text: j.toUpperCase(), color: JUDGE_COLORS[j], x, y: this.hitY - 44, life: 1 });
    if (this.floaters.length > 12) this.floaters.shift();
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
    this.updateHolds(songMs);
    this.mood.update(dt);
    this.particles.update(dt, this.mood.moodNorm, this.opts.visualIntensity);
    this.updateFlow(dt);
    for (let i = 0; i < this.laneFlash.length; i++) {
      const target = this.lanePressed[i] ? 0.5 : 0;
      this.laneFlash[i] = Math.max(target, this.laneFlash[i] - dt / 190);
    }
    if (this.missFlash > 0) this.missFlash = Math.max(0, this.missFlash - dt / 450);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt / 650;
      f.y -= (dt / 1000) * 42;
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

  private updateHolds(songMs: number): void {
    const t = songMs - this.opts.latencyOffsetMs;
    for (let lane = 0; lane < this.laneCount; lane++) {
      const idx = this.activeHoldByLane[lane];
      if (idx < 0) continue;
      const n = this.notes[idx];
      if (t >= n.holdEndMs) {
        // Held all the way through.
        this.completeHold(n);
        this.activeHoldByLane[lane] = -1;
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

  // ---- star sprite cache ---------------------------------------------
  private getStarSprite(key: number, rim: RGB): HTMLCanvasElement {
    const cached = this.starSprites.get(key);
    if (cached) return cached;
    const S = STAR_SPRITE_SIZE;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const c = cv.getContext('2d')!;
    const cx = S / 2;
    const cy = S / 2;
    const outer = S * 0.36;
    const inner = outer * 0.44;
    const rimBright = lightenRGB(rim, 0.3);

    const starPath = (r0: number, r1: number) => {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r0 : r1;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    // 1) Big soft outer glow halo (brighter than before — the stars now really pop).
    c.save();
    c.shadowBlur = S * 0.38;
    c.shadowColor = rgbCss(rimBright, 1);
    c.fillStyle = rgbCss(rimBright, 1);
    starPath(outer, inner);
    c.fill();
    c.shadowBlur = S * 0.22;
    c.fill(); // second pass intensifies the glow
    c.restore();

    // 2) Bright thick rim.
    c.lineJoin = 'round';
    c.lineWidth = S * 0.07;
    c.strokeStyle = rgbCss(lightenRGB(rim, 0.55), 1);
    starPath(outer * 0.9, inner * 0.9);
    c.stroke();

    // 3) Negative-black core with a 3D radial shade (dark center → slightly lifted edge).
    const g = c.createRadialGradient(cx - outer * 0.22, cy - outer * 0.28, outer * 0.1, cx, cy, outer);
    g.addColorStop(0, '#1b1e30');
    g.addColorStop(0.55, '#0b0d18');
    g.addColorStop(1, '#03030a');
    c.fillStyle = g;
    starPath(outer * 0.84, inner * 0.84);
    c.fill();

    // 4) Specular highlight for the 3D pop.
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(cx - outer * 0.24, cy - outer * 0.3, outer * 0.15, outer * 0.1, -0.5, 0, Math.PI * 2);
    c.fill();

    this.starSprites.set(key, cv);
    return cv;
  }

  // ---- render ---------------------------------------------------------
  private render(songMs: number): void {
    const ctx = this.ctx;
    const moodNorm = this.mood.moodNorm;
    const cw = moodColorway(this.opts.palette, moodNorm);

    // Background gradient (mood-graded)
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, rgbCss(cw.bgGlow));
    grad.addColorStop(0.5, rgbCss(cw.bgDeep));
    grad.addColorStop(1, rgbCss(cw.bgDeep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawFlow(cw.particle, moodNorm);

    // Vanishing-point pulse
    const pulse = 0.5 + 0.5 * Math.sin((songMs / (700 - moodNorm * 350)) % (Math.PI * 2));
    const vg = ctx.createRadialGradient(this.w / 2, this.topY, 0, this.w / 2, this.topY, this.w * (0.5 + moodNorm * 0.3));
    vg.addColorStop(0, rgbCss(cw.bgGlow, 0.3 + moodNorm * 0.4 * pulse));
    vg.addColorStop(1, rgbCss(cw.bgGlow, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);

    const comboGlow = this.combo >= 100 ? 1 : this.combo >= 50 ? 0.6 : 0;
    this.drawLanes(cw, moodNorm, comboGlow);
    this.particles.draw(ctx, cw.particle, moodNorm, false);
    this.drawNotes(songMs, cw, moodNorm);
    this.drawHitZone(cw, moodNorm);
    if (this.combo >= 100) this.drawSideSparkles(songMs);
    this.drawCombo(moodNorm, cw.glow);
    this.drawFloaters();
    this.drawMissFlash();
    this.drawEncouragement();
  }

  /** Red vignette pulse at the screen edges when you miss — makes misses obvious. */
  private drawMissFlash(): void {
    if (this.missFlash <= 0.01) return;
    const ctx = this.ctx;
    const a = this.missFlash;
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.28,
      this.w / 2,
      this.h / 2,
      this.h * 0.62,
    );
    g.addColorStop(0, 'rgba(255,40,70,0)');
    g.addColorStop(1, `rgba(255,30,60,${0.5 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  /** Big centered encouragement banner after a run of misses. */
  private drawEncouragement(): void {
    const now = performance.now();
    if (now >= this.encourageUntil) return;
    const remain = (this.encourageUntil - now) / 1600; // 1 -> 0
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = 1 + (1 - remain) * 0.15;
    ctx.globalAlpha = Math.min(1, remain * 2);
    ctx.font = `900 italic ${Math.round(40 * scale)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,120,140,0.35)';
    ctx.fillText(this.encourageText, this.w / 2, this.h * 0.5);
    ctx.fillStyle = '#ffe28a';
    ctx.fillText(this.encourageText, this.w / 2, this.h * 0.5 - 2);
    ctx.restore();
  }

  // Glowing sparkles drifting up the left/right edges once past a 200 combo.
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

  private drawFlow(color: RGB, moodNorm: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.flowStars) {
      const tw = 0.55 + 0.45 * Math.sin(s.tw);
      const a = (0.06 + s.z * 0.22) * tw * (0.6 + moodNorm * 0.5);
      ctx.fillStyle = rgbCss(color, a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLanes(cw: ReturnType<typeof moodColorway>, moodNorm: number, comboGlow: number): void {
    const ctx = this.ctx;
    // Combo glow: at 100+ the grid brightens; at 200+ it blazes.
    if (comboGlow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 6 + comboGlow * 6;
      for (let i = 0; i <= this.laneCount; i++) {
        const topX = this.laneCenterX(i - 0.5, 0);
        const botX = this.laneCenterX(i - 0.5, 1);
        ctx.strokeStyle = rgbCss(lightenRGB(cw.glow, 0.3), 0.14 * comboGlow);
        ctx.beginPath();
        ctx.moveTo(topX, this.topY);
        ctx.lineTo(botX, this.hitY);
        ctx.stroke();
      }
      ctx.restore();
    }
    // High-contrast WHITE lane lines (opposite of the dark stars).
    ctx.lineWidth = 2 + comboGlow;
    for (let i = 0; i <= this.laneCount; i++) {
      const topX = this.laneCenterX(i - 0.5, 0);
      const botX = this.laneCenterX(i - 0.5, 1);
      const lg = ctx.createLinearGradient(topX, this.topY, botX, this.hitY);
      lg.addColorStop(0, 'rgba(255,255,255,0.05)');
      lg.addColorStop(1, `rgba(255,255,255,${Math.min(1, 0.5 + moodNorm * 0.35 + comboGlow * 0.25)})`);
      ctx.strokeStyle = lg;
      ctx.beginPath();
      ctx.moveTo(topX, this.topY);
      ctx.lineTo(botX, this.hitY);
      ctx.stroke();
    }
    // Pressed-lane wash
    for (let lane = 0; lane < this.laneCount; lane++) {
      const flash = this.laneFlash[lane];
      if (flash <= 0.01) continue;
      const cx = this.laneCenterX(lane, 1);
      const lw = this.laneWidthAt(1);
      const wash = ctx.createLinearGradient(0, this.topY, 0, this.hitY);
      wash.addColorStop(0, rgbCss(cw.glow, 0));
      wash.addColorStop(1, rgbCss(cw.glow, 0.22 * flash));
      ctx.fillStyle = wash;
      ctx.fillRect(cx - lw / 2, this.topY, lw, this.hitY - this.topY);
    }
  }

  private drawNotes(songMs: number, cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    const tapMs = songMs - this.opts.latencyOffsetMs;
    // At 100+ combo the stars go rainbow (hue cycles over time); otherwise mood-graded glow.
    const rainbow = this.combo >= 100;
    let spriteKey: number;
    let rimColor: RGB;
    if (rainbow) {
      const hi = Math.floor(songMs / 110) % RAINBOW.length;
      spriteKey = 1000 + hi;
      rimColor = RAINBOW[hi];
    } else {
      spriteKey = Math.round(moodNorm * 5);
      rimColor = cw.glow;
    }
    const sprite = this.getStarSprite(spriteKey, rimColor);

    // Draw hold tails first (behind heads) — bold, obvious "ribbon" with a bright border.
    for (const n of this.notes) {
      if (!n.isHold || n.holdBroken) continue;
      const headDelta = n.timeMs - tapMs;
      const tailDelta = n.holdEndMs - tapMs;
      if (tailDelta > APPROACH_MS || headDelta < -this.diffChart.hitWindowMs.good) continue;
      const pHead = Math.min(1, this.progressFor(headDelta));
      const pTail = Math.min(1, this.progressFor(tailDelta));
      const yHead = this.yFor(pHead);
      const yTail = this.yFor(pTail);
      const xHead = this.laneCenterX(n.lane, Math.max(0, Math.min(1, pHead)));
      const wBar = this.laneWidthAt(Math.max(0.1, pHead)) * 0.46; // much wider than before
      const active = n.holdActive;
      const top = Math.min(yHead, yTail);
      const bot = Math.max(yHead, yTail);
      const r = wBar / 2;
      const pulse = active ? 0.75 + 0.25 * Math.sin(songMs / 90) : 1;

      // filled ribbon
      const grad = ctx.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, rgbCss(rimColor, (active ? 0.85 : 0.5) * pulse));
      grad.addColorStop(1, rgbCss(cw.note, active ? 0.95 : 0.62));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(xHead - r, top, wBar, Math.max(3, bot - top), r);
      ctx.fill();
      // bright border so it reads clearly as a HOLD
      ctx.strokeStyle = rgbCss(lightenRGB(rimColor, active ? 0.7 : 0.4), active ? 0.95 : 0.7);
      ctx.lineWidth = active ? 5 : 3.5;
      ctx.stroke();
      // dashed center line down the ribbon for a "rail" feel
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.lineDashOffset = -(songMs / 12) % 20;
      ctx.strokeStyle = 'rgba(255,255,255,' + (active ? 0.7 : 0.35) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xHead, top + r);
      ctx.lineTo(xHead, bot - r);
      ctx.stroke();
      ctx.restore();
    }

    // Draw heads (glowing negative-black stars via cached sprite).
    for (const n of this.notes) {
      if (n.judged && !n.holdActive) continue;
      if (n.holdActive) {
        // While holding, the head sits pinned at the hit line as a bright anchor.
        const size = this.laneWidthAt(1) * 0.7;
        const x = this.laneCenterX(n.lane, 1);
        this.blitStar(sprite, x, this.hitY, size, 1);
        continue;
      }
      const delta = n.timeMs - tapMs;
      if (delta > APPROACH_MS || delta < -this.diffChart.hitWindowMs.good) continue;
      const p = this.progressFor(delta);
      const y = this.yFor(p);
      const x = this.laneCenterX(n.lane, p);
      const pulse = 1 + 0.06 * Math.sin(songMs / 120 + n.timeMs);
      const size = this.laneWidthAt(p) * 0.66 * (0.62 + p * 0.4) * pulse;
      const alpha = Math.min(1, 0.35 + p);
      this.blitStar(sprite, x, y, size, alpha);
    }
  }

  private blitStar(sprite: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  private drawHitZone(cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    for (let lane = 0; lane < this.laneCount; lane++) {
      const x = this.laneCenterX(lane, 1);
      const lw = this.laneWidthAt(1);
      const r = lw * 0.34;
      const flash = this.laneFlash[lane];
      ctx.save();
      // Bright white ring + colored inner glow → strong contrast with the dark stars.
      ctx.lineWidth = 3 + flash * 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + moodNorm * 0.3 + flash * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, this.hitY, r, 0, Math.PI * 2);
      ctx.stroke();
      const ig = ctx.createRadialGradient(x, this.hitY, 0, x, this.hitY, r);
      ig.addColorStop(0, rgbCss(cw.glow, 0.35 + flash * 0.5));
      ig.addColorStop(1, rgbCss(cw.glow, 0));
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(x, this.hitY, r * 0.96, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCombo(moodNorm: number, glow: RGB): void {
    if (this.combo < 2) return;
    const ctx = this.ctx;
    const scale = 1 + (Math.min(this.combo, 100) / 100) * 0.6 + moodNorm * 0.25;
    const size = 44 * scale;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    // Cheap glow via a couple of translucent offset passes (no shadowBlur).
    ctx.fillStyle = rgbCss(glow, 0.28);
    ctx.fillText(`${this.combo}`, this.w / 2, this.h * 0.33);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(`${this.combo}`, this.w / 2, this.h * 0.33);
    ctx.font = `800 ${size * 0.3}px system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(glow, 0.95);
    ctx.fillText('COMBO', this.w / 2, this.h * 0.33 + size * 0.6);
    ctx.restore();
  }

  private drawFloaters(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const a = Math.max(0, Math.min(1, f.life));
      ctx.globalAlpha = a;
      const isMiss = f.text === 'MISS';
      if (isMiss) {
        // Bigger, bolder, with a little shake so a miss is unmistakable.
        const shake = Math.sin(f.life * 40) * (1 - f.life) * 5;
        const size = 34 + (1 - f.life) * 12;
        ctx.font = `900 italic ${size}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(f.text, f.x + shake + 2, f.y + 2);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x + shake, f.y);
      } else {
        ctx.font = `900 ${20 + (1 - f.life) * 10}px system-ui, sans-serif`;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawPausedTint(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3,4,12,0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
