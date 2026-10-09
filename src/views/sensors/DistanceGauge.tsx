import { sensorRange } from '../../lib/nexus/sensors'

/** Professional ultrasonic rangefinder display — vertical measurement stick with top sensor and water surface. */
export function DistanceGauge({
  value,
  height = 110,
  scale = 1,
}: {
  value: number
  height?: number
  scale?: number
}) {
  const { min, max } = sensorRange('distance')
  const dist = Math.max(min, Math.min(max, value))
  const frac = (dist - min) / (max - min)
  
  const W = Math.round(80 * scale)
  const H = height
  const pad = 12 * scale
  const stickW = 36 * scale
  const stickX = (W - stickW) / 2
  const top = pad
  const bot = H - pad
  const stickH = bot - top

  const majorTicks = [0, 50, 100, 150, 200, 250, 300, 350, 400]
  const body = frac < 0.25 ? [239, 68, 68] : frac < 0.5 ? [245, 158, 11] : frac < 0.75 ? [34, 197, 94] : [59, 130, 246]
  const waterColor = [14, 165, 233] // clean blue water

  const surfaceY = top + stickH * frac
  const waterH = bot - surfaceY
  const pingTravel = Math.max(0, surfaceY - top - 6)

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-hidden">
      <defs>
        <linearGradient id="dist-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${waterColor[0]},${waterColor[1]},${waterColor[2]},0.85)`} />
          <stop offset="100%" stopColor={`rgba(${waterColor[0]},${waterColor[1]},${waterColor[2]},0.4)`} />
        </linearGradient>
        <linearGradient id="dist-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0.5)`} />
          <stop offset="100%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0)`} />
        </linearGradient>
        <linearGradient id="dist-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="dist-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.3)" />
        </filter>
      </defs>
      
      {/* outer case / tank walls */}
      <rect x={stickX - 6} y={top - 4} width={stickW + 12} height={stickH + 8} rx={8 * scale} fill="var(--color-s3)" stroke="var(--color-tx)" strokeOpacity={0.3} strokeWidth={1.5} filter="url(#dist-shadow)" />
      
      {/* measurement stick background */}
      <rect x={stickX} y={top} width={stickW} height={stickH} rx={5 * scale} fill="var(--color-bg)" />
      
      {/* water fill (bottom up to surface) */}
      {waterH > 0 && (
        <rect x={stickX + 2} y={surfaceY} width={stickW - 4} height={waterH} rx={4 * scale} fill="url(#dist-water)" />
      )}
      
      {/* ultrasonic beam (sensor down to water) */}
      {surfaceY > top && (
        <path d={`M ${stickX + stickW/2 - 6} ${top} L ${stickX + stickW/2 - 12} ${surfaceY} L ${stickX + stickW/2 + 12} ${surfaceY} L ${stickX + stickW/2 + 6} ${top} Z`} fill="url(#dist-beam)" />
      )}
      
      {/* water surface line & reflection */}
      <line x1={stickX + 2} y1={surfaceY} x2={stickX + stickW - 2} y2={surfaceY} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
      
      {/* glass overlay for clean look */}
      <rect x={stickX + 2} y={top} width={stickW - 4} height={stickH} rx={4 * scale} fill="url(#dist-glass)" opacity={0.6} pointerEvents="none" />
      
      {/* scale ticks (0 at top, max at bot) */}
      {majorTicks.map((tick) => {
        const t = (tick - min) / (max - min)
        const y = top + stickH * t
        if (y < top - 1 || y > bot + 1) return null
        const isMajor = tick % 100 === 0
        return (
          <g key={tick}>
            <line x1={stickX} y1={y} x2={stickX + (isMajor ? 12 : 8)} y2={y} stroke="var(--color-tx3)" strokeOpacity={0.6} strokeWidth={isMajor ? 1.5 : 0.8} />
            {isMajor && (
              <text x={stickX - 4} y={y + 3} fontSize={5.5} fill="var(--color-tx3)" textAnchor="end" fontFamily="monospace">{tick}</text>
            )}
          </g>
        )
      })}
      
      {/* Ultrasonic sensor housing at top */}
      <rect x={stickX - 2} y={top - 6} width={stickW + 4} height={10} rx={3} fill="var(--color-s2)" stroke="var(--color-tx)" strokeOpacity={0.8} strokeWidth={1} />
      {/* Sensor eyes with reflections */}
      <circle cx={stickX + stickW/2 - 6} cy={top - 1} r={2.5} fill="#000" />
      <circle cx={stickX + stickW/2 + 6} cy={top - 1} r={2.5} fill="#000" />
      <circle cx={stickX + stickW/2 - 6} cy={top - 1} r={0.8} fill="rgba(255,255,255,0.5)" />
      <circle cx={stickX + stickW/2 + 6} cy={top - 1} r={0.8} fill="rgba(255,255,255,0.5)" />
      
      {/* Animated ping dot (simulating measurement) */}
      {pingTravel > 0 && (
        <>
          <circle cx={stickX + stickW/2} cy={surfaceY - 2} r={1.5} fill={`rgb(${body[0]},${body[1]},${body[2]})`} className="ping-dot" />
          <style>{`
            @keyframes pingMove {
              0% { transform: translateY(-${pingTravel}px); opacity: 0; }
              10% { opacity: 1; }
              90% { transform: translateY(0px); opacity: 1; }
              100% { transform: translateY(0px); opacity: 0; }
            }
            .ping-dot {
              animation: pingMove 1.5s ease-in-out infinite;
            }
          `}</style>
        </>
      )}
      
      
    </svg>
  )
}

