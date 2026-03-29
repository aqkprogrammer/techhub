'use client';

/**
 * Layered animated background: soft gradient orbs, drifting dashed grid,
 * flowing arcs, and subtle accent glows. Tech-forward, calm, and theme-aware.
 */
export default function AnimatedBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[rgb(var(--bg))]"
      aria-hidden
    >
      {/* Two soft gradient orbs — float animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-[20%] top-[10%] h-[50vmax] w-[50vmax] rounded-full opacity-[0.1] dark:opacity-[0.14] blur-3xl animate-blob will-change-transform"
          style={{
            background: `radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute right-[-10%] top-[60%] h-[40vmax] w-[40vmax] rounded-full opacity-[0.08] dark:opacity-[0.12] blur-3xl animate-blob will-change-transform"
          style={{
            background: `radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)`,
            animationDelay: '2s',
          }}
        />
      </div>

      {/* Subtle radial vignette for depth */}
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.5]"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgb(var(--bg)) 100%)',
        }}
      />

      {/* SVG layer: grid + arcs */}
      <svg
        className="absolute inset-0 h-full w-full opacity-35 dark:opacity-[0.45]"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dashed-grid"
            width={12}
            height={12}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 v 12"
              fill="none"
              stroke="rgb(var(--muted))"
              strokeWidth="0.1"
              strokeDasharray="1 4"
            />
            <path
              d="M 0 0 h 12"
              fill="none"
              stroke="rgb(var(--muted))"
              strokeWidth="0.1"
              strokeDasharray="1 4"
            />
          </pattern>
          {/* Accent glow for highlighted arcs */}
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid: diagonal drift — animated */}
        <g className="animate-grid-shift will-change-transform" style={{ transformOrigin: '0 0' }}>
          <rect width="100" height="100" fill="url(#dashed-grid)" />
        </g>

        {/* Muted dashed arcs — dash offset animation on each circle */}
        <g fill="none" stroke="rgb(var(--muted))" strokeWidth="0.18">
          <circle cx="10" cy="12" r="28" strokeDasharray="1.2 8" className="animate-dash-flow" />
          <circle cx="90" cy="88" r="32" strokeDasharray="1.2 10" className="animate-dash-flow" />
          <circle cx="52" cy="38" r="14" strokeDasharray="0.8 5" className="animate-dash-flow" />
        </g>
        <g fill="none" stroke="rgb(var(--muted))" strokeWidth="0.15">
          <circle cx="75" cy="20" r="22" strokeDasharray="1 7" className="animate-dash-flow-reverse" />
          <circle cx="25" cy="75" r="18" strokeDasharray="0.9 6" className="animate-dash-flow-reverse" />
        </g>

        {/* Accent arcs — dash flow + opacity pulse */}
        <g fill="none" stroke="rgb(var(--accent))" strokeWidth="0.3" filter="url(#soft-glow)" className="animate-accent-pulse">
          <circle cx="50" cy="50" r="20" strokeDasharray="2 10" className="animate-dash-flow" style={{ opacity: 0.85 }} />
        </g>
        <g fill="none" stroke="rgb(var(--accent))" strokeWidth="0.25" className="animate-accent-pulse" style={{ opacity: 0.6 }}>
          <circle cx="20" cy="50" r="35" strokeDasharray="1.2 9" className="animate-dash-flow-reverse" />
        </g>
      </svg>
    </div>
  );
}
