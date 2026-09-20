import type { Difficulty } from '../engine/chartTypes';
import type { LetterGrade } from '../engine/grading';

/**
 * Local persistence (spec 2.2 / 9). Everything is stored in localStorage under a single
 * namespaced key, read/written through a guarded facade so a private-mode or quota failure
 * degrades gracefully instead of crashing the game.
 *
 * Backend account-sync is explicitly out of scope for v1 (spec Section 10) — the shape here
 * is designed so a sync layer can be layered on later without changing callers.
 */

const KEY = 'rhythm_riot_save_v1';

export interface BestRecord {
  score: number;
  accuracy: number;
  vibeScore: number;
  grade: LetterGrade;
  stars: number;
  perfectPercent: number;
  maxCombo: number;
  playedAt: number;
}

export interface Settings {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  haptics: boolean;
  /** 0.35..1 — scales particle density & flash intensity (accessibility + performance). */
  visualIntensity: number;
  /** Per-device input latency offset in ms (from calibration). Positive = taps land late. */
  latencyOffsetMs: number;
}

export interface SaveData {
  settings: Settings;
  /** bests[trackId][difficulty] */
  bests: Record<string, Partial<Record<Difficulty, BestRecord>>>;
  /** expertUnlocked[trackId] === true once ≥90% Perfect on Hard achieved. */
  expertUnlocked: Record<string, boolean>;
  introSeen: boolean;
  calibrationDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.85,
  sfxVolume: 0.8,
  haptics: true,
  visualIntensity: 1,
  latencyOffsetMs: 0,
};

function defaultSave(): SaveData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    bests: {},
    expertUnlocked: {},
    introSeen: false,
    calibrationDone: false,
  };
}

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cache = {
        ...defaultSave(),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        bests: parsed.bests ?? {},
        expertUnlocked: parsed.expertUnlocked ?? {},
      };
      return cache;
    }
  } catch {
    /* corrupt / unavailable — fall through to defaults */
  }
  cache = defaultSave();
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode — keep in-memory only */
  }
}

export function getSettings(): Settings {
  return loadSave().settings;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const s = loadSave();
  s.settings = { ...s.settings, ...patch };
  persist();
  return s.settings;
}

export function getBest(trackId: string, diff: Difficulty): BestRecord | undefined {
  return loadSave().bests[trackId]?.[diff];
}

export function isExpertUnlocked(trackId: string): boolean {
  return loadSave().expertUnlocked[trackId] === true;
}

export interface SubmitResult {
  isNewRecord: boolean;
  expertJustUnlocked: boolean;
}

/**
 * Record the outcome of a completed run. Returns whether it was a new best and whether
 * this run just satisfied the Expert unlock condition (≥90% Perfect on Hard).
 */
export function submitResult(
  trackId: string,
  diff: Difficulty,
  record: BestRecord,
): SubmitResult {
  const s = loadSave();
  if (!s.bests[trackId]) s.bests[trackId] = {};
  const prev = s.bests[trackId][diff];
  const isNewRecord = !prev || record.score > prev.score;
  if (isNewRecord) s.bests[trackId][diff] = record;

  let expertJustUnlocked = false;
  if (diff === 'hard' && record.perfectPercent >= 90 && !s.expertUnlocked[trackId]) {
    s.expertUnlocked[trackId] = true; // permanent, never re-locks (spec 2.2)
    expertJustUnlocked = true;
  }

  persist();
  return { isNewRecord, expertJustUnlocked };
}

export function markIntroSeen(): void {
  loadSave().introSeen = true;
  persist();
}

export function markCalibrationDone(): void {
  loadSave().calibrationDone = true;
  persist();
}
