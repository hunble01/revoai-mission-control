export function SkeletonBlock({ height = 14, width = '100%', style }: { height?: number; width?: string | number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', gap: 10 }}>
          <SkeletonBlock height={12} />
          <SkeletonBlock height={12} />
          <SkeletonBlock height={12} />
        </div>
      ))}
    </div>
  );
}
