import { useMemo, useState } from 'react'
import { LuExpand, LuDownload } from 'react-icons/lu'
import {
  CartesianGrid,
  Line,
  LineChart,
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { sensorRange, type SensorKind, type SensorSample } from '../../lib/nexus/sensors'
import { cn, timeSince } from '../../lib/utils'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/primitives'
import { KIND_COLOR, KIND_ICON, type SensorSource } from './sensorMeta'
import { SensorIndicator, zoneFor, zoneUnit, zonesFor } from './sensorIndicators'
import { exportSensorData } from '../../lib/export'

const WINDOWS: { id: string; label: string; tip: string; ms: number }[] = [
  { id: '1m', label: '1m', tip: 'Last 1 minute', ms: 60_000 },
  { id: '1h', label: '1h', tip: 'Last 1 hour', ms: 3_600_000 },
  { id: '1d', label: '1d', tip: 'Last 1 day', ms: 86_400_000 },
  { id: '6mo', label: '6mo', tip: 'Last 6 months', ms: 6 * 30 * 86_400_000 },
]

function ChartTip({ active, payload, unit }: { active?: boolean; payload?: { payload?: { v?: number; ts?: number } }[]; unit?: string }) {
  if (!active || !payload?.length) return null
  const raw = payload[0].payload ?? {}
  const value = raw.v !== undefined ? raw.v : '—'
  return (
    <div className="pointer-events-none rounded-xl border-2 border-tx3/10 bg-s1 px-2.5 py-1.5 font-mono text-[0.56rem] shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
      <div className="font-bold text-tx tabular-nums">
        {value}
        {raw.v !== undefined && unit && <span className="ml-0.5 font-semibold text-tx3">{unit}</span>}
      </div>
      {raw.ts !== undefined && <div className="mt-0.5 text-[0.5rem] text-tx3">{timeSince(raw.ts * 1000)}</div>}
    </div>
  )
}

export function LiveSensorCard({
  kind,
  sample,
  nodes,
  data,
  sources,
  compact = false,
}: {
  kind: SensorKind
  sample: SensorSample
  nodes: number
  data: { v: number; ts?: number }[]
  sources?: SensorSource[]
  compact?: boolean
}) {
  const color = KIND_COLOR[kind]
  const Icon = KIND_ICON[kind]
  const band = zoneFor(kind, sample.value)
  const val = Math.abs(sample.value) >= 100 ? sample.value.toFixed(0) : sample.value.toFixed(1)
  const [open, setOpen] = useState(false)
  const [win, setWin] = useState<number>(WINDOWS[1].ms)
  const { windowData, extended } = useMemo(() => {
    const pts = data.filter((p): p is { v: number; ts: number } => p.ts !== undefined)
    if (pts.length < 2) return { windowData: data, extended: false }
    const maxTs = pts.reduce((m, p) => Math.max(m, p.ts), -Infinity)
    const cutoff = maxTs - win / 1000
    const inWin = pts.filter((p) => p.ts >= cutoff)
    if (inWin.length >= 2) return { windowData: inWin, extended: false }
    const fallback = [...pts].sort((a, b) => a.ts - b.ts).slice(-2)
    return { windowData: fallback, extended: true }
  }, [data, win])
  const { min, max } = sensorRange(kind)
  const zoneBands = zonesFor(kind)
  const allOffline = (sources || []).length > 0 && (sources || []).every((s) => !s.online)

  return (
    <>
      {/* card — equal height via grid, gauge-only */}
      <div
        className={cn(
          'group relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 transition-all hover:border-ac/25',
          allOffline && 'border-rd/25',
        )}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-1">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 sm:h-9 sm:w-9 sm:rounded-xl"
            style={{ borderColor: color + '30', background: color + '08' }}
          >
            <Icon size={14} className="sm:hidden" style={{ color }} />
            <Icon size={17} className="hidden sm:block" style={{ color }} />
          </div>
          <span className="min-w-0 flex-1 truncate text-[0.65rem] font-bold text-tx sm:text-[0.75rem]">{sample.key}</span>
          <button
            onClick={() => setOpen(true)}
            title="Open detailed view"
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-tx3/10 bg-s1 text-tx3 transition-all hover:border-ac/30 hover:text-ac sm:h-7 sm:w-7 sm:rounded-lg"
          >
            <LuExpand size={11} className="sm:hidden" />
            <LuExpand size={12} className="hidden sm:block" />
          </button>
        </div>

        {/* gauge — centered */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-1 sm:px-4 sm:py-2">
          <SensorIndicator kind={kind} value={sample.value} height={compact ? 130 : 150} />
        </div>

        {/* value — right bottom */}
        <div className="flex items-end justify-end gap-1 px-3 pb-1 sm:px-4 sm:pb-2">
          <span className="font-mono text-[1rem] leading-none font-bold text-tx tabular-nums sm:text-[1.3rem]">{val}</span>
          <span className="pb-px text-[0.48rem] font-semibold text-tx3 sm:text-[0.58rem]">{sample.unit}</span>
        </div>

        {/* status — left bottom */}
        <div className="flex items-center justify-start px-3 pb-2 sm:px-4 sm:pb-3">
          <span className="font-mono text-[0.42rem] text-tx3 sm:text-[0.48rem]">
            {allOffline ? (
              <span className="font-bold text-rd">offline</span>
            ) : sample.ts ? (
              <>{timeSince(sample.ts * 1000)}</>
            ) : (
              <>No data</>
            )}
          </span>
        </div>
      </div>

      {/* detail dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${sample.key} — detailed view`}
        width="max-w-[1400px]"
      >
        <div className="grid grid-cols-[minmax(0,400px)_minmax(0,1fr)_minmax(0,260px)] items-start gap-5">
          {/* col A — large gauge + value */}
          <div className="flex flex-col items-center justify-center gap-3">
            <SensorIndicator kind={kind} value={sample.value} height={kind === 'water' ? 440 : 420} scale={2} />
            <div className="text-center">
              <div className="font-mono text-[1.3rem] leading-none font-bold text-tx tabular-nums">
                {val}
                <span className="ml-1 text-[0.75rem] font-semibold text-tx3">{sample.unit}</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
                <span
                  className="text-[0.7rem] leading-none font-bold tracking-[0.04em] uppercase"
                  style={{ color: band.color }}
                >
                  {band.label}
                </span>
                <span className="text-[0.58rem] leading-none text-tx3">{band.hint}</span>
              </div>
            </div>
          </div>

          {/* col B — chart + meta grid */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-shrink-0 items-center justify-between gap-2">
              <span className="text-[0.52rem] font-bold tracking-[0.1em] text-tx3 uppercase">Window</span>
              <div className="flex items-center rounded-full border-2 border-tx3/10 bg-s1 p-0.5" role="group">
                {WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWin(w.ms)}
                    data-tip={w.tip}
                    data-tip-pos="bottom"
                    className={cn(
                      'flex h-6 cursor-pointer items-center rounded-xl px-2.5 text-[0.52rem] font-bold tracking-[0.06em] uppercase transition-colors',
                      win === w.ms
                        ? 'bg-ac text-bg shadow-[0_1px_4px_rgba(16,24,40,0.2)]'
                        : 'text-tx3 hover:text-tx',
                    )}
                  >
                    {w.label}
                  </button>
                ))}
                {extended && (
                  <span
                    className="text-[0.48rem] font-bold tracking-[0.06em] text-amber-500 uppercase"
                    data-tip="Not enough recent points — showing the latest available data"
                    data-tip-pos="bottom"
                  >
                    extended
                  </span>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <DetailChart kind={kind} data={windowData} height={kind === 'water' ? 340 : 320} unit={sample.unit} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Meta label="Unit" value={sample.unit || '—'} />
              <Meta label="Range" value={`${min} – ${max}`} />
              <Meta label="Last update" value={sample.ts ? timeSince(sample.ts * 1000) : '—'} />
              <Meta label="Sources" value={`${nodes} node${nodes === 1 ? '' : 's'}`} />
            </div>
          </div>

          {/* col C — zones + sources + export */}
          <div className="flex w-56 shrink-0 flex-col gap-1.5">
            <div className="text-[0.56rem] font-bold tracking-[0.1em] text-tx3 uppercase">
              {zoneUnit(kind) ? `Zones (${zoneUnit(kind)})` : 'Zones'}
            </div>
            {zoneBands.map((z) => (
              <div
                key={z.label}
                className="flex items-center gap-2 rounded-xl border-2 border-tx3/10 bg-s1 px-2.5 py-2"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: z.color }} />
                <div className="min-w-0">
                  <div className="text-[0.6rem] font-semibold text-tx">{z.label}</div>
                  <div className="truncate text-[0.5rem] text-tx3">{z.hint}</div>
                </div>
                <span className="ml-auto font-mono text-[0.52rem] text-tx3">
                  {z.from === -Infinity ? '–' : z.from}
                  {' – '}
                  {z.to === Infinity ? '∞' : z.to}
                </span>
              </div>
            ))}
            {sources && sources.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {sources.map((src) => (
                  <span
                    key={src.mac}
                    className="flex items-center gap-1 rounded-full border-2 border-tx3/10 bg-s1 px-1.5 py-0.5 font-mono text-[0.46rem] text-tx2"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', src.online ? 'bg-gn' : 'bg-tx3')} />
                    {src.label}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5">
              <Button
                size="full"
                variant="blue"
                onClick={() => exportSensorData(kind)}
                data-tip="Download this sensor's history (CSV + JSON)"
                data-tip-pos="top"
                className="flex items-center justify-center gap-1.5"
              >
                <LuDownload size={12} />
                Export CSV + JSON
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}

function DetailChart({
  kind,
  data,
  height = 280,
  unit,
}: {
  kind: SensorKind
  data: { v: number; ts?: number }[]
  height?: number
  unit?: string
}) {
  const color = KIND_COLOR[kind]
  if (data.length < 2) return null
  const { min, max } = sensorRange(kind)
  const fmtTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const tick = { fontSize: 9, fill: 'var(--color-tx3)', fontFamily: 'monospace' }
  const axisLine = { stroke: 'var(--color-tx3)', strokeOpacity: 0.25 }
  const isArea = kind === 'hum' || kind === 'atmp' || kind === 'altitude' || kind === 'battery'

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {isArea ? (
          <AreaChart data={data.slice(-29)} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={`detail-${kind}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-tx3)" strokeOpacity={0.1} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtTime}
              tick={tick}
              tickLine={false}
              axisLine={axisLine}
              minTickGap={42}
            />
            <YAxis domain={[min, max]} tick={tick} tickLine={false} axisLine={axisLine} width={44} />
            <Tooltip
              content={<ChartTip unit={unit} />}
              cursor={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.2 }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#detail-${kind})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={data.slice(-29)} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={`detail-${kind}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={color} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-tx3)" strokeOpacity={0.1} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtTime}
              tick={tick}
              tickLine={false}
              axisLine={axisLine}
              minTickGap={42}
            />
            <YAxis domain={[min, max]} tick={tick} tickLine={false} axisLine={axisLine} width={44} />
            <Tooltip
              content={<ChartTip unit={unit} />}
              cursor={{ stroke: 'var(--color-tx3)', strokeOpacity: 0.2 }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={`url(#detail-${kind})`}
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-tx3/10 bg-s1 px-2.5 py-2">
      <div className="text-[0.5rem] font-bold tracking-[0.08em] text-tx3 uppercase">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[0.62rem] font-semibold text-tx">{value}</div>
    </div>
  )
}

export function KindChart({
  kind,
  data,
  height = 56,
  unit,
  grid: _grid = false,
}: {
  kind: SensorKind
  data: { v: number; ts?: number }[]
  height?: number
  unit?: string
  grid?: boolean
}) {
  return <DetailChart kind={kind} data={data} height={height} unit={unit} />
}
