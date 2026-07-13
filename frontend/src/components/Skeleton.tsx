import { RADIUS } from '../theme';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = RADIUS.sm,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: string;
  style?: React.CSSProperties;
}) {
  return <div style={{ ...base, width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} width={c === 0 ? '30%' : `${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={72} radius={RADIUS.md} />
      ))}
    </div>
  );
}

const base: React.CSSProperties = {
  background:
    'linear-gradient(90deg, var(--skeleton-from) 25%, var(--skeleton-mid) 50%, var(--skeleton-from) 75%)',
  backgroundSize: '200px 100%',
  animation: 'belmy-skeleton 1.2s ease-in-out infinite',
};
