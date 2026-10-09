import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { UnifiedGraph } from '../../components/UnifiedGraph'
import type { SensorKind, SensorSample } from '../../lib/nexus/sensors'
import { cn } from '../../lib/utils'
import { KIND_COLOR } from './sensorMeta'
import type { SensorPoint } from '../../store/nexus'

const WINDOWS = [
  { id: '1m', label: '1m', ms: 60_000 },
  { id: '5m', label: '5m', ms: 300_000 },
  { id: '1h', label: '1h', ms: 3_600_000 },
  { id: '6h', label: '6h', ms: 6 * 3_600_000 },
  { id: '1d', label: '1d', ms: 86_400_000 },
  { id: '7d', label: '7d', ms: 7 * 86_400_000 },
] as const

const AREA_KINDS = new Set<SensorKind>(['hum', 'atmp', 'altitude', 'battery', 'wind'])

const THRESHOLDS: Partial<Record<SensorKind, { value: number; color: string; label: string }[]>> = {
  temp: [
    { value: 0, color: '#38bdf8', label: '0°C Freeze' },
    { value: 35, color: '#f59e0b', label: '35°C Hot' },
  ],
  atmp: [
    { value: 1000, color: '#22c55e', label: '1000 hPa' },
    { value: 1020, color: '#f59e0b', label: '1020 hPa' },
  ],
  turbidity: [
    { value: 50, color: '#f59e0b', label: '50 NTU' },
    { value: 200, color: '#ef4444', label: '200 NTU' },
  ],
  water: [
    { value: 20, color: '#f97316', label: '20% Low' },
    { value: 80, color: '#006194', label: '80% High' },
  ],
  hum: [
    { value: 30, color: '#f59e0b', label: '30% Dry' },
    { value: 70, color: '#38bdf8', label: '70% Humid' },
  ],
}

interface SensorGraphSectionProps {
  sensorKinds: SensorKind[]
  sensorHistory: Record<string, Record<string, SensorPoint[]>>
  filteredReadings: Record<string, SensorSample[]>
  nodeFilter: string | null
}

export function SensorGraphSection({
  sensorKinds,
  sensorHistory,
  filteredReadings,
  nodeFilter,
}: SensorGraphSectionProps) {
  const [win, setWin] = useState<number>(WINDOWS[2].ms as number)
  const [, setTick] = useState(0)

  // refresh every 60s so average re-computes
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  const allData = useMemo(() => {
    const byKind = new Map<SensorKind, { v: number; ts?: number }[]>()
    sensorKinds.forEach((kind) => {
      const pts: { v: number; ts: number }[] = []
      for (const [mac, samples] of Object.entries(filteredReadings)) {
        if (!samples) continue
        samples.filter((s) => s.kind === kind).forEach((s) => {
          let hist = sensorHistory[mac]?.[s.key]
          if (!hist) hist = sensorHistory[mac]?.[s.kind]
          if (hist) pts.push(...hist.map((p) => ({ v: p.v, ts: p.ts })))
        })
      }
      const seen = new Set<number>()
      const unique = pts.filter((p) => {
        const k = p.ts ?? 0
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      unique.sort((a, b) => a.ts - b.ts)
      byKind.set(kind, unique)
    })
    return byKind
  }, [sensorKinds, sensorHistory, filteredReadings])

  const showUnified = !nodeFilter
  const showIndividual = !!nodeFilter

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0 h-full">
      {sensorKinds.length === 0 ? (
        <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-tx3/10">
          <span className="text-[0.7rem] text-tx3">No sensor data available</span>
        </div>
      ) : (
        <>
          {showUnified && (
            <div className="flex min-h-[400px] flex-1 flex-col rounded-3xl border-2 border-tx3/10 bg-s1 p-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {sensorKinds.map((kind) => {
                    const color = KIND_COLOR[kind]
                    return (
                      <span key={kind} className="flex items-center gap-1.5 text-[0.52rem] font-bold uppercase tracking-wider">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span style={{ color }}>{kind}</span>
                      </span>
                    )
                  })}
                </div>
                <div className="flex items-center rounded-xl border-2 border-tx3/10 bg-s2/50 p-0.5">
                  {WINDOWS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWin(w.ms as number)}
                      className={cn(
                        'flex h-8 cursor-pointer items-center rounded-lg px-3 text-[0.58rem] font-bold tracking-wider uppercase transition-all',
                        win === w.ms
                          ? 'bg-ac text-bg shadow-[0_1px_4px_rgba(0,97,148,0.3)]'
                          : 'text-tx3 hover:text-tx hover:bg-s2/60',
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 h-full">
                <UnifiedGraph sensorKinds={sensorKinds} allData={allData} timeFilter={win / 60000} />
              </div>
            </div>
          )}

          {showIndividual && (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0">
              <div className="flex items-center justify-end">
                <div className="flex items-center rounded-xl border-2 border-tx3/10 bg-s2/50 p-0.5">
                  {WINDOWS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWin(w.ms as number)}
                      className={cn(
                        'flex h-8 cursor-pointer items-center rounded-lg px-3 text-[0.58rem] font-bold tracking-wider uppercase transition-all',
                        win === w.ms
                          ? 'bg-ac text-bg shadow-[0_1px_4px_rgba(0,97,148,0.3)]'
                          : 'text-tx3 hover:text-tx hover:bg-s2/60',
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
               <div
                 className="grid w-full gap-3"
                 style={{
                   gridTemplateColumns: sensorKinds.length <= 1 ? '1fr' : sensorKinds.length <= 4 ? 'repeat(2, minmax(0, 1fr))' : sensorKinds.length <= 9 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                 }}
               >
                {sensorKinds.map((kind) => {
                  const data = allData.get(kind) || []
                  const color = KIND_COLOR[kind]
                  const pts = data.filter((p): p is { v: number; ts: number } => p.ts !== undefined)
                  const maxTs = pts.length > 0 ? Math.max(...pts.map((p) => p.ts)) : 0
                  const inWindow = pts.filter((p) => p.ts >= (maxTs - win / 1000))
                  const last = inWindow.length > 0 ? inWindow[inWindow.length - 1] : pts.length > 0 ? pts[pts.length - 1] : null
                  const avg = inWindow.length > 0 ? inWindow.reduce((s, p) => s + p.v, 0) / inWindow.length : null
                  const th = THRESHOLDS[kind] || []

                  return (
                    <div
                      key={kind}
                      className="flex flex-1 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 p-4 transition-all hover:border-ac/20"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="text-[0.62rem] font-bold uppercase tracking-wider" style={{ color }}>
                          {kind}
                        </span>
                        {last && (
                          <span className="ml-auto font-mono text-[0.6rem] font-bold text-tx tabular-nums">
                            {last.v.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {avg !== null && (
                        <div className="mb-1 flex items-center gap-2 text-[0.48rem] text-tx3">
                          <span>avg</span>
                          <span className="font-mono font-bold text-tx2">{avg.toFixed(1)}</span>
                          {th.length > 0 && (
                            <span className="ml-auto flex items-center gap-1">
                              {th.map((t) => (
                                <span key={t.value} className="flex items-center gap-0.5">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                                  <span style={{ color: t.color }}>{t.label}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="min-h-0 flex-1">
                        {inWindow.length >= 1 ? (
                          <MiniGraph kind={kind} data={inWindow} />
                        ) : (
                          <div className="flex h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-tx3/10 text-[0.48rem] text-tx3">
                            No data in window
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


function MiniGraph({
  kind,
  data,
}: {
  kind: SensorKind
  data: { v: number; ts: number }[]
}) {
  const color = KIND_COLOR[kind]
  const isArea = AREA_KINDS.has(kind)
  const thresholds = THRESHOLDS[kind] || []

  const yDomain = useMemo(() => {
    if (data.length === 0) return ['auto', 'auto'] as const
    let min = Infinity
    let max = -Infinity
    data.forEach((p) => {
      if (p.v < min) min = p.v
      if (p.v > max) max = p.v
    })
    if (!isFinite(min) || !isFinite(max)) return ['auto', 'auto'] as const
    if (min === max) return [min - 1, max + 1] as const
    const pad = (max - min) * 0.2
    const lo = Math.floor((min - pad) * 10) / 10
    const hi = Math.ceil((max + pad) * 10) / 10
    return [lo, hi] as const
  }, [data])

  const fmtY = (v: number) => {
    if (Math.abs(v) >= 1000) return v.toFixed(0)
    if (Math.abs(v) >= 100) return v.toFixed(0)
    if (Math.abs(v) >= 10) return v.toFixed(1)
    return v.toFixed(1)
  }

  // filter thresholds to only those within visible Y range
  const visibleThresholds = useMemo(() => {
    const [dMin, dMax] = yDomain
    if (typeof dMin !== 'number' || typeof dMax !== 'number') return []
    return thresholds.filter((th) => th.value >= dMin && th.value <= dMax)
  }, [yDomain, thresholds])

  const fmtTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const tick = { fontSize: 8, fill: 'var(--color-tx3)', fontFamily: 'monospace' }
  const axisLine = { stroke: 'var(--color-tx3)', strokeOpacity: 0.2 }

  const sliced = data.slice(-29)

  return (
    <div className="h-full min-h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        {isArea ? (
          <AreaChart data={sliced} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`mg-${kind}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-tx3)" strokeOpacity={0.06} strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtTime}
              tick={tick}
              tickLine={false}
              axisLine={axisLine}
              minTickGap={32}
            />
            <YAxis domain={yDomain} tickFormatter={fmtY} tick={tick} tickLine={false} axisLine={axisLine} width={40} />
            {visibleThresholds.map((th) => (
              <ReferenceLine
                key={th.value}
                y={th.value}
                stroke={th.color}
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{
                  value: th.label,
                  position: 'insideTopRight',
                  fill: th.color,
                  fontSize: 7,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
            ))}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const val = payload[0]?.value
                const ts = payload[0]?.payload?.ts as number | undefined
                return (
                  <div className="rounded-lg border-2 border-tx3/10 bg-s1 px-2 py-1 shadow-[0_4px_12px_rgba(16,24,40,0.12)]">
                    {ts && (
                      <div className="mb-0.5 text-[0.45rem] text-tx3">{fmtTime(ts)}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      <span className="font-mono text-[0.55rem] font-bold tabular-nums text-tx">
                        {typeof val === 'number' ? val.toFixed(1) : val}
                      </span>
                    </div>
                  </div>
                )
              }}
              cursor={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.15 }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#mg-${kind})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={sliced} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`mg-${kind}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-tx3)" strokeOpacity={0.06} strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtTime}
              tick={tick}
              tickLine={false}
              axisLine={axisLine}
              minTickGap={32}
            />
            <YAxis domain={yDomain} tickFormatter={fmtY} tick={tick} tickLine={false} axisLine={axisLine} width={40} />
            {visibleThresholds.map((th) => (
              <ReferenceLine
                key={th.value}
                y={th.value}
                stroke={th.color}
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{
                  value: th.label,
                  position: 'insideTopRight',
                  fill: th.color,
                  fontSize: 7,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
            ))}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const val = payload[0]?.value
                const ts = payload[0]?.payload?.ts as number | undefined
                return (
                  <div className="rounded-lg border-2 border-tx3/10 bg-s1 px-2 py-1 shadow-[0_4px_12px_rgba(16,24,40,0.12)]">
                    {ts && (
                      <div className="mb-0.5 text-[0.45rem] text-tx3">{fmtTime(ts)}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      <span className="font-mono text-[0.55rem] font-bold tabular-nums text-tx">
                        {typeof val === 'number' ? val.toFixed(1) : val}
                      </span>
                    </div>
                  </div>
                )
              }}
              cursor={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.15 }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={`url(#mg-${kind})`}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
