import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appContext';
import { ScreenHeader } from '../components/ui';
import { markCalibrationDone } from '../state/storage';
import { WordArt } from '../components/WordArt';
import { sfx } from '../audio/sfx';

/**
 * Latency calibration (spec Section 9). A steady metronome plays; the player taps to the
 * beat; we measure the average signed offset between taps and the beat grid and store it as
 * a per-device latencyOffsetMs. In gameplay, tapMs = songMs - latencyOffsetMs, so a player
 * who consistently taps late has their input pulled back into line.
 */
const BEAT_MS = 500; // 120 BPM
const MAX_SAMPLES = 16;

export function CalibrationScreen() {
  const { settings, updateSettings, goBack } = useApp();
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [samples, setSamples] = useState<number[]>([]);
  const [avg, setAvg] = useState<number | null>(null);

  const firstBeatRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const stop = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  };

  const start = () => {
    sfx.unlock();
    setSamples([]);
    setAvg(null);
    firstBeatRef.current = performance.now();
    setRunning(true);
    const tick = () => {
      sfx.play('countdown');
      setPulse(true);
      window.setTimeout(() => setPulse(false), 120);
    };
    tick();
    intervalRef.current = window.setInterval(tick, BEAT_MS);
  };

  useEffect(() => () => stop(), []);

  const onTap = () => {
    if (!running) return;
    const now = performance.now();
    const elapsed = now - firstBeatRef.current;
    const nearestBeat = Math.round(elapsed / BEAT_MS) * BEAT_MS;
    let err = elapsed - nearestBeat; // positive = tapped late
    // Ignore wild outliers (double taps / missed entirely)
    if (Math.abs(err) > BEAT_MS / 2) err = err > 0 ? BEAT_MS / 2 : -BEAT_MS / 2;
    setSamples((prev) => {
      const next = [...prev, err].slice(-MAX_SAMPLES);
      const mean = next.reduce((a, b) => a + b, 0) / next.length;
      setAvg(mean);
      return next;
    });
  };

  const save = () => {
    if (avg === null) return;
    updateSettings({ latencyOffsetMs: Math.round(avg) });
    markCalibrationDone();
    sfx.play('record');
    stop();
    goBack();
  };

  const reset = () => {
    updateSettings({ latencyOffsetMs: 0 });
    setSamples([]);
    setAvg(null);
    sfx.play('uiBack');
  };

  return (
    <div className="screen">
      <ScreenHeader title="CALIBRATE" onBack={() => { sfx.play('uiBack'); stop(); goBack(); }} />

      <div className="stack center" style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <div className="subtle center" style={{ maxWidth: 320 }}>
          Start the metronome, then tap the pad exactly on each beat. We&apos;ll measure your device&apos;s delay.
        </div>

        <button
          className={`calib-pad ${pulse ? 'pulse' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); onTap(); }}
        >
          <div style={{ height: 40, width: 160 }}>
            <WordArt text={running ? 'TAP!' : 'READY'} size={26} fitHeight />
          </div>
        </button>

        <div className="card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: 220 }}>
          <div className="faint">MEASURED OFFSET</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>
            {avg === null ? `${settings.latencyOffsetMs} ms` : `${Math.round(avg)} ms`}
          </div>
          <div className="subtle">{samples.length} / {MAX_SAMPLES} taps</div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          {!running ? (
            <button className="btn btn-primary" onClick={start}>Start Metronome</button>
          ) : (
            <button className="btn btn-ghost" onClick={stop}>Stop</button>
          )}
          <button className="btn btn-ghost" onClick={reset}>Reset to 0</button>
        </div>

        <button className="btn btn-primary btn-block" disabled={avg === null} onClick={save} style={{ maxWidth: 320 }}>
          Save Offset
        </button>
      </div>
    </div>
  );
}
