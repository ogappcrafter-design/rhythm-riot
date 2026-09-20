/**
 * Track catalog + player-progression order (spec Sections 5.1 / 5.5).
 *
 * Adding a 6th song requires only: a new entry here, a chart JSON in src/charts,
 * an audio file in public/audio, and a palette in palettes.ts — no engine/UI changes
 * (spec Section 5.5: "scale past 5 songs with zero code changes").
 */
export interface TrackMeta {
  id: string;
  title: string;
  /** File placed in public/audio/<audioFile>. */
  audioFile: string;
  /** Key into PALETTES. */
  paletteKey: string;
  /** One-line vibe descriptor shown on the song card. */
  tagline: string;
  bpm: number;
  durationSec: number;
}

/** Ordered easiest → hardest, matching the spec's recommended progression. */
export const TRACKS: TrackMeta[] = [
  {
    id: 'i_dont_care_tonight',
    title: "I Don't Care Tonight",
    audioFile: 'i_dont_care_tonight.mp3',
    paletteKey: 'i_dont_care_tonight',
    tagline: 'Steady groove · easy in',
    bpm: 103.4,
    durationSec: 173.08,
  },
  {
    id: 'where_the_inside_opens_wide',
    title: 'Where the Inside Opens Wide',
    audioFile: 'where_the_inside_opens_wide.mp4',
    paletteKey: 'where_the_inside_opens_wide',
    tagline: 'Wide dynamic swings',
    bpm: 129.2,
    durationSec: 231.05,
  },
  {
    id: 'who_moved_the_moon',
    title: 'Who Moved the Moon',
    audioFile: 'who_moved_the_moon.mp4',
    paletteKey: 'who_moved_the_moon',
    tagline: 'Slow burn · epic build',
    bpm: 95.7,
    durationSec: 243.05,
  },
  {
    id: 'dub_steps_trip',
    title: 'Dub Steps Trip',
    audioFile: 'dub_steps_trip.mp4',
    paletteKey: 'dub_steps_trip',
    tagline: 'Electronic · hard drops',
    bpm: 136.0,
    durationSec: 265.81,
  },
  {
    id: 'everyday_g',
    title: 'Everyday G',
    audioFile: 'everyday_g.mp4',
    paletteKey: 'everyday_g',
    tagline: 'Fastest · densest · prove yourself',
    bpm: 152.0,
    durationSec: 214.69,
  },
];

export const TRACKS_BY_ID: Record<string, TrackMeta> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t]),
);
