import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LuChartLine } from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { sensorLabel, type SensorKind, type SensorSample } from '../../lib/nexus/sensors'
import { Empty, StatusDot } from '../../components/ui/primitives'
import { KIND_COLOR, latestFor } from '../sensors/sensorMeta'
import { cn } from '../../lib/utils'

const MAX_PTS = 150
const MAX_SERIES = 6

interface WindowDef {
  title: string
  ms: number
}

/** Nice window sizes for charting, smallest first. */
const LADDER: WindowDef[] = [
  { title: '1 min', ms: 60_000 },
  { title: '5 min', ms: 5 * 60_000 },
  { title: '15 min', ms: 15 * 60_000 },
  { title: '30 min', ms: 30 * 60_000 },
  { title: '1 hour', ms: 3_600_000 },
  { title: '2 hours', ms: 2 * 3_600_000 },
  { title: '3 hours', ms: 3 * 3_600_000 },
  { title: '6 hours', ms: 6 * 3_600_000 },
  { title: '12 hours', ms: 12 * 3_600_000 },
  { title: '1 day', ms: 86_400_000 },
  { title: '3 days', ms: 3 * 86_400_000 },
  { title: '1 week', ms: 7 * 86_400_000 },
  { title: '2 weeks', ms: 14 * 86_400_000 },
  { title: '1 month', ms: 30 * 86_400_000 },
  { title: '3 months', ms: 3 * 30 * 86_400_000 },
  { title: '6 months', ms: 6 * 30 * 86_400_000 },
]

const fmtDur = (sec: number): string => {
  const mo = sec / (30.44 * 86400)
  if (mo >= 1) return mo >= 1.5 ? `${Math.round(mo)} mo` : `${mo.toFixed(1)} mo`
  const d = sec / 86400
  if (d >= 1) return d >= 1.5 ? `${Math.round(d)} d` : `${d.toFixed(1)} d`
  const h = sec / 3600
  if (h >= 1) return h >= 1.5 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`
  const m = sec / 60
  if (m >= 1) return m >= 1.5 ? `${Math.round(m)} min` : `${m.toFixed(1)} min`
  return `${Math.max(1, Math.round(sec / 5) * 5)} s`
}

/**
 * Pick the four windows that best fit the data we actually have. When the span
 * fills enough of the ladder we spread small → large through it; when there is
 * very little data we synthesize quarter fractions of the span so every card
 * still shows something real.
 */
function pickWindows(allTs: number[]): WindowDef[] {
  const maxTs = allTs[0]
  const minTs = allTs[allTs.length - 1]
  const spanMs = Math.max(maxTs - minTs, 60) * 1000
  const fitting = LADDER.filter((w) => w.ms <= spanMs)
  if (fitting.length >= 4) {
    const step = (fitting.length - 1) / 3
    return [fitting[0], fitting[Math.round(step)], fitting[Math.round(2 * step)], fitting[fitting.length - 1]]
  }
  const gap = spanMs / 4
  return [1, 2, 3, 4].map((i) => ({ title: fmtDur((gap * i) / 1000), ms: gap * i }))
}

interface TelemetrySeries {
  kind: SensorKind
  label: string
  color: string
  unit: string
  pts: { ts: number; v: number; unit?: string }[]
}

type Row = { ts: number } & Record<string, number | string | undefined>

const tick = { fontSize: 9, fill: 'var(--color-tx3)', fontFamily: 'monospace' }

const fmtTime = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function reduceSeries(pts: { ts: number; v: number }[], max: number) {
  if (pts.length <= max) return pts
  const step = pts.length / max
  const out: { ts: number; v: number }[] = []
  for (let i = 0; i < pts.length - 1; i += step) out.push(pts[Math.floor(i)])
  out.push(pts[pts.length - 1])
  return out
}

interface MastersInput {
  sensorReadings: Record<string, SensorSample[]>
  sensorHistory: Record<string, Record<string, { ts: number; v: number; unit: string }[]>>
  waterLevels: Record<string, { v: number; unit: string; ts: number }>
  waterHistory: Record<string, { ts: number; v: number; unit: string }[]>
  nodeFilter: string | null
}

/** Full-length series for every available kind (not yet windowed). */
function buildMasters({
  sensorReadings,
  sensorHistory,
  waterLevels,
  waterHistory,
  nodeFilter,
}: MastersInput): TelemetrySeries[] {
  const readings: Record<string, SensorSample[]> = nodeFilter
    ? nodeFilter in sensorReadings
      ? { [nodeFilter]: sensorReadings[nodeFilter] }
      : {}
    : sensorReadings

  const out: TelemetrySeries[] = []

  const waterMacs = Object.keys(waterLevels).filter((m) => !nodeFilter || m === nodeFilter)
  const allWaterPts: { ts: number; v: number; unit: string }[] = []
  waterMacs.forEach((mac) => {
    const hist = waterHistory[mac] || []
    allWaterPts.push(...hist)
  })
  allWaterPts.sort((a, b) => b.ts - a.ts)
  const waterPts = allWaterPts.slice(0, MAX_PTS)
  if (waterPts.length >= 2) {
    out.push({
      kind: 'water',
      label: 'Water level',
      color: KIND_COLOR.water,
      unit: waterPts[waterPts.length - 1]?.unit || '%',
      pts: waterPts,
    })
  }

  const byKind = new Map<SensorKind, SensorSample>()
  Object.entries(readings).forEach(([, samples]) => {
    samples.forEach((s) => {
      const cur = byKind.get(s.kind)
      if (!cur || s.ts > cur.ts) byKind.set(s.kind, s)
    })
  })

  const kinds = [...byKind.entries()]
    .filter(([kind]) => kind !== 'water')
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_SERIES)

  for (const [kind, s] of kinds) {
    const pts = latestFor(kind, sensorHistory, readings).filter(
      (p): p is { v: number; ts: number } => p.ts !== undefined,
    )
    if (pts.length >= 2) {
      out.push({
        kind,
        label: sensorLabel(kind),
        color: KIND_COLOR[kind],
        unit: s.unit,
        pts: reduceSeries(pts, MAX_PTS),
      })
    }
  }
  return out
}

/** Normalize each series to its own min–max in the window and join on timestamps. */
function buildRows(series: TelemetrySeries[]): Row[] {
  if (!series.length) return []
  const normMap: Record<string, { min: number; max: number }> = {}
  for (const s of series) {
    let min = Infinity
    let max = -Infinity
    for (const p of s.pts) {
      if (p.v < min) min = p.v
      if (p.v > max) max = p.v
    }
    if (max - min < 1e-9) {
      min = 0
      max = 1
    }
    normMap[s.kind] = { min, max }
  }

  const byTs = new Map<number, Row>()
  for (const s of series) {
    const { min, max } = normMap[s.kind]
    for (const p of s.pts) {
      let row = byTs.get(p.ts)
      if (!row) {
        row = { ts: p.ts }
        byTs.set(p.ts, row)
      }
      row[s.kind] = ((p.v - min) / (max - min)) * 100
      row['_r_' + s.kind] = p.v
      row['_u_' + s.kind] = p.unit ?? s.unit
    }
  }

  let out = [...byTs.values()].sort((a, b) => (a.ts as number) - (b.ts as number))
  const MAX_ROWS = 1600
  if (out.length > MAX_ROWS) {
    const step = out.length / MAX_ROWS
    out = out.filter((_, i) => Math.floor(i % step) === 0)
  }
  return out
}

function ChartTip({
  active,
  payload,
  meta,
}: {
  active?: boolean
  payload?: { dataKey?: string | number; payload?: Row }[]
  meta: Record<string, { label: string; color: string; unit: string }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  if (!row) return null
  const items = payload.filter((p) => typeof row[String(p.dataKey)] === 'number')
  if (!items.length) return null
  return (
    <div className="rounded-lg border border-tx3/15 bg-s1 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
      <div className="mb-1 text-[0.5rem] tracking-[0.1em] text-tx3 uppercase">{fmtTime(row.ts as number)}</div>
      {items.map((p) => {
        const key = String(p.dataKey)
        const m = meta[key]
        if (!m) return null
        const raw = row['_r_' + key]
        const unit = (row['_u_' + key] as string) || m.unit
        return (
          <div key={key} className="flex items-center gap-1.5 py-px font-mono text-[0.58rem]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
            <span className="text-tx2">{m.label}:</span>
            <span className="font-bold text-tx tabular-nums">
              {typeof raw === 'number' ? (Math.abs(raw) >= 100 ? raw.toFixed(0) : raw.toFixed(1)) : '—'}
              {unit && <span className="ml-0.5 font-semibold text-tx3">{unit}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TelemetryCell({
  def,
  cell,
  visibleMap,
}: {
  def: WindowDef
  cell: { series: TelemetrySeries[]; extended: boolean }
  visibleMap: Record<string, boolean>
}) {
  const shown = cell.series.filter((s) => visibleMap[s.kind])
  const samples = cell.series.reduce((n, s) => n + s.pts.length, 0)
  const meta = useMemo(() => {
    const m: Record<string, { label: string; color: string; unit: string }> = {}
    for (const s of shown) m[s.kind] = { label: s.label, color: s.color, unit: s.unit }
    return m
  }, [shown])
  const rows = useMemo(() => buildRows(shown), [shown])

  return (
    <div className="flex h-40 flex-col rounded-lg border border-tx3/10 bg-s2 p-2 sm:h-44 lg:h-48">
      <div className="flex flex-shrink-0 items-center justify-between gap-2">
        <span className="text-[0.52rem] font-bold tracking-[0.08em] text-tx2 uppercase">{def.title}</span>
        <span className="flex items-center gap-1.5 font-mono text-[0.46rem] text-tx3">
          {cell.series.length ? `${cell.series.length} series · ${samples} smp` : 'no data'}
          {cell.extended && <span className="text-[0.42rem] font-bold tracking-[0.06em] text-am uppercase">extended</span>}
        </span>
      </div>
      <div className="mt-1 min-h-0 flex-1">
        {rows.length < 2 ? (
          <div className="flex h-full items-center justify-center text-[0.5rem] text-tx3">
            {cell.series.length ? 'Not enough samples in this window' : 'No data in this window'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(152,161,176,0.18)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={tick}
                tickFormatter={fmtTime}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={tick}
                tickFormatter={(v: number) => String(Math.round(v))}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip content={<ChartTip meta={meta} />} />
              {shown.map((s) => (
                <Line
                  key={s.kind}
                  dataKey={s.kind}
                  stroke={s.color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/**
 * Unified telemetry graphs — four independent time windows chosen from the
 * range the data actually spans (never a window with nothing to show), each
 * plotted in its own space with series scaled to that window's own min–max.
 * A range that has fewer than two samples is auto-extended to the nearest
 * data so it always renders, tagged `extended`.
 */
export function TelemetryGraph({ nodeFilter = null }: { nodeFilter?: string | null } = {}) {
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const sensorHistory = useNexusStore((s) => s.sensorHistory)
  const waterLevels = useNexusStore((s) => s.waterLevels)
  const waterHistory = useNexusStore((s) => s.waterHistory)

  const [visible, setVisible] = useState<Record<string, boolean>>({})

  const masters = useMemo(
    () => buildMasters({ sensorReadings, sensorHistory, waterLevels, waterHistory, nodeFilter }),
    [sensorReadings, sensorHistory, waterLevels, waterHistory, nodeFilter],
  )

  const cells = useMemo(() => {
    const allTs: number[] = []
    for (const s of masters) for (const p of s.pts) allTs.push(p.ts)
    allTs.sort((a, b) => b - a)
    if (!allTs.length) return { cells: [], spanS: 0, total: 0 }

    const maxTs = allTs[0]
    const minTs = allTs[allTs.length - 1]
    /* second *distinct* timestamp — frames stamp many kinds at the same second,
       so a plain allTs[1] is usually equal to maxTs and never widens a short
       window. Using the previous distinct instant lets sparse data still render. */
    const uniq = [...new Set(allTs)]
    const secondNewest = uniq.length > 1 ? uniq[1] : maxTs

    const windows = pickWindows(allTs)
    const every = windows.map((def) => {
      const nominal = maxTs - def.ms / 1000
      const cutoff = Math.min(nominal, secondNewest)
      const screen = (s: TelemetrySeries): TelemetrySeries => ({
        ...s,
        pts: s.pts.filter((p) => p.ts >= cutoff),
      })
      return {
        def,
        series: masters.map(screen).filter((s) => s.pts.length >= 2),
        extended: nominal > secondNewest,
      }
    })
    return { cells: every, spanS: maxTs - minTs, total: allTs.length }
  }, [masters])

  const legend = useMemo(() => {
    const map = new Map<SensorKind, { label: string; color: string }>()
    for (const c of cells.cells) {
      for (const s of c.series) {
        if (!map.has(s.kind)) map.set(s.kind, { label: s.label, color: s.color })
      }
    }
    return [...map.entries()].map(([kind, m]) => ({ kind, ...m }))
  }, [cells])

  const visibleMap = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const l of legend) m[l.kind] = visible[l.kind] ?? true
    return m
  }, [legend, visible])

  const hasAny = legend.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-tx3/10 bg-s1 p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[0.56rem] font-bold tracking-[0.1em] text-tx3 uppercase">
          <LuChartLine size={11} className="opacity-70" />
          Telemetry
        </span>
        <span className="h-px min-w-4 flex-1 bg-tx3/10" />
        <StatusDot tone="green" pulse />
      </div>

      {!hasAny ? (
        <Empty
          icon={<LuChartLine size={26} />}
          title={<div className="text-[0.68rem] text-tx2">No telemetry yet</div>}
          sub="Connect a node to start charting readings"
        />
      ) : (
        <>
          <div className="mt-2 flex flex-shrink-0 flex-wrap items-center gap-1">
            {legend.map((l) => (
              <button
                key={l.kind}
                onClick={() => setVisible((v) => ({ ...v, [l.kind]: !(v[l.kind] ?? true) }))}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.52rem] font-semibold transition-colors cursor-pointer',
                  visibleMap[l.kind]
                    ? 'border-tx3/20 text-tx hover:bg-s2'
                    : 'border-tx3/10 text-tx3 opacity-45 hover:opacity-80',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex-shrink-0 text-[0.5rem] text-tx3">
            windows adapt to the data you have · data spans ~{fmtDur(cells.spanS)} · {cells.total} samples across 4
            ranges — each window scaled to its own min–max
          </p>

          <div className="mt-2 grid flex-1 grid-cols-1 gap-1.5 overflow-y-auto lg:grid-cols-2 nexus-scroll">
            {cells.cells.map((c) => (
              <TelemetryCell key={c.def.title} def={c.def} cell={c} visibleMap={visibleMap} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}