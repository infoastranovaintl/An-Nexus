import {
  LuActivity as Activity,
  LuBatteryFull as BatteryFull,
  LuCloudFog as CloudFog,
  LuCloudRain as CloudRain,
  LuCloudSun as CloudSun,
  LuDroplets as Droplets,
  LuFlaskConical as FlaskConical,
  LuGauge as Gauge,
  LuMountain as Mountain,
  LuMove as Move,
  LuThermometer as Thermometer,
  LuThermometerSnowflake as ThermometerWater,
  LuWaves as Waves,
  LuWind as Wind,
} from 'react-icons/lu'
import type { IconType } from 'react-icons'
import type { SensorKind, SensorSample } from '../../lib/nexus/sensors'
import type { SensorPoint } from '../../store/nexus'

export interface SensorSource {
  mac: string
  label: string
  online: boolean
}

/** History series for the newest sample of a kind (any node). */
export function latestFor(
  kind: SensorKind,
  history: Record<string, Record<string, SensorPoint[]>>,
  readings: Record<string, SensorSample[]>,
): { v: number; ts?: number }[] {
  let best: { mac: string; key: string; kind: string; ts: number } | null = null
  for (const [mac, samples] of Object.entries(readings)) {
    if (!samples) continue
    for (const s of samples) {
      if (s.kind === kind && (!best || s.ts > best.ts)) best = { mac, key: s.key, kind: s.kind, ts: s.ts }
    }
  }
  if (!best) return []
  const histByKey = history[best.mac]?.[best.key]
  const histByKind = history[best.mac]?.[best.kind || kind]
  const hist = histByKey || histByKind || []
  return hist.map((p) => ({ v: p.v, ts: p.ts }))
}

export const KIND_COLOR: Record<SensorKind, string> = {
  water: '#006194',
  temp: '#ef4444',
  waterTemp: '#1e88e5',
  hum: '#1e88e5',
  flow: '#004b78',
  pressure: '#f59e0b',
  atmp: '#7c3aed',
  altitude: '#1565c0',
  battery: '#22c55e',
  ph: '#a855f7',
  turbidity: '#78716c',
  rain: '#2e8f84',
  wind: '#14b8a6',
  distance: '#3b82f6',
  generic: '#64748b',
}

export const KIND_ICON: Record<SensorKind, IconType> = {
  water: Waves,
  temp: Thermometer,
  waterTemp: ThermometerWater,
  hum: Droplets,
  flow: Gauge,
  pressure: Activity,
  atmp: CloudSun,
  altitude: Mountain,
  battery: BatteryFull,
  ph: FlaskConical,
  turbidity: CloudFog,
  rain: CloudRain,
  wind: Wind,
  distance: Move,
  generic: Activity,
}
