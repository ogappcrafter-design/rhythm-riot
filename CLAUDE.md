# Rhythm Riot — project guide for Claude Code

A premium, commercial-grade Android **rhythm-tap game** (DDR-style). Built as a web app and
wrapped for Google Play with Capacitor. This file is the orientation doc so any Claude Code
session (web, desktop, or CLI) can pick the project up cold.

## How to open / continue this project in regular Claude Code

1. The code lives on GitHub: `ogappcrafter-design/rhythm-riot`.
2. Install the CLI once: `npm install -g @anthropic-ai/claude-code` (needs Node 18+).
3. Clone and enter it, then just run `claude`:
   ```bash
   git clone https://github.com/ogappcrafter-design/rhythm-riot.git
   cd rhythm-riot
   npm install
   claude
   ```
4. Active development branch: **`claude/new-session-0h125a`** (not `main`). Check it out first:
   `git checkout claude/new-session-0h125a`.
5. Claude Code reads this CLAUDE.md automatically on startup, so it'll already know the layout.

## Stack

- **React 18 + Vite 5 + TypeScript** (strict). UI is plain React; gameplay is a hand-written
  Canvas 2D engine (no game framework).
- **Web Audio API** for SFX (synthesized, no audio files) and **Web Speech API** for spoken cues.
- **Capacitor 6** wraps the built web app into an Android app (`android/`).
- Song audio: AAC in an `.mp4` container (one `.mp3`), in `public/audio/`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (play in a browser). |
| `npm run build` | Typecheck + **regenerate charts** + Vite production build. |
| `npm test` | Vitest suite (includes a byte-identical chart-regen guard). |
| `npm run lint` | ESLint. |
| `python3 scripts/analyze.py` | Re-run librosa audio analysis → `scripts/analysis_real.json`. Slow (pitch tracking). |
| `node scripts/generateCharts.mjs` | Regenerate `src/charts/*.json` from the analysis. |
| `npx cap sync android` | Copy the web build into the Android project. |

## Architecture map

- `src/engine/gameEngine.ts` — the whole gameplay engine: note scheduling, per-finger pointer
  input, judging, the Canvas render loop (orbs, slides, grid, receptors, combo, effects).
- `src/engine/audioClock.ts` — song-position clock; the single source of truth for note timing.
- `src/engine/chartTypes.ts` — chart/note data schema and `Difficulty` / `DIFFICULTY_ORDER`.
- `src/screens/*` — React screens (Intro, Tutorial, MainMenu, SongSelect, Ready, Gameplay,
  Results, Settings, Calibration). Routed by `src/state/appContext.tsx`.
- `src/components/ui.tsx` — shared UI (difficulty chips, headers, grade badge, stars).
- `src/components/WordArt.tsx` — all titles/headers are WordArt SVG, never plain text.
- `src/data/tracks.ts` — the song catalog (id, title, audio file, bpm, duration, palette).
- `src/data/palettes.ts` — per-song mood colorways (low→high mood lerp).
- `src/charts/*.json` — **generated** chart data (do not hand-edit; regenerate instead).
- `scripts/analyze.py` — librosa: beats, onsets, energy, pitch→sustain segments.
- `scripts/generateCharts.mjs` — turns the analysis into deterministic Easy/Medium/Hard/Expert
  charts (lead-in guarantee, holds, slides, slide de-confliction, beat-subdivision coloring).

## Charts are a build-time asset

Charts are generated deterministically (seeded RNG) and committed. `npm test` regenerates them and
fails if the output isn't byte-identical, so **always commit regenerated charts together with any
generator change**.

## Adding a song (end to end)

1. Put browser-playable audio in `public/audio/<id>.mp4` (AAC). Transcode from `.m4a`/`.opus` with
   the bundled ffmpeg: `ffmpeg -i in.m4a -c:a aac -b:a 192k -movflags +faststart public/audio/<id>.mp4`.
2. Add `(id, "<id>.mp4")` to `TRACKS` in `scripts/analyze.py` **and** to `TRACKS` in
   `scripts/generateCharts.mjs`.
3. `python3 scripts/analyze.py` (reads the new bpm + duration).
4. Add the track to `src/data/tracks.ts` (use the analyzed bpm/duration) and a palette to
   `src/data/palettes.ts` (key must match the track id).
5. `node scripts/generateCharts.mjs`, then `npm run build && npm test`.

## Android release

- `android/app/build.gradle` holds `versionCode` / `versionName` — bump both every release.
- Release build uses R8; the deobfuscation (mapping) file lands at
  `android/app/build/outputs/mapping/release/mapping.txt` — upload it to the Play Console.
- `npm run build && npx cap sync android`, then build the AAB in Android Studio.

## House style (from the owner)

- Everything ships Play-Store-ready: polished, animated, no placeholders/TODOs, tests run each step.
- Titles/headers are always WordArt, never plain text.
- Keep it premium, 3D, image-rich, and visually impressive.
