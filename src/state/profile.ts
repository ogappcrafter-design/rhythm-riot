import { TRACKS } from '../data/tracks';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';
import { getAllBests, getExpertUnlockMap, getLifetime, type BestRecord, type LifetimeStats } from './storage';

/**
 * Derived Profile/Stats aggregates (spec 8.1). Pure read over persisted data — no side effects,
 * safe to call on every render of the Profile screen.
 */

export interface TrackProgress {
  trackId: string;
  title: string;
  paletteKey: string;
  bests: Partial<Record<Difficulty, BestRecord>>;
  stars: number; // sum of per-difficulty stars for this track (0..20)
  expertUnlocked: boolean;
}

export interface RankInfo {
  name: string;
  index: number; // 0-based tier
  /** progress toward the next rank, 0..1 (1 at max rank). */
  progress: number;
  starsIntoTier: number;
  starsForNextTier: number;
}

export interface ProfileSummary {
  lifetime: LifetimeStats;
  lifetimeAccuracy: number; // weighted %, matches results-screen accuracy formula
  totalStars: number;
  maxStars: number;
  tracksPlayed: number;
  totalTracks: number;
  difficultiesCleared: number;
  expertUnlockedCount: number;
  bestScore: number;
  bestVibe: number;
  bestAccuracy: number;
  rank: RankInfo;
  tracks: TrackProgress[];
}

// Rank tiers keyed by cumulative stars (max 100 = 5 tracks × 4 diffs × 5 stars).
const RANK_TIERS: { name: string; minStars: number }[] = [
  { name: 'Rookie', minStars: 0 },
  { name: 'Tapper', minStars: 1 },
  { name: 'Rhythmist', minStars: 20 },
  { name: 'Riot Starter', minStars: 40 },
  { name: 'Riot Leader', minStars: 65 },
  { name: 'Riot Legend', minStars: 90 },
];

function rankFor(totalStars: number): RankInfo {
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (totalStars >= RANK_TIERS[i].minStars) idx = i;
  }
  const current = RANK_TIERS[idx];
  const next = RANK_TIERS[idx + 1];
  if (!next) {
    return { name: current.name, index: idx, progress: 1, starsIntoTier: 0, starsForNextTier: 0 };
  }
  const span = next.minStars - current.minStars;
  const into = totalStars - current.minStars;
  return {
    name: current.name,
    index: idx,
    progress: span > 0 ? into / span : 1,
    starsIntoTier: into,
    starsForNextTier: span,
  };
}

export function computeProfile(): ProfileSummary {
  const bests = getAllBests();
  const lifetime = getLifetime();
  const unlocks = getExpertUnlockMap();

  let totalStars = 0;
  let difficultiesCleared = 0;
  let tracksPlayed = 0;
  let bestScore = 0;
  let bestVibe = 0;
  let bestAccuracy = 0;

  const tracks: TrackProgress[] = TRACKS.map((t) => {
    const trackBests = bests[t.id] ?? {};
    let trackStars = 0;
    let played = false;
    for (const d of DIFFICULTY_ORDER) {
      const b = trackBests[d];
      if (b) {
        played = true;
        difficultiesCleared += 1;
        trackStars += b.stars;
        bestScore = Math.max(bestScore, b.score);
        bestVibe = Math.max(bestVibe, b.vibeScore);
        bestAccuracy = Math.max(bestAccuracy, b.accuracy);
      }
    }
    if (played) tracksPlayed += 1;
    totalStars += trackStars;
    return {
      trackId: t.id,
      title: t.title,
      paletteKey: t.paletteKey,
      bests: trackBests,
      stars: trackStars,
      expertUnlocked: unlocks[t.id] === true,
    };
  });

  const expertUnlockedCount = tracks.filter((t) => t.expertUnlocked).length;
  const lifetimeAccuracy =
    lifetime.notes > 0
      ? ((lifetime.perfect * 1 + lifetime.great * 0.7 + lifetime.good * 0.35) / lifetime.notes) * 100
      : 0;

  return {
    lifetime,
    lifetimeAccuracy,
    totalStars,
    maxStars: TRACKS.length * DIFFICULTY_ORDER.length * 5,
    tracksPlayed,
    totalTracks: TRACKS.length,
    difficultiesCleared,
    expertUnlockedCount,
    bestScore,
    bestVibe,
    bestAccuracy,
    rank: rankFor(totalStars),
    tracks,
  };
}

/** Format ms as H:MM:SS or M:SS for playtime display. */
export function formatPlaytime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
