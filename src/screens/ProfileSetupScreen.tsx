import { useState } from 'react';
import { useApp } from '../state/appContext';
import { getProfile, saveProfile } from '../state/storage';
import { AVATARS, AvatarPic } from '../components/Avatar';
import { WordArt } from '../components/WordArt';
import { ScreenHeader } from '../components/ui';
import { sfx } from '../audio/sfx';

/**
 * Minimal profile setup: pick a username + one of 25 neon cartoon avatars. Shown once on first run
 * (before the menu) and reachable later from the menu to edit. Profiles are what multiplayer uses
 * to show who you're playing against.
 */
export function ProfileSetupScreen({ firstRun = false }: { firstRun?: boolean }) {
  const { navigate, goBack } = useApp();
  const existing = getProfile();
  const [name, setName] = useState(existing?.username ?? '');
  const [avatar, setAvatar] = useState(existing?.avatarId ?? 0);

  const trimmed = name.trim();
  const canSave = trimmed.length >= 2;

  const save = () => {
    if (!canSave) return;
    sfx.play('uiTap');
    saveProfile({ username: trimmed, avatarId: avatar });
    navigate({ name: 'menu' });
  };

  return (
    <div className="screen">
      {!firstRun && <ScreenHeader title="PROFILE" onBack={() => { sfx.play('uiBack'); goBack(); }} />}
      {firstRun && (
        <div style={{ height: 54, marginTop: 6 }}>
          <WordArt text="CREATE PROFILE" size={34} colors={['#ffffff', '#8ef0ff', '#22d3ee']} align="middle" fitHeight />
        </div>
      )}

      <div className="stack fade-mask" style={{ paddingBottom: 90 }}>
        {/* Preview */}
        <div className="profile-preview">
          <div className="profile-preview-av"><AvatarPic id={avatar} size={96} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="faint" style={{ letterSpacing: '0.1em' }}>PLAYER NAME</div>
            <input
              className="name-input"
              value={name}
              maxLength={16}
              placeholder="Enter a name"
              onChange={(e) => setName(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
              2–16 characters
            </div>
          </div>
        </div>

        {/* Avatar grid */}
        <div className="faint" style={{ margin: '14px 2px 8px', letterSpacing: '0.1em' }}>CHOOSE YOUR CHARACTER</div>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              className={`avatar-cell${a.id === avatar ? ' is-sel' : ''}`}
              onClick={() => { sfx.play('uiTap'); setAvatar(a.id); }}
              aria-label={`Avatar ${a.id + 1}`}
              style={{ ['--sel' as string]: a.accent }}
            >
              <AvatarPic id={a.id} size={64} ring={false} />
            </button>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="profile-savebar">
        <button className="btn btn-primary btn-block" disabled={!canSave} onClick={save}>
          {firstRun ? "Let's go" : 'Save'}
        </button>
      </div>
    </div>
  );
}
