/**
 * Ambient song-preview player for the entry screen and song-select menu.
 *
 * Cycles through the track catalog, playing ~10 seconds of each at low volume and crossfading
 * smoothly from one to the next so the menus always have music behind them. Uses two
 * HTMLAudioElements for a gapless fade. Browsers block autoplay until a user gesture, so start()
 * is safe to call repeatedly — it no-ops while running and retries the play on the next call once a
 * tap has unlocked audio. Automatically silent in environments that can't decode the files.
 */
import { TRACKS } from '../data/tracks';

const SEGMENT_MS = 10000; // audible time per track
const FADE_MS = 1600; // crossfade length

class PreviewPlayer {
  private els: (HTMLAudioElement | null)[] = [null, null];
  private cur = 0;
  private idx = 0;
  private target = 0.22;
  private running = false;
  private tickTimer: number | null = null;
  private fadeTimer: number | null = null;
  private segStart = 0;

  private make(): HTMLAudioElement {
    const a = new Audio();
    a.preload = 'auto';
    a.volume = 0;
    (a as unknown as { playsInline: boolean }).playsInline = true;
    return a;
  }

  private srcFor(i: number): string {
    return `${import.meta.env.BASE_URL}audio/${TRACKS[i % TRACKS.length].audioFile}`;
  }

  private offsetFor(durationSec: number): number {
    // Skip the intro; start ~22% in (capped) on anything long enough for a full segment.
    return durationSec > SEGMENT_MS / 1000 + 6 ? Math.min(durationSec * 0.22, 40) : 0;
  }

  async start(volume: number): Promise<void> {
    this.target = Math.max(0, Math.min(0.5, volume));
    if (this.running || typeof Audio === 'undefined') return;
    if (!this.els[0]) this.els[0] = this.make();
    if (!this.els[1]) this.els[1] = this.make();
    this.cur = 0;
    await this.loadInto(this.cur, this.idx);
    const el = this.els[this.cur]!;
    if (!(await this.tryPlay(el))) return; // autoplay blocked — a later start() retries
    this.running = true;
    this.ramp(el, 0, this.target, FADE_MS, () => {
      this.segStart = performance.now();
      this.scheduleTick();
    });
  }

  setVolume(v: number): void {
    this.target = Math.max(0, Math.min(0.5, v));
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) { clearTimeout(this.tickTimer); this.tickTimer = null; }
    if (this.fadeTimer) { clearTimeout(this.fadeTimer); this.fadeTimer = null; }
    for (const el of this.els) {
      if (!el) continue;
      const start = el.volume;
      if (start <= 0) { try { el.pause(); } catch { /* ignore */ } continue; }
      const t0 = performance.now();
      const fade = () => {
        const k = Math.min(1, (performance.now() - t0) / 380);
        el.volume = start * (1 - k);
        if (k >= 1) { try { el.pause(); } catch { /* ignore */ } }
        else window.setTimeout(fade, 40);
      };
      fade();
    }
  }

  private async tryPlay(el: HTMLAudioElement): Promise<boolean> {
    try { await el.play(); return true; } catch { return false; }
  }

  private loadInto(slot: number, trackIdx: number): Promise<void> {
    const el = this.els[slot]!;
    const t = TRACKS[trackIdx % TRACKS.length];
    el.src = this.srcFor(trackIdx);
    el.volume = 0;
    try { el.load(); } catch { /* ignore */ }
    return new Promise<void>((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      el.addEventListener('loadedmetadata', () => {
        const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : t.durationSec;
        try { el.currentTime = this.offsetFor(dur); } catch { /* ignore */ }
        fin();
      }, { once: true });
      el.addEventListener('error', fin, { once: true });
      setTimeout(fin, 1600);
    });
  }

  private scheduleTick(): void {
    if (!this.running) return;
    this.tickTimer = window.setTimeout(this.tick, 80);
  }

  private tick = (): void => {
    if (!this.running) return;
    const el = this.els[this.cur]!;
    el.volume = this.target; // hold during the body of the segment
    if (performance.now() - this.segStart >= SEGMENT_MS - FADE_MS) {
      void this.advance();
      return;
    }
    this.scheduleTick();
  };

  private async advance(): Promise<void> {
    if (!this.running) return;
    const fromSlot = this.cur;
    const toSlot = 1 - this.cur;
    this.idx = (this.idx + 1) % TRACKS.length;
    await this.loadInto(toSlot, this.idx);
    if (!this.running) return;
    const to = this.els[toSlot]!;
    const from = this.els[fromSlot]!;
    if (!(await this.tryPlay(to))) { this.scheduleTick(); return; }
    const t0 = performance.now();
    const cross = () => {
      if (!this.running) return;
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      to.volume = this.target * k;
      from.volume = this.target * (1 - k);
      if (k >= 1) {
        try { from.pause(); } catch { /* ignore */ }
        this.cur = toSlot;
        this.segStart = performance.now();
        this.scheduleTick();
      } else {
        this.fadeTimer = window.setTimeout(cross, 45);
      }
    };
    cross();
  }

  private ramp(el: HTMLAudioElement, from: number, to: number, dur: number, onDone: () => void): void {
    const t0 = performance.now();
    const step = () => {
      if (!this.running) return;
      const k = Math.min(1, (performance.now() - t0) / dur);
      el.volume = from + (to - from) * k;
      if (k >= 1) onDone();
      else this.fadeTimer = window.setTimeout(step, 45);
    };
    step();
  }
}

export const preview = new PreviewPlayer();
