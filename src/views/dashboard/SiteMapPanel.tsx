import { useState, useRef } from 'react'
import {
  LuMap as Map,
  LuMapPin as MapPin,
  LuZoomIn as ZoomIn,
  LuZoomOut as ZoomOut,
} from 'react-icons/lu'
import { useMapStore, type LatLng } from '../../store/map'
import { useTilesStore } from '../../lib/map/tiles'
import { SiteMap, MAP_VIEWS, type MapView } from './SiteMap'
import { CoordEditorDialog } from './CoordEditorDialog'
import { Panel, PanelTitle } from '../../components/ui/primitives'
import { cn } from '../../lib/utils'

const MAP_LAT = 27.7172
const MAP_LNG = 85.324
const MIN_ZOOM = 1
const MAX_ZOOM = 18
const DEFAULT_ZOOM = 15

export function SiteMapPanel() {
  const [view, setView] = useState<MapView>('map')
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [mapCenter, setMapCenter] = useState<LatLng>(() => {
    const c = useMapStore.getState().center
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : { lat: MAP_LAT, lng: MAP_LNG }
  })
  const [flyTo, setFlyTo] = useState<{ center: LatLng; zoom?: number; nonce: number } | null>(null)
  const flyNonce = useRef(0)
  const [coordOpen, setCoordOpen] = useState(false)

  const setMapCenterStore = useMapStore((s) => s.setCenter)
  const tilesOffline = useTilesStore((s) => s.offline)

  const switchView = (next: MapView) => {
    setView(next)
  }

  const handleFlyTo = (coord: LatLng) => {
    setMapCenter(coord)
    setFlyTo({ center: coord, zoom: 16, nonce: ++flyNonce.current })
    setCoordOpen(false)
  }

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelTitle icon={<Map size={13} />}>
        Site Map
      </PanelTitle>

      {/* toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {/* Tile layer toggle */}
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
          className="press flex h-7 cursor-pointer items-center justify-center rounded-md border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:text-ac"
        >
          <ZoomOut size={12} />
        </button>
        <button
          onClick={() => setMapZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          data-tip="Zoom in"
          data-tip-pos="bottom"
          aria-label="Zoom in"
          className="press flex h-7 cursor-pointer items-center justify-center rounded-md border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:text-ac"
        >
          <ZoomIn size={12} />
        </button>

        <button
          onClick={() => useTilesStore.getState().setOffline(!useTilesStore.getState().offline)}
          data-tip={tilesOffline ? 'Offline tiles on' : 'Online tiles on'}
          data-tip-pos="bottom"
          aria-label="Toggle offline tiles"
          className={cn('press flex h-7 cursor-pointer items-center justify-center rounded-md border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:text-ac', tilesOffline && 'border-amber-400/50 text-amber-400')}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="8" width="20" height="12" rx="2" />
            <path d="M4 12h16" />
            <path d="M7 8V5a5 5 0 0110 0v3" />
          </svg>
        </button>

        <button
          onClick={() => setCoordOpen(true)}
          data-tip="Edit coordinates"
          data-tip-pos="bottom"
          aria-label="Edit coordinates"
          className="press flex h-7 cursor-pointer items-center justify-center rounded-md border border-tx3/10 text-tx2 transition-colors hover:border-ac/40 hover:text-ac"
        >
          <MapPin size={12} />
        </button>
      </div>

      {/* map */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-tx3/10">
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
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 rounded-full border border-tx3/10 bg-s1/90 px-2.5 py-1 font-mono text-[0.52rem] tracking-[0.08em] text-tx2 uppercase backdrop-blur-sm">
          <Map size={9} />
          {view}
        </div>
      </div>

      <CoordEditorDialog open={coordOpen} onClose={() => setCoordOpen(false)} onFlyTo={handleFlyTo} />
    </Panel>
  )
}
