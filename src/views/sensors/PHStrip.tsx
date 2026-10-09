import { sensorRange } from '../../lib/nexus/sensors'

const PH_ZONES = [
  { to: 5, color: '#ef4444', label: 'Acid' },
  { to: 7, color: '#eab308', label: 'Neutral' },
  { to: 14, color: '#3b82f6', label: 'Base' },
]

export function PHStrip({
  value,
  width = 200,
  scale = 1,
}: {
  value: number
  width?: number
  scale?: number
}) {
  const { min, max } = sensorRange('ph')
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const H = 18 * scale
  const seg = width / PH_ZONES.length
  return (
    <svg width={width} height={40} viewBox={`0 0 ${width} 40`} className="shrink-0">
      {PH_ZONES.map((z, i) => (
        <rect key={i} x={i * seg + 2} y={4} width={seg - 4} height={H} rx={3 * scale} fill={z.color} opacity={0.9} />
      ))}
      <rect x={frac * width - 2} y={2} width={4} height={H + 2} rx={2} fill="#fff" stroke="var(--color-tx)" strokeWidth={1} />
      {PH_ZONES.map((z, i) => (
        <text key={i} x={i * seg + seg / 2} y={H + 22} fontSize={7} fill="var(--color-tx3)" textAnchor="middle" fontFamily="monospace">{z.label}</text>
      ))}
      <text x={width / 2} y={H + 34} fontSize={8} fontWeight="bold" fill="var(--color-tx)" textAnchor="middle" fontFamily="monospace">{value.toFixed(1)}</text>
    </svg>
  )
}
