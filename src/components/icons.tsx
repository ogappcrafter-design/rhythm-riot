import type { CSSProperties } from 'react';

/**
 * Custom-illustrated icon set (spec 6.1: "No generic/stock UI icons").
 * All icons are original SVG paths styled to the game's neon/shard identity — no
 * Material/system icons. Each takes a size and inherits currentColor with a soft glow.
 */

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

const base = (size: number, color?: string, style?: CSSProperties): CSSProperties => ({
  color: color ?? 'currentColor',
  filter: 'drop-shadow(0 0 4px rgba(124,92,255,0.5))',
  display: 'block',
  ...style,
  width: size,
  height: size,
});

export function IconPlay({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none">
      <path d="M7 4.5 19 12 7 19.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

export function IconSettings({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" strokeLinecap="round" />
    </svg>
  );
}

export function IconHelp({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.4c0-1.6 1.3-2.7 2.9-2.7s2.8 1 2.8 2.5c0 2.4-2.7 2.2-2.8 4.3" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBack({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPause({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  );
}

export function IconLock({ size = 24, color, style }: IconProps) {
  // Shard-integrated padlock (spec 2.1: not a generic system lock).
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 11h12l-1 9H7l-1-9Z" fill="rgba(124,92,255,0.15)" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" strokeLinecap="round" />
      <path d="M12 14.5 10.8 17h2.4L12 14.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconStar({ size = 24, color, style, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6}>
      <path d="M12 3.2 14.6 9l6.4.6-4.8 4.2 1.5 6.3L12 16.9 6.3 20.1l1.5-6.3L3 9.6 9.4 9 12 3.2Z" strokeLinejoin="round" />
    </svg>
  );
}

/** The Rhythm Riot shard mark — reused in the logo and as a favicon-style glyph. */
export function IconRiotShard({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none">
      <path d="M12 2 14 9l8 1-6 4 2 8-6-5-6 5 2-8-6-4 8-1 4-7Z" fill="currentColor" opacity="0.9" />
      <path d="M12 2 12 22" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
    </svg>
  );
}

export function IconReplay({ size = 24, color, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" style={base(size, color, style)} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 12a8 8 0 1 1 2.5 5.8" strokeLinecap="round" />
      <path d="M4 8v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
