import { useEffect, useRef } from 'react';
import type { ChartNote } from '../engine/chartTypes';

/**
 * A compact, live preview of a chart: the real notes of the selected difficulty scroll up into a
 * glowing hit line in sync with the preview audio (`timeRef`). Taps are glass beads, holds are
 * glass bars, slides are glass tubes along their real paths, beat lines pulse underneath.
 */

const NOTE_COLORS = ['#ff405c', '#38b6ff', '#ffd640', '#46e86e'];
const SLIDE = '#ff6cdc';
const HOLD = '#40fff2';
const WINDOW = 1500; // ms of chart visible ahead of the hit line

function laneAt(n: ChartNote, t: number): number {
  const p = n.path;
  if (!p || p.length < 2) return n.lane;
  if (t <= p[0].tMs) return p[0].lane;
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].tMs) {
      const a = p[i - 1];
      const b = p[i];
      return a.lane + ((b.lane - a.lane) * (t - a.tMs)) / Math.max(1, b.tMs - a.tMs);
    }
  }
  return p[p.length - 1].lane;
}

export function MiniHighway({
  notes,
  laneCount,
  beatsMs,
  timeRef,
  accent,
}: {
  notes: ChartNote[];
  laneCount: number;
  beatsMs?: number[];
  timeRef: { current: number };
  accent: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = timeRef.current;
      const laneW = w / laneCount;
      const hitY = h * 0.18;
      const yFor = (ms: number) => hitY + ((ms - t) / WINDOW) * (h - hitY + 20);
      const cx = (lane: number) => (lane + 0.5) * laneW;
      const r = Math.min(laneW * 0.24, 13);

      // lanes
      for (let i = 0; i < laneCount; i++) {
        const g = ctx.createLinearGradient(i * laneW, 0, (i + 1) * laneW, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.35)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(i * laneW, 0, laneW, h);
      }
      // beat lines (pulse as they reach the hit line)
      if (beatsMs) {
        for (const b of beatsMs) {
          if (b < t - 200) continue;
          if (b > t + WINDOW) break;
          const y = yFor(b);
          const near = Math.max(0, 1 - Math.abs(b - t) / 600);
          ctx.fillStyle = `rgba(200,180,255,${0.08 + near * 0.3})`;
          ctx.fillRect(0, y - 0.5, w, 1);
        }
      }
      // rails
      ctx.strokeStyle = 'rgba(220,240,255,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= laneCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneW, 0);
        ctx.lineTo(i * laneW, h);
        ctx.stroke();
      }
      // hit line + receptors
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, hitY - 1, w, 2);
      ctx.globalAlpha = 1;
      for (let i = 0; i < laneCount; i++) {
        ctx.strokeStyle = 'rgba(230,235,255,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx(i), hitY, r * 1.05, 0, Math.PI * 2);
        ctx.stroke();
      }

      const tube = (col: string, width: number, pts: [number, number][]) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        };
        path();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = width + 2;
        ctx.stroke();
        path();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = width;
        ctx.stroke();
        path();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = width * 0.25;
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      // sustains first (behind heads)
      for (const n of notes) {
        if (n.type === 'tap') continue;
        const endT = n.timeMs + (n.holdMs ?? 0);
        if (endT < t - 100 || n.timeMs > t + WINDOW) continue;
        if (n.type === 'hold') {
          tube(HOLD, r * 1.1, [
            [cx(n.lane), yFor(Math.max(n.timeMs, t))],
            [cx(n.lane), yFor(Math.min(endT, t + WINDOW + 200))],
          ]);
        } else {
          const pts: [number, number][] = [];
          const a = Math.max(n.timeMs, t);
          const b = Math.min(endT, t + WINDOW + 200);
          for (let k = 0; k <= 12; k++) {
            const tt = a + ((b - a) * k) / 12;
            pts.push([cx(laneAt(n, tt)), yFor(tt)]);
          }
          tube(SLIDE, r * 1.1, pts);
        }
      }
      // heads
      for (const n of notes) {
        if (n.timeMs < t - 120 || n.timeMs > t + WINDOW) continue;
        const x = n.timeMs < t && n.type === 'slide' ? cx(laneAt(n, t)) : cx(n.lane);
        const y = n.timeMs < t ? hitY : yFor(n.timeMs);
        const col = NOTE_COLORS[n.c ?? 0] ?? NOTE_COLORS[0];
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, col);
        g.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [notes, laneCount, beatsMs, timeRef, accent]);

  return <canvas ref={ref} className="mini-highway" aria-label="Note preview" />;
}
