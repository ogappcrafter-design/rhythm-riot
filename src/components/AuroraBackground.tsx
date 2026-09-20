import { useMemo } from 'react';
import { IconRiotShard } from './icons';

/**
 * Shared cinematic background for the entry/menu screens (spec 6.1: "No flat single-color
 * backgrounds anywhere"). Layered drifting aurora blobs + a slow floating shard field +
 * a parallax dot grid. Pure CSS animation (GPU transforms) — no per-frame JS.
 */
export function AuroraBackground({ shards = 9 }: { shards?: number }) {
  const shardData = useMemo(
    () =>
      Array.from({ length: shards }).map((_, i) => ({
        left: `${(i * 37 + 8) % 96}%`,
        top: `${(i * 53 + 12) % 92}%`,
        size: 12 + ((i * 7) % 22),
        dur: 9 + ((i * 3) % 10),
        delay: -(i * 1.7),
        color: i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#7c5cff' : '#b06bff',
      })),
    [shards],
  );

  return (
    <div className="aurora" aria-hidden>
      <div className="aurora-grid" />
      <div className="aurora-blob b1" />
      <div className="aurora-blob b2" />
      <div className="aurora-blob b3" />
      <div className="aurora-shards">
        {shardData.map((s, i) => (
          <span
            key={i}
            className="aurora-shard"
            style={{
              left: s.left,
              top: s.top,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <IconRiotShard size={s.size} color={s.color} />
          </span>
        ))}
      </div>
      <div className="aurora-scan" />
    </div>
  );
}
