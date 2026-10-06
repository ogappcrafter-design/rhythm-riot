/**
 * 25 original neon cartoon-character avatars for player profiles, drawn as crisp parametric SVG
 * (no external images, so they're sharp at any size and work offline/in any build). Each is a cute
 * synthwave creature — cats, robots, aliens, foxes, ghosts… — with music gear (headphones, shades,
 * visors) to fit the game's theme. Pick one in profile setup; referenced everywhere by its id.
 */
export type Ears = 'cat' | 'bear' | 'bunny' | 'horn' | 'antenna' | 'none';
export type Eyes = 'happy' | 'round' | 'star' | 'wink' | 'sleepy';
export type Mouth = 'smile' | 'grin' | 'cat' | 'ooo' | 'flat';
export type Gear = 'phones' | 'shades' | 'visor' | 'cap' | 'none';

export interface AvatarDef {
  id: number;
  name: string;
  bg: [string, string]; // badge gradient
  body: string; // face color
  body2: string; // shaded face color
  ears: Ears;
  eyes: Eyes;
  mouth: Mouth;
  gear: Gear;
  accent: string; // gear / detail color
}

const A = (
  id: number,
  name: string,
  bg: [string, string],
  body: string,
  body2: string,
  ears: Ears,
  eyes: Eyes,
  mouth: Mouth,
  gear: Gear,
  accent: string,
): AvatarDef => ({ id, name, bg, body, body2, ears, eyes, mouth, gear, accent });

export const AVATARS: AvatarDef[] = [
  A(0, 'Neon Cat', ['#2a0b4e', '#7c1f9e'], '#ff7ad5', '#d64ba6', 'cat', 'happy', 'cat', 'phones', '#22e3ff'),
  A(1, 'Byte Bot', ['#071a3a', '#0e4d8c'], '#9fe8ff', '#4bb6e8', 'antenna', 'round', 'flat', 'none', '#ffd24a'),
  A(2, 'Star Fox', ['#3a1206', '#a3431a'], '#ff9a53', '#e0702a', 'cat', 'star', 'grin', 'shades', '#ffe14d'),
  A(3, 'Glow Ghost', ['#0a0a2e', '#3b2f80'], '#d7d2ff', '#a79bff', 'none', 'sleepy', 'ooo', 'phones', '#ff6ad5'),
  A(4, 'Panda Pop', ['#101225', '#2b3157'], '#f4f6ff', '#c9cee8', 'bear', 'round', 'smile', 'shades', '#22e3ff'),
  A(5, 'Alien Ace', ['#052617', '#0f7a46'], '#7cff9c', '#2fd36a', 'antenna', 'happy', 'grin', 'visor', '#ff4d6a'),
  A(6, 'Bunny Bass', ['#2e0b2a', '#8a1f6c'], '#ffc0e8', '#e67ac0', 'bunny', 'happy', 'smile', 'phones', '#8ef0ff'),
  A(7, 'Volt Bear', ['#241206', '#8a5a1a'], '#ffcf8a', '#e0a24b', 'bear', 'round', 'grin', 'cap', '#22e3ff'),
  A(8, 'Pixel Pup', ['#0b2436', '#157a8a'], '#9ff0e8', '#4bc3bb', 'bunny', 'happy', 'smile', 'shades', '#ffd24a'),
  A(9, 'Disco Devil', ['#2e0612', '#a01a3a'], '#ff6a84', '#d6395e', 'horn', 'wink', 'grin', 'phones', '#ffe14d'),
  A(10, 'Cosmo Cat', ['#0a0e2e', '#2b2f8c'], '#9fb6ff', '#5c76e0', 'cat', 'star', 'cat', 'visor', '#ff9a3c'),
  A(11, 'Mint Mech', ['#06261f', '#0f8a6a'], '#9fffe0', '#4bd6b0', 'antenna', 'round', 'flat', 'none', '#ff6ad5'),
  A(12, 'Sunset Sal', ['#301206', '#b2531a'], '#ffb06a', '#e0822a', 'none', 'happy', 'smile', 'shades', '#ff4d6a'),
  A(13, 'Grape Ghoul', ['#1a0636', '#5a1f9e'], '#c89fff', '#9a5ce0', 'none', 'sleepy', 'ooo', 'cap', '#8eff9b'),
  A(14, 'Aqua Owl', ['#06202e', '#157a9e'], '#9fe0ff', '#4ba6d6', 'horn', 'round', 'flat', 'visor', '#ffd24a'),
  A(15, 'Lime Lynx', ['#152606', '#5a8a1a'], '#d4ff7c', '#a6d63a', 'cat', 'happy', 'cat', 'phones', '#ff6ad5'),
  A(16, 'Rose Robot', ['#2e0620', '#9e1f6a'], '#ff9fd0', '#e04ba0', 'antenna', 'round', 'flat', 'none', '#22e3ff'),
  A(17, 'Blue Blaze', ['#06143a', '#1f45a0'], '#8aa6ff', '#4b6ae0', 'horn', 'wink', 'grin', 'shades', '#ffe14d'),
  A(18, 'Gold Gremlin', ['#2e2306', '#9e821a'], '#ffe08a', '#e0bb4b', 'bunny', 'star', 'grin', 'visor', '#ff4d6a'),
  A(19, 'Teal Tiger', ['#06262e', '#0f7a8a'], '#7cf0ff', '#2fc3d6', 'cat', 'happy', 'grin', 'cap', '#ff9a3c'),
  A(20, 'Violet Vox', ['#1a062e', '#5a1f9e'], '#cfa6ff', '#9a5ce0', 'bear', 'round', 'smile', 'phones', '#8ef0ff'),
  A(21, 'Coral Croc', ['#2e1206', '#a0431a'], '#ff9a7c', '#e06a4b', 'horn', 'happy', 'grin', 'shades', '#8eff9b'),
  A(22, 'Frost Fennec', ['#0a1a36', '#2b50a0'], '#c0e0ff', '#7ca6e0', 'bunny', 'sleepy', 'smile', 'none', '#ff6ad5'),
  A(23, 'Magma Moth', ['#2e0606', '#a01a1a'], '#ff8a6a', '#e05a3a', 'antenna', 'round', 'flat', 'visor', '#ffd24a'),
  A(24, 'Jade Jester', ['#06260f', '#0f8a3a'], '#8aff9f', '#3ad66a', 'horn', 'wink', 'grin', 'cap', '#ff6ad5'),
];

export function avatarById(id: number | undefined): AvatarDef {
  return AVATARS[((id ?? 0) % AVATARS.length + AVATARS.length) % AVATARS.length];
}

/* ------------------------------ part renderers ------------------------------ */

function Ears({ type, body, accent }: { type: Ears; body: string; accent: string }) {
  switch (type) {
    case 'cat':
      return (
        <g>
          <path d="M30 34 L26 14 L44 28 Z" fill={body} />
          <path d="M70 34 L74 14 L56 28 Z" fill={body} />
          <path d="M31 30 L29 20 L39 27 Z" fill={accent} opacity="0.7" />
          <path d="M69 30 L71 20 L61 27 Z" fill={accent} opacity="0.7" />
        </g>
      );
    case 'bear':
      return (
        <g>
          <circle cx="30" cy="26" r="11" fill={body} />
          <circle cx="70" cy="26" r="11" fill={body} />
          <circle cx="30" cy="26" r="5" fill={accent} opacity="0.65" />
          <circle cx="70" cy="26" r="5" fill={accent} opacity="0.65" />
        </g>
      );
    case 'bunny':
      return (
        <g>
          <rect x="33" y="6" width="10" height="34" rx="5" fill={body} />
          <rect x="57" y="6" width="10" height="34" rx="5" fill={body} />
          <rect x="36" y="10" width="4" height="26" rx="2" fill={accent} opacity="0.7" />
          <rect x="60" y="10" width="4" height="26" rx="2" fill={accent} opacity="0.7" />
        </g>
      );
    case 'horn':
      return (
        <g>
          <path d="M34 30 Q26 10 40 22 Z" fill={accent} />
          <path d="M66 30 Q74 10 60 22 Z" fill={accent} />
        </g>
      );
    case 'antenna':
      return (
        <g>
          <line x1="50" y1="26" x2="50" y2="8" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="7" r="5" fill={accent} />
          <circle cx="48" cy="5" r="1.6" fill="#fff" opacity="0.8" />
        </g>
      );
    default:
      return null;
  }
}

function Eyes({ type, accent }: { type: Eyes; accent: string }) {
  const white = '#0a0820';
  switch (type) {
    case 'happy':
      return (
        <g stroke={white} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M36 52 Q42 44 48 52" />
          <path d="M52 52 Q58 44 64 52" />
        </g>
      );
    case 'round':
      return (
        <g>
          <circle cx="40" cy="52" r="6.5" fill="#fff" />
          <circle cx="60" cy="52" r="6.5" fill="#fff" />
          <circle cx="41" cy="53" r="3.2" fill={white} />
          <circle cx="61" cy="53" r="3.2" fill={white} />
          <circle cx="39.5" cy="50.5" r="1.3" fill="#fff" />
          <circle cx="59.5" cy="50.5" r="1.3" fill="#fff" />
        </g>
      );
    case 'star':
      return (
        <g fill={accent}>
          <path d="M40 46 l2 5 5 1 -4 4 1 5 -4 -3 -4 3 1 -5 -4 -4 5 -1 Z" />
          <path d="M60 46 l2 5 5 1 -4 4 1 5 -4 -3 -4 3 1 -5 -4 -4 5 -1 Z" />
        </g>
      );
    case 'wink':
      return (
        <g>
          <circle cx="40" cy="52" r="6.5" fill="#fff" />
          <circle cx="41" cy="53" r="3.2" fill={white} />
          <path d="M53 52 Q60 45 67 52" stroke={white} strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'sleepy':
      return (
        <g stroke={white} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M35 51 Q41 55 47 51" />
          <path d="M53 51 Q59 55 65 51" />
        </g>
      );
  }
}

function Mouth({ type }: { type: Mouth }) {
  const c = '#0a0820';
  switch (type) {
    case 'smile':
      return <path d="M42 64 Q50 70 58 64" stroke={c} strokeWidth="3.5" strokeLinecap="round" fill="none" />;
    case 'grin':
      return <path d="M40 62 Q50 74 60 62 Z" fill={c} />;
    case 'cat':
      return (
        <path d="M44 63 Q47 67 50 63 Q53 67 56 63" stroke={c} strokeWidth="3" strokeLinecap="round" fill="none" />
      );
    case 'ooo':
      return <ellipse cx="50" cy="65" rx="5" ry="6" fill={c} />;
    case 'flat':
      return <line x1="44" y1="65" x2="56" y2="65" stroke={c} strokeWidth="3.5" strokeLinecap="round" />;
  }
}

function Gear({ type, accent }: { type: Gear; accent: string }) {
  switch (type) {
    case 'phones':
      return (
        <g>
          <path d="M26 54 Q26 24 50 24 Q74 24 74 54" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="18" y="48" width="12" height="20" rx="5" fill={accent} />
          <rect x="70" y="48" width="12" height="20" rx="5" fill={accent} />
          <rect x="21" y="51" width="6" height="14" rx="3" fill="#fff" opacity="0.4" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <rect x="30" y="46" width="18" height="12" rx="4" fill="#0a0820" stroke={accent} strokeWidth="2.5" />
          <rect x="52" y="46" width="18" height="12" rx="4" fill="#0a0820" stroke={accent} strokeWidth="2.5" />
          <line x1="48" y1="50" x2="52" y2="50" stroke={accent} strokeWidth="2.5" />
          <line x1="32" y1="49" x2="44" y2="49" stroke={accent} strokeWidth="2" opacity="0.6" />
        </g>
      );
    case 'visor':
      return (
        <g>
          <rect x="28" y="44" width="44" height="13" rx="6.5" fill={accent} opacity="0.85" />
          <rect x="31" y="47" width="38" height="3.5" rx="1.75" fill="#fff" opacity="0.5" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M26 40 Q50 18 74 40 Z" fill={accent} />
          <path d="M26 40 Q50 36 74 40 L80 46 Q50 42 26 46 Z" fill={accent} />
          <circle cx="50" cy="24" r="2.5" fill="#fff" opacity="0.7" />
        </g>
      );
    default:
      return null;
  }
}

/** Render an avatar by id at a given pixel size. Rounds a glowing synthwave badge around the face. */
export function AvatarPic({ id, size = 64, ring = true }: { id: number; size?: number; ring?: boolean }) {
  const a = avatarById(id);
  const gid = `av-bg-${a.id}`;
  const showGearBehindEyes = a.gear === 'shades' || a.gear === 'visor';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={a.name} role="img">
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor={a.bg[1]} />
          <stop offset="1" stopColor={a.bg[0]} />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${gid})`} stroke={ring ? a.accent : 'none'} strokeWidth={ring ? 2.5 : 0} opacity="1" />
      {/* subtle inner glow */}
      <rect x="2" y="2" width="96" height="96" rx="24" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" />
      <Ears type={a.ears} body={a.body} accent={a.accent} />
      {/* face */}
      <circle cx="50" cy="54" r="27" fill={a.body} />
      <path d="M50 27 A27 27 0 0 1 77 54 A27 27 0 0 0 50 27" fill="#ffffff" opacity="0.12" />
      <ellipse cx="38" cy="62" rx="4.5" ry="3" fill={a.body2} opacity="0.7" />
      <ellipse cx="62" cy="62" rx="4.5" ry="3" fill={a.body2} opacity="0.7" />
      {!showGearBehindEyes && <Eyes type={a.eyes} accent={a.accent} />}
      <Mouth type={a.mouth} />
      <Gear type={a.gear} accent={a.accent} />
    </svg>
  );
}
