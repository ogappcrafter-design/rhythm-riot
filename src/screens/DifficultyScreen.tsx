import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/appContext';
import { TRACKS_BY_ID } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import { DIFFICULTY_ORDER, type Difficulty, type DifficultyChart, type TrackChart } from '../engine/chartTypes';
import { loadChart } from '../engine/chartLoader';
import { getBest, isExpertUnlocked } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { ScreenHeader, StarRow } from '../components/ui';
import { WordArt } from '../components/WordArt';
import { TrackCover } from '../components/TrackCover';
import { MiniHighway } from '../components/MiniHighway';
import { IconLock, IconPlay } from '../components/icons';
import { useTrackPreview } from '../audio/trackPreview';
import { sfx } from '../audio/sfx';

const DIFF_NAME: Record<Difficulty, string> = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', expert: 'EXPERT' };
const DIFF_COLOR: Record<Difficulty, string> = { easy: '#4ade80', medium: '#38bdf8', hard: '#f472b6', expert: '#f59e0b' };
const DIFF_BLURB: Record<Difficulty, string> = {
  easy: 'Warm up · gentle one-lane drags',
  medium: 'Full groove · wider slides',
  hard: 'Every hit in the song',
  expert: 'Five lanes · no mercy',
};

interface Stats {
  lanes: number;
  notes: number;
  taps: number;
  holds: number;
  slides: number;
  nps: number;
  peak: number;
  level: number;
}

function chartStats(d: DifficultyChart): Stats {
  const ns = d.notes;
  let taps = 0;
  let holds = 0;
  let slides = 0;
  for (const n of ns) {
    if (n.type === 'slide') slides++;
    else if (n.type === 'hold') holds++;
    else taps++;
  }
  const first = ns.length ? ns[0].timeMs : 0;
  const lastN = ns.length ? ns[ns.length - 1] : undefined;
  const last = lastN ? lastN.timeMs + (lastN.holdMs ?? 0) : 1;
  const span = Math.max(1000, last - first);
  const nps = (ns.length / span) * 1000;
  // Peak density: most notes inside any 2-second stretch.
  let peakCount = 0;
  let j = 0;
  for (let i = 0; i < ns.length; i++) {
    while (ns[i].timeMs - ns[j].timeMs > 2000) j++;
    peakCount = Math.max(peakCount, i - j + 1);
  }
  const level = Math.max(1, Math.min(10, Math.round((nps - 1) * 3 + 1 + (d.laneCount >= 5 ? 0.5 : 0))));
  return { lanes: d.laneCount, notes: ns.length, taps, holds, slides, nps, peak: peakCount / 2, level };
}

const LAST_KEY = (id: string) => `rr.lastDiff.${id}`;

export function DifficultyScreen({ trackId }: { trackId: string }) {
  const { navigate, goBack, settings } = useApp();
  const track = TRACKS_BY_ID[trackId];
  const pal = PALETTES[track.paletteKey];
  const glow = rgbCss(pal.high.glow);
  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), glow];
  const expertOpen = isExpertUnlocked(trackId);

  const [chart, setChart] = useState<TrackChart | null>(null);
  const [selected, setSelected] = useState<Difficulty>(() => {
    try {
      const v = localStorage.getItem(LAST_KEY(trackId)) as Difficulty | null;
      if (v && DIFFICULTY_ORDER.includes(v) && (v !== 'expert' || expertOpen)) return v;
    } catch {
      /* ignore */
    }
    return 'easy';
  });

  useEffect(() => {
    let alive = true;
    loadChart(trackId)
      .then((c) => alive && setChart(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trackId]);

  const stats = useMemo(() => {
    if (!chart) return null;
    const out = {} as Record<Difficulty, Stats>;
    for (const d of DIFFICULTY_ORDER) out[d] = chartStats(chart.difficulties[d]);
    return out;
  }, [chart]);

  // Preview the hook: the hottest point of the song's energy curve.
  const hookMs = useMemo(() => {
    if (!chart) return track.durationSec * 1000 * 0.3;
    let best = chart.moodCurve.samples[0];
    for (const s of chart.moodCurve.samples) if (s.energy > (best?.energy ?? -1)) best = s;
    return best?.timeMs ?? 30000;
  }, [chart, track.durationSec]);
  const preview = useTrackPreview(
    `${import.meta.env.BASE_URL}audio/${track.audioFile}`,
    hookMs,
    track.durationSec * 1000,
    Math.min(0.85, settings.musicVolume),
  );

  const choose = (d: Difficulty) => {
    if (d === 'expert' && !expertOpen) {
      sfx.play('uiBack');
      return;
    }
    sfx.play('uiTap');
    setSelected(d);
    try {
      localStorage.setItem(LAST_KEY(trackId), d);
    } catch {
      /* ignore */
    }
  };

  const play = () => {
    sfx.unlock();
    sfx.play('countdownGo');
    navigate({ name: 'game', trackId, difficulty: selected });
  };

  const hardBest = getBest(trackId, 'hard');
  const mins = Math.floor(track.durationSec / 60);
  const secs = String(Math.round(track.durationSec % 60)).padStart(2, '0');

  return (
    <div className="screen diff-screen" style={{ ['--card-accent' as string]: glow, ['--sel' as string]: DIFF_COLOR[selected] }}>
      <ScreenHeader title="DIFFICULTY" onBack={() => { sfx.play('uiBack'); goBack(); }} colors={accent} />
      <div className="step-tag">STEP 2 · CHOOSE YOUR DIFFICULTY</div>

      <div className="diff-scroll fade-mask">
        {/* Song hero */}
        <div className="song-hero card">
          <div className="song-hero-cover">
            <TrackCover trackId={track.id} palette={pal} size={118} />
          </div>
          <div className="song-hero-info">
            <div style={{ height: 42 }}>
              <WordArt text={track.title} size={26} align="start" colors={accent} tilt={-3} fitHeight />
            </div>
            <div className="faint" style={{ marginTop: 4 }}>{track.tagline}</div>
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="pill">{Math.round(track.bpm)} BPM</span>
              <span className="pill">{mins}:{secs}</span>
              {track.explicit && <span className="pill pill-explicit">EXPLICIT</span>}
            </div>
          </div>
        </div>

        {/* Live preview: real notes of the selected difficulty, in sync with the song */}
        <div className="preview-panel card">
          <div className="preview-head">
            <span className={`preview-live${preview.playing ? ' is-on' : ''}`}>
              <span className="preview-dot" /> {preview.playing ? 'NOW PREVIEWING' : 'PREVIEW'}
            </span>
            <span className="preview-diff" style={{ color: DIFF_COLOR[selected] }}>{DIFF_NAME[selected]} CHART</span>
            <button className="preview-btn" onClick={preview.toggle} aria-label={preview.playing ? 'Pause preview' : 'Play preview'}>
              {preview.playing ? '❚❚' : '▶'}
            </button>
          </div>
          <div className="preview-stage">
            {chart ? (
              <MiniHighway
                notes={chart.difficulties[selected].notes}
                laneCount={chart.difficulties[selected].laneCount}
                beatsMs={chart.beatsMs}
                timeRef={preview.timeRef}
                accent={DIFF_COLOR[selected]}
              />
            ) : (
              <div className="loader-ring" />
            )}
          </div>
          {preview.blocked && !preview.playing && (
            <button className="preview-tap" onClick={preview.toggle}>▶ TAP TO HEAR THE SONG</button>
          )}
        </div>

        {/* Difficulty cards */}
        <div className="diff-cards">
          {DIFFICULTY_ORDER.map((d) => {
            const st = stats?.[d];
            const locked = d === 'expert' && !expertOpen;
            const best = getBest(trackId, d);
            const on = d === selected;
            return (
              <button
                key={d}
                className={`diff-card${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
                style={{ ['--dc' as string]: DIFF_COLOR[d] }}
                onClick={() => choose(d)}
                aria-pressed={on}
                aria-label={`${DIFF_NAME[d]}${locked ? ' (locked)' : ''}`}
              >
                <div className="diff-card-top">
                  <span className="diff-card-name">
                    {locked && <IconLock size={15} color="#fff" />} {DIFF_NAME[d]}
                  </span>
                  <span className="diff-card-blurb">{DIFF_BLURB[d]}</span>
                  <span className="diff-meter" aria-label={st ? `Level ${st.level} of 10` : undefined}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <i key={i} className={st && i < st.level ? 'on' : ''} />
                    ))}
                    <b>{st ? st.level : '–'}</b>
                  </span>
                </div>
                <div className="diff-stats">
                  <span><b>{st?.notes ?? '–'}</b>NOTES</span>
                  <span><b>{st?.slides ?? '–'}</b>SLIDES</span>
                  <span><b>{st?.holds ?? '–'}</b>HOLDS</span>
                  <span><b>{st?.lanes ?? '–'}</b>LANES</span>
                  <span><b>{st ? st.nps.toFixed(1) : '–'}</b>NOTES/S</span>
                  <span><b>{st ? st.peak.toFixed(1) : '–'}</b>PEAK/S</span>
                </div>
                {locked ? (
                  <div className="diff-card-foot">
                    Unlock: 90% Perfect on Hard{hardBest ? ` · your best ${hardBest.perfectPercent.toFixed(0)}%` : ''}
                  </div>
                ) : best ? (
                  <div className="diff-card-foot">
                    BEST <b>{best.score.toLocaleString()}</b> · {best.grade} · {best.accuracy.toFixed(1)}%
                    <span style={{ marginLeft: 'auto' }}><StarRow count={best.stars} size={12} /></span>
                  </div>
                ) : (
                  <div className="diff-card-foot faint">Not played yet — set the first record</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn btn-primary btn-block play-confirm row" onClick={play}>
        <IconPlay size={22} color="#fff" /> PLAY · {DIFF_NAME[selected]}
      </button>
    </div>
  );
}
