import { useState } from 'react'
import {
  LuRuler as Ruler,
  LuExpand,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { timeSince } from '../../lib/utils'
import { sensorRange } from '../../lib/nexus/sensors'
import { DistanceGauge, zonesFor, zoneUnit, zoneFor } from '../../views/sensors/sensorIndicators'
import { KindChart } from '../../views/sensors/sensorUi'
import { Dialog } from './Dialog'

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-tx3/10 bg-s1 px-2.5 py-2">
      <div className="text-[0.5rem] font-bold tracking-[0.08em] text-tx3 uppercase">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[0.62rem] font-semibold text-tx">{value}</div>
    </div>
  )
}

export function DistanceCard({ compact = false }: { compact?: boolean }) {
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const sensorHistory = useNexusStore((s) => s.sensorHistory)
  const nodes = useNexusStore((s) => s.nodes)

  let distSample: { value: number; ts: number; unit: string } | null = null
  let distMac: string | null = null
  for (const mac of Object.keys(sensorReadings)) {
    const s = (sensorReadings[mac] || []).find((r) => r.kind === 'distance')
    if (s && (!distSample || s.ts >= distSample.ts)) { distSample = s; distMac = mac }
  }

  const node = distMac ? nodes[distMac] : null
  const distance = distSample ? distSample.value : null
  const distanceUnit = distSample?.unit || 'cm'
  const offline = node ? !node.online : false
  const distanceZone = distance !== null ? zoneFor('distance', distance) : null

  const [open, setOpen] = useState(false)

  const graphData = distMac ? (sensorHistory[distMac]?.['Distance'] || []).map((p) => ({ v: p.v, ts: p.ts })) : []
  const { min, max } = sensorRange('distance')
  const zoneBands = zonesFor('distance')
  const hasData = distSample !== null

  if (!hasData) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-am/30 bg-am/[0.03] sm:h-9 sm:w-9 sm:rounded-xl">
            <Ruler size={14} className="text-am sm:hidden" />
            <Ruler size={17} className="hidden text-am sm:block" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[0.65rem] font-bold text-tx sm:text-[0.75rem]">Distance</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-6 sm:px-4 sm:py-8">
          <div className="text-[0.5rem] text-tx3 sm:text-[0.58rem]">Waiting for readings</div>
        </div>
        <div className="pb-2 sm:pb-3" />
      </div>
    )
  }

  return (
    <>
      <div className="group relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 transition-all hover:border-ac/25">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1 sm:px-4 sm:pt-4 sm:pb-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-am/30 bg-am/[0.03] sm:h-9 sm:w-9 sm:rounded-xl">
            <Ruler size={14} className="text-am sm:hidden" />
            <Ruler size={17} className="hidden text-am sm:block" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[0.65rem] font-bold text-tx sm:text-[0.75rem]">Distance</span>
          <button
            onClick={() => setOpen(true)}
            title="Detailed view"
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-tx3/10 bg-s1 text-tx3 transition-all hover:border-ac/30 hover:text-ac sm:h-7 sm:w-7 sm:rounded-lg"
          >
            <LuExpand size={11} className="sm:hidden" />
            <LuExpand size={12} className="hidden sm:block" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 items-center justify-center px-2 py-1 sm:px-4 sm:py-2">
          <DistanceGauge value={distance ?? 0} height={compact ? 130 : 150} scale={compact ? 0.9 : 1.0} />
        </div>

        {/* value — right bottom */}
        <div className="flex items-end justify-end gap-1 px-3 pb-1 sm:px-4 sm:pb-2">
          <span className="font-mono text-[1rem] leading-none font-bold text-tx tabular-nums sm:text-[1.3rem]">
            {distance !== null ? Math.round(distance) : '—'}
          </span>
          {distance !== null && <span className="pb-px text-[0.48rem] font-semibold text-tx3 sm:text-[0.58rem]">{distanceUnit}</span>}
        </div>

        {/* status — left bottom */}
        <div className="flex items-center justify-start px-3 pb-2 sm:px-4 sm:pb-3">
          <span className="font-mono text-[0.42rem] text-tx3 sm:text-[0.48rem]">
            {offline ? <span className="font-bold text-rd">offline</span> : <>{timeSince(distSample!.ts * 1000)}</>}
          </span>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Distance — detailed view" width="max-w-[1200px]">
        <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,230px)] items-start gap-4">
          <div className="flex flex-col items-center justify-center gap-2">
            <DistanceGauge value={distance ?? 0} height={160} scale={1.6} />
            <div className="text-center">
              <div className="font-mono text-[1.3rem] leading-none font-bold text-tx tabular-nums">
                {distance !== null ? Math.round(distance) : '—'}
                {distance !== null && <span className="ml-1 text-[0.75rem] font-semibold text-tx3">{distanceUnit}</span>}
              </div>
              {distanceZone && (
                <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
                  <span className="text-[0.7rem] leading-none font-bold tracking-[0.04em] uppercase" style={{ color: distanceZone.color }}>{distanceZone.label}</span>
                  <span className="text-[0.58rem] leading-none uppercase text-tx3">{distanceZone.hint}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-h-0 flex-1"><KindChart kind="distance" data={graphData} height={260} unit="cm" grid /></div>
            <div className="grid grid-cols-2 gap-1.5">
              <Meta label="Unit" value={distanceUnit || '—'} />
              <Meta label="Range" value={`${min} – ${max}`} />
              <Meta label="Sensor" value="Ultrasonic" />
              <Meta label="Zone" value={distanceZone?.label || '—'} />
            </div>
          </div>
          <div className="flex w-56 shrink-0 flex-col gap-1.5">
            <div className="text-[0.56rem] font-bold tracking-[0.1em] text-tx3 uppercase">{zoneUnit('distance') ? `Zones (${zoneUnit('distance')})` : 'Zones'}</div>
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
