import { useMemo, useState } from 'react'
import { LuGauge as Gauge, LuLayoutGrid as LayoutGrid, LuChartLine as ChartLine } from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import type { SensorKind, SensorSample } from '../../lib/nexus/sensors'
import { cn } from '../../lib/utils'
import { SensorCardsSection } from './SensorCardsSection'
import { SensorGraphSection } from './SensorGraphSection'

export function SensorsView() {
  const nodes = useNexusStore((s) => s.nodes)
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const sensorHistory = useNexusStore((s) => s.sensorHistory)

  const macs = useMemo(() => Object.keys(sensorReadings), [sensorReadings])
  const [nodeFilter, setNodeFilter] = useState<string | null>(null)
  const effectiveFilter = nodeFilter && macs.includes(nodeFilter) ? nodeFilter : null
  const [view, setView] = useState<'cards' | 'graph'>('cards')

  const meshSummary = useMemo(() => {
    const byKind = new Map<SensorKind, { sample: SensorSample; macs: string[] }>()
    Object.entries(sensorReadings).forEach(([mac, samples]) => {
      if (effectiveFilter && mac !== effectiveFilter) return
      samples.forEach((s) => {
        if (s.kind === 'water') return
        const cur = byKind.get(s.kind)
        if (!cur) byKind.set(s.kind, { sample: s, macs: [mac] })
        else {
          if (s.ts > cur.sample.ts) cur.sample = s
          if (!cur.macs.includes(mac)) cur.macs.push(mac)
        }
      })
    })
    return [...byKind.entries()].map(([kind, { sample, macs: macList }]) => ({ kind, sample, macs: macList }))
  }, [sensorReadings, effectiveFilter])

  const filteredReadings = useMemo(
    () => (effectiveFilter ? { [effectiveFilter]: sensorReadings[effectiveFilter] } : sensorReadings),
    [effectiveFilter, sensorReadings],
  )

  const sensorKinds = meshSummary.filter((e) => e.kind !== 'distance').map((e) => e.kind)

return (
    <div
      className="nexus-scroll flex flex-1 flex-col min-h-0 gap-2 overflow-y-auto"
    >
        {macs.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-tx3/15 bg-s2/20 p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-tx3/10 bg-s1 mb-2">
              <Gauge size={24} className="text-ac" />
            </div>
            <div className="text-center">
              <div className="text-[0.82rem] font-bold text-tx">No sensor data yet</div>
              <p className="mt-1 max-w-[340px] text-[0.62rem] leading-relaxed text-tx3">
                Connect the base station and readings stream here in real time.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex h-10 items-center gap-0.5 rounded-2xl border-2 border-tx3/10 bg-s1 px-1">
                <FilterPill active={!effectiveFilter} label="All nodes" onClick={() => setNodeFilter(null)} />
                {macs.map((mac) => {
                  const node = nodes[mac]
                  return (
                    <FilterPill
                      key={mac}
                      active={effectiveFilter === mac}
                      label={'N' + (node?.id ?? '?')}
                      title={node?.ssid || node?.name || mac}
                      online={Boolean(node?.online)}
                      onClick={() => setNodeFilter(effectiveFilter === mac ? null : mac)}
                    />
                  )
                })}
              </div>

              <div className="flex h-11 items-center gap-1 rounded-2xl border-2 border-tx3/10 bg-s1 p-1" role="group">
                <button onClick={() => setView('cards')} className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-[0.66rem] font-bold tracking-[0.04em] uppercase transition-all', view === 'cards' ? 'bg-ac text-bg shadow-[0_2px_8px_rgba(0,97,148,0.3)]' : 'text-tx3 hover:text-tx')}>
                  <LayoutGrid size={13} /> Cards
                </button>
                <button onClick={() => setView('graph')} className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-xl px-4 text-[0.66rem] font-bold tracking-[0.04em] uppercase transition-all', view === 'graph' ? 'bg-ac text-bg shadow-[0_2px_8px_rgba(0,97,148,0.3)]' : 'text-tx3 hover:text-tx')}>
                  <ChartLine size={13} /> Graph
                </button>
              </div>
            </div>

          {view === 'cards' ? (
              <SensorCardsSection
                meshSummary={meshSummary}
                sensorHistory={sensorHistory}
                filteredReadings={filteredReadings}
                nodes={nodes}
              />
            ) : (

                <SensorGraphSection sensorKinds={sensorKinds} sensorHistory={sensorHistory} filteredReadings={filteredReadings} nodeFilter={effectiveFilter} />

            )}
        </>
      )}
    </div>
  )
}

function FilterPill({ active, online, label, title, onClick }: { active: boolean; online?: boolean; label: string; title?: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className={cn('relative flex h-8 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-[0.66rem] font-bold tracking-[0.03em] uppercase transition-colors duration-300', active ? 'text-bg' : 'text-tx2 hover:text-tx')}>
      {active && <span className="absolute inset-0 rounded-xl bg-tx transition-colors duration-300" />}
      {online !== undefined && <span className={cn('relative z-10 h-1.5 w-1.5 rounded-full', online ? 'bg-gn' : 'bg-tx3')} />}
      <span className="relative z-10">{label}</span>
    </button>
  )
}
