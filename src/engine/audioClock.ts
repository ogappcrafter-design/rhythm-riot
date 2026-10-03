/**
 * Audio-synced game clock (spec Section 9: "sample-accurate-ish timing").
 *
 * The song's playback position is the single source of truth for note timing. Because
 * HTMLAudioElement.currentTime only updates a few times per second on some engines, we
 * anchor to it and interpolate with performance.now() between updates, giving smooth
 * millisecond positions without drifting away from the audio.
 *
 * If the audio file is missing or fails to load (the launch tracks are dropped into
 * public/audio/ per environment), the clock transparently falls back to a
 * performance.now() timeline so the whole game stays testable and playable — it simply
 * plays silently. `isFallback` lets the UI surface a designed "audio unavailable" state.
 */

export interface LoadResult {
  ok: boolean;
  isFallback: boolean;
  error?: string;
}

export class AudioClock {
  private audio: HTMLAudioElement | null = null;
  private durationMs: number;
  isFallback = false;

  private running = false;
  private paused = false;

  // Interpolation anchors (audio path).
  private anchorAudioMs = 0;
  private anchorPerf = 0;
  private lastRawAudioMs = -1;

  // Fallback path.
  private fallbackStartPerf = 0;
  private fallbackPausedAt = 0;

  private onEndCb: (() => void) | null = null;
  private musicVolume = 1;

  constructor(durationMs: number) {
    this.durationMs = durationMs;
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.audio) this.audio.volume = this.musicVolume;
  }

  getDurationMs(): number {
    return this.durationMs;
  }

  onEnd(cb: () => void): void {
    this.onEndCb = cb;
  }

  async load(url: string): Promise<LoadResult> {
    if (typeof Audio === 'undefined') {
      this.isFallback = true;
      return { ok: true, isFallback: true, error: 'no-audio-element' };
    }
    return new Promise<LoadResult>((resolve) => {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      let settled = false;
      const done = (r: LoadResult) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      const onReady = () => {
        this.audio = a;
        a.volume = this.musicVolume;
        if (Number.isFinite(a.duration) && a.duration > 0) {
          this.durationMs = Math.round(a.duration * 1000);
        }
        a.addEventListener('ended', () => this.onEndCb?.());
        done({ ok: true, isFallback: false });
      };
      const onError = () => {
        this.isFallback = true;
        done({ ok: true, isFallback: true, error: 'audio-load-failed' });
      };
      a.addEventListener('canplaythrough', onReady, { once: true });
      a.addEventListener('error', onError, { once: true });
      // Safety timeout: if neither event fires (e.g. missing file, some engines), fall back.
      setTimeout(() => {
        if (!settled) {
          this.isFallback = true;
          done({ ok: true, isFallback: true, error: 'audio-load-timeout' });
        }
      }, 4000);
      a.load();
    });
  }

  async start(): Promise<void> {
    this.running = true;
    this.paused = false;
    if (this.audio && !this.isFallback) {
      try {
        this.audio.currentTime = 0;
        await this.audio.play();
        this.anchorAudioMs = 0;
        this.anchorPerf = performance.now();
        this.lastRawAudioMs = 0;
        return;
      } catch {
        // Autoplay blocked or decode error → fall back to silent timeline.
        this.isFallback = true;
      }
    }
    this.fallbackStartPerf = performance.now();
  }

  getPositionMs(): number {
    if (!this.running) return 0;
    if (this.audio && !this.isFallback && !this.paused) {
      const rawMs = this.audio.currentTime * 1000;
      const now = performance.now();
      if (rawMs !== this.lastRawAudioMs) {
        // currentTime advanced → re-anchor.
        this.anchorAudioMs = rawMs;
        this.anchorPerf = now;
        this.lastRawAudioMs = rawMs;
      }
      const interpolated = this.anchorAudioMs + (now - this.anchorPerf);
      // Clamp the interpolation tightly around the true audio position. currentTime only ticks a
      // few times a second, so between ticks we advance with performance.now(); but we must not let
      // that race AHEAD of the real playback, or every note arrives at the receptor slightly early
      // (a consistent "dots line up too soon" feel). One frame of slack (16ms) keeps motion smooth
      // without drifting ahead of what the player actually hears.
      return Math.max(rawMs, Math.min(interpolated, rawMs + 16));
    }
    if (this.paused) return this.fallbackPausedAt;
    return performance.now() - this.fallbackStartPerf;
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.audio && !this.isFallback) {
      this.audio.pause();
    } else {
      this.fallbackPausedAt = performance.now() - this.fallbackStartPerf;
    }
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this.audio && !this.isFallback) {
      void this.audio.play();
      this.anchorPerf = performance.now();
    } else {
      this.fallbackStartPerf = performance.now() - this.fallbackPausedAt;
    }
  }

  /** True once playback position reaches the end (used when the audio 'ended' event
   *  can't fire — i.e. the fallback timeline). */
  isFinished(): boolean {
    return this.getPositionMs() >= this.durationMs;
  }

  stop(): void {
    this.running = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
