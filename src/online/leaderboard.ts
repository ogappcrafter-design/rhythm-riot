/**
 * Online leaderboards + challenges (Supabase PostgREST, anon/publishable key).
 *
 * No login: each device gets a stable random player id stored locally, and the player's name +
 * avatar (from their local profile) are denormalized onto each submitted score. We submit a score
 * only when it's a new personal best, and de-dupe to each player's best when reading, so a board
 * shows one row per player. Everything degrades gracefully (and silently) when offline or blocked —
 * the game never depends on the network.
 *
 * The publishable key is safe to ship in a client app; the database is protected by row-level
 * security (public read, validated insert only — no anon update/delete).
 */
import type { Difficulty } from '../engine/chartTypes';
import { getProfile } from '../state/storage';

const SUPABASE_URL = 'https://thtpxnseevxsshpkmkpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_11STqK67Rd-9vdxvpCQx6w_r5MoZNKR';
const REST = `${SUPABASE_URL}/rest/v1/scores`;
const HEADERS: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};
const TIMEOUT_MS = 7000;

export interface ScoreRow {
  id?: string;
  player_id: string;
  username: string;
  avatar_id: number;
  track_id: string;
  difficulty: Difficulty;
  score: number;
  accuracy: number;
  perfect_percent: number;
  max_combo: number;
  grade: string;
  created_at?: string;
}

const PID_KEY = 'rr_player_id';

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `p_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(PID_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function withTimeout(init: RequestInit): RequestInit {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { ...init, signal: ctrl.signal };
}

/** Submit a run as the player's best for that track+difficulty. Fire-and-forget; never throws. */
export async function submitScore(entry: {
  trackId: string;
  difficulty: Difficulty;
  score: number;
  accuracy: number;
  perfectPercent: number;
  maxCombo: number;
  grade: string;
}): Promise<boolean> {
  const profile = getProfile();
  if (!profile) return false;
  const row: ScoreRow = {
    player_id: getPlayerId(),
    username: profile.username,
    avatar_id: profile.avatarId,
    track_id: entry.trackId,
    difficulty: entry.difficulty,
    score: Math.max(0, Math.round(entry.score)),
    accuracy: Number(entry.accuracy.toFixed(2)),
    perfect_percent: Number(entry.perfectPercent.toFixed(2)),
    max_combo: Math.max(0, Math.round(entry.maxCombo)),
    grade: entry.grade,
  };
  try {
    const res = await fetch(REST, withTimeout({
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    }));
    return res.ok;
  } catch {
    return false;
  }
}

/** De-dupe rows to each player's single best (highest score), preserving order. */
function bestPerPlayer(rows: ScoreRow[]): ScoreRow[] {
  const seen = new Map<string, ScoreRow>();
  for (const r of rows) {
    const prev = seen.get(r.player_id);
    if (!prev || r.score > prev.score) seen.set(r.player_id, r);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

async function query(params: string): Promise<ScoreRow[] | null> {
  try {
    const res = await fetch(`${REST}?${params}`, withTimeout({ headers: HEADERS }));
    if (!res.ok) return null;
    return (await res.json()) as ScoreRow[];
  } catch {
    return null;
  }
}

/** Top scores for a track+difficulty (one row per player). null = couldn't reach the server. */
export async function fetchTrackBoard(trackId: string, difficulty: Difficulty, limit = 100): Promise<ScoreRow[] | null> {
  const rows = await query(
    `track_id=eq.${encodeURIComponent(trackId)}&difficulty=eq.${difficulty}&order=score.desc&limit=${limit * 2}`,
  );
  return rows ? bestPerPlayer(rows).slice(0, limit) : null;
}

/** Global top scores across all tracks (one row per player). */
export async function fetchGlobalBoard(limit = 100): Promise<ScoreRow[] | null> {
  const rows = await query(`order=score.desc&limit=${limit * 3}`);
  return rows ? bestPerPlayer(rows).slice(0, limit) : null;
}

/* ----------------------------- challenges ----------------------------- */
// A challenge is simply "beat this score on this track+difficulty". We encode it as a short code so
// it can be shared by text; decoding gives the target to chase, and results compares against it.

export interface Challenge {
  username: string;
  trackId: string;
  difficulty: Difficulty;
  score: number;
}

export function encodeChallenge(c: Challenge): string {
  try {
    return 'RR-' + btoa(`${c.username}|${c.trackId}|${c.difficulty}|${c.score}`).replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeChallenge(code: string): Challenge | null {
  try {
    const raw = code.trim().replace(/^RR-/i, '');
    const parts = atob(raw).split('|');
    if (parts.length !== 4) return null;
    const [username, trackId, difficulty, score] = parts;
    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) return null;
    const s = Number(score);
    if (!Number.isFinite(s)) return null;
    return { username, trackId, difficulty: difficulty as Difficulty, score: s };
  } catch {
    return null;
  }
}
