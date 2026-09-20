import { useApp } from '../state/appContext';
import { ScreenHeader } from '../components/ui';
import { sfx } from '../audio/sfx';

function Slider({
  label,
  value,
  onChange,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span className="subtle">{format ? format(value) : `${Math.round(value * 100)}%`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SettingsScreen() {
  const { settings, updateSettings, goBack, navigate } = useApp();

  return (
    <div className="screen">
      <ScreenHeader title="SETTINGS" onBack={() => { sfx.play('uiBack'); goBack(); }} />
      <div className="stack" style={{ paddingBottom: 20 }}>
        <Slider
          label="Music Volume"
          value={settings.musicVolume}
          onChange={(v) => updateSettings({ musicVolume: v })}
        />
        <Slider
          label="SFX Volume"
          value={settings.sfxVolume}
          onChange={(v) => {
            updateSettings({ sfxVolume: v });
            sfx.play('uiTap');
          }}
        />
        <Slider
          label="Visual Intensity"
          value={settings.visualIntensity}
          onChange={(v) => updateSettings({ visualIntensity: Math.max(0.35, v) })}
          format={(v) => (v <= 0.4 ? 'Low' : v <= 0.75 ? 'Medium' : 'Full')}
        />
        <div className="faint" style={{ marginTop: -4, paddingLeft: 4 }}>
          Lower intensity reduces particles &amp; flashes — easier on the eyes and on lower-end devices.
        </div>

        <div className="card row" style={{ padding: 16, justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>Haptics</span>
          <button
            className={`toggle ${settings.haptics ? 'on' : ''}`}
            onClick={() => {
              updateSettings({ haptics: !settings.haptics });
              sfx.play('uiTap');
            }}
            aria-pressed={settings.haptics}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="card row" style={{ padding: 16, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Input Latency</div>
            <div className="faint">{settings.latencyOffsetMs} ms offset</div>
          </div>
          <button className="btn btn-ghost" onClick={() => { sfx.play('uiTap'); navigate({ name: 'calibration' }); }}>
            Calibrate
          </button>
        </div>
      </div>
    </div>
  );
}
