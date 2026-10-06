import { useEffect, useState } from 'react';
import { useApp } from '../state/appContext';
import { TRACKS, TRACKS_BY_ID } from '../data/tracks';
import { DIFFICULTY_ORDER, type Difficulty } from '../engine/chartTypes';
import { ScreenHeader } from '../components/ui';
import { AvatarPic } from '../components/Avatar';
import { fetchGlobalBoard, fetchTrackBoard, getPlayerId, decodeChallenge, type ScoreRow } from '../online/leaderboard';
import { sfx } from '../audio/sfx';

type Scope = 'global' | 'track';
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', expert: 'EXPERT' };

export function LeaderboardScreen() {
  const { goBack, navigate } = useApp();
  const [scope, setScope] = useState<Scope>('global');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);

  const acceptCode = () => {
    const c = decodeChallenge(code);
    if (!c || !TRACKS_BY_ID[c.trackId]) { setCodeErr(true); return; }
    sfx.play('uiTap');
    navigate({ name: 'ready', trackId: c.trackId, difficulty: c.difficulty, challenge: c });
  };
  const [trackId, setTrackId] = useState<string>(TRACKS[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'offline'>('loading');
  const me = getPlayerId();

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setRows(null);
    const run = scope === 'global' ? fetchGlobalBoard(100) : fetchTrackBoard(trackId, difficulty, 100);
    run.then((r) => {
      if (cancelled) return;
      if (r === null) { setState('offline'); return; }
      setRows(r);
      setState('ok');
    });
    return () => { cancelled = true; };
  }, [scope, trackId, difficulty]);

  return (
    <div className="screen">
      <ScreenHeader title="LEADERBOARDS" onBack={() => { sfx.play('uiBack'); goBack(); }} />

      {/* Accept a challenge code */}
      <div className="lb-challenge">
        <input
          className="name-input"
          style={{ fontSize: 15 }}
          placeholder="Paste a challenge code (RR-…)"
          value={code}
          onChange={(e) => { setCode(e.target.value); setCodeErr(false); }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="btn btn-primary" onClick={acceptCode} disabled={!code.trim()}>Accept</button>
      </div>
      {codeErr && <div className="lb-note" style={{ color: '#ff8a9a' }}>That challenge code didn&apos;t look right.</div>}

      {/* Scope toggle */}
      <div className="lb-tabs">
        <button className={`lb-tab${scope === 'global' ? ' is-on' : ''}`} onClick={() => { sfx.play('uiTap'); setScope('global'); }}>Global</button>
        <button className={`lb-tab${scope === 'track' ? ' is-on' : ''}`} onClick={() => { sfx.play('uiTap'); setScope('track'); }}>By Song</button>
      </div>

      {scope === 'track' && (
        <div className="lb-filters">
          <select className="lb-select" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
            {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {DIFFICULTY_ORDER.map((d) => (
              <button key={d} className={`lb-diff${d === difficulty ? ' is-on' : ''}`} onClick={() => { sfx.play('uiTap'); setDifficulty(d); }}>
                {DIFF_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="stack fade-mask" style={{ paddingBottom: 24, marginTop: 12 }}>
        {state === 'loading' && <div className="lb-note"><div className="loader-ring sm" /> Loading scores…</div>}
        {state === 'offline' && (
          <div className="lb-note">
            Couldn&apos;t reach the leaderboard. Check your connection — scores sync automatically next time.
          </div>
        )}
        {state === 'ok' && rows && rows.length === 0 && (
          <div className="lb-note">No scores yet. Set a personal best and you&apos;ll be the first on the board! 🏆</div>
        )}
        {state === 'ok' && rows && rows.map((r, i) => {
          const mine = r.player_id === me;
          const track = TRACKS_BY_ID[r.track_id];
          return (
            <div className={`lb-row${mine ? ' is-me' : ''}`} key={r.id ?? `${r.player_id}-${i}`}>
              <div className={`lb-rank r${i + 1 <= 3 ? i + 1 : 0}`}>{i + 1}</div>
              <AvatarPic id={r.avatar_id} size={38} ring={false} />
              <div className="lb-who">
                <div className="lb-name">{r.username}{mine ? ' (you)' : ''}</div>
                <div className="lb-sub">
                  {scope === 'global'
                    ? `${track?.title ?? r.track_id} · ${DIFF_LABEL[r.difficulty]}`
                    : `${r.grade} · ${r.max_combo}x · ${r.accuracy.toFixed(1)}%`}
                </div>
              </div>
              <div className="lb-score">{r.score.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
