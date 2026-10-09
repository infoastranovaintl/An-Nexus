import type { SensorKind, SensorSample } from '../../lib/nexus/sensors'
import { WaterLevelCard } from '../../components/ui/WaterLevelCard'
import { DistanceCard } from '../../components/ui/DistanceCard'
import { LiveSensorCard } from './sensorUi'
import { latestFor, type SensorSource } from './sensorMeta'
import type { NexNode, SensorPoint } from '../../store/nexus'

interface SensorCardsSectionProps {
  meshSummary: { kind: SensorKind; sample: SensorSample; macs: string[] }[]
  sensorHistory: Record<string, Record<string, SensorPoint[]>>
  filteredReadings: Record<string, SensorSample[]>
  nodes: Record<string, NexNode>
}

export function SensorCardsSection({
  meshSummary,
  sensorHistory,
  filteredReadings,
  nodes,
}: SensorCardsSectionProps) {
const cardCount = meshSummary.filter((e) => e.kind !== 'distance').length + 2
  const cols = cardCount <= 1 ? 1 : Math.min(Math.ceil(Math.sqrt(cardCount)), 4)
  const compact = cols > 1

  const sourcesForKind = (kind: SensorKind): SensorSource[] => {
    const entry = meshSummary.find((e) => e.kind === kind)
    if (!entry) return []
    return entry.macs.map((mac) => ({
      mac,
      label: nodes[mac]?.id === 0 ? 'GW' : 'N' + (nodes[mac]?.id ?? '?'),
      online: Boolean(nodes[mac]?.online),
    }))
  }

  return (
    <div className="grid w-full flex-1 min-h-0 gap-3 pb-4" style={{
      gridTemplateColumns: cols === 1 ? '1fr' : `repeat(${cols}, minmax(0, 1fr))`,
      gridAutoRows: '1fr',
    }}>
      <WaterLevelCard compact={compact} />
      <DistanceCard compact={compact} />
      {meshSummary.filter((e) => e.kind !== 'distance').map(({ kind, sample, macs: macList }) => (
        <LiveSensorCard
          key={kind}
          kind={kind}
          sample={sample}
          nodes={macList.length}
          data={latestFor(kind, sensorHistory, filteredReadings)}
          sources={sourcesForKind(kind)}
          compact={compact}
        />
      ))}
    </div>
  )
}
