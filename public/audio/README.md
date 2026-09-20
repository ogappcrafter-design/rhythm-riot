# Track audio goes here

The five launch tracks are **not committed** (they're large binaries, and were not
provided with the build spec). Drop the audio files here with these **exact** filenames:

| Filename | Track |
|---|---|
| `i_dont_care_tonight.mp3` | I Don't Care Tonight |
| `where_the_inside_opens_wide.m4a` | Where the Inside Opens Wide |
| `who_moved_the_moon.m4a` | Who Moved the Moon |
| `dub_steps_trip.m4a` | Dub Steps Trip |
| `everyday_g.m4a` | Everyday G |

> Both `.mp3` and `.m4a` (AAC) play natively in Chrome and Android WebView. The extension in
> each row must match the `audioFile` field in `src/data/tracks.ts` — that's what the loader uses.

The filenames must match the `audioFile` field in each `src/charts/<trackId>.json`
(and `src/data/tracks.ts`). To add a **new** song, follow the same convention — see
the repo `README.md` §"Adding a song".

## What happens if a file is missing?

The game does **not** crash. `AudioClock` (src/engine/audioClock.ts) detects the missing
file and transparently falls back to a `performance.now()` timeline, so the track plays
**silently** but the chart, scoring, mood system and results all still work. A small
"Silent mode" banner appears in gameplay so it's obvious audio is absent. Once the real
files are dropped in, everything syncs to the audio automatically — no code change needed.

> These files **are committed** — they're the game's actual content and must ship in the
> build. (Filenames are lowercase snake_case to match the chart `audioFile` fields.)
