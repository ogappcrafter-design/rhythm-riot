import type { RGB } from '../data/palettes';
import { rgbCss } from './colors';

/**
 * Rhythm Riot's signature "riot shards" particle field (spec Section 6.2).
 * Geometric shards that go from a single slow drift at low mood to an explosive
 * splatter at high mood. Two pools:
 *   - ambient: always-present drift whose live count scales with mood
 *   - burst:   emitted on successful hits, radial and short-lived
 *
 * Counts scale with the Settings "visual intensity" (0..1) so the field doubles as a
 * performance safety valve on low-end devices (spec 8.2 / 9).
 */

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  life: number; // 1 -> 0
  decay: number;
  sides: number;
}

const AMBIENT_MAX = 90;
const BURST_MAX = 260;

export class ParticleField {
  private ambient: Shard[] = [];
  private burst: Shard[] = [];
  private w = 0;
  private h = 0;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  reset(): void {
    this.ambient.length = 0;
    this.burst.length = 0;
  }

  private makeAmbient(): Shard {
    return {
      x: Math.random() * this.w,
      y: this.h + Math.random() * this.h,
      vx: (Math.random() - 0.5) * 6,
      vy: -8 - Math.random() * 14,
      size: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.6,
      life: 1,
      decay: 0,
      sides: 3 + (Math.random() < 0.5 ? 0 : 1),
    };
  }

  /** Emit a burst at a hit position. Strength scales density/speed. */
  emitBurst(x: number, y: number, color: RGB, strength: number, intensity: number): void {
    const count = Math.round((6 + strength * 16) * intensity);
    for (let i = 0; i < count; i++) {
      if (this.burst.length >= BURST_MAX) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = (40 + Math.random() * 180) * (0.5 + strength);
      this.burst.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        size: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 8,
        life: 1,
        decay: 1.4 + Math.random() * 1.2,
        sides: 3 + (Math.random() < 0.5 ? 0 : 1),
        // color captured per-burst below via closure array
      });
    }
    this.lastBurstColor = color;
  }

  private lastBurstColor: RGB = [255, 255, 255];

  /**
   * @param dtMs      frame delta
   * @param moodNorm  0..1 live mood (drives ambient density + speed)
   * @param intensity 0..1 visual intensity setting
   */
  update(dtMs: number, moodNorm: number, intensity: number): void {
    const dt = dtMs / 1000;

    // Target ambient population scales with mood and the intensity setting.
    const targetCount = Math.round((8 + moodNorm * (AMBIENT_MAX - 8)) * intensity);
    while (this.ambient.length < targetCount) this.ambient.push(this.makeAmbient());

    const speedMul = 0.6 + moodNorm * 1.8;
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i];
      p.x += p.vx * dt * speedMul;
      p.y += p.vy * dt * speedMul;
      p.rot += p.vrot * dt;
      if (p.y < -20 || this.ambient.length > targetCount + 4) {
        this.ambient.splice(i, 1);
      }
    }

    for (let i = this.burst.length - 1; i >= 0; i--) {
      const p = this.burst[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // gravity
      p.vx *= 0.98;
      p.rot += p.vrot * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.burst.splice(i, 1);
    }
  }

  /** Append one shard's polygon to the current path (rotation done in math — no save/restore). */
  private traceShard(ctx: CanvasRenderingContext2D, p: Shard): void {
    const r = p.size;
    const c = Math.cos(p.rot);
    const sn = Math.sin(p.rot);
    for (let i = 0; i < p.sides; i++) {
      const a = (i / p.sides) * Math.PI * 2;
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r * 0.7;
      const px = p.x + lx * c - ly * sn;
      const py = p.y + lx * sn + ly * c;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /**
   * Batched: every ambient shard goes into ONE path / one fill, and burst shards are bucketed by
   * fade level into a handful of fills — instead of a save/translate/rotate/fill/restore per shard
   * (up to ~350 separate fills a frame on a busy hard chart, a big source of phone lag).
   */
  draw(ctx: CanvasRenderingContext2D, ambientColor: RGB, moodNorm: number, glowEnabled: boolean): void {
    ctx.globalCompositeOperation = 'lighter';
    if (glowEnabled) {
      ctx.shadowBlur = 6 + moodNorm * 14;
      ctx.shadowColor = rgbCss(ambientColor, 0.9);
    }
    if (this.ambient.length) {
      ctx.fillStyle = rgbCss(ambientColor, 0.25 + moodNorm * 0.4);
      ctx.beginPath();
      for (const p of this.ambient) this.traceShard(ctx, p);
      ctx.fill();
    }
    if (this.burst.length) {
      const BUCKETS = 5;
      for (let b = 0; b < BUCKETS; b++) {
        const lo = b / BUCKETS;
        const hi = (b + 1) / BUCKETS;
        let any = false;
        for (const p of this.burst) {
          if (Math.min(BUCKETS - 1, Math.floor(Math.max(0, p.life) * BUCKETS)) !== b) continue;
          if (!any) {
            ctx.beginPath();
            any = true;
          }
          this.traceShard(ctx, p);
        }
        if (!any) continue;
        const alpha = (lo + hi) / 2;
        if (glowEnabled) ctx.shadowColor = rgbCss(this.lastBurstColor, alpha);
        ctx.fillStyle = rgbCss(this.lastBurstColor, alpha);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }
}
