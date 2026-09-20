import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';
import { TRACKS_BY_ID } from '../data/tracks';
import { PALETTES } from '../data/palettes';
import type { Difficulty, TrackChart } from '../engine/chartTypes';
import { loadChart } from '../engine/chartLoader';
import { AudioClock } from '../engine/audioClock';
import { GameEngine, type HudState, type RunResult } from '../engine/gameEngine';
import { submitResult, type BestRecord } from '../state/storage';
import { rgbCss } from '../engine/colors';
import { IconPause } from '../components/icons';
import { WordArt } from '../components/WordArt';
import { sfx } from '../audio/sfx';

type Phase = 'loading' | 'error' | 'countdown' | 'playing' | 'paused';

const KEY_MAP = ['d', 'f', 'j', 'k', 'l'];

export function GameplayScreen({ trackId, difficulty }: { trackId: string; difficulty: Difficulty }) {
  const { navigate, settings } = useApp();
  const track = TRACKS_BY_ID[trackId];
  const pal = PALETTES[track.paletteKey];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const clockRef = useRef<AudioClock | null>(null);
  const chartRef = useRef<TrackChart | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [count, setCount] = useState(3);
  const [fallback, setFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hud, setHud] = useState<HudState>({
    score: 0, combo: 0, accuracy: 0, progress: 0, perfect: 0, great: 0, good: 0, miss: 0,
  });
  const [laneCount, setLaneCount] = useState(4);
  const [activeLanes, setActiveLanes] = useState<boolean[]>([]);

  const accent: [string, string, string] = ['#ffffff', rgbCss(pal.high.note), rgbCss(pal.high.glow)];

  // ---- load chart + audio ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chart = await loadChart(trackId);
        if (cancelled) return;
        chartRef.current = chart;
        setLaneCount(chart.difficulties[difficulty].laneCount);
        setActiveLanes(new Array(chart.difficulties[difficulty].laneCount).fill(false));

        const clock = new AudioClock(chart.durationMs);
        clock.setMusicVolume(settings.musicVolume);
        clockRef.current = clock;
        const url = `${import.meta.env.BASE_URL}audio/${track.audioFile}`;
        const res = await clock.load(url);
        if (cancelled) return;
        setFallback(res.isFallback);
        setPhase('countdown');
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load chart');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId, difficulty, track.audioFile]);

  // ---- countdown → start ----
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCount(3);
    let n = 3;
    sfx.play('countdown');
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        sfx.play('countdown');
      } else {
        clearInterval(iv);
        setCount(0);
        sfx.play('countdownGo');
        startEngine();
      }
    }, 750);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startEngine = () => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const clock = clockRef.current;
    if (!canvas || !chart || !clock) return;

    const engine = new GameEngine({
      canvas,
      chart,
      difficulty,
      palette: pal,
      clock,
      latencyOffsetMs: settings.latencyOffsetMs,
      visualIntensity: settings.visualIntensity,
      hapticsEnabled: settings.haptics,
      onHud: setHud,
      onFinish: handleFinish,
    });
    engineRef.current = engine;
    void clock.start().then(() => {
      engine.start();
      setPhase('playing');
    });
  };

  const handleFinish = (result: RunResult) => {
    const record: BestRecord = {
      score: result.totals.score,
      accuracy: result.accuracy,
      vibeScore: result.vibeScore,
      grade: result.grade,
      stars: result.stars,
      perfectPercent: result.perfectPercent,
      maxCombo: result.totals.maxCombo,
      playedAt: Date.now(),
    };
    const sub = submitResult(trackId, difficulty, record);
    if (sub.expertJustUnlocked) sfx.play('unlock');
    else if (sub.isNewRecord) sfx.play('record');
    navigate({
      name: 'results',
      result,
      isNewRecord: sub.isNewRecord,
      expertJustUnlocked: sub.expertJustUnlocked,
    });
  };

  // ---- resize ----
  useEffect(() => {
    const onResize = () => engineRef.current?.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // ---- keyboard (desktop) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing') return;
      const idx = KEY_MAP.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < laneCount) {
        e.preventDefault();
        triggerLane(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, laneCount]);

  // ---- cleanup ----
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      clockRef.current?.stop();
    };
  }, []);

  const triggerLane = (lane: number) => {
    engineRef.current?.hitLane(lane);
    setActiveLanes((prev) => {
      const next = [...prev];
      next[lane] = true;
      return next;
    });
    window.setTimeout(() => {
      setActiveLanes((prev) => {
        const next = [...prev];
        next[lane] = false;
        return next;
      });
    }, 90);
  };

  const doPause = () => {
    if (phase !== 'playing') return;
    engineRef.current?.pause();
    clockRef.current?.pause();
    setPhase('paused');
  };
  const doResume = () => {
    // Resume directly — do NOT route through the 'countdown' phase, which would
    // re-run the countdown effect and spawn a second engine.
    clockRef.current?.resume();
    engineRef.current?.resume();
    setPhase('playing');
  };
  const doQuit = () => {
    engineRef.current?.destroy();
    clockRef.current?.stop();
    navigate({ name: 'songselect' });
  };

  return (
    <div className="gameplay">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* HUD */}
      {(phase === 'playing' || phase === 'paused' || phase === 'countdown') && (
        <div className="hud">
          <div className="hud-top">
            <div className="hud-score">
              <div className="hud-score-val">{hud.score.toLocaleString()}</div>
              <div className="hud-acc">{hud.accuracy.toFixed(1)}%</div>
            </div>
            <div className="hud-progress">
              <div className="hud-progress-fill" style={{ width: `${hud.progress * 100}%`, background: `linear-gradient(90deg, ${rgbCss(pal.low.glow)}, ${rgbCss(pal.high.glow)})` }} />
            </div>
            <button className="icon-btn" onClick={doPause} aria-label="Pause">
              <IconPause size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Lane controls */}
      {(phase === 'playing' || phase === 'paused' || phase === 'countdown') && (
        <div className="lane-controls" style={{ '--lanes': laneCount } as React.CSSProperties}>
          {Array.from({ length: laneCount }).map((_, i) => (
            <button
              key={i}
              className={`lane-btn ${activeLanes[i] ? 'active' : ''}`}
              style={{ ['--pad' as string]: rgbCss(pal.high.glow) }}
              onPointerDown={(e) => {
                e.preventDefault();
                triggerLane(i);
              }}
              aria-label={`Lane ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div className="overlay center">
          <div className="loader-ring" />
          <div style={{ height: 40, marginTop: 20, width: 260 }}>
            <WordArt text="LOADING" size={26} colors={accent} />
          </div>
          <div className="subtle" style={{ marginTop: 6 }}>{track.title}</div>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="overlay center">
          <div style={{ height: 44, width: 280 }}>
            <WordArt text="TRACK ERROR" size={26} colors={['#ffd9df', '#ff9db0', '#ff5d73']} />
          </div>
          <div className="subtle" style={{ marginTop: 10, maxWidth: 300, textAlign: 'center' }}>{errorMsg}</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={doQuit}>
            Back to Songs
          </button>
        </div>
      )}

      {/* Countdown */}
      {phase === 'countdown' && count > 0 && (
        <div className="overlay center countdown">
          <div style={{ height: 140, width: 200 }}>
            <WordArt text={`${count}`} size={120} colors={accent} tilt={0} />
          </div>
        </div>
      )}
      {phase === 'countdown' && count === 0 && (
        <div className="overlay center countdown">
          <div style={{ height: 120, width: 260 }}>
            <WordArt text="GO!" size={96} colors={['#fff', '#8bff9b', '#22d3ee']} />
          </div>
        </div>
      )}

      {/* Audio fallback banner */}
      {fallback && phase === 'playing' && (
        <div className="fallback-banner">
          Silent mode — drop <b>{track.audioFile}</b> into public/audio to hear it
        </div>
      )}

      {/* Pause overlay */}
      {phase === 'paused' && (
        <div className="overlay center pause-menu">
          <div style={{ height: 60, width: 240 }}>
            <WordArt text="PAUSED" size={40} colors={accent} />
          </div>
          <div className="stack" style={{ width: 240, marginTop: 20 }}>
            <button className="btn btn-primary btn-block" onClick={doResume}>Resume</button>
            <button className="btn btn-ghost btn-block" onClick={() => navigate({ name: 'ready', trackId, difficulty })}>Restart</button>
            <button className="btn btn-ghost btn-block" onClick={doQuit}>Quit to Songs</button>
          </div>
        </div>
      )}
    </div>
  );
}
