#!/usr/bin/env python3
"""
Rhythm Riot — real audio analysis (spec Section 5.1 / 5.2).

Runs librosa over the actual launch-track audio in public/audio/ and writes the full
beat grid, onset list (with per-onset strength), and normalized RMS energy envelope to
scripts/analysis_real.json. That file is the input to scripts/generateCharts.mjs, which
turns it into the committed per-track chart JSON.

Decoding: the .mp4/.mp3 files are transcoded to a temp WAV via the ffmpeg binary bundled
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
    ("where_the_inside_opens_wide", "where_the_inside_opens_wide.mp4"),
    ("who_moved_the_moon", "who_moved_the_moon.mp4"),
    ("dub_steps_trip", "dub_steps_trip.mp4"),
    ("everyday_g", "everyday_g.mp4"),
    ("badass_underglow", "badass_underglow.mp4"),
    ("you_lick_the_lion", "you_lick_the_lion.mp4"),
    ("take_me_back_west", "take_me_back_west.mp4"),
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

    # --- pitch tracking (pYIN) → sustained held-note segments ---
    sustain_segments = detect_sustain_segments(y, sr)

    return {
        "trackId": track_id,
        "durationMs": int(round(duration * 1000)),
        "bpm": round(tempo, 2),
        "numOnsets": len(onsets),
        "numBeats": int(len(beat_times)),
        "beatsMs": [int(round(b * 1000)) for b in beat_times],
        "onsets": onsets,
        "energyEnvelope": env,
        "sustainSegments": sustain_segments,
    }


# ------------------------------------------------------------------ #
# Pitch-based held-note detection                                     #
# ------------------------------------------------------------------ #
PYIN_HOP = 512
PYIN_FRAME = 2048
SEG_MIN_MS = 260          # a held note must last at least this long
SEG_PITCH_TOL = 0.75      # semitones of wobble allowed within one held note
SEG_GAP_FRAMES = 3        # allow a few unvoiced frames (a breath/vibrato dip) before ending


def detect_sustain_segments(y, sr):
    """Track f0 with pYIN and return sustained, stable-pitch segments as held notes:
    [{startMs, endMs, midi}]. A segment is a run of voiced frames whose pitch stays within
    SEG_PITCH_TOL semitones of the run's running median (a note that is genuinely held)."""
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=65.0, fmax=2093.0, sr=sr, frame_length=PYIN_FRAME, hop_length=PYIN_HOP
    )
    times = librosa.times_like(f0, sr=sr, hop_length=PYIN_HOP)
    with np.errstate(divide="ignore", invalid="ignore"):
        midi = 69.0 + 12.0 * np.log2(f0 / 440.0)

    segments = []
    seg_start = None
    seg_vals = []
    gap = 0

    def close(end_i):
        if seg_start is None or end_i < seg_start:
            return
        start_ms = int(round(times[seg_start] * 1000))
        end_ms = int(round(times[end_i] * 1000))
        if end_ms - start_ms >= SEG_MIN_MS and seg_vals:
            segments.append(
                {"startMs": start_ms, "endMs": end_ms, "midi": int(round(float(np.median(seg_vals))))}
            )

    for i in range(len(f0)):
        ok = bool(voiced_flag[i]) and np.isfinite(midi[i])
        if ok:
            if seg_start is None:
                seg_start = i
                seg_vals = [float(midi[i])]
                gap = 0
            else:
                ref = float(np.median(seg_vals[-10:]))
                if abs(float(midi[i]) - ref) <= SEG_PITCH_TOL:
                    seg_vals.append(float(midi[i]))
                    gap = 0
                else:
                    close(i - 1 - gap)
                    seg_start = i
                    seg_vals = [float(midi[i])]
                    gap = 0
        else:
            if seg_start is not None:
                gap += 1
                if gap > SEG_GAP_FRAMES:
                    close(i - gap)
                    seg_start = None
                    seg_vals = []
                    gap = 0
    close(len(f0) - 1)

    # Merge segments separated by a tiny gap at (roughly) the same pitch.
    merged = []
    for s in segments:
        if merged and s["startMs"] - merged[-1]["endMs"] <= 90 and abs(s["midi"] - merged[-1]["midi"]) <= 1:
            merged[-1]["endMs"] = s["endMs"]
        else:
            merged.append(dict(s))
    return merged


def main():
    result = {}
    for track_id, filename in TRACKS:
        print(f"analyzing {track_id} ({filename}) ...", flush=True)
        data = analyze(track_id, filename)
        result[track_id] = data
        print(
            f"   bpm={data['bpm']}  dur={data['durationMs']/1000:.1f}s  "
            f"onsets={data['numOnsets']}  beats={data['numBeats']}  "
            f"heldNotes={len(data['sustainSegments'])}",
            flush=True,
        )

    with open(OUT_PATH, "w") as f:
        json.dump(result, f)
    print(f"\nWrote {OUT_PATH}")


if __name__ == "__main__":
    main()
