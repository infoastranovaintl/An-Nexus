import { sensorRange } from '../../lib/nexus/sensors'

export function RainfallGauge({
  value,
  height = 110,
}: {
  value: number
  height?: number
}) {
  const { min, max } = sensorRange('rain')
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const W = 120
  const H = height

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-hidden">
      <image href="/rain.gif" x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid meet" opacity={0.4 + frac * 0.5} />
    </svg>
  )
}
