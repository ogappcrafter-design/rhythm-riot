/**
 * Player profile avatars — exactly 8, loaded from image files in public/avatars/ (1.png … 8.png).
 * Pictures only (no character names). To swap the artwork, replace those files (square, ~256×256);
 * no code change needed. Referenced everywhere by id (0–7).
 */
const BASE = import.meta.env.BASE_URL;

export interface AvatarDef {
  id: number;
  src: string;
  accent: string; // ring / selection glow color
}

export const AVATARS: AvatarDef[] = [
  { id: 0, src: `${BASE}avatars/1.png`, accent: '#a06bff' },
  { id: 1, src: `${BASE}avatars/2.png`, accent: '#ff8ad0' },
  { id: 2, src: `${BASE}avatars/3.png`, accent: '#ff7a3c' },
  { id: 3, src: `${BASE}avatars/4.png`, accent: '#35d0ff' },
  { id: 4, src: `${BASE}avatars/5.png`, accent: '#6aa6ff' },
  { id: 5, src: `${BASE}avatars/6.png`, accent: '#ff9ae0' },
  { id: 6, src: `${BASE}avatars/7.png`, accent: '#ff5a5a' },
  { id: 7, src: `${BASE}avatars/8.png`, accent: '#7cf0ff' },
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
      alt={`Avatar ${a.id + 1}`}
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
