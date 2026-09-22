/**
 * Synthesized sound effects via the Web Audio API — zero asset dependency, fully original.
 * Every hit judgement, UI interaction and celebratory moment has its own designed tone
 * (spec Section 4/8: designed states, not silent flag-flips).
 *
 * The AudioContext must be created/resumed from a user gesture (browser autoplay policy);
 * call `unlock()` on the first tap.
 */

type SfxName =
  | 'perfect'
  | 'great'
  | 'good'
  | 'miss'
  | 'uiTap'
  | 'uiBack'
  | 'countdown'
  | 'countdownGo'
  | 'unlock'
  | 'record'
  | 'combo100'
  | 'combo200'
  | 'rally'
  | 'fanfare';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.8;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.volume <= 0) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseThud(dur: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.volume <= 0) return;
    const t0 = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ensure() || this.volume <= 0) return;
    switch (name) {
      case 'perfect':
        this.tone(880, 0.12, 'triangle', 0.35);
        this.tone(1320, 0.14, 'sine', 0.22);
        break;
      case 'great':
        this.tone(660, 0.1, 'triangle', 0.3);
        break;
      case 'good':
        this.tone(440, 0.09, 'sine', 0.24);
        break;
      case 'miss':
        this.noiseThud(0.14, 0.28);
        this.tone(150, 0.12, 'sawtooth', 0.12, 90);
        break;
      case 'uiTap':
        this.tone(520, 0.06, 'square', 0.14, 620);
        break;
      case 'uiBack':
        this.tone(400, 0.07, 'square', 0.14, 300);
        break;
      case 'countdown':
        this.tone(440, 0.12, 'sine', 0.3);
        break;
      case 'countdownGo':
        this.tone(880, 0.25, 'triangle', 0.4, 1200);
        break;
      case 'unlock':
        [523, 659, 784, 1047].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.18, 'triangle', 0.3), i * 90),
        );
        break;
      case 'record':
        [784, 988, 1319].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.16, 'sine', 0.3), i * 80),
        );
        break;
      case 'combo100':
        // quick bright rising triad — "you're on fire"
        [659, 880, 1109].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.12, 'triangle', 0.22), i * 55),
        );
        break;
      case 'combo200':
        // brighter shimmer sweep for the rainbow tier
        [880, 1109, 1319, 1760].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.14, 'triangle', 0.22), i * 55),
        );
        break;
      case 'rally':
        // warm two-note "keep going" nudge when a big streak drops (kept low so it
        // never fights the music)
        this.tone(392, 0.16, 'sine', 0.16, 523);
        setTimeout(() => this.tone(523, 0.18, 'sine', 0.16), 140);
        break;
      case 'fanfare':
        // celebratory results-screen sting
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          setTimeout(() => this.tone(f, 0.22, 'triangle', 0.32), i * 110),
        );
        setTimeout(() => this.tone(1568, 0.5, 'sine', 0.28), 560);
        break;
    }
  }
}

export const sfx = new SfxEngine();

/**
 * Speak a short line using the device's built-in text-to-speech (Web Speech API) — used for the
 * DDR-style "Are you ready?" right before a song. No audio asset required; degrades to silence
 * where TTS isn't available. Kept short so it finishes during the countdown, before the music.
 */
export function speak(text: string, volume = 1): void {
  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || volume <= 0) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.15;
    u.volume = Math.max(0, Math.min(1, volume));
    synth.speak(u);
  } catch {
    /* TTS unavailable — no-op */
  }
}
