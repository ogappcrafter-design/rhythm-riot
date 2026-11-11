/**
 * Audio-synced game clock (spec Section 9: "sample-accurate-ish timing").
 *
 * The song's playback position is the single source of truth for note timing. Because
 * HTMLAudioElement.currentTime only updates in coarse steps on some engines (notably Android),
 * we run a phase-locked clock: it advances with performance.now() and is continuously steered
 * toward the audio, giving smooth, monotonic millisecond positions that never drift away.
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

  // Smoothing state (audio path).
  private lastRawAudioMs = -1; // last distinct currentTime reading (ms)
  private lastRawPerf = 0; // performance.now() when that reading first appeared
  private smoothMs = 0; // the position we hand out: continuous, monotonic, phase-locked to the audio
  private smoothPerf = 0; // performance.now() of the last hand-out (0 = re-snap on next read)

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
        this.lastRawAudioMs = -1;
        this.smoothPerf = 0;
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
        this.lastRawAudioMs = rawMs;
        this.lastRawPerf = now;
      }
      // On phones (Android WebView especially) currentTime advances in coarse steps — every
      // 20–100+ ms depending on the audio buffer — not every frame. Reading it raw (or clamping to
      // it) makes the notes move, freeze, then jump: a stutter that feels like lag even at 60 fps.
      //
      // Instead the clock is phase-locked: it advances at real speed every frame, and is gently
      // steered toward the audio's true position (last reading + time since that reading). It is
      // continuous and never runs backwards, yet stays locked to what the player hears. A large
      // disagreement (decoder stall, first read) snaps straight to the audio.
      const est = rawMs + Math.min(250, now - this.lastRawPerf);
      if (this.smoothPerf === 0 || Math.abs(est - this.smoothMs) > 200) {
        this.smoothMs = est;
      } else {
        const dt = now - this.smoothPerf;
        const free = this.smoothMs + dt;
        // ~150 ms time constant: corrections are invisible but drift can never build up.
        const next = free + (est - free) * Math.min(1, dt / 150);
        this.smoothMs = Math.max(this.smoothMs, next);
      }
      this.smoothPerf = now;
      return this.smoothMs;
    }
    if (this.paused) return this.audio && !this.isFallback ? this.smoothMs : this.fallbackPausedAt;
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
      // Re-lock to the audio on the next read (and forget the pre-pause reading's timestamp, or the
      // estimate would leap ahead by the length of the pause).
      this.lastRawAudioMs = -1;
      this.smoothPerf = 0;
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
