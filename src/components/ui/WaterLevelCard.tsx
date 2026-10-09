import { useState } from 'react'
import {
  LuCheck as Check,
  LuDroplets as Droplets,
  LuExpand,
  LuPencil as Pencil,
  LuX as X,
} from 'react-icons/lu'
import { useNexusStore, DEFAULT_TANK_DEPTH } from '../../store/nexus'
import { cn, timeSince } from '../../lib/utils'
import { tankPct } from '../../lib/nexus/sensors'
import { WaterTankGauge, zonesFor, zoneUnit } from '../../views/sensors/sensorIndicators'
import { KindChart } from '../../views/sensors/sensorUi'
import { Dialog } from './Dialog'

const ZONES = {
  dry: { label: 'critical low' },
  low: { label: 'low' },
  ok: { label: 'normal' },
  high: { label: 'high' },
  spill: { label: 'overflow risk' },
} as const

const ZONE_HINT: Record<keyof typeof ZONES, string> = {
  dry: 'water is critically low',
  low: 'refill needed soon',
  ok: 'water level nominal',
  high: 'approaching overflow',
  spill: 'overflow risk — vent dam',
}

function levelZone(pct: number): keyof typeof ZONES {
  if (pct < 15) return 'dry'
  if (pct < 30) return 'low'
  if (pct <= 85) return 'ok'
  if (pct <= 95) return 'high'
  return 'spill'
}

function zoneColor(pct: number): string {
  if (pct < 15) return 'text-red-400'
  if (pct >= 95) return 'text-red-400'
  if (pct < 30) return 'text-amber-400'
  if (pct > 85) return 'text-amber-400'
  return 'text-emerald-400'
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-tx3/10 bg-s1 px-2.5 py-2">
      <div className="text-[0.5rem] font-bold tracking-[0.08em] text-tx3 uppercase">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[0.62rem] font-semibold text-tx">{value}</div>
    </div>
  )
}

export function WaterLevelCard({ compact = false }: { compact?: boolean }) {
  const waterLevels = useNexusStore((s) => s.waterLevels)
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const sensorHistory = useNexusStore((s) => s.sensorHistory)
  const nodes = useNexusStore((s) => s.nodes)
  const setTankDepth = useNexusStore((s) => s.setTankDepth)

  const waterMacs = Object.keys(waterLevels)
  const waterMac = waterMacs.length > 0 ? waterMacs[0] : null
  const latestWater = waterMac ? waterLevels[waterMac] : null

  let distSample: { value: number; ts: number } | null = null
  for (const mac of Object.keys(sensorReadings)) {
    const s = (sensorReadings[mac] || []).find((r) => r.kind === 'distance')
    if (s && (!distSample || s.ts >= distSample.ts)) distSample = s
  }

  const primaryMac = latestWater ? waterMac : null
  const node = primaryMac ? nodes[primaryMac] : null
  const depth = node?.tankDepth ?? DEFAULT_TANK_DEPTH

  const [editingDepth, setEditingDepth] = useState(false)
  const [open, setOpen] = useState(false)
  const [depthDraft, setDepthDraft] = useState<number | null>(null)

  const beginEdit = () => { setDepthDraft(depth); setEditingDepth(true) }
  const cancelEdit = () => { setDepthDraft(null); setEditingDepth(false) }
  const commitDepth = (d: number) => {
    if (primaryMac && Number.isFinite(d)) setTankDepth(primaryMac, d)
    setDepthDraft(null); setEditingDepth(false)
  }

  const level = distSample ? depth - distSample.value : latestWater ? latestWater.v : 0
  const waterVal = Math.max(0, level)
  const waterUnit = latestWater?.unit || 'cm'
  const capacityPct = depth != null && depth > 0 ? Math.max(0, Math.min(100, (waterVal / depth) * 100)) : latestWater ? tankPct(latestWater) : 0
  const zone = levelZone(capacityPct)
  const hasData = !!latestWater || distSample !== null
  const offline = node ? !node.online : false

  const graphData = waterMac ? (sensorHistory[waterMac]?.['Water level'] || []).map((p) => ({ v: p.v, ts: p.ts })) : []
  const zoneBands = zonesFor('water')

  if (!hasData) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1">
        <div className="flex items-center gap-3 px-5 pt-5 pb-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-ac/30 bg-ac/[0.03]">
            <Droplets size={20} className="text-ac" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[0.82rem] font-bold text-tx">Water level</span>
            <div className="mt-0.5 text-[0.54rem] text-tx3">No data yet</div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <div className="text-[0.62rem] text-tx3">Waiting for readings</div>
        </div>
        <div className="pb-4" />
      </div>
    )
  }

  return (
    <>
      <div className="group relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 transition-all hover:border-ac/25">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ac/30 bg-ac/[0.03] sm:h-9 sm:w-9 sm:rounded-xl">
            <Droplets size={14} className="text-ac sm:hidden" />
            <Droplets size={17} className="hidden text-ac sm:block" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[0.65rem] font-bold text-tx sm:text-[0.75rem]">Water level</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => (editingDepth ? cancelEdit() : beginEdit())}
              title={editingDepth ? 'Cancel' : 'Edit dam height'}
              className={cn(
                'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-all sm:h-7 sm:w-7 sm:rounded-lg',
                editingDepth ? 'border-ac/30 bg-ac/8 text-ac' : 'border-tx3/10 bg-s1 text-tx3 hover:border-ac/30 hover:text-ac',
              )}
            >
              <Pencil size={11} className="sm:hidden" />
              <Pencil size={12} className="hidden sm:block" />
            </button>
            <button
              onClick={() => setOpen(true)}
              title="Detailed view"
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-tx3/10 bg-s1 text-tx3 transition-all hover:border-ac/30 hover:text-ac sm:h-7 sm:w-7 sm:rounded-lg"
            >
              <LuExpand size={11} className="sm:hidden" />
              <LuExpand size={12} className="hidden sm:block" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 items-center justify-center px-2 py-1 sm:px-4 sm:py-2">
          {depth > 0 ? (
            <div className="flex flex-col items-center justify-center gap-1">
              <WaterTankGauge value={waterVal} pct={capacityPct} height={compact ? 130 : 150} scale={compact ? 0.9 : 1.0} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Droplets size={16} className="text-tx3 sm:hidden" />
              <Droplets size={18} className="hidden text-tx3 sm:block" />
              <div className="text-[0.52rem] font-semibold text-tx2 sm:text-[0.6rem]">Set dam height</div>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} step={1}
                  value={depthDraft ?? ''}
                  onChange={(e) => setDepthDraft(e.target.value === '' ? null : Number(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { const d = Number(depthDraft); if (Number.isFinite(d) && d > 0) commitDepth(d) } }}
                  placeholder="cm" autoFocus
                  className="h-6 w-16 rounded-md border-2 border-tx3/20 bg-s1 px-1.5 text-center font-mono text-[0.58rem] text-tx outline-none focus:border-ac sm:h-7 sm:w-20 sm:text-[0.65rem]"
                />
                <button onClick={() => { const d = Number(depthDraft); if (Number.isFinite(d) && d > 0) commitDepth(d) }} className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-gn/40 bg-gn/15 text-gn hover:bg-gn/25 sm:h-7 sm:w-7">
                  <Check size={10} className="sm:hidden" />
                  <Check size={12} className="hidden sm:block" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* value — right bottom */}
        <div className="flex items-end justify-end gap-1 px-3 pb-1 sm:px-4 sm:pb-2">
          {depth > 0 && editingDepth ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} step={1}
                value={depthDraft ?? depth}
                onChange={(e) => setDepthDraft(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { const d = Number(depthDraft ?? depth); if (Number.isFinite(d) && d > 0) commitDepth(d) }
                  else if (e.key === 'Escape') cancelEdit()
                }}
                autoFocus
                className="h-5 w-12 rounded border border-tx3/20 bg-s1 px-1 text-right font-mono text-[0.6rem] font-bold text-tx outline-none focus:border-ac sm:h-6 sm:w-14 sm:text-[0.7rem]"
              />
              <button onClick={() => { const d = Number(depthDraft ?? depth); if (Number.isFinite(d) && d > 0) commitDepth(d) }} className="flex h-5 w-5 items-center justify-center rounded border border-gn/40 bg-gn/15 text-gn hover:bg-gn/25 sm:h-6 sm:w-6">
                <Check size={9} className="sm:hidden" />
                <Check size={10} className="hidden sm:block" />
              </button>
              <button onClick={cancelEdit} className="flex h-5 w-5 items-center justify-center rounded border border-tx3/20 bg-s1 text-tx3 hover:text-tx sm:h-6 sm:w-6">
                <X size={9} className="sm:hidden" />
                <X size={10} className="hidden sm:block" />
              </button>
            </div>
          ) : (
            <>
              <span className="font-mono text-[1rem] leading-none font-bold text-tx tabular-nums sm:text-[1.3rem]">{depth > 0 ? Math.round(waterVal) : '—'}</span>
              {depth > 0 && <span className="pb-px text-[0.48rem] font-semibold text-tx3 sm:text-[0.58rem]">{waterUnit}</span>}
            </>
          )}
        </div>

        {/* status — left bottom */}
        <div className="flex items-center justify-start px-3 pb-2 sm:px-4 sm:pb-3">
          <span className="font-mono text-[0.42rem] text-tx3 sm:text-[0.48rem]">
            {offline ? <span className="font-bold text-rd">offline</span> : latestWater ? <>{timeSince(latestWater.ts * 1000)}</> : <>No data</>}
          </span>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Water level — detailed view" width="max-w-[1200px]">
        <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,230px)] items-start gap-4">
          <div className="flex flex-col items-center justify-center gap-2">
            <WaterTankGauge value={waterVal} pct={capacityPct} height={300} scale={1.9} />
            <div className="text-center">
              <div className="font-mono text-[1.3rem] leading-none font-bold text-tx tabular-nums">
                {Math.round(waterVal)}<span className="ml-1 text-[0.75rem] font-semibold text-tx3">{waterUnit}</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
                <span className={cn('text-[0.7rem] leading-none font-bold tracking-[0.04em] uppercase', zoneColor(capacityPct))}>{ZONES[zone].label}</span>
                <span className="text-[0.58rem] leading-none uppercase text-tx3">{ZONE_HINT[zone]}</span>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-h-0 flex-1"><KindChart kind="water" data={graphData} height={260} unit="cm" grid /></div>
            <div className="grid grid-cols-2 gap-1.5">
              <Meta label="Unit" value={waterUnit || '—'} />
              <Meta label="Dam depth" value={`${depth} cm`} />
              <Meta label="Distance" value={distSample ? `${distSample.value} cm` : '—'} />
              <Meta label="Zone" value={ZONES[zone].label} />
            </div>
          </div>
          <div className="flex w-56 shrink-0 flex-col gap-1.5">
            <div className="text-[0.56rem] font-bold tracking-[0.1em] text-tx3 uppercase">{zoneUnit('water') ? `Zones (${zoneUnit('water')})` : 'Zones'}</div>
            {zoneBands.map((z) => (
              <div key={z.label} className="flex items-center gap-2 rounded-md border-2 border-tx3/10 bg-s1 px-2 py-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: z.color }} />
                <div className="min-w-0"><div className="text-[0.6rem] font-semibold text-tx">{z.label}</div><div className="truncate text-[0.5rem] text-tx3">{z.hint}</div></div>
                <span className="ml-auto font-mono text-[0.52rem] text-tx3">{z.from === -Infinity ? '–' : z.from} – {z.to === Infinity ? '∞' : z.to}</span>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </>
  )
}
