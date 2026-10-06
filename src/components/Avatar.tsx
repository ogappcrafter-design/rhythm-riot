/**
 * Player profile avatars — exactly 8, loaded from image files in public/avatars/ (1.png … 8.png).
 * To swap the artwork, just replace those files (keep the names/size ~256×256 square); no code
 * change needed. Referenced everywhere by id (0–7).
 */
const BASE = import.meta.env.BASE_URL;

export interface AvatarDef {
  id: number;
  name: string;
  src: string;
  accent: string; // ring / selection glow color
}

export const AVATARS: AvatarDef[] = [
  { id: 0, name: 'Riot', src: `${BASE}avatars/1.png`, accent: '#a06bff' },
  { id: 1, name: 'Sunny', src: `${BASE}avatars/2.png`, accent: '#ff8ad0' },
  { id: 2, name: 'Blaze', src: `${BASE}avatars/3.png`, accent: '#ff7a3c' },
  { id: 3, name: 'Cosmo', src: `${BASE}avatars/4.png`, accent: '#35d0ff' },
  { id: 4, name: 'Ace', src: `${BASE}avatars/5.png`, accent: '#6aa6ff' },
  { id: 5, name: 'Kitti', src: `${BASE}avatars/6.png`, accent: '#ff9ae0' },
  { id: 6, name: 'Cyber', src: `${BASE}avatars/7.png`, accent: '#ff5a5a' },
  { id: 7, name: 'Beat', src: `${BASE}avatars/8.png`, accent: '#7cf0ff' },
];

export function avatarById(id: number | undefined): AvatarDef {
  const n = AVATARS.length;
  return AVATARS[(((id ?? 0) % n) + n) % n];
}

/** Render an avatar by id at a given pixel size, as a rounded image with an optional neon ring. */
export function AvatarPic({ id, size = 64, ring = true }: { id: number; size?: number; ring?: boolean }) {
  const a = avatarById(id);
  return (
    <img
      className="avatar-img"
      src={a.src}
      width={size}
      height={size}
      alt={a.name}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: Math.round(size * 0.24),
        border: ring ? `2.5px solid ${a.accent}` : 'none',
        boxShadow: ring ? `0 0 16px ${a.accent}99` : undefined,
        display: 'block',
      }}
    />
  );
}
