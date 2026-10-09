import { useMemo, useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts'
import { KIND_COLOR } from '../views/sensors/sensorMeta'
import type { SensorKind } from '../lib/nexus/sensors'

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { dataKey?: string; value?: number; payload?: Record<string, number> }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-tx3/10 bg-s1 px-3 py-2 shadow-lg font-mono text-[0.55rem]">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: KIND_COLOR[entry.dataKey as SensorKind] || '#666' }} />
          <span className="text-tx">{entry.dataKey}:</span>
          <span className="text-ac font-bold">{entry.payload?.[entry.dataKey as string]?.toFixed(1) ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

interface UnifiedGraphProps {
  sensorKinds: SensorKind[]
  allData: Map<SensorKind, { v: number; ts?: number }[]>
  timeFilter: number
}

export function UnifiedGraph({ sensorKinds, allData, timeFilter }: UnifiedGraphProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10_000)
    return () => clearInterval(id)
  }, [])

  const chartData = useMemo(() => {
    const inWindow = sensorKinds.map((kind) =>
      (allData.get(kind) ?? [])
        .filter((p): p is { v: number; ts: number } => p.ts != null && p.ts >= (Math.max(now, ...(allData.get(kind) ?? []).map((p) => p.ts ?? 0)) - timeFilter * 60))
    )
    if (!inWindow.some((pts) => pts.length > 0)) return []

    /* merge every kind's series on real timestamps so the X axis is honest.
       samples from one broadcast share a ts, so series align exactly; for
       kinds with sparser sampling the most-recent value is carried forward. */
    const tsSet = new Set<number>()
    inWindow.forEach((pts) => pts.forEach((p) => tsSet.add(p.ts)))
    const times = [...tsSet].sort((a, b) => a - b)

    return times.map((t) => {
      const entry: Record<string, number> = { time: t }
      sensorKinds.forEach((kind, idx) => {
        const pts = inWindow[idx]
        for (let i = pts.length - 1; i >= 0; i--) {
          if (pts[i].ts <= t) {
            entry[kind] = pts[i].v
            break
          }
        }
      })
      return entry
    })
  }, [sensorKinds, allData, timeFilter, now])

  if (chartData.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-tx3/10 bg-s1">
        <span className="text-[0.64rem] text-tx3">No sensor data available</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(152,161,176,0.15)" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            tick={{ fontSize: 9, fill: 'var(--color-tx3)', fontFamily: 'monospace' }}
            axisLine={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.25 }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 9, fill: 'var(--color-tx3)', fontFamily: 'monospace' }}
            axisLine={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.25 }}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} />
          {sensorKinds.map((kind) => (
            <Line key={kind} dataKey={kind} stroke={KIND_COLOR[kind]} strokeWidth={1.5} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
