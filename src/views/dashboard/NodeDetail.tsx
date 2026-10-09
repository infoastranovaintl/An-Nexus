import {
  LuBluetooth as Bluetooth,
  LuCheck as Check,
  LuGauge as Gauge,
  LuPencil as Pencil,
  LuRouter as Router,
  LuTrash2 as Trash,
  LuTriangleAlert as AlertTriangle,
  LuWifi as Wifi,
  LuX as X,
  LuZap as Zap,
} from 'react-icons/lu'
import { Badge, Empty, Panel, PanelTitle } from '../../components/ui/primitives'
import { useNexusStore } from '../../store/nexus'
import { usePositionsStore } from '../../store/positions'
import { canvasBearing, cn, distLabel, MASTER_MAC, rssiToDistance, shortMac, timeSince, SIG_TONE_CSS, sigTone } from '../../lib/utils'
import { useState } from 'react'
import { requestConfirm } from '../../lib/popup'

function DetailCell({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-tx3/10 bg-s2 px-2 py-1.5', span && 'col-span-2')}>
      <div className="mb-0.5 text-[0.5rem] font-semibold tracking-[0.08em] text-tx3 uppercase">{label}</div>
      <div className="font-mono text-[0.64rem] break-all text-tx">{children}</div>
    </div>
  )
}

export function NodeDetail() {
  const nodes = useNexusStore((s) => s.nodes)
  const selectedMac = useNexusStore((s) => s.selectedMac)
  const bleConnected = useNexusStore((s) => s.bleConnected)
  const bleDeviceName = useNexusStore((s) => s.bleDeviceName)
  const wsConnected = useNexusStore((s) => s.wsConnected)
  const totalPkts = useNexusStore((s) => s.totalPkts)
  const wires = useNexusStore((s) => s.wires)
  const positions = usePositionsStore((s) => s.positions)
  const updateNode = useNexusStore((s) => s.updateNode)
  const removeNode = useNexusStore((s) => s.removeNode)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')

  const n = selectedMac ? nodes[selectedMac] : undefined

  const startEdit = (name: string) => {
    setDraftName(name || '')
    setEditingName(true)
  }

  const cancelEdit = () => {
    setEditingName(false)
    setDraftName('')
  }

  const saveName = (mac: string, currentName: string) => {
    const trimmed = draftName.trim()
    updateNode(mac, { name: trimmed || currentName || shortMac(mac) })
    setEditingName(false)
    setDraftName('')
  }

  if (!n) {
    return (
      <Panel className="flex min-h-0 flex-1 flex-col">
        <PanelTitle badge={<Badge>Select</Badge>}>Node Detail</PanelTitle>
        <Empty
          icon={<Gauge size={26} />}
          title={<div>Select a field node</div>}
          sub={<div className="text-[0.58rem]">Click node on map or list</div>}
        />
      </Panel>
    )
  }

  const isMaster = n.isMaster || n.mac === MASTER_MAC
  const baseOnline = bleConnected || wsConnected
  const fieldNodes = Object.values(nodes).filter((x) => !x.isMaster && x.mac !== MASTER_MAC)
  const onlineCount = fieldNodes.filter((x) => x.online).length
  const pairedCount = fieldNodes.filter((x) => x.online && x.paired).length
  const baseLinks = wires.filter((w) => w.from === MASTER_MAC || w.to === MASTER_MAC)

  const masterPos = positions[MASTER_MAC]
  const nPos = positions[n.mac]
  const dist = rssiToDistance(n.rssi)
  const bearing =
    !isMaster && nPos && masterPos ? canvasBearing(nPos.x, nPos.y, masterPos.x, masterPos.y) : null
  const since = n.lastSeen ? timeSince(n.lastSeen) : 'never'

  const displayName = n.name || n.macFmt || shortMac(n.mac)
  const renameLabel = isMaster ? 'Base Station' : 'Field Node'

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        badge={
          isMaster ? (
            <Badge variant={baseOnline ? 'green' : 'red'}>
              {baseOnline ? 'Base Online' : 'Base Offline'}
            </Badge>
          ) : (
            <Badge variant={n.online ? 'green' : 'red'}>
              {n.online ? 'Online' : 'Offline'}
            </Badge>
          )
        }
      >
        {isMaster ? 'Base Station' : 'Node Detail'}
      </PanelTitle>

      {/* ═══ name block with rename ═══ */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {editingName ? (
            <div className="flex flex-1 items-center gap-1">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName(n.mac, displayName)
                  if (e.key === 'Escape') cancelEdit()
                }}
                placeholder={`${renameLabel} name`}
                className="h-7 min-w-0 flex-1 rounded-md border border-ac/40 bg-s1 px-2 text-[0.78rem] text-tx outline-none focus:border-ac"
              />
              <button
                type="button"
                onClick={() => saveName(n.mac, displayName)}
                title="Save name"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gn/30 text-gn transition-colors hover:bg-gn/10"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                title="Cancel"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-tx3/20 text-tx3 transition-colors hover:bg-tx3/10"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[0.95rem] leading-none font-bold text-tx">
                {displayName}
              </span>
              <button
                type="button"
                onClick={() => startEdit(n.name)}
                title={`Rename ${renameLabel.toLowerCase()}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-tx3 transition-colors hover:bg-tx3/10 hover:text-tx"
              >
                <Pencil size={12} />
              </button>
              {!isMaster && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await requestConfirm({
                      title: `Forget ${displayName}?`,
                      message: 'Remove this node, its links and sensor history. It can be discovered again on reconnect.',
                      confirmLabel: 'Forget',
                      danger: true,
                    })
                    if (ok) removeNode(n.mac)
                  }}
                  title="Forget node"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-tx3 transition-colors hover:bg-rd/10 hover:text-rd"
                >
                  <Trash size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="nexus-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {!isMaster && !n.online && (
          <div className="flex items-center gap-2 rounded-lg border border-rd/30 bg-rd/10 px-2.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.06em] text-rd uppercase">
            <AlertTriangle size={12} className="shrink-0" /> Offline — check power / range
          </div>
        )}

        {isMaster ? (
          <>
            {/* ═══ master-exclusive metrics ═══ */}
            <div className="grid grid-cols-2 gap-1.5">
              <DetailCell label="Link">
                <span className="flex flex-wrap gap-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 border px-1 py-px text-[0.56rem] font-medium',
                      bleConnected ? 'border-gn/25 text-gn' : 'border-rd/25 text-rd',
                    )}
                  >
                    <Bluetooth size={9} /> BLE {bleConnected ? 'on' : 'off'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 border px-1 py-px text-[0.56rem] font-medium',
                      wsConnected ? 'border-gn/25 text-gn' : 'border-rd/25 text-rd',
                    )}
                  >
                    <Wifi size={9} /> WS {wsConnected ? 'on' : 'off'}
                  </span>
                </span>
              </DetailCell>
              <DetailCell label="Device">{bleDeviceName || '—'}</DetailCell>
              <DetailCell label="Packets">
                <span className="inline-flex items-center gap-1">
                  <Zap size={9} className="text-am" /> {totalPkts}
                </span>
              </DetailCell>
              <DetailCell label="Mesh">{fieldNodes.length} nodes · {onlineCount} online</DetailCell>
              <DetailCell label="Paired">{pairedCount} wired to base</DetailCell>
              <DetailCell label="Base links">{baseLinks.length} direct</DetailCell>
              <DetailCell label="RSSI">{n.rssi ? `${n.rssi} dBm` : '—'}</DetailCell>
              <DetailCell label="Last Seen">{since}</DetailCell>
              <DetailCell label="MAC" span>{n.macFmt || shortMac(n.mac)}</DetailCell>
            </div>

            {/* ═══ routing to base ═══ */}
            <div className="rounded-lg border border-tx3/10 bg-s2 p-2">
              <div className="mb-1 flex items-center gap-1.5 text-[0.52rem] font-semibold tracking-[0.08em] text-ac uppercase">
                <Router size={10} /> Routing to base
              </div>
              {baseLinks.length === 0 ? (
                <div className="text-[0.58rem] leading-relaxed text-tx3">
                  No nodes wired to the base yet — use Wire mode on the topology to link them.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {baseLinks.map((w, i) => {
                    const peer = w.from === MASTER_MAC ? w.to : w.from
                    const pn = nodes[peer]
                    const q = sigTone(w.rssi)
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-md border border-tx3/10 bg-s1 px-2 py-1">
                        <span
                          className={cn('h-1.5 w-1.5 rounded-full', pn?.online ? 'bg-gn' : 'bg-rd')}
                          aria-hidden
                        />
                        <span className="truncate font-mono text-[0.58rem] text-tx">
                          {pn?.name || shortMac(peer)}
                        </span>
                        <span className="ml-auto h-1 w-10 shrink-0 overflow-hidden rounded-full bg-s3">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${q}%`, background: SIG_TONE_CSS[q] }}
                          />
                        </span>
                        <span className="w-8 shrink-0 text-right font-mono text-[0.54rem] text-tx3">{w.rssi}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* metrics */}
            <div className="grid grid-cols-2 gap-1.5">
              <DetailCell label="RSSI">{n.rssi ? `${n.rssi} dBm` : '—'}</DetailCell>
              <DetailCell label="Distance">{distLabel(dist)}</DetailCell>
              <DetailCell label="Bearing">{bearing ? `${bearing.deg}° ${bearing.label}` : '—'}</DetailCell>
              <DetailCell label="Parent">{n.parent ? shortMac(n.parent) : '—'}</DetailCell>
              <DetailCell label="Last Seen">{since}</DetailCell>
              <DetailCell label="MAC">{n.macFmt || shortMac(n.mac)}</DetailCell>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}