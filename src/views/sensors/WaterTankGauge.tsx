import { tankPct } from '../../lib/nexus/sensors'

export function WaterTankGauge({
  value,
  pct,
  height = 110,
  scale = 1,
}: {
  value: number
  pct?: number
  height?: number
  scale?: number
}) {
  const cap = pct !== undefined ? Math.max(0, Math.min(100, pct)) : tankPct({ v: value, unit: 'cm' })
  const p = cap / 100
  const W = 120
  const tankW = 64 * scale
  const tankX = (W - tankW) / 2
  const top = 10
  const bot = height - 8
  const fillH = (bot - top) * p
  const waveY = bot - fillH
  const body = p < 0.3 ? [30, 64, 175] : p > 0.9 ? [37, 99, 235] : [14, 165, 233]

  const scaleLbl = [
    { p: 1, label: 'FULL' },
    { p: 0.75, label: '75' },
    { p: 0.5, label: '50' },
    { p: 0.25, label: '25' },
    { p: 0, label: '0' },
  ]
  const minorPs = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]
  
  // Wave paths (length = 2 * tankW to allow translating by -tankW)
  const tw = tankW
  // Front wave
  const waveFront = `M 0 0 q ${tw/4} 3.5, ${tw/2} 0 t ${tw/2} 0 t ${tw/2} 0 t ${tw/2} 0 L ${2*tw} ${fillH + 10} L 0 ${fillH + 10} Z`
  // Back wave (slightly offset in phase)
  const waveBack = `M 0 0 q ${tw/4} -3.5, ${tw/2} 0 t ${tw/2} 0 t ${tw/2} 0 t ${tw/2} 0 L ${2*tw} ${fillH + 10} L 0 ${fillH + 10} Z`

  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="shrink-0 overflow-hidden">
      <style>{`
        @keyframes waveMoveFront {
          0% { transform: translate(${tankX + 2}px, ${waveY}px); }
          100% { transform: translate(${tankX + 2 - tw}px, ${waveY}px); }
        }
        @keyframes waveMoveBack {
          0% { transform: translate(${tankX + 2 - tw/2}px, ${waveY}px); }
          100% { transform: translate(${tankX + 2 - tw - tw/2}px, ${waveY}px); }
        }
        .wave-front {
          animation: waveMoveFront 3s linear infinite;
        }
        .wave-back {
          animation: waveMoveBack 4s linear infinite;
        }
      `}</style>
      <defs>
        <linearGradient id="wt-fill-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0.9)`} />
          <stop offset="100%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0.6)`} />
        </linearGradient>
        <linearGradient id="wt-fill-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0.5)`} />
          <stop offset="100%" stopColor={`rgba(${body[0]},${body[1]},${body[2]},0.2)`} />
        </linearGradient>
        <linearGradient id="wt-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id="wt-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id="wt-clip">
          <rect x={tankX + 2} y={top + 2} width={tankW - 4} height={bot - top - 4} rx={6 * scale} />
        </clipPath>
      </defs>
      
      {/* outer container */}
      <rect x={tankX} y={top} width={tankW} height={bot - top} rx={8 * scale} fill="var(--color-s3)" stroke="var(--color-tx3)" strokeOpacity={0.4} />
      {/* glass panel back */}
      <rect x={tankX + 2} y={top + 2} width={tankW - 4} height={bot - top - 4} rx={6 * scale} fill="url(#wt-glass)" opacity={0.5} />
      
      {/* liquid */}
      {fillH > 1 && (
        <g clipPath="url(#wt-clip)">
          {/* Base fill */}
          <rect x={tankX + 2} y={waveY + 4} width={tankW - 4} height={fillH} fill="url(#wt-fill-front)" />
          {/* Animated waves */}
          <path d={waveBack} fill="url(#wt-fill-back)" className="wave-back" />
          <path d={waveFront} fill="url(#wt-fill-front)" className="wave-front" />
        </g>
      )}
      
      {/* Empty tank line */}
      {fillH <= 1 && (
        <line x1={tankX + 6} y1={bot - 3} x2={tankX + tankW - 6} y2={bot - 3} stroke="var(--color-tx3)" strokeOpacity={0.4} strokeWidth={1.5} />
      )}
      
      {/* glass panel front shine */}
      <rect x={tankX + 2} y={top + 2} width={12 * scale} height={bot - top - 4} rx={6 * scale} fill="url(#wt-glass)" opacity={0.8} />

      {/* Scale labels */}
      {scaleLbl.map(({ p: sp, label }) => {
        const y = top + (bot - top) * (1 - sp)
        return (
          <g key={label}>
            <line x1={tankX - 5} y1={y} x2={tankX} y2={y} stroke="var(--color-tx3)" strokeOpacity={0.6} strokeWidth={1} />
            <text x={tankX - 9} y={y + 2.5} fontSize={6} fill="var(--color-tx3)" textAnchor="end" fontFamily="monospace">{label}</text>
          </g>
        )
      })}
      {minorPs.map((sp) => {
        const y = top + (bot - top) * (1 - sp)
        return <line key={sp} x1={tankX - 3} y1={y} x2={tankX} y2={y} stroke="var(--color-tx3)" strokeOpacity={0.3} strokeWidth={0.7} />
      })}
      
      {/* Percentage bubble */}
      <rect x={tankX + tankW + 4} y={Math.max(waveY - 6, top + 2)} width={28} height={14} rx={7} fill={`rgba(${body[0]},${body[1]},${body[2]},0.9)`} />
      <text x={tankX + tankW + 18} y={Math.max(waveY + 4, top + 12)} fontSize={7} fontWeight="bold" fill="#062e24" textAnchor="middle" fontFamily="monospace">{Math.round(cap)}%</text>
    </svg>
  )
}

