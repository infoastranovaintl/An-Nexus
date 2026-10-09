import { useEffect, useRef, useState } from 'react'
import {
  LuCrosshair as Crosshair,
  LuLayoutGrid as LayoutGrid,
  LuMap as Map,
  LuMapPin as MapPin,
  LuNetwork as Network,
  LuRefreshCw as Refresh,
  LuTrash2 as Trash2,
  LuZoomIn as ZoomIn,
  LuZoomOut as ZoomOut,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { usePositionsStore } from '../../store/positions'
import { useMapStore, type LatLng } from '../../store/map'
import { renderTopology, prewarmTopologySprites, type DrawNode } from '../../lib/nexus/canvas'
import { autoLayout } from '../../lib/nexus/nodes'
import { pairNode, requestAllData } from './nodeActions'
import { SiteMap, MAP_VIEWS, type MapView } from './SiteMap'
import { CoordEditorDialog } from './CoordEditorDialog'
import { MASTER_MAC, cn } from '../../lib/utils'
import { Button } from '../../components/ui/primitives'

interface TopologyCanvasProps {
  onToggleNodes: () => void
  onToggleDetail?: () => void
}

type DragState = {
  mac: string
  ox: number
  oy: number
  moved: boolean
  pos: { x: number; y: number }
  start: { x: number; y: number }
}

const MAP_LAT = 27.7172
const MAP_LNG = 85.324
const MIN_ZOOM = 1
const MAX_ZOOM = 18
const DEFAULT_ZOOM = 15

const topoBtn =
  'press flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-tx3/10 px-3 text-[0.62rem] font-semibold tracking-wide text-tx2 transition-colors hover:border-ac/40 hover:text-ac'

const mapBtn =
  'press flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:text-ac'

export function TopologyCanvas({ onToggleNodes, onToggleDetail }: TopologyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const miniCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const [mode, setMode] = useState<'topo' | 'map'>('topo')
  const [view, setView] = useState<MapView>('map')
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [mapCenter, setMapCenter] = useState<LatLng>(() => {
    const c = useMapStore.getState().center
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : { lat: MAP_LAT, lng: MAP_LNG }
  })
  const [flyTo, setFlyTo] = useState<{ center: LatLng; zoom?: number; nonce: number } | null>(null)
  const flyNonce = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const mapFirstEntered = useRef(false)

  const [coordOpen, setCoordOpen] = useState(false)

  const setMapCenterStore = useMapStore((s) => s.setCenter)

  const isTopo = mode === 'topo'

  const switchView = (next: MapView) => {
    setView(next)
  }

  const enterMap = () => {
    const store = useMapStore.getState()
    if (!mapFirstEntered.current) {
      mapFirstEntered.current = true
      if (!store.center) {
        const pts = [...Object.values(store.nodes)]
        if (store.base) pts.push(store.base)
        if (pts.length > 0) {
          const lat = pts.reduce((a, p) => a + p.lat, 0) / pts.length
          const lng = pts.reduce((a, p) => a + p.lng, 0) / pts.length
          const c = { lat, lng }
          setMapCenter(c)
          setMapCenterStore(c)
          setFlyTo({ center: c, zoom: DEFAULT_ZOOM, nonce: ++flyNonce.current })
        }
      }
    }
  }

  const handleFlyTo = (coord: LatLng) => {
    setMapCenter(coord)
    setFlyTo({ center: coord, zoom: 16, nonce: ++flyNonce.current })
    setCoordOpen(false)
  }

  useEffect(() => {
    prewarmTopologySprites()
    const canvas = canvasRef.current
    if (!canvas || mode !== 'topo') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const size = () => {
      const W = canvas.offsetWidth || 600
      const H = canvas.offsetHeight || 400
      return { W, H }
    }

    const resize = () => {
      const { W, H } = size()
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = () => {
      const { W, H } = size()
      const store = useNexusStore.getState()
      const positions = { ...usePositionsStore.getState().positions }
      if (dragRef.current) positions[dragRef.current.mac] = dragRef.current.pos
      const nodes: Record<string, DrawNode> = {}
      Object.values(store.nodes).forEach((n) => {
        const p = positions[n.mac] || { x: W / 2, y: H / 2 }
        nodes[n.mac] = { ...n, pos: p }
      })
      renderTopology(ctx, W, H, nodes, store.wires, store.selectedMac, store.wireMode)
    }

    const hitTest = (mx: number, my: number): string | null => {
      const store = useNexusStore.getState()
      const positions = usePositionsStore.getState().positions
      let hit: string | null = null
      Object.values(store.nodes).forEach((n) => {
        const p = positions[n.mac]
        if (!p) return
        const r = n.isMaster || n.mac === MASTER_MAC ? 28 : 22
        if (Math.hypot(mx - p.x, my - p.y) < r) hit = n.mac
      })
      return hit
    }

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const store = useNexusStore.getState()
      const positions = usePositionsStore.getState().positions
      Object.values(store.nodes).forEach((n) => {
        const p = positions[n.mac]
        if (!p) return
        const r = n.isMaster || n.mac === MASTER_MAC ? 28 : 22
        if (Math.hypot(mx - p.x, my - p.y) < r) {
          if (store.wireMode && store.selectedMac && n.mac !== store.selectedMac) {
            pairNode(store.selectedMac, n.mac)
            useNexusStore.getState().setWireMode(false)
          } else {
            dragRef.current = {
              mac: n.mac,
              ox: mx - p.x,
              oy: my - p.y,
              moved: false,
              pos: { ...p },
              start: { x: p.x, y: p.y },
            }
          }
        }
      })
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const rect = canvas.getBoundingClientRect()
      const { W, H } = size()
      const d = dragRef.current
      d.pos.x = Math.max(30, Math.min(W - 30, e.clientX - rect.left - d.ox))
      d.pos.y = Math.max(30, Math.min(H - 30, e.clientY - rect.top - d.oy))
      if (Math.abs(d.pos.x - d.start.x) > 2 || Math.abs(d.pos.y - d.start.y) > 2) d.moved = true
      draw()
    }

    const onMouseUp = () => {
      if (dragRef.current) {
        const d = dragRef.current
        if (d.moved) usePositionsStore.getState().setPos(d.mac, { ...d.pos })
        dragRef.current = null
      }
    }

    const onClick = (e: MouseEvent) => {
      if (dragRef.current) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const store = useNexusStore.getState()
      const hit = hitTest(mx, my)
      if (hit && !store.wireMode) store.selectNode(hit)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('click', onClick)

    let raf = 0
    let last = 0
    const tick = (ts: number) => {
      if (ts - last >= 80) {
        last = ts
        draw()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('click', onClick)
    }
  }, [mode])

  // Mini topology canvas for map mode preview
  useEffect(() => {
    const canvas = miniCanvasRef.current
    if (!canvas || mode !== 'map') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = 128
    const H = 128
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const store = useNexusStore.getState()
      const rawPositions = usePositionsStore.getState().positions

      const allMacs = Object.keys(store.nodes)
      if (allMacs.length === 0) return

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      allMacs.forEach((mac) => {
        const p = rawPositions[mac]
        if (p) {
          minX = Math.min(minX, p.x)
          maxX = Math.max(maxX, p.x)
          minY = Math.min(minY, p.y)
          maxY = Math.max(maxY, p.y)
        }
      })

      if (!isFinite(minX)) return

      const pad = 60
      minX -= pad; maxX += pad; minY -= pad; maxY += pad

      const rangeX = maxX - minX || 1
      const rangeY = maxY - minY || 1
      const scale = Math.min(W / rangeX, H / rangeY) * 0.7

      const offsetX = (W - rangeX * scale) / 2
      const offsetY = (H - rangeY * scale) / 2

      ctx.save()
      ctx.scale(scale, scale)

      const nodes: Record<string, DrawNode> = {}
      allMacs.forEach((mac) => {
        const p = rawPositions[mac] || { x: W / 2, y: H / 2 }
        const sx = (p.x - minX) + offsetX / scale
        const sy = (p.y - minY) + offsetY / scale
        nodes[mac] = { ...store.nodes[mac], pos: { x: sx, y: sy } }
      })

      renderTopology(ctx, W / scale, H / scale, nodes, store.wires, store.selectedMac, store.wireMode)
      ctx.restore()
    }

    draw()

    let raf = 0
    let last = 0
    const tick = (ts: number) => {
      if (ts - last >= 200) {
        last = ts
        draw()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [mode])

  return (
    <div className="topo-grid relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-tx3/15 bg-s1">
      {/* toolbar */}
      <div className="relative z-[80] flex flex-shrink-0 flex-wrap items-center gap-3 border-b-2 border-tx3/10 bg-s1 px-4 py-3 sm:px-5 sm:py-3.5">
        {isTopo ? <Network size={16} className="shrink-0 text-ac" /> : <Map size={16} className="shrink-0 text-ac" />}
        <span className="flex-1 text-[0.82rem] font-bold tracking-[0.06em] text-tx">
          {isTopo ? 'Mesh Topology' : 'Site Map'}
        </span>

        <Button size="sm" className="lg:hidden" onClick={onToggleNodes} data-tip="Field nodes" data-tip-pos="bottom">
          <Crosshair size={11} /> Nodes
        </Button>
        {onToggleDetail && (
          <Button size="sm" className="lg:hidden" onClick={onToggleDetail} data-tip="Node detail" data-tip-pos="bottom">
            <LayoutGrid size={11} /> Detail
          </Button>
        )}

        {isTopo && (
          <>
            <button
              onClick={() => {
                useNexusStore.getState().clearWires()
                useNexusStore.getState().addLog('Wires cleared', 'SYS')
              }}
              data-tip="Clear wires"
              data-tip-pos="bottom"
              aria-label="Clear wires"
              className={cn(topoBtn, 'hover:border-rd/40 hover:text-rd')}
            >
              <Trash2 size={12} /> Clear
            </button>
            <button onClick={autoLayout} data-tip="Auto layout" data-tip-pos="bottom" aria-label="Auto layout" className={topoBtn}>
              <LayoutGrid size={12} /> Layout
            </button>
            <button
              onClick={async () => {
                setRefreshing(true)
                try {
                  await requestAllData()
                  autoLayout()
                } finally {
                  setTimeout(() => setRefreshing(false), 800)
                }
              }}
              data-tip="Refresh / re-detect nodes"
              data-tip-pos="bottom"
              aria-label="Refresh / re-detect nodes"
              className={topoBtn}
            >
              <Refresh size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </>
        )}
        {!isTopo && (
          <>
            <div className="flex h-7 items-center gap-0.5 rounded-md border border-tx3/10 bg-s2/60 p-0.5">
              {MAP_VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => switchView(id)}
                  className={cn(
                    'flex h-6 cursor-pointer items-center rounded px-2 text-[0.6rem] font-semibold tracking-[0.05em] uppercase transition-colors',
                    view === id ? 'bg-ac/15 text-ac' : 'text-tx2 hover:text-tx',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMapZoom((z) => Math.max(MIN_ZOOM, z - 1))}
              data-tip="Zoom out"
              data-tip-pos="bottom"
              aria-label="Zoom out"
              className={mapBtn}
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={() => setMapZoom((z) => Math.min(MAX_ZOOM, z + 1))}
              data-tip="Zoom in"
              data-tip-pos="bottom"
              aria-label="Zoom in"
              className={mapBtn}
            >
              <ZoomIn size={12} />
            </button>

            <button
               onClick={() => setCoordOpen(true)}
              data-tip="Edit coordinates"
              data-tip-pos="bottom"
              aria-label="Edit coordinates"
              className={mapBtn}
            >
              <MapPin size={12} />
            </button>
          </>
        )}
      </div>

      

      {/* map / topology */}
      {isTopo && (
        <div className="relative min-h-0 flex-1">
          <canvas
            ref={canvasRef}
            id="topology-canvas"
            className="relative z-10 block min-h-0 h-full w-full cursor-crosshair"
          />
          {/* mini map — bottom right, click to switch */}
          <button
            type="button"
            onClick={() => {
              enterMap()
              setMode('map')
              setMapCenterStore(mapCenter)
            }}
            className="absolute bottom-4 right-4 z-20 h-36 w-36 overflow-hidden rounded-2xl border-2 border-tx3/15 bg-s1 shadow-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:h-72 hover:w-72 cursor-pointer"
          >
            <div className="pointer-events-none absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-s1/90 px-2 py-0.5 text-[0.5rem] font-bold tracking-wide text-tx3 uppercase backdrop-blur-sm">
              <Map size={9} />
              Map
            </div>
            <div className="pointer-events-none h-full w-full">
              <SiteMap
                view={view}
                zoom={mapZoom}
                center={mapCenter}
                onZoomChange={setMapZoom}
                onCenterChange={(c) => {
                  setMapCenter(c)
                  setMapCenterStore(c)
                }}
                flyTo={flyTo}
              />
            </div>
          </button>
        </div>
      )}
      {!isTopo && (
        <div className="relative min-h-0 flex-1">
          {/* full map */}
          <div className="relative z-10 h-full w-full overflow-hidden rounded-lg border border-tx3/10">
            <SiteMap
              view={view}
              zoom={mapZoom}
              center={mapCenter}
              onZoomChange={setMapZoom}
              onCenterChange={(c) => {
                setMapCenter(c)
                setMapCenterStore(c)
              }}
              flyTo={flyTo}
            />
            <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-full border border-tx3/10 bg-s1/90 px-2.5 py-1 font-mono text-[0.56rem] tracking-[0.08em] text-tx2 uppercase backdrop-blur-sm">
              <Map size={10} />
              {view}
            </div>
            {/* mini topology — bottom right, click to switch back */}
            <button
              type="button"
              onClick={() => setMode('topo')}
              className="absolute bottom-4 right-4 z-20 h-36 w-36 overflow-hidden rounded-2xl border-2 border-tx3/15 bg-s1 shadow-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:h-72 hover:w-72 cursor-pointer"
            >
              <div className="pointer-events-none absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-s1/90 px-2 py-0.5 text-[0.5rem] font-bold tracking-wide text-tx3 uppercase backdrop-blur-sm">
                <Network size={9} />
                Topology
              </div>
              <div className="pointer-events-none h-full w-full">
                <canvas
                  ref={miniCanvasRef}
                  className="block h-full w-full"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </button>
          </div>
        </div>
      )}

      <CoordEditorDialog open={coordOpen} onClose={() => setCoordOpen(false)} onFlyTo={handleFlyTo} />
    </div>
  )
}
