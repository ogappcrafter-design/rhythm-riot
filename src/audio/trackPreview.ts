import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Focused preview of ONE song for the difficulty screen: plays a looping window around the song's
 * hottest stretch (the hook), fading in/out at the edges. Exposes the live playback position so the
 * mini note highway can scroll the chart in sync with what you hear.
 *
 * Browsers may refuse audio before a gesture; then `blocked` is true and `toggle()` (from a tap)
 * starts it. Silent and harmless where audio can't play.
 */
export interface TrackPreview {
  playing: boolean;
  blocked: boolean;
  /** Current song position in ms (live; read it inside an animation frame). */
  timeRef: { current: number };
  /** Preview window [start, end] in ms. */
  windowMs: [number, number];
  toggle: () => void;
}

const WINDOW_MS = 20000;
const FADE_MS = 900;

export function useTrackPreview(src: string, hookMs: number, durationMs: number, volume: number): TrackPreview {
  const start = Math.max(4000, Math.min(hookMs - 2500, durationMs - WINDOW_MS - 1000));
  const end = Math.min(durationMs - 500, start + WINDOW_MS);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(start);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const vol = Math.max(0, Math.min(1, volume));

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const el = new Audio(src);
    (el as unknown as { playsInline: boolean }).playsInline = true;
    el.preload = 'auto';
    el.volume = 0;
    elRef.current = el;
    let raf = 0;
    let alive = true;

    let last = performance.now();
    const tick = () => {
      if (!alive) return;
      const now = performance.now();
      const dt = now - last;
      last = now;
      const t = el.currentTime * 1000;
      if (el.paused) {
        // Silent/blocked/paused: keep a virtual clock running so the note preview still animates.
        timeRef.current += dt;
        if (timeRef.current >= end || timeRef.current < start) timeRef.current = start;
      } else {
        timeRef.current = t;
        if (t >= end) {
          el.currentTime = start / 1000;
        }
        // Fade in at the window start, out toward its end.
        const fin = Math.min(1, (t - start) / FADE_MS);
        const fout = Math.min(1, (end - t) / FADE_MS);
        el.volume = vol * Math.max(0, Math.min(fin, fout));
      }
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      try {
        el.currentTime = start / 1000;
      } catch {
        /* seek once metadata arrives */
      }
      el.play()
        .then(() => {
          if (!alive) return;
          setPlaying(true);
          setBlocked(false);
        })
        .catch(() => alive && setBlocked(true));
    };
    if (el.readyState >= 1) begin();
    else el.addEventListener('loadedmetadata', begin, { once: true });
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      // Quick fade-out so leaving the screen never clicks.
      const v0 = el.volume;
      const t0 = performance.now();
      const fade = () => {
        const k = Math.min(1, (performance.now() - t0) / 250);
        el.volume = v0 * (1 - k);
        if (k < 1) requestAnimationFrame(fade);
        else {
          el.pause();
          el.removeAttribute('src');
          el.load();
        }
      };
      fade();
    };
  }, [src, start, end, vol]);

  const toggle = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    if (el.paused) {
      if (el.currentTime * 1000 < start || el.currentTime * 1000 > end) el.currentTime = start / 1000;
      el.play()
        .then(() => {
          setPlaying(true);
          setBlocked(false);
        })
        .catch(() => setBlocked(true));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [start, end]);

  return { playing, blocked, timeRef, windowMs: [start, end], toggle };
}
