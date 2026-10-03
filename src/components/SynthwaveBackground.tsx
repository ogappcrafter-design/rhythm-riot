/**
 * App-wide synthwave / retrowave backdrop (menus, song select, results, intro — every non-game
 * screen). A dark neon sky with a banded retro sun, glowing wireframe mountains and a starfield,
 * over an animated perspective grid road flowing toward the viewer. Pure CSS/SVG (GPU transforms,
 * no per-frame JS) so it stays smooth everywhere. Matches the in-game road. No palm trees, no car.
 */
export function SynthwaveBackground() {
  // A jagged neon ridgeline for the wireframe mountains (deterministic zig-zag).
  const peaks = [
    0, 7, 2, 11, 4, 14, 6, 10, 3, 13, 5, 16, 8, 12, 4, 15, 6, 11, 3, 9, 5, 13, 2, 8, 4, 10, 0,
  ];
  const ridge = peaks.map((p, i) => `${(i / (peaks.length - 1)) * 100},${20 - p}`).join(' ');

  return (
    <div className="synth" aria-hidden>
      <div className="synth-sky">
        <div className="synth-stars" />
        <div className="synth-sun" />
        <svg className="synth-mtns synth-mtns-far" viewBox="0 0 100 20" preserveAspectRatio="none">
          <polyline points={`0,20 ${ridge} 100,20`} />
        </svg>
        <svg className="synth-mtns synth-mtns-near" viewBox="0 0 100 20" preserveAspectRatio="none">
          <polyline points={`0,20 ${peaks.map((p, i) => `${(i / (peaks.length - 1)) * 100},${20 - p * 0.62}`).join(' ')} 100,20`} />
        </svg>
      </div>
      <div className="synth-floor" />
      <div className="synth-horizon" />
      <div className="synth-vignette" />
    </div>
  );
}
