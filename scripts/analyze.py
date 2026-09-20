#!/usr/bin/env python3
"""
Rhythm Riot — real audio analysis (spec Section 5.1 / 5.2).

Runs librosa over the actual launch-track audio in public/audio/ and writes the full
beat grid, onset list (with per-onset strength), and normalized RMS energy envelope to
scripts/analysis_real.json. That file is the input to scripts/generateCharts.mjs, which
turns it into the committed per-track chart JSON.

Decoding: the .m4a/.mp3 files are transcoded to a temp WAV via the ffmpeg binary bundled
with imageio-ffmpeg (no system ffmpeg required), then loaded with librosa/soundfile.

Run:  python3 scripts/analyze.py
"""

import json
import os
import subprocess
import tempfile

import numpy as np
import librosa
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
AUDIO_DIR = os.path.join(ROOT, "public", "audio")
OUT_PATH = os.path.join(HERE, "analysis_real.json")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# Must match src/data/tracks.ts (id -> audio filename).
TRACKS = [
    ("i_dont_care_tonight", "i_dont_care_tonight.mp3"),
    ("where_the_inside_opens_wide", "where_the_inside_opens_wide.m4a"),
    ("who_moved_the_moon", "who_moved_the_moon.m4a"),
    ("dub_steps_trip", "dub_steps_trip.m4a"),
    ("everyday_g", "everyday_g.m4a"),
]

SR = 22050
ENV_STEP_SEC = 0.5  # energy-envelope sample spacing


def decode_to_wav(src, dst):
    subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", str(SR), dst],
        check=True,
    )


def analyze(track_id, filename):
    src = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(src):
        raise FileNotFoundError(src)

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.wav")
        decode_to_wav(src, wav)
        y, sr = librosa.load(wav, sr=SR, mono=True)

    duration = float(librosa.get_duration(y=y, sr=sr))

    # --- tempo + beat grid ---
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # --- onsets (full list) + per-onset strength ---
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, onset_envelope=onset_env, backtrack=False
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    env_times = librosa.times_like(onset_env, sr=sr)
    raw_strength = onset_env[onset_frames] if len(onset_frames) else np.array([])
    smax = float(raw_strength.max()) if raw_strength.size else 1.0
    strengths = (raw_strength / smax) if smax > 0 else raw_strength

    # --- RMS energy envelope (normalized 0..1) ---
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.times_like(rms, sr=sr)
    rmax = float(rms.max()) if rms.size else 1.0
    rms_norm = (rms / rmax) if rmax > 0 else rms

    def energy_at(t):
        return float(np.interp(t, rms_times, rms_norm))

    onsets = [
        {"tMs": int(round(t * 1000)), "strength": round(float(s), 4), "energy": round(energy_at(t), 4)}
        for t, s in zip(onset_times, strengths)
    ]

    # Compact energy envelope sampled every ENV_STEP_SEC.
    env = []
    t = 0.0
    while t <= duration:
        env.append({"tMs": int(round(t * 1000)), "e": round(energy_at(t), 4)})
        t += ENV_STEP_SEC

    return {
        "trackId": track_id,
        "durationMs": int(round(duration * 1000)),
        "bpm": round(tempo, 2),
        "numOnsets": len(onsets),
        "numBeats": int(len(beat_times)),
        "beatsMs": [int(round(b * 1000)) for b in beat_times],
        "onsets": onsets,
        "energyEnvelope": env,
    }


def main():
    result = {}
    for track_id, filename in TRACKS:
        print(f"analyzing {track_id} ({filename}) ...", flush=True)
        data = analyze(track_id, filename)
        result[track_id] = data
        print(
            f"   bpm={data['bpm']}  dur={data['durationMs']/1000:.1f}s  "
            f"onsets={data['numOnsets']}  beats={data['numBeats']}  env={len(data['energyEnvelope'])}",
            flush=True,
        )

    with open(OUT_PATH, "w") as f:
        json.dump(result, f)
    print(f"\nWrote {OUT_PATH}")


if __name__ == "__main__":
    main()
