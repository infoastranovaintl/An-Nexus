export interface WaterReading {
  v: number
  unit: 'm' | 'cm' | 'mm' | '%' | ''
  ts: number
}

/* known key aliases for water / liquid level readings */
const WATER_KEYS = [
  'water',
  'level',
  'liquid',
  'wl',
  'h2o',
  'depth',
  'waterlevel',
  'water_level',
  'val',
  'value',
  'reading',
]

function parseNumberWithUnit(s: string): { v: number; unit: WaterReading['unit'] } | null {
  const t = String(s).trim()
  const m = t.match(/^([\d.+-]+)\s*(mm|cm|m|%)$/i)
  if (m) {
    const v = parseFloat(m[1])
    if (Number.isFinite(v)) return { v, unit: m[2].toLowerCase() as WaterReading['unit'] }
  }
  const v = parseFloat(t)
  if (Number.isFinite(v)) return { v, unit: '' }
  return null
}

/**
 * Extracts a water/liquid level reading from a raw sensor payload.
 * Handles JSON ("{water:1.42}", '{"level":"90cm"}'), key=value / key:value
 * token streams ("water=142cm hum=62", "WL:1.4m,hum:60") and bare values.
 * Returns null when no water key is found.
 */
export function parseWaterPayload(raw: string): WaterReading | null {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null

  /* JSON payloads */
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const j = JSON.parse(s)
      const obj = Array.isArray(j) ? j[0] : j
      if (obj && typeof obj === 'object') {
        for (const key of WATER_KEYS) {
          if (key in obj) {
            const parsed = parseNumberWithUnit(String(obj[key]))
            if (parsed) return { v: parsed.v, unit: parsed.unit, ts: Date.now() / 1000 }
          }
        }
      }
      return null
    } catch {
      /* fall through to token parsing */
    }
  }

  /* token streams: split on , ; | whitespace */
  const tokens = s.split(/[,;|\s]+/).filter(Boolean)
  for (const tok of tokens) {
    const m = tok.match(/^([^:=]+)[:=](.+)$/)
    if (!m) continue
    const key = m[1].toLowerCase().replace(/_|-/g, '')
    if (WATER_KEYS.includes(key)) {
      const parsed = parseNumberWithUnit(m[2])
      if (parsed) return { v: parsed.v, unit: parsed.unit, ts: Date.now() / 1000 }
    }
  }

  /* bare numeric value — treat as water level */
  const parsed = parseNumberWithUnit(s)
  if (parsed) return { v: parsed.v, unit: parsed.unit, ts: Date.now() / 1000 }

  return null
}

/* normalize a reading to meters (percent is treated as tank % and left alone) */
export function toMeters(r: { v: number; unit: WaterReading['unit'] }): number {
  switch (r.unit) {
    case 'cm':
      return r.v / 100
    case 'mm':
      return r.v / 1000
    default:
      return r.v
  }
}

/* fraction of a 2 m nominal tank, 0..1 (percent readings pass through) */
export function tankPct(r: { v: number; unit: WaterReading['unit'] }): number {
  const pct = r.unit === '%' ? r.v : r.unit === 'cm' ? r.v / 2 : r.unit === 'mm' ? r.v / 20 : (r.v / 2) * 100
  return Math.max(0, Math.min(100, pct))
}

/* ── GENERIC SENSOR STREAM ──────────────────────────────────────────── */

export type SensorKind =
  | 'water'
  | 'temp'
  | 'waterTemp'
  | 'hum'
  | 'flow'
  | 'pressure'
  | 'atmp'
  | 'altitude'
  | 'battery'
  | 'ph'
  | 'turbidity'
  | 'rain'
  | 'wind'
  | 'distance'
  | 'generic'

export interface SensorSample {
  key: string
  kind: SensorKind
  value: number
  unit: string
  ts: number
}

export interface SensorMeta {
  kind: SensorKind
  label: string
  unit: string
  min: number
  max: number
  good: number /* ideal band, 0..1 of range */
}

/* key aliases → canonical kind + label + units + display range */
const KEY_MAP: { re: RegExp; kind: SensorKind; label: string; unit: string; min: number; max: number }[] = [
  { re: /^(water|level|liquid|wl|h2o|depth|tank|waterlevel|water_level|val|value|reading)$/, kind: 'water', label: 'Water level', unit: 'm', min: 0, max: 2 },
  { re: /^(temp|temperature|tmp|t)$/, kind: 'temp', label: 'Temperature', unit: '°C', min: -10, max: 60 },
  { re: /^(watertemp|water_temperature|watert|wt|wtemp|h2otemp|wtrtemp|wtempc)$/, kind: 'waterTemp', label: 'Water temperature', unit: '°C', min: 0, max: 40 },
  { re: /^(hum|humidity|rh|humi)$/, kind: 'hum', label: 'Humidity', unit: '%', min: 0, max: 100 },
  { re: /^(flow|flowrate|flow_rate|lpm|q)$/, kind: 'flow', label: 'Flow rate', unit: 'L/min', min: 0, max: 120 },
  { re: /^(pressure|press|psi|bar)$/, kind: 'pressure', label: 'Pressure', unit: 'psi', min: 0, max: 150 },
  { re: /^(atmp|atm|baro|barometric|bmp|hpa|mbar)$/, kind: 'atmp', label: 'Atmospheric pressure', unit: 'hPa', min: 850, max: 1100 },
  { re: /^(alt|altitude|elev|elevation|asl)$/, kind: 'altitude', label: 'Altitude', unit: 'm', min: 0, max: 5000 },
  { re: /^(batt|battery|bat|vbatt|voltage|v)$/, kind: 'battery', label: 'Battery', unit: 'V', min: 3, max: 4.2 },
  { re: /^(ph|acidity)$/, kind: 'ph', label: 'pH', unit: 'pH', min: 0, max: 14 },
  { re: /^(turb|turbidity|ntu|clarity)$/, kind: 'turbidity', label: 'Turbidity', unit: 'NTU', min: 0, max: 400 },
  { re: /^(rain|rainfall|precip)$/, kind: 'rain', label: 'Rainfall', unit: 'mm/h', min: 0, max: 120 },
  { re: /^(wind|windspeed|wind_speed|ws)$/, kind: 'wind', label: 'Wind speed', unit: 'km/h', min: 0, max: 120 },
  { re: /^(distance|dist|range|proximity|sonic|ultrasonic|sonar|hcsr04|hc04|echo)$/, kind: 'distance', label: 'Distance', unit: 'cm', min: 0, max: 400 },
]

const LABEL = (kind: SensorKind) => {
  const hit = KEY_MAP.find((k) => k.kind === kind)
  return hit?.label || 'Reading'
}

const UNIT = (kind: SensorKind) => KEY_MAP.find((k) => k.kind === kind)?.unit || ''

const RANGE = (kind: SensorKind): { min: number; max: number } => {
  const hit = KEY_MAP.find((k) => k.kind === kind)
  return hit ? { min: hit.min, max: hit.max } : { min: 0, max: 100 }
}

/** Normalize a raw unit string for a kind (cm/mm → m for water, casing for known units). */
const UNIT_CANON: Record<string, string> = {
  ntu: 'NTU',
  lpm: 'L/min',
  ph: 'pH',
  c: '°C',
  f: '°F',
  hpa: 'hPa',
  mmh: 'mm/h',
  kmh: 'km/h',
  v: 'V',
  ma: 'mA',
  pct: '%',
  bar: 'bar',
  psi: 'psi',
}
function normalizeUnit(kind: SensorKind, raw: string): string {
  if (kind === 'water' && (raw === 'cm' || raw === 'mm')) return 'm'
  if (kind === 'distance' && (raw === 'm' || raw === 'mm')) return 'cm'
  const key = String(raw).toLowerCase()
  if (UNIT_CANON[key]) return UNIT_CANON[key]
  if (raw) return raw
  return UNIT(kind)
}

/** Convert a raw value into the kind's display unit (water cm/mm → m, distance m/mm → cm). */
function normalizeValue(kind: SensorKind, v: number, rawUnit: string): number {
  if (kind === 'water') {
    if (rawUnit === 'cm') return v / 100
    if (rawUnit === 'mm') return v / 1000
  }
  if (kind === 'distance') {
    if (rawUnit === 'm') return v * 100
    if (rawUnit === 'mm') return v / 10
  }
  return v
}

const parseNumber = (s: string): { v: number; unit: string } | null => {
  const t = String(s).trim()
  const m = t.match(/^([\d.+-]+)\s*([a-zA-Z°%/]+)?$/)
  if (m) {
    const v = parseFloat(m[1])
    if (Number.isFinite(v)) return { v, unit: m[2] || '' }
  }
  return null
}

/**
 * Positional value profiles keyed by AN-Nexus `sensor=N` index.
 * `v0, v1, v2, ...` in a payload map to these kinds in order.
 */
const POSITIONAL_PROFILES: Record<number, SensorKind[]> = {
  1: ['temp', 'atmp', 'altitude'],
  /* sensor=2 → v0 is the ultrasonic distance in cm */
  2: ['distance'],
  /* sensor=3 → v0 is the water temperature in °C */
  3: ['waterTemp'],
}

/**
 * Extracts every key=value / key:value reading from a raw DATA payload
 * (JSON or token streams). Returns canonical sensor samples; unknown keys
 * fall back to a generic reading. Water keeps its special handling in
 * `parseWaterPayload` for the dashboard card. Positional `vN` values use
 * the `sensor=N` profile when one is known.
 */
export function parseSensorPayload(raw: string): SensorSample[] {
  if (!raw || typeof raw !== 'string') return []
  const s = raw.trim()
  if (!s) return []
  const out: SensorSample[] = []
  const ts = Date.now() / 1000

  const push = (key: string, v: number, unit: string, kindOverride?: SensorKind) => {
    const keyNorm = key.toLowerCase().replace(/_|-/g, '')
    const hit = kindOverride ? undefined : KEY_MAP.find((k) => k.re.test(keyNorm))
    const kind: SensorKind = kindOverride ?? (hit ? hit.kind : 'generic')
    const u = normalizeUnit(kind, unit)
    const val = normalizeValue(kind, v, unit)
    if (Number.isFinite(val)) out.push({ key: kindOverride ? LABEL(kind) : hit ? hit.label : key, kind, value: val, unit: u, ts })
  }

  /* collect positional values (vN) + sensor profile index */
  const emitPositionals = (profile: SensorKind[] | undefined, pos: { v: number; unit: string }[]) => {
    if (!profile) return
    pos.forEach((p, i) => {
      const kind = profile[i]
      if (kind && p) push(kind, p.v, p.unit, kind)
    })
  }

  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const j = JSON.parse(s)
      const obj = Array.isArray(j) ? j[0] : j
      if (obj && typeof obj === 'object') {
        let profile: SensorKind[] | undefined
        const pos: { v: number; unit: string }[] = []
        for (const [key, rawVal] of Object.entries(obj)) {
          const p = parseNumber(String(rawVal))
          if (!p) continue
          const vm = key.toLowerCase().match(/^v(\d+)$/)
          if (key.toLowerCase() === 'sensor') {
            const n = parseInt(String(rawVal), 10)
            if (Number.isFinite(n)) profile = POSITIONAL_PROFILES[n]
          } else if (vm) {
            pos[parseInt(vm[1], 10)] = { v: p.v, unit: p.unit }
          } else {
            push(key, p.v, p.unit)
          }
        }
        emitPositionals(profile, pos)
        return out
      }
    } catch {
      /* fall through to token parsing */
    }
  }

  const tokens = s.split(/[,;|\s]+/).filter(Boolean)
  const flat: string[] = []
  for (const tok of tokens) {
    /* `=`-style pairs joined by `:` (e.g. sensor=1:v0=28.24) — split on `:` */
    if (tok.includes('=') && tok.includes(':')) flat.push(...tok.split(':').filter(Boolean))
    else flat.push(tok)
  }
  let profile: SensorKind[] | undefined
  const pos: { v: number; unit: string }[] = []
  for (const tok of flat) {
    /* strip wrapping braces/brackets/quotes so {ultrasonic:420} → ultrasonic */
    const m = tok.match(/^[([{\"']*([^:=]+)[:=](.+?)[\]})"']*$/)
    if (!m) continue
    const key = m[1].toLowerCase().replace(/[([{\"']/g, '').replace(/_|-/g, '')
    const valRaw = m[2].replace(/[\]})"']/g, '').trim()
    const p = parseNumber(valRaw)
    if (!p) continue
    const vm = key.match(/^v(\d+)$/)
    if (key === 'sensor') {
      const n = parseInt(m[2], 10)
      if (Number.isFinite(n)) profile = POSITIONAL_PROFILES[n]
    } else if (vm) {
      pos[parseInt(vm[1], 10)] = { v: p.v, unit: p.unit }
    } else {
      push(m[1].replace(/[([{\"']/g, ''), p.v, p.unit)
    }
  }
  emitPositionals(profile, pos)

  return out
}

export function sensorRange(kind: SensorKind): { min: number; max: number } {
  return RANGE(kind)
}

export function sensorLabel(kind: SensorKind): string {
  return LABEL(kind)
}
