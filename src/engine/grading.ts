import type { HitWindowMs } from './chartTypes';

export type Judgement = 'perfect' | 'great' | 'good' | 'miss';

export interface JudgeResult {
  judgement: Judgement;
  /** Signed timing error in ms (negative = early, positive = late). */
  errorMs: number;
}

/**
 * Grade a tap against a note's ideal time using the difficulty's hit windows.
 * DDR-style: a tap outside the "good" window on the correct lane is a miss but never
 * ends the run (spec Section 1 / 3).
 */
export function judgeTiming(absErrorMs: number, windows: HitWindowMs): Judgement {
  if (absErrorMs <= windows.perfect) return 'perfect';
  if (absErrorMs <= windows.great) return 'great';
  if (absErrorMs <= windows.good) return 'good';
  return 'miss';
}

export const JUDGEMENT_SCORE: Record<Judgement, number> = {
  perfect: 300,
  great: 200,
  good: 100,
  miss: 0,
};

/** How each judgement nudges the combo. */
export function combosAfter(current: number, j: Judgement): number {
  if (j === 'miss') return 0;
  if (j === 'good') return current + 1; // good keeps the combo alive but is the weakest link
  return current + 1;
}

export interface RunTotals {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  maxCombo: number;
  score: number;
}

export const EMPTY_TOTALS: RunTotals = {
  perfect: 0,
  great: 0,
  good: 0,
  miss: 0,
  maxCombo: 0,
  score: 0,
};

export function totalNotes(t: RunTotals): number {
  return t.perfect + t.great + t.good + t.miss;
}

export function accuracyPercent(t: RunTotals): number {
  const n = totalNotes(t);
  if (n === 0) return 0;
  const weighted = t.perfect * 1 + t.great * 0.7 + t.good * 0.35;
  return (weighted / n) * 100;
}

export function perfectPercent(t: RunTotals): number {
  const n = totalNotes(t);
  if (n === 0) return 0;
  return (t.perfect / n) * 100;
}

export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export function letterGrade(accuracy: number, missCount: number, notes: number): LetterGrade {
  const missRate = notes > 0 ? missCount / notes : 1;
  if (accuracy >= 95 && missRate <= 0.02) return 'S';
  if (accuracy >= 88) return 'A';
  if (accuracy >= 75) return 'B';
  if (accuracy >= 55) return 'C';
  return 'D';
}

/** Star rating 1..5 for the results screen, derived from accuracy + miss rate. */
export function starRating(accuracy: number, missCount: number, notes: number): number {
  const missRate = notes > 0 ? missCount / notes : 1;
  if (accuracy >= 95 && missRate <= 0.02) return 5;
  if (accuracy >= 88) return 4;
  if (accuracy >= 74) return 3;
  if (accuracy >= 55) return 2;
  return 1;
}
