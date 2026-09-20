import type { DifficultyChart, TrackChart, Difficulty } from './chartTypes';
import type { Palette } from '../data/palettes';
import { moodColorway } from './colors';
import { rgbCss } from './colors';
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
import { sfx } from '../audio/sfx';
import type { AudioClock } from './audioClock';

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
  progress: number; // 0..1
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
  onHud: (s: HudState) => void;
  onFinish: (r: RunResult) => void;
}

interface RuntimeNote {
  timeMs: number;
  lane: number;
  hit: boolean;
  judged: boolean;
  judgement: Judgement | null;
}

interface FloatingJudge {
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

const APPROACH_MS = 1500; // time a note is visible before reaching the hit line
const TOP_MARGIN_FRAC = 0.06;
const HIT_LINE_FRAC = 0.82;
const JUDGE_COLORS: Record<Judgement, string> = {
  perfect: '#8ef0ff',
  great: '#8bff9b',
  good: '#ffe98a',
  miss: '#ff7a8a',
};

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
  private laneFlash: number[] = []; // per-lane hit-zone flash 1->0

  private raf = 0;
  private running = false;
  private paused = false;
  private lastFrame = 0;
  private finished = false;

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
    this.notes = this.diffChart.notes.map((n) => ({
      timeMs: n.timeMs,
      lane: Math.min(n.lane, this.laneCount - 1),
      hit: false,
      judged: false,
      judgement: null,
    }));
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
  }

  start(): void {
    if (this.running) return;
    this.running = true;
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
  }

  // ---- geometry -------------------------------------------------------

  private get topY() {
    return this.h * TOP_MARGIN_FRAC;
  }
  private get hitY() {
    return this.h * HIT_LINE_FRAC;
  }

  /** Lane center X at a given vertical progress p (0 = top/far, 1 = hit line/near). */
  private laneCenterX(lane: number, p: number): number {
    const cx = this.w / 2;
    const bottomHalf = this.w * 0.46;
    const topHalf = this.w * 0.2; // converging perspective
    const half = topHalf + (bottomHalf - topHalf) * p;
    const laneW = (half * 2) / this.laneCount;
    const left = cx - half;
    return left + laneW * (lane + 0.5);
  }

  private laneWidthAt(p: number): number {
    const bottomHalf = this.w * 0.46;
    const topHalf = this.w * 0.2;
    const half = topHalf + (bottomHalf - topHalf) * p;
    return (half * 2) / this.laneCount;
  }

  // ---- input ----------------------------------------------------------

  /** Public: called by the React lane controls (and keyboard). */
  hitLane(lane: number): void {
    if (!this.running || this.paused || this.finished) return;
    const songMs = this.opts.clock.getPositionMs();
    const tapMs = songMs - this.opts.latencyOffsetMs;
    const win = this.diffChart.hitWindowMs;

    // Find nearest un-hit note in this lane within the good window.
    let bestIdx = -1;
    let bestErr = Infinity;
    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.hit || n.judged || n.lane !== lane) continue;
      const err = Math.abs(n.timeMs - tapMs);
      if (err <= win.good && err < bestErr) {
        bestErr = err;
        bestIdx = i;
      }
      if (n.timeMs - tapMs > win.good) break; // notes are sorted; no closer match ahead
    }

    this.laneFlash[lane] = 1;
    if (bestIdx === -1) return; // stray tap — no penalty (DDR-lite)

    const n = this.notes[bestIdx];
    const j = judgeTiming(bestErr, win);
    this.applyJudgement(n, j);
  }

  private applyJudgement(n: RuntimeNote, j: Judgement): void {
    n.hit = j !== 'miss';
    n.judged = true;
    n.judgement = j;

    this.totals[j] += 1;
    if (j === 'miss') {
      this.combo = 0;
    } else {
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const base = JUDGEMENT_SCORE[j];
      const comboMul = 1 + Math.min(this.combo, 100) / 100 * 0.5;
      this.score += Math.round(base * comboMul);
    }

    const energy = sampleMoodCurve(this.opts.chart, n.timeMs);
    this.mood.registerJudgement(j, this.combo, energy);

    // Visual + audio feedback
    const p = 1;
    const x = this.laneCenterX(n.lane, p);
    this.spawnFloater(j, x);
    if (j !== 'miss') {
      const strength = j === 'perfect' ? 1 : j === 'great' ? 0.7 : 0.4;
      this.particles.emitBurst(
        x,
        this.hitY,
        moodColorway(this.opts.palette, this.mood.moodNorm).glow,
        strength,
        this.opts.visualIntensity,
      );
      this.laneFlash[n.lane] = 1;
    }
    sfx.play(j);
    if (this.opts.hapticsEnabled && j === 'perfect') {
      const nav = navigator as Navigator & { vibrate?: (pattern: number) => boolean };
      if (typeof nav.vibrate === 'function') {
        try {
          nav.vibrate(8);
        } catch {
          /* unsupported */
        }
      }
    }
  }

  private spawnFloater(j: Judgement, x: number): void {
    this.floaters.push({
      text: j.toUpperCase(),
      color: JUDGE_COLORS[j],
      x,
      y: this.hitY - 40,
      life: 1,
    });
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
    if (dt > 60) dt = 60; // clamp after stalls

    const songMs = this.opts.clock.getPositionMs();

    this.autoMiss(songMs);
    this.mood.update(dt);
    this.particles.update(dt, this.mood.moodNorm, this.opts.visualIntensity);
    for (let i = 0; i < this.laneFlash.length; i++) {
      this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt / 180);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt / 650;
      f.y -= (dt / 1000) * 40;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }

    this.render(songMs);
    this.emitHud(songMs, dt);

    if (!this.finished && songMs >= this.opts.chart.durationMs + 400) {
      this.finish();
    }
  };

  private autoMiss(songMs: number): void {
    const tapMs = songMs - this.opts.latencyOffsetMs;
    const goodWin = this.diffChart.hitWindowMs.good;
    for (const n of this.notes) {
      if (n.judged) continue;
      if (n.timeMs < tapMs - goodWin) {
        this.applyJudgement(n, 'miss');
      } else {
        // notes are time-sorted; the first un-judged future note ends the scan
        if (n.timeMs >= tapMs - goodWin) break;
      }
    }
  }

  private emitHud(songMs: number, dt: number): void {
    this.hudAccum += dt;
    if (this.hudAccum < 66) return; // ~15fps HUD updates
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
    const result: RunResult = {
      trackId: this.opts.chart.trackId,
      difficulty: this.opts.difficulty,
      totals: t,
      accuracy: acc,
      perfectPercent: perfectPercent(t),
      vibeScore: this.mood.vibeScore(),
      grade: letterGrade(acc, t.miss, n),
      stars: starRating(acc, t.miss, n),
    };
    this.opts.onFinish(result);
  }

  // ---- rendering ------------------------------------------------------

  private render(songMs: number): void {
    const ctx = this.ctx;
    const cw = moodColorway(this.opts.palette, this.mood.moodNorm);
    const moodNorm = this.mood.moodNorm;

    // Background vertical gradient (mood-graded)
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, rgbCss(cw.bgGlow));
    grad.addColorStop(0.5, rgbCss(cw.bgDeep));
    grad.addColorStop(1, rgbCss(cw.bgDeep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    // Parallax pulse — a radial glow near the vanishing point, pulsing faster at high mood
    const pulse = 0.5 + 0.5 * Math.sin((songMs / (700 - moodNorm * 350)) % (Math.PI * 2));
    const vg = ctx.createRadialGradient(
      this.w / 2,
      this.topY,
      0,
      this.w / 2,
      this.topY,
      this.w * (0.5 + moodNorm * 0.3),
    );
    vg.addColorStop(0, rgbCss(cw.bgGlow, 0.35 + moodNorm * 0.4 * pulse));
    vg.addColorStop(1, rgbCss(cw.bgGlow, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawLanes(cw, moodNorm);
    this.particles.draw(ctx, cw.particle, moodNorm, this.opts.visualIntensity > 0.5);
    this.drawNotes(songMs, cw, moodNorm);
    this.drawHitZone(cw, moodNorm);
    this.drawCombo(moodNorm, cw.glow);
    this.drawFloaters();
  }

  private drawLanes(cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= this.laneCount; i++) {
      const topX = this.laneCenterX(i - 0.5, 0);
      const botX = this.laneCenterX(i - 0.5, 1);
      ctx.beginPath();
      ctx.moveTo(topX, this.topY);
      ctx.lineTo(botX, this.hitY);
      ctx.strokeStyle = rgbCss(cw.lane, 0.35 + moodNorm * 0.35);
      ctx.stroke();
    }
    // Lane hit-zone flashes (base of each lane)
    for (let lane = 0; lane < this.laneCount; lane++) {
      const flash = this.laneFlash[lane];
      if (flash <= 0) continue;
      const cx = this.laneCenterX(lane, 1);
      const lw = this.laneWidthAt(1);
      ctx.fillStyle = rgbCss(cw.glow, 0.25 * flash);
      ctx.fillRect(cx - lw / 2, this.topY, lw, this.hitY - this.topY);
    }
  }

  private drawNotes(songMs: number, cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    const tapMs = songMs - this.opts.latencyOffsetMs;
    ctx.globalCompositeOperation = 'lighter';
    for (const n of this.notes) {
      if (n.judged && (n.hit || n.judgement === 'miss')) continue;
      const delta = n.timeMs - tapMs; // ms until it should be hit
      if (delta > APPROACH_MS || delta < -this.diffChart.hitWindowMs.good) continue;
      const p = 1 - delta / APPROACH_MS; // 0 top -> 1 hit line
      const y = this.topY + p * (this.hitY - this.topY);
      const x = this.laneCenterX(n.lane, p);
      const r = (this.laneWidthAt(p) * 0.32) * (0.6 + p * 0.4);

      // Glow trail
      if (this.opts.visualIntensity > 0.5) {
        ctx.shadowBlur = 12 + moodNorm * 22;
        ctx.shadowColor = rgbCss(cw.glow, 0.9);
      }
      // Gem body
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, rgbCss([255, 255, 255], 0.95));
      gg.addColorStop(0.4, rgbCss(cw.note, 1));
      gg.addColorStop(1, rgbCss(cw.note, 0.15));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawHitZone(cw: ReturnType<typeof moodColorway>, moodNorm: number): void {
    const ctx = this.ctx;
    for (let lane = 0; lane < this.laneCount; lane++) {
      const x = this.laneCenterX(lane, 1);
      const lw = this.laneWidthAt(1);
      const r = lw * 0.34;
      const flash = this.laneFlash[lane];
      ctx.save();
      if (this.opts.visualIntensity > 0.5) {
        ctx.shadowBlur = 16 + moodNorm * 20 + flash * 24;
        ctx.shadowColor = rgbCss(cw.glow, 0.8);
      }
      ctx.lineWidth = 3 + flash * 4;
      ctx.strokeStyle = rgbCss(cw.glow, 0.55 + moodNorm * 0.35 + flash * 0.3);
      ctx.beginPath();
      ctx.arc(x, this.hitY, r, 0, Math.PI * 2);
      ctx.stroke();
      // inner fill pulse
      ctx.fillStyle = rgbCss(cw.glow, 0.08 + flash * 0.4);
      ctx.beginPath();
      ctx.arc(x, this.hitY, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCombo(moodNorm: number, glow: readonly [number, number, number]): void {
    if (this.combo < 2) return;
    const ctx = this.ctx;
    const scale = 1 + Math.min(this.combo, 100) / 100 * 0.6 + moodNorm * 0.25;
    const size = 42 * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 18 + moodNorm * 30;
    ctx.shadowColor = rgbCss(glow, 0.9);
    ctx.fillStyle = rgbCss([255, 255, 255], 0.92);
    ctx.fillText(`${this.combo}`, this.w / 2, this.h * 0.34);
    ctx.font = `800 ${size * 0.32}px system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(glow, 0.95);
    ctx.fillText('COMBO', this.w / 2, this.h * 0.34 + size * 0.62);
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
      ctx.font = `900 ${20 + (1 - f.life) * 10}px system-ui, sans-serif`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = f.color;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
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
