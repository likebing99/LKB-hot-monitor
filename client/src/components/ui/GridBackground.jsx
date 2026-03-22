export function GridBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, #86efac 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-500/[0.03] via-transparent to-emerald-500/[0.03]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-400/[0.06] rounded-full blur-[128px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-400/[0.06] rounded-full blur-[128px]" />
    </div>
  );
}
