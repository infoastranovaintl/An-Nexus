import { sensorRange } from '../../lib/nexus/sensors'

const TURB_ZONES = [
  { to: 5, color: '#8fc3d8', label: 'Clear' },
  { to: 50, color: '#22c55e', label: 'Slight' },
  { to: 100, color: '#eab308', label: 'Cloudy' },
  { to: 200, color: '#f97316', label: 'Murky' },
  { to: 400, color: '#ef4444', label: 'Dirty' },
]

export function TurbidityGauge({
  value,
  width = 200,
  scale = 1,
}: {
  value: number
  width?: number
  scale?: number
}) {
  const { min, max } = sensorRange('turbidity')
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const H = 14 * scale
  const seg = width / TURB_ZONES.length
  const activeIdx = TURB_ZONES.findIndex((z) => value >= z.to) || TURB_ZONES.length - 1

  return (
    <svg width={width} height={44} viewBox={`0 0 ${width} 44`} className="shrink-0">
      {TURB_ZONES.map((z, i) => (
        <rect key={i} x={i * seg + 1} y={H / 2 - 6 * scale} width={seg - 2} height={12 * scale} rx={3 * scale} fill={z.color} opacity={i < activeIdx ? 0.95 : 0.25} />
      ))}
      {/* marker */}
      <polygon points={`${frac * width},2 ${frac * width - 4},13 ${frac * width + 4},13`} fill="var(--color-tx)" stroke="var(--color-s1)" strokeWidth={1} />
      {/* labels */}
      {TURB_ZONES.map((z, i) => (
        <text key={i} x={i * seg + seg / 2} y={H / 2 + 16} fontSize={7} fill="var(--color-tx3)" textAnchor="middle" fontFamily="monospace">{z.label}</text>
      ))}
      {/* value */}
      <text x={width / 2} y={H + 30} fontSize={8} fontWeight="bold" fill={TURB_ZONES[activeIdx >= 0 ? activeIdx : 0].color} textAnchor="middle" fontFamily="monospace">{Math.round(value)} NTU</text>
    </svg>
  )
}
