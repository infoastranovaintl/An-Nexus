import { useMemo, useState } from 'react'
import { LuCable as Cable, LuCheck as Check, LuChevronDown as ChevronDown, LuLink2Off as LinkOff, LuNetwork as Network, LuPencil as Pencil, LuSignalHigh as SignalHigh, LuSignalLow as SignalLow, LuSignalMedium as SignalMedium, LuSignalZero as SignalZero, LuTrash2 as Trash, LuX as X } from 'react-icons/lu'
import { Badge, Button, Empty, Panel, PanelTitle, StatusDot } from '../../components/ui/primitives'
import { useNexusStore } from '../../store/nexus'
import {
  cn,
  MASTER_MAC,
  macFmt,
  sigTone,
  SIG_TONE_HEX,
} from '../../lib/utils'
import { wireToBase, unwireNode, connectedToBase } from './nodeActions'
import { requestConfirm } from '../../lib/popup'
import type { SensorKind } from '../../lib/nexus/sensors'
import { KIND_COLOR, KIND_ICON } from '../sensors/sensorMeta'

export function NodeList() {
  const nodes = useNexusStore((s) => s.nodes)
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const updateNode = useNexusStore((s) => s.updateNode)
  const removeNode = useNexusStore((s) => s.removeNode)
  const [expandedMac, setExpandedMac] = useState<string | null>(null)
  const [editingMac, setEditingMac] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const all = useMemo(
    () => Object.values(nodes).filter((n) => !n.isMaster && n.mac !== MASTER_MAC),
    [nodes],
  )

  const online = all.filter((n) => n.online)

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        icon={<Network size={14} />}
        badge={
          online.length > 0 ? (
            <Badge variant="green">
              {online.length}/{all.length} online
            </Badge>
          ) : (
            <Badge>{all.length}</Badge>
          )
        }
      >
        Field Nodes
      </PanelTitle>

      <div className="nexus-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {all.length === 0 ? (
          <Empty
            icon={<Network size={36} />}
            title={<div>No field nodes</div>}
            sub={<div className="text-[0.62rem]">Power on ESP32 units</div>}
          />
        ) : (
          all.map((n) => {
            const expanded = expandedMac === n.mac
            const toBase = connectedToBase(n.mac)
            const isEditing = editingMac === n.mac
            const readings = sensorReadings[n.mac] || []
            const liveSensors = readings.filter((r) => r.kind !== 'water')
            const isOnline = n.online

            return (
              <div key={n.mac} className="flex-shrink-0">
                {/* card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedMac((prev) => (prev === n.mac ? null : n.mac))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedMac((prev) => (prev === n.mac ? null : n.mac))
                    }
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-2 bg-s1 px-4 py-3 transition-all duration-200',
                    expanded && 'border-ac shadow-[0_0_0_3px_rgba(0,97,148,0.1)]',
                    !expanded && isOnline && toBase && 'border-gn/40 hover:border-gn/60',
                    !expanded && isOnline && !toBase && 'border-ac/30 hover:border-ac/50',
                    !expanded && !isOnline && 'border-rd/25 hover:border-rd/40',
                    !expanded && !n.paired && 'border-am/25 hover:border-am/40',
                  )}
                >
                  <StatusDot tone={n.online ? 'green' : n.paired ? 'red' : 'amber'} pulse={n.online} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.82rem] font-bold text-tx">
                      {n.name || `Node ${n.id}`}
                    </div>
                    <div className="mt-0.5 font-mono text-[0.56rem] text-tx3">
                      {n.macFmt || macFmt(n.mac)}
                      {n.id > 0 && <>, N{n.id}</>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.5rem] font-bold tracking-wide uppercase',
                          isOnline
                            ? toBase
                              ? 'bg-gn/10 text-gn'
                              : 'bg-ac/10 text-ac'
                            : 'bg-rd/10 text-rd',
                        )}
                      >
                        {isOnline ? (toBase ? 'Connected' : 'Online') : 'Offline'}
                      </span>
                      {!n.paired && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-am/5 px-2 py-0.5 text-[0.5rem] font-semibold text-am/70">
                          Unpaired
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <SignalIcon rssi={n.rssi} />
                    <span className="font-mono text-[0.48rem] text-tx3">
                      {n.rssi ? `${n.rssi}dBm` : '—'}
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant={toBase ? 'red' : 'green'}
                    data-tip={toBase ? 'Unwire' : 'Wire'}
                    data-tip-pos="left"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (toBase) unwireNode(n.mac)
                      else wireToBase(n.mac)
                    }}
                  >
                    {toBase ? <LinkOff size={10} /> : <Cable size={10} />}
                    {toBase ? 'Unwire' : 'Wire'}
                  </Button>
                  <ChevronDown
                    size={15}
                    className={cn(
                      'shrink-0 text-tx3 transition-transform duration-200',
                      expanded && 'rotate-180',
                    )}
                  />
                </div>

                {/* expanded panel */}
                {expanded && (
                  <div className="mt-2 rounded-2xl border-2 border-ac/20 bg-ac/[0.02] px-4 py-4">
                    {/* controls row */}
                    <div className="mb-4 flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const trimmed = draftName.trim()
                                updateNode(n.mac, { name: trimmed || (n.name || `Node ${n.id}`) })
                                setEditingMac(null)
                                setDraftName('')
                              }
                              if (e.key === 'Escape') {
                                setEditingMac(null)
                                setDraftName('')
                              }
                            }}
                            className="h-10 min-w-0 flex-1 rounded-xl border-2 border-ac/40 bg-white px-3 text-[0.82rem] font-semibold text-tx outline-none focus:border-ac"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = draftName.trim()
                              updateNode(n.mac, { name: trimmed || (n.name || `Node ${n.id}`) })
                              setEditingMac(null)
                              setDraftName('')
                            }}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gn/10 text-gn hover:bg-gn/20"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMac(null)
                              setDraftName('')
                            }}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tx3/10 text-tx3 hover:bg-tx3/15"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-tx">
                            {n.name || `Node ${n.id}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMac(n.mac)
                              setDraftName(n.name || '')
                            }}
                            title="Rename"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-tx3/15 text-tx3 hover:border-ac hover:text-ac"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await requestConfirm({
                                title: `Forget ${n.name || `Node ${n.id}`}?`,
                                message: 'Remove this node, its links and sensor history.',
                                confirmLabel: 'Forget',
                                danger: true,
                              })
                              if (ok) removeNode(n.mac)
                            }}
                            title="Forget node"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-tx3/15 text-tx3 hover:border-rd hover:text-rd"
                          >
                            <Trash size={14} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* live sensor readings */}
                    {liveSensors.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gn/10 px-2.5 py-1 text-[0.56rem] font-bold tracking-wide text-gn uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-gn" />
                            Live Feed
                          </span>
                          <span className="h-px flex-1 bg-tx3/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {liveSensors.map((s, i) => {
                            const Icon = KIND_ICON[s.kind as SensorKind] || KIND_ICON.generic
                            const color = KIND_COLOR[s.kind as SensorKind] || '#888'
                            return (
                              <div
                                key={`${s.kind}-${i}`}
                                className="flex items-center gap-3 rounded-xl border border-tx3/10 bg-white px-3.5 py-3"
                              >
                                <span
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                  style={{ background: color + '18', color }}
                                >
                                  <Icon size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[0.56rem] font-semibold text-tx3 uppercase tracking-wide">
                                    {s.key}
                                  </div>
                                  <div className="font-mono text-[0.82rem] font-bold text-tx tabular-nums">
                                    {Math.abs(s.value) >= 100 ? s.value.toFixed(0) : s.value.toFixed(1)}
                                    <span className="ml-0.5 text-[0.62rem] font-medium text-tx3">
                                      {s.unit}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Panel>
  )
}

function SignalIcon({ rssi }: { rssi: number }) {
  if (!rssi) return <SignalZero size={16} className="shrink-0 text-tx3" />
  const tone = sigTone(rssi)
  const color = SIG_TONE_HEX[tone]
  if (tone === 'good') return <SignalHigh size={16} style={{ color }} className="shrink-0" />
  if (tone === 'fair') return <SignalMedium size={16} style={{ color }} className="shrink-0" />
  return <SignalLow size={16} style={{ color }} className="shrink-0" />
}
