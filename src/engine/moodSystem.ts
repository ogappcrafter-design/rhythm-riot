import type { Judgement } from './grading';

/**
 * The Mood System (spec Section 4) — the core differentiator.
 *
 * A hidden 0..100 meter with INERTIA. Performance sets a target; the live value eases
 * toward it over ~1-2s so mood transitions feel like a wave, not a light switch. The live
 * value is what the renderer reads every frame to drive color grading, particle density,
 * glow, parallax and combo styling.
 *
 * Mood is purely a downstream RESPONSE to performance — it never feeds back into chart
 * difficulty or note timing (spec 4.3).
 */

/** Time constant for the easing. ~600ms tau => reaches ~90% of target in ~1.4s. */
const TAU_MS = 600;
const NEUTRAL_BASELINE = 34; // where mood drifts when nothing is happening
const DECAY_PER_SEC = 3.5; // gentle pull of the TARGET back toward baseline

const TARGET_DELTA: Record<Judgement, number> = {
  perfect: 8.5,
  great: 4,
  good: 1.2,
  miss: -19,
};

export class MoodSystem {
  /** Live, inertial mood 0..100 (read by the renderer). */
  mood = NEUTRAL_BASELINE;
  /** Where the mood is currently heading. */
  private target = NEUTRAL_BASELINE;

  // Vibe Score accumulation (spec 4.4) — how well the player rode the song's own energy arc.
  private vibeRaw = 0;
  private vibeMax = 0;

  /** 0..1 normalized live mood for color/particle interpolation. */
  get moodNorm(): number {
    return this.mood / 100;
  }

  reset(): void {
    this.mood = NEUTRAL_BASELINE;
    this.target = NEUTRAL_BASELINE;
    this.vibeRaw = 0;
    this.vibeMax = 0;
  }

  /** Advance the eased value toward the target. Call every frame. */
  update(dtMs: number): void {
    // Pull target gently back toward neutral so a hot streak doesn't stay pinned forever.
    const decay = (DECAY_PER_SEC * dtMs) / 1000;
    if (this.target > NEUTRAL_BASELINE) this.target = Math.max(NEUTRAL_BASELINE, this.target - decay);
    else if (this.target < NEUTRAL_BASELINE)
      this.target = Math.min(NEUTRAL_BASELINE, this.target + decay);

    const k = 1 - Math.exp(-dtMs / TAU_MS);
    this.mood += (this.target - this.mood) * k;
    if (this.mood < 0) this.mood = 0;
    if (this.mood > 100) this.mood = 100;
  }

  /**
   * Register a judged note.
   * @param j          judgement
   * @param combo      combo count AFTER this note (streaks accelerate the climb)
   * @param songEnergy normalized 0..1 energy of the song at this moment (from moodCurve)
   */
  registerJudgement(j: Judgement, combo: number, songEnergy: number): void {
    let delta = TARGET_DELTA[j];
    // Sustained streaks push harder toward high mood (feels like building momentum).
    if (j !== 'miss') {
      const streakBonus = Math.min(1.6, combo / 40);
      delta *= 1 + streakBonus * 0.6;
    }
    this.target = Math.max(0, Math.min(100, this.target + delta));

    // --- Vibe Score: reward riding the song's high-energy sections cleanly ---
    const quality = j === 'perfect' ? 1 : j === 'great' ? 0.72 : j === 'good' ? 0.38 : -0.55;
    const moodFactor = 0.5 + 0.5 * this.moodNorm;
    this.vibeRaw += songEnergy * quality * moodFactor;
    this.vibeMax += songEnergy; // ceiling: perfect + full mood through every note
  }

  /** Final Vibe Score (0..10000), the "secret premium stat". */
  vibeScore(): number {
    if (this.vibeMax <= 0) return 0;
    const ratio = this.vibeRaw / this.vibeMax;
    return Math.max(0, Math.round(ratio * 10000));
  }
}
