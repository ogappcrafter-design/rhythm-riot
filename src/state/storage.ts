import { Preferences } from '@capacitor/preferences';
import type { Difficulty } from '../engine/chartTypes';
import type { LetterGrade } from '../engine/grading';

/**
 * Local persistence (spec 2.2 / 9). All progress — best scores, grades, song completion,
 * Expert unlocks, lifetime stats and settings — is stored under a single namespaced key.
 *
 * Durability: on native (Android/iOS via Capacitor) writes go to Capacitor Preferences, which
 * persists to the OS's native key/value store (SharedPreferences on Android) and survives
 * reliably across launches — unlike WebView localStorage, which the system may evict. We keep an
 * in-memory cache for synchronous reads during render, hydrate it from Preferences at startup
 * (see initStorage), and write-through to both Preferences and localStorage on every change.
 *
 * Every read/write is guarded so a private-mode / quota / plugin failure degrades gracefully.
 * Backend account-sync stays out of scope for v1 (spec Section 10); this shape lets it layer on
 * later without changing callers.
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

/** Cumulative lifetime totals across every run (spec 8.1 Profile/Stats). Accumulated on
 *  every completed run, not just personal bests. */
export interface LifetimeStats {
  runs: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  notes: number;
  scoreSum: number;
  bestCombo: number;
  playMs: number;
  firstPlayedAt: number;
  lastPlayedAt: number;
}

export const EMPTY_LIFETIME: LifetimeStats = {
  runs: 0,
  perfect: 0,
  great: 0,
  good: 0,
  miss: 0,
  notes: 0,
  scoreSum: 0,
  bestCombo: 0,
  playMs: 0,
  firstPlayedAt: 0,
  lastPlayedAt: 0,
};

export interface SaveData {
  settings: Settings;
  /** bests[trackId][difficulty] */
  bests: Record<string, Partial<Record<Difficulty, BestRecord>>>;
  /** expertUnlocked[trackId] === true once ≥90% Perfect on Hard achieved. */
  expertUnlocked: Record<string, boolean>;
  lifetime: LifetimeStats;
  introSeen: boolean;
  calibrationDone: boolean;
  tutorialSeen: boolean;
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
    lifetime: { ...EMPTY_LIFETIME },
    introSeen: false,
    calibrationDone: false,
    tutorialSeen: false,
  };
}

let cache: SaveData | null = null;

/** Merge a parsed (possibly partial/legacy) save over defaults. */
function hydrate(parsed: Partial<SaveData>): SaveData {
  return {
    ...defaultSave(),
    ...parsed,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    bests: parsed.bests ?? {},
    expertUnlocked: parsed.expertUnlocked ?? {},
    lifetime: { ...EMPTY_LIFETIME, ...(parsed.lifetime ?? {}) },
  };
}

/**
 * Hydrate the in-memory cache from durable native storage. Call once at startup and await it
 * before rendering so the first synchronous reads see the saved data. Falls back to (and migrates
 * from) legacy localStorage, then to defaults. Safe to call more than once.
 */
export async function initStorage(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      cache = hydrate(JSON.parse(value) as Partial<SaveData>);
      return;
    }
  } catch {
    /* plugin unavailable (older web view) — fall back below */
  }
  // No native record yet: adopt any legacy localStorage save (or defaults) and write it through
  // so it becomes durable from here on.
  cache = loadSave();
  persist();
}

export function loadSave(): SaveData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = hydrate(JSON.parse(raw) as Partial<SaveData>);
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
  const serialized = JSON.stringify(cache);
  // Durable native write (SharedPreferences on Android). Fire-and-forget; guarded.
  Preferences.set({ key: KEY, value: serialized }).catch(() => {
    /* plugin/native failure — the localStorage mirror below still holds it */
  });
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* quota / private mode — native write above is the source of truth */
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

/** Per-run detail used to accumulate lifetime stats (raw counts + playtime). */
export interface RunDetail {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  durationMs: number;
}

/**
 * Record the outcome of a completed run: update the per-track/difficulty best, accumulate
 * lifetime stats, and flag Expert unlock (≥90% Perfect on Hard). Called once per finished run.
 */
export function recordRun(
  trackId: string,
  diff: Difficulty,
  record: BestRecord,
  detail: RunDetail,
): SubmitResult {
  const s = loadSave();

  // --- personal best (by score) ---
  if (!s.bests[trackId]) s.bests[trackId] = {};
  const prev = s.bests[trackId][diff];
  const isNewRecord = !prev || record.score > prev.score;
  if (isNewRecord) s.bests[trackId][diff] = record;

  // --- lifetime accumulation (every run) ---
  const lt = s.lifetime;
  lt.runs += 1;
  lt.perfect += detail.perfect;
  lt.great += detail.great;
  lt.good += detail.good;
  lt.miss += detail.miss;
  lt.notes += detail.perfect + detail.great + detail.good + detail.miss;
  lt.scoreSum += record.score;
  lt.bestCombo = Math.max(lt.bestCombo, record.maxCombo);
  lt.playMs += detail.durationMs;
  if (!lt.firstPlayedAt) lt.firstPlayedAt = record.playedAt;
  lt.lastPlayedAt = record.playedAt;

  // --- Expert unlock (permanent) ---
  let expertJustUnlocked = false;
  if (diff === 'hard' && record.perfectPercent >= 90 && !s.expertUnlocked[trackId]) {
    s.expertUnlocked[trackId] = true; // never re-locks (spec 2.2)
    expertJustUnlocked = true;
  }

  persist();
  return { isNewRecord, expertJustUnlocked };
}

export function getLifetime(): LifetimeStats {
  return loadSave().lifetime;
}

export function getAllBests(): SaveData['bests'] {
  return loadSave().bests;
}

export function getExpertUnlockMap(): Record<string, boolean> {
  return loadSave().expertUnlocked;
}

export function markIntroSeen(): void {
  loadSave().introSeen = true;
  persist();
}

export function markCalibrationDone(): void {
  loadSave().calibrationDone = true;
  persist();
}

export function isTutorialSeen(): boolean {
  return loadSave().tutorialSeen;
}

export function markTutorialSeen(): void {
  loadSave().tutorialSeen = true;
  persist();
}
