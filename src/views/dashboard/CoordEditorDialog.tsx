import { useEffect, useState } from 'react'
import { LuCrosshair as Crosshair, LuMapPin as MapPin } from 'react-icons/lu'
import { Dialog } from '../../components/ui/Dialog'
import { useNexusStore } from '../../store/nexus'
import { useMapStore, parseCoords, type LatLng } from '../../store/map'
import { BASE_STATION_LABEL, MASTER_MAC, shortMac } from '../../lib/utils'
import { Button } from '../../components/ui/primitives'
import { cn } from '../../lib/utils'

interface CoordEditorDialogProps {
  open: boolean
  onClose: () => void
  onFlyTo: (coord: LatLng) => void
}

interface Row {
  id: string
  label: string
  mac?: string
  coord: LatLng | null
  isBase?: boolean
}

const fmt = (c: LatLng) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`

export function CoordEditorDialog({ open, onClose, onFlyTo }: CoordEditorDialogProps) {
  const nodes = useNexusStore((s) => s.nodes)
  const mapBase = useMapStore((s) => s.base)
  const mapNodes = useMapStore((s) => s.nodes)
  const setBase = useMapStore((s) => s.setBase)
  const setNode = useMapStore((s) => s.setNode)

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    const rowOf = (id: string, coord: LatLng | null) => {
      next[id] = coord ? fmt(coord) : ''
    }
    rowOf('base', mapBase)
    for (const [mac, n] of Object.entries(nodes)) {
      if (n.isMaster || mac === MASTER_MAC) continue
      rowOf(mac, mapNodes[mac] ?? null)
    }
    setDrafts(next)
    setSaved({})
  }, [open])

  const rows: Row[] = (() => {
    const list: Row[] = [{ id: 'base', label: BASE_STATION_LABEL, coord: mapBase, isBase: true }]
    for (const [mac, n] of Object.entries(nodes)) {
      if (n.isMaster || mac === MASTER_MAC) continue
      const name = n.name || (n.id > 0 ? `Node-${n.id}` : shortMac(mac))
      list.push({ id: mac, label: name, mac, coord: mapNodes[mac] ?? null })
    }
    return list
  })()

  const save = (row: Row) => {
    const parsed = parseCoords(drafts[row.id] || '')
    if (row.mac) setNode(row.mac, parsed)
    else setBase(parsed)
    setSaved((s) => ({ ...s, [row.id]: true }))
    setTimeout(() => setSaved((s) => ({ ...s, [row.id]: false })), 1200)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Site coordinates" width="max-w-[540px]">
      <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-ac/15 bg-ac/5 px-4 py-3.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ac/15">
          <MapPin size={16} className="text-ac" />
        </div>
        <div className="text-[0.68rem] leading-relaxed text-tx2">
          Set latitude / longitude for the base station and each field node. Coordinates are saved automatically and markers appear on the site map.
        </div>
      </div>

      <div className="nexus-scroll max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group flex items-center gap-3 rounded-2xl border-2 border-tx3/10 bg-s2/30 px-4 py-3 transition-colors hover:border-ac/20 hover:bg-s2/50"
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                row.isBase ? 'bg-gn/10 text-gn' : 'bg-ac/10 text-ac',
              )}
            >
              {row.isBase ? <span className="text-[0.6rem] font-black">B</span> : <span className="text-[0.6rem] font-black">N</span>}
            </div>
            <div className="min-w-0 shrink-0">
              <div className="text-[0.7rem] font-bold text-tx">{row.label}</div>
              <div className="font-mono text-[0.54rem] text-tx3">
                {row.isBase ? 'BASE · lat, lng' : `NODE · lat, lng`}
              </div>
            </div>
            <input
              value={drafts[row.id] ?? ''}
              onChange={(e) => {
                setDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                setSaved((s) => ({ ...s, [row.id]: false }))
              }}
              onBlur={() => save(row)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(row) } }}
              placeholder="lat, lng"
              spellCheck={false}
              className="h-9 min-w-0 flex-1 rounded-xl border border-tx3/10 bg-s1 px-3 font-mono text-[0.66rem] text-tx outline-none transition-colors focus:border-ac/50 focus:ring-2 focus:ring-ac/15"
            />
            {saved[row.id] && (
              <span className="shrink-0 rounded-full bg-gn/10 px-2.5 py-1 text-[0.54rem] font-bold text-gn">Saved</span>
            )}
            {row.coord && (
              <button
                title="Center map on this marker"
                onClick={() => onFlyTo(row.coord!)}
                className="press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:bg-ac/5 hover:text-ac"
              >
                <Crosshair size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="font-mono text-[0.56rem] text-tx3">
          Coordinates persist in this browser.
        </div>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  )
}
