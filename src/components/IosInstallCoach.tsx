import { useState } from 'react';
import { WordArt } from './WordArt';

/**
 * iPhone install guide. Shown when the game is opened from the download page's "Install on iPhone"
 * button (?install=1) in iOS Safari and not already running as a Home Screen app. It walks the
 * player through Safari's Share → Add to Home Screen, with icons matching what they'll tap.
 * Never shown once installed (standalone), never shown on Android/desktop.
 */

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function shouldShowIosCoach(): boolean {
  try {
    return new URLSearchParams(location.search).has('install') && isIOS() && !isStandalone();
  } catch {
    return false;
  }
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const AddIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
    <circle cx="6" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="18" cy="12" r="1.8" fill="currentColor" />
  </svg>
);

export function IosInstallCoach() {
  const [open, setOpen] = useState(shouldShowIosCoach);
  if (!open) return null;
  return (
    <div className="ios-coach" role="dialog" aria-label="Install Rhythm Riot on your iPhone">
      <div className="ios-coach-card">
        <img className="ios-coach-icon" src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" />
        <div style={{ height: 50 }}>
          <WordArt text="ADD TO HOME SCREEN" size={30} colors={['#ffffff', '#8ef0ff', '#22d3ee']} fitHeight />
        </div>
        <div className="ios-coach-sub">Install Rhythm Riot as a full-screen app · plays offline</div>
        <ol className="ios-coach-steps">
          <li>
            <span className="ios-coach-chip"><ShareIcon /></span>
            <span>
              Tap <b>Share</b> in Safari's toolbar.
              <em> On newer iPhones it's inside the <span className="ios-inline"><DotsIcon /></span> menu.</em>
            </span>
          </li>
          <li>
            <span className="ios-coach-chip"><AddIcon /></span>
            <span>Scroll down and tap <b>Add to Home Screen</b>.</span>
          </li>
          <li>
            <span className="ios-coach-chip ios-coach-chip-go">✓</span>
            <span>Tap <b>Add</b> — then launch <b>Rhythm Riot</b> from your Home Screen.</span>
          </li>
        </ol>
        <button className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
          Got it
        </button>
      </div>
      <div className="ios-coach-arrow" aria-hidden>
        <svg viewBox="0 0 40 52" width="40" height="52">
          <path d="M20 2v40M8 30l12 14 12-14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>SAFARI TOOLBAR</span>
      </div>
    </div>
  );
}
