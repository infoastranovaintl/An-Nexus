import type { SensorKind } from '../../lib/nexus/sensors'
import { sensorRange, tankPct } from '../../lib/nexus/sensors'
import { cn } from '../../lib/utils'
import { KIND_COLOR } from './sensorMeta'
import { BatteryGauge } from './BatteryGauge'
import { FlowRateGauge } from './FlowRateGauge'
import { RainfallGauge } from './RainfallGauge'
import { PHStrip } from './PHStrip'
import { DistanceGauge } from './DistanceGauge'
import { WaterTankGauge } from './WaterTankGauge'
import { WaterFlowGauge } from './WaterFlowGauge'
import { TurbidityGauge } from './TurbidityGauge'
import { HumidityGauge } from './HumidityGauge'

/* ── zones per data type ─────────────────────────────────────────── */

export interface Zone {
  label: string
  color: string
  hint: string
}

export interface ZoneBand extends Zone {
  from: number
  to: number
}

const fracOf = (kind: SensorKind, value: number) => {
  const { min, max } = sensorRange(kind)
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/** Ordered status bands per data type, in display units. */
export function zonesFor(kind: SensorKind): ZoneBand[] {
  switch (kind) {
    case 'temp':
      return [
        { from: -Infinity, to: 0, label: 'Freezing', color: '#8fc3d8', hint: 'frost risk' },
        { from: 0, to: 15, label: 'Cold', color: '#1e88e5', hint: 'below comfort' },
        { from: 15, to: 35, label: 'Comfort', color: '#22c55e', hint: 'ideal range' },
        { from: 35, to: 45, label: 'Hot', color: '#f59e0b', hint: 'above comfort' },
        { from: 45, to: Infinity, label: 'Extreme', color: '#ef4444', hint: 'critical heat' },
      ]
    case 'waterTemp':
      return [
        { from: -Infinity, to: 4, label: 'Chill', color: '#38bdf8', hint: 'near freezing' },
        { from: 4, to: 15, label: 'Cool', color: '#22d3ee', hint: 'cold water' },
        { from: 15, to: 25, label: 'Ideal', color: '#22c55e', hint: 'healthy aquatic' },
        { from: 25, to: 32, label: 'Warm', color: '#f59e0b', hint: 'rising temp' },
        { from: 32, to: Infinity, label: 'Hot', color: '#ef4444', hint: 'stress risk' },
      ]
    case 'atmp':
      return [
        { from: -Infinity, to: 985, label: 'Storm', color: '#004b78', hint: 'storm possible' },
        { from: 985, to: 1000, label: 'Low', color: '#8fc3d8', hint: 'unsettled' },
        { from: 1000, to: 1020, label: 'Normal', color: '#22c55e', hint: 'steady conditions' },
        { from: 1020, to: 1030, label: 'High', color: '#f59e0b', hint: 'fair weather' },
        { from: 1030, to: Infinity, label: 'Very high', color: '#ef4444', hint: 'strong high' },
      ]
    case 'altitude':
      return [
        { from: -Infinity, to: 200, label: 'Lowland', color: '#22c55e', hint: 'sea level area' },
        { from: 200, to: 1000, label: 'Mid', color: '#16a34a', hint: 'hilly terrain' },
        { from: 1000, to: 3000, label: 'High', color: '#f59e0b', hint: 'elevated site' },
        { from: 3000, to: Infinity, label: 'Very high', color: '#ef4444', hint: 'mountainous' },
      ]
    case 'turbidity':
      return [
        { from: -Infinity, to: 5, label: 'Clear', color: '#8fc3d8', hint: 'drinking quality' },
        { from: 5, to: 50, label: 'Slight', color: '#22c55e', hint: 'low particles' },
        { from: 50, to: 100, label: 'Cloudy', color: '#eab308', hint: 'suspended solids' },
        { from: 100, to: 200, label: 'Murky', color: '#f97316', hint: 'high turbidity' },
        { from: 200, to: Infinity, label: 'Dirty', color: '#ef4444', hint: 'sediment heavy' },
      ]
    case 'water':
      return [
        { from: -Infinity, to: 20, label: 'Low', color: '#f97316', hint: 'tank nearly empty' },
        { from: 20, to: 80, label: 'Normal', color: '#22c55e', hint: 'healthy level' },
        { from: 80, to: Infinity, label: 'High', color: '#006194', hint: 'near overflow' },
      ]
    case 'distance':
      return [
        { from: -Infinity, to: 25, label: 'Very close', color: '#ef4444', hint: 'collision imminent' },
        { from: 25, to: 75, label: 'Close', color: '#f59e0b', hint: 'reduced clearance' },
        { from: 75, to: 200, label: 'Clear', color: '#22c55e', hint: 'normal clearance' },
        { from: 200, to: Infinity, label: 'Far', color: '#60a5fa', hint: 'beyond close range' },
      ]
    default:
      return [{ from: -Infinity, to: Infinity, label: 'Live', color: KIND_COLOR[kind], hint: 'streaming' }]
  }
}

/** Band unit suffix for ladder labels. */
export function zoneUnit(kind: SensorKind): string {
  switch (kind) {
    case 'temp':
      return '°C'
    case 'waterTemp':
      return '°C'
    case 'atmp':
      return 'hPa'
    case 'altitude':
      return 'm'
    case 'turbidity':
      return 'NTU'
    case 'water':
      return '%'
    case 'distance':
      return 'cm'
    default:
      return ''
  }
}

/** Normalized value for band math (water works on tank percent). */
function bandValue(kind: SensorKind, value: number): number {
  return kind === 'water' ? tankPct({ v: value, unit: 'm' }) : value
}

export function zoneIndexFor(kind: SensorKind, value: number): number {
  const v = bandValue(kind, value)
  const bands = zonesFor(kind)
  const i = bands.findIndex((b) => v < b.to)
  return i < 0 ? bands.length - 1 : i
}

/** Human-readable quality/state zone for a sensor value. */
export function zoneFor(kind: SensorKind, value: number): Zone {
  return zonesFor(kind)[zoneIndexFor(kind, value)]
}

/** Position 0..1 of the value on the status ladder. */
export function zoneFrac(kind: SensorKind, value: number): number {
  if (kind === 'water') return tankPct({ v: value, unit: 'm' }) / 100
  return fracOf(kind, value)
}

/* ── shared arc math for dials ───────────────────────────────── */

const ARC = { A: Math.PI * 0.75, SW: Math.PI * 1.5 }
const arcPt = (size: number, r: number, t: number) => {
  const cx = size / 2
  const cy = size / 2
  return [cx + r * Math.cos(ARC.A + t * ARC.SW), cy + r * Math.sin(ARC.A + t * ARC.SW)] as const
}
const arcPath = (size: number, r: number, t0: number, t1: number) => {
  const [x0, y0] = arcPt(size, r, t0)
  const [x1, y1] = arcPt(size, r, t1)
  const large = t1 - t0 > 0.5 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

/** 270° dial with colored zone segments + needle. */
function ZoneDial({
  frac,
  color,
  zones,
  size = 84,
  min = 0,
  max = 1,
  scale = 1,
}: {
  frac: number
  color: string
  zones: { from: number; to: number; color: string }[]
  size?: number
  min?: number
  max?: number
  scale?: number
}) {
  const f = Math.max(0, Math.min(1, frac))
  const stroke = 8 * scale
  const r = size / 2 - stroke / 2 - 3 * scale
  const [x0, y0] = arcPt(size, r, 0)
  const [x1, y1] = arcPt(size, r, 1)
  const [nx, ny] = arcPt(size, r - 12 * scale, f)
  const majorTs = [0, 0.25, 0.5, 0.75, 1]
  const minorTs = Array.from({ length: 19 }, (_, i) => Math.round(((i + 1) / 20) * 100) / 100).filter((t) => !majorTs.includes(t))
  const majors = majorTs.map((t) => {
    const a = ARC.A + t * ARC.SW
    const [lx, ly] = arcPt(size, r + 2 * scale, t)
    const [tx2, ty2] = arcPt(size, r + 8 * scale, t)
    const [lx2, ly2] = arcPt(size, r + 16 * scale, t)
    const cos = Math.cos(a)
    const anchor: 'start' | 'end' | 'middle' = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
    return { t, lx, ly, tx2, ty2, lx2, ly2, anchor, value: Math.round(min + t * (max - min)) }
  })
  const minors = minorTs.map((t) => {
    const [lx, ly] = arcPt(size, r + 2 * scale, t)
    const [tx2, ty2] = arcPt(size, r + 5 * scale, t)
    return { lx, ly, tx2, ty2 }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 overflow-visible">
      <defs>
        <radialGradient id={`dial-glow-${color.replace('#', '')}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      
      {/* Background glow */}
      <circle cx={size / 2} cy={size / 2} r={size * 0.45} fill={`url(#dial-glow-${color.replace('#', '')})`} />
      
      <path d={`M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`} fill="none" stroke="var(--color-s3)" strokeWidth={stroke} strokeLinecap="round" />
      {zones.map((z, i) => (
        <path key={i} d={arcPath(size, r, z.from, z.to)} fill="none" stroke={z.color} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.8} />
      ))}
      {minors.map((tk, i) => (
        <line key={i} x1={tk.lx} y1={tk.ly} x2={tk.tx2} y2={tk.ty2} stroke="var(--color-tx3)" strokeOpacity={0.4} strokeWidth={0.75} />
      ))}
      {majors.map((tk) => (
        <g key={tk.t}>
          <line x1={tk.lx} y1={tk.ly} x2={tk.tx2} y2={tk.ty2} stroke="var(--color-tx3)" strokeOpacity={0.7} strokeWidth={1.5} />
          <text
            x={tk.lx2}
            y={tk.ly2 + 2.5}
            fontSize={6.5 * scale}
            fill="var(--color-tx3)"
            textAnchor={tk.anchor}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {tk.value}
          </text>
        </g>
      ))}
      
      {/* Premium needle */}
      <line x1={size / 2} y1={size / 2} x2={nx} y2={ny} stroke={color} strokeWidth={2 * scale} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={5 * scale} fill="var(--color-bg)" stroke={color} strokeWidth={1.5 * scale} />
      <circle cx={size / 2} cy={size / 2} r={2 * scale} fill={color} />
    </svg>
  )
}

/* ── thermometer (temperature) ───────────────────────────────── */

export function ThermometerGauge({
  value,
  color,
  height = 110,
  scale = 1,
  kind = 'temp',
}: {
  value: number
  color: string
  height?: number
  scale?: number
  kind?: 'temp' | 'waterTemp'
}) {
  const frac = fracOf(kind, value)
  const { min, max } = sensorRange(kind)
  const W = 80 * scale
  const H = height
  const tubeW = 12 * scale
  const tubeX = (W - tubeW) / 2
  const tubeTop = 10 * scale
  const tubeBot = H - 32 * scale
  const bulbC = tubeBot + 12 * scale
  const bulbR = tubeW / 2 + 5 * scale
  const fillH = (tubeBot - tubeTop) * frac
  const comfort = kind === 'temp' ? { from: 18, to: 28 } : null
  const z = (v: number) => tubeTop + (tubeBot - tubeTop) * (1 - (v - min) / (max - min))
  const ticks: { v: number; major: boolean }[] = []
  for (let v = Math.ceil(min / 10) * 10; v <= max; v += 10) ticks.push({ v, major: true })
  for (let v = Math.ceil(min / 5) * 5; v <= max; v += 5) {
    if (!ticks.some((t) => t.v === v)) ticks.push({ v, major: false })
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id="thermo-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="25%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </linearGradient>
        <linearGradient id="thermo-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {comfort && (
        <rect x={tubeX - 6 * scale} y={z(comfort.to)} width={tubeW + 12 * scale} height={z(comfort.from) - z(comfort.to)} rx={4 * scale} fill={color} opacity={0.12} />
      )}
      {ticks.map((t) => (
        <g key={t.v}>
          <line x1={tubeX + tubeW + 3 * scale} y1={z(t.v)} x2={tubeX + tubeW + (t.major ? 9 * scale : 5 * scale)} y2={z(t.v)} stroke="var(--color-tx3)" strokeOpacity={t.major ? 0.7 : 0.4} strokeWidth={1} />
          {t.major && (
            <text x={tubeX + tubeW + 12 * scale} y={z(t.v) + 2.5 * scale} fontSize={7 * scale} fill="var(--color-tx3)" fontFamily="monospace">{t.v}</text>
          )}
        </g>
      ))}
      {/* Background tube & bulb */}
      <rect x={tubeX} y={tubeTop} width={tubeW} height={tubeBot - tubeTop + bulbR} rx={tubeW / 2} fill="var(--color-s3)" stroke="var(--color-tx3)" strokeOpacity={0.2} />
      <circle cx={tubeX + tubeW / 2} cy={bulbC} r={bulbR} fill="var(--color-s3)" stroke="var(--color-tx3)" strokeOpacity={0.2} />
      
      {/* Liquid fill */}
      <circle cx={tubeX + tubeW / 2} cy={bulbC} r={bulbR - 1.5 * scale} fill={color} opacity={0.9} />
      {fillH > 0 && (
        <rect x={tubeX + 1.5 * scale} y={tubeBot - fillH} width={tubeW - 3 * scale} height={fillH + 4 * scale} rx={(tubeW - 3 * scale) / 2} fill={color} opacity={0.9} />
      )}
      
      {/* Glass overlay */}
      <rect x={tubeX} y={tubeTop} width={tubeW} height={tubeBot - tubeTop + bulbR} rx={tubeW / 2} fill="url(#thermo-glass)" />
      <circle cx={tubeX + tubeW / 2} cy={bulbC} r={bulbR} fill="url(#thermo-glass)" />
      
      {/* Shine */}
      <rect x={tubeX + 1.5 * scale} y={tubeTop + 2 * scale} width={tubeW * 0.3} height={tubeBot - tubeTop + bulbR} rx={tubeW * 0.15} fill="url(#thermo-shine)" />
    </svg>
  )
}

/* ── barometer (atmospheric pressure) ──────────────────────── */

export function BarometerDial({
  value,
  size = 96,
  scale = 1,
}: {
  value: number
  size?: number
  scale?: number
}) {
  const frac = fracOf('atmp', value)
  const { min, max } = sensorRange('atmp')
  return (
    <ZoneDial
      frac={frac}
      color="#7c3aed"
      size={size}
      min={min}
      max={max}
      scale={scale}
      zones={[
        { from: 0, to: 0.45, color: '#004b78' },
        { from: 0.52, to: 0.72, color: '#22c55e' },
        { from: 0.8, to: 1, color: '#f59e0b' },
      ]}
    />
  )
}

/* ── elevation (altitude) ──────────────────────────────────── */

export function ElevationScale({
  value,
  height = 110,
}: {
  value: number
  height?: number
}) {
  const frac = fracOf('altitude', value)
  const { max } = sensorRange('altitude')
  const W = 214
  const imgX = 10
  const imgW = 152
  const imgY = 2
  const imgH = Math.max(40, height - 16)
  const baseY = imgY + imgH
  const span = imgH - 10
  const y = baseY - span * frac
  const railX = imgX + imgW + 2
  const ticks = [0, 1000, 2000, 3000, 4000, max].map((v) => ({
    v,
    ty: baseY - span * (v / max),
  }))
  const midTicks = [500, 1500, 2500, 3500, 4500]

  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="shrink-0">
      <image
        href="/snow-capped-mountain-svgrepo-com.svg"
        x={imgX} y={imgY} width={imgW} height={imgH}
        preserveAspectRatio="xMidYMid meet"
      />
      <line x1={imgX} y1={baseY} x2={imgX + imgW} y2={baseY} stroke="var(--color-ac)" strokeWidth={1.2} strokeDasharray="2 2" />
      <text x={imgX} y={baseY + 7} fontSize={6} fill="var(--color-ac)" textAnchor="start" fontFamily="monospace">sea level</text>
      <line x1={imgX} y1={y} x2={imgX + imgW} y2={y} stroke="var(--color-ac)" strokeWidth={1.6} strokeDasharray="3 3" />
      <polygon points={`${imgX + imgW},${y} ${imgX + imgW + 5},${y - 3} ${imgX + imgW + 5},${y + 3}`} fill="var(--color-ac)" />
      <circle cx={imgX} cy={y} r={2.2} fill="var(--color-ac)" />
      <line x1={railX + 1} y1={imgY} x2={railX + 1} y2={baseY} stroke="var(--color-tx3)" strokeOpacity={0.4} strokeWidth={1} />
      {midTicks.map((v) => {
        const ty = baseY - span * (v / max)
        return (
          <line key={v} x1={railX + 1} y1={ty} x2={railX + 5} y2={ty} stroke="var(--color-tx3)" strokeOpacity={0.35} strokeWidth={1} />
        )
      })}
      {ticks.map(({ v, ty }) => (
        <g key={v}>
          <line x1={railX + 1} y1={ty} x2={railX + 6} y2={ty} stroke="var(--color-tx)" strokeOpacity={0.75} strokeWidth={1} />
          <text x={railX + 9} y={ty + 2.5} fontSize={6} fill="var(--color-tx)" textAnchor="start" fontFamily="monospace" fontWeight="bold">{v}m</text>
        </g>
      ))}
      <text x={imgX + 2} y={Math.max(y - 5, imgY + 8)} fontSize={8} fontWeight="bold" fill="var(--color-ac)" textAnchor="start" fontFamily="monospace">{Math.round(value)}m</text>
    </svg>
  )
}

/* ── unified per-kind indicator ──────────────────────────────── */

export function SensorIndicator({
  kind,
  value,
  height = 96,
  scale = 1,
}: {
  kind: SensorKind
  value: number
  height?: number
  scale?: number
}) {
  const color = KIND_COLOR[kind]
  const frac = fracOf(kind, value)
  switch (kind) {
    case 'temp':
      return <ThermometerGauge value={value} color={color} height={height} scale={scale} kind="temp" />
    case 'waterTemp':
      return <ThermometerGauge value={value} color={color} height={height} scale={scale} kind="waterTemp" />
    case 'atmp':
      return <BarometerDial value={value} size={Math.round(height * 0.9)} scale={scale} />
    case 'altitude':
      return <ElevationScale value={value} height={height} />
    case 'turbidity':
      return <TurbidityGauge value={value} width={Math.min(Math.round(height * 2.1), 260)} scale={scale} />
    case 'ph':
      return <PHStrip value={value} width={Math.min(Math.round(height * 2.1), 260)} scale={scale} />
    case 'water':
      return <WaterTankGauge value={value} height={height} scale={scale} />
    case 'battery':
      return <BatteryGauge value={value} height={height} scale={scale} />
    case 'flow':
      return <WaterFlowGauge value={value} height={height} />
    case 'rain':
      return <RainfallGauge value={value} height={height} />
    case 'wind':
      return <FlowRateGauge value={value} height={height} />
    case 'distance':
      return <DistanceGauge value={value} height={height} />
    case 'hum':
      return <HumidityGauge value={value} height={height} />
    default:
      return (
        <ZoneDial
          frac={frac}
          color={color}
          size={Math.round(height * 0.9)}
          min={sensorRange(kind).min}
          max={sensorRange(kind).max}
          scale={scale}
          zones={[{ from: 0, to: 1, color }]}
        />
      )
  }
}

/* ── status ladder: full band context + current position ─────── */

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function StatusLadder({
  kind,
  value,
  className,
}: {
  kind: SensorKind
  value: number
  className?: string
}) {
  const bands = zonesFor(kind)
  const idx = zoneIndexFor(kind, value)
  const frac = zoneFrac(kind, value)
  const band = bands[idx]
  const min = kind === 'water' ? 0 : sensorRange(kind).min
  const max = kind === 'water' ? 100 : sensorRange(kind).max
  const widths = bands.map((b) => {
    const lo = Math.max(b.from, min)
    const hi = Math.min(b.to, max)
    return Math.max(0, (hi - lo) / (max - min))
  })
  const total = Math.max(widths.reduce((a, w) => a + w, 0), 1e-6)

  return (
    <div className={cn('select-none', className)}>
      <div className="relative h-1.5">
        <div className="flex h-full w-full overflow-hidden rounded-full">
          {bands.map((b, i) => (
            <div key={b.label} className="transition-colors duration-500" style={{ width: `${(widths[i] / total) * 100}%`, background: i === idx ? b.color : hexA(b.color, 0.3) }} />
          ))}
        </div>
        <span className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_3px_rgba(16,24,40,0.35)]" style={{ left: `${frac * 100}%`, background: band.color }} />
      </div>
    </div>
  )
}

/* ── re-exports for backward compatibility ── */
export { BatteryGauge } from './BatteryGauge'
export { FlowRateGauge } from './FlowRateGauge'
export { RainfallGauge } from './RainfallGauge'
export { PHStrip } from './PHStrip'
export { DistanceGauge } from './DistanceGauge'
export { WaterTankGauge } from './WaterTankGauge'
export { WaterFlowGauge } from './WaterFlowGauge'
export { TurbidityGauge } from './TurbidityGauge'
export { HumidityGauge } from './HumidityGauge'
