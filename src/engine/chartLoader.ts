import type { TrackChart } from './chartTypes';

/**
 * Loads a track's committed chart JSON. Charts are bundled as static assets (spec 9:
 * no runtime fetch/backend for core gameplay) via Vite's glob import, so adding a new
 * chart file requires no code change here (spec 5.5).
 */

// Eagerly-referenced, lazily-loaded modules — Vite code-splits each chart into its own chunk.
const chartModules = import.meta.glob<{ default: TrackChart }>('../charts/*.json');

const cache = new Map<string, TrackChart>();

export async function loadChart(trackId: string): Promise<TrackChart> {
  const cached = cache.get(trackId);
  if (cached) return cached;

  const path = `../charts/${trackId}.json`;
  const loader = chartModules[path];
  if (!loader) {
    throw new Error(`No chart bundled for track "${trackId}"`);
  }
  const mod = await loader();
  const chart = mod.default;
  cache.set(trackId, chart);
  return chart;
}

/** Sample the song's normalized energy (0..1) at a given time using the chart's moodCurve. */
export function sampleMoodCurve(chart: TrackChart, timeMs: number): number {
  const samples = chart.moodCurve.samples;
  if (samples.length === 0) return 0.3;
  if (timeMs <= samples[0].timeMs) return samples[0].energy;
  const last = samples[samples.length - 1];
  if (timeMs >= last.timeMs) return last.energy;

  // Linear search is fine (≈100 samples); charts are short.
  for (let i = 1; i < samples.length; i++) {
    if (timeMs < samples[i].timeMs) {
      const a = samples[i - 1];
      const b = samples[i];
      const t = (timeMs - a.timeMs) / (b.timeMs - a.timeMs);
      return a.energy + (b.energy - a.energy) * t;
    }
  }
  return last.energy;
}
