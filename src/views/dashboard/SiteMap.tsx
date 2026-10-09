import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore, type LatLng } from '../../store/map'
import { useNexusStore } from '../../store/nexus'
import { BASE_STATION_LABEL } from '../../lib/utils'
import type { LeafletMouseEvent } from 'leaflet'
import { OfflineTileLayer } from '../../components/map/OfflineTileLayer'
import { TileRegionOverlay } from '../../components/map/TileRegionOverlay'

export type MapView = 'map' | 'satellite'

export const MAP_VIEWS: { id: MapView; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'satellite', label: 'Satellite' },
]

const MAP_MIN_ZOOM = 1
const MAP_MAX_ZOOM = 18

const baseIcon = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;font-family:ui-monospace,monospace;">B</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14],
})

const nodeIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
})

const emergencyIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);animation:sys-pulse 1s infinite;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;font-family:ui-monospace,monospace;">!</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -15],
})

interface SiteMapProps {
  view: MapView
  zoom: number
  center: LatLng
  onZoomChange: (zoom: number) => void
  onCenterChange: (center: LatLng) => void
  flyTo: { center: LatLng; zoom?: number; nonce: number } | null
}

/* report drag/pan + click back so the parent "center" state stays in sync */
function Events({ onCenterChange }: { onCenterChange: (c: LatLng) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter()
      onCenterChange({ lat: c.lat, lng: c.lng })
    },
    click(e: LeafletMouseEvent) {
      onCenterChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function ZoomSync({ zoom, onZoomChange, onCenterChange }: { zoom: number; onZoomChange: (z: number) => void; onCenterChange: (c: LatLng) => void }) {
  const map = useMap()

  useEffect(() => {
    const current = map.getZoom()
    if (current !== zoom) map.setZoom(Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, zoom)))
  }, [zoom, map])

  useEffect(() => {
    const h = () => onZoomChange(map.getZoom())
    const m = () => {
      const c = map.getCenter()
      onCenterChange({ lat: c.lat, lng: c.lng })
    }
    map.on('zoomend', h)
    map.on('moveend', m)
    return () => {
      map.off('zoomend', h)
      map.off('moveend', m)
    }
  }, [map, onZoomChange, onCenterChange])

  return null
}

function FlyTo({ target }: { target: SiteMapProps['flyTo'] }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.center.lat, target.center.lng], target.zoom ?? map.getZoom())
  }, [target, map])
  return null
}

export function SiteMap({ view, zoom, center, onZoomChange, onCenterChange, flyTo }: SiteMapProps) {
  const emergency = useNexusStore((s) => s.emergency)
  const nodes = useNexusStore((s) => s.nodes)
  const mapBase = useMapStore((s) => s.base)
  const mapNodes = useMapStore((s) => s.nodes)

  const tileProvider = view === 'satellite' ? 'satellite' : 'osm'

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
    >
      <OfflineTileLayer provider={tileProvider} />
      <TileRegionOverlay />
      <Events onCenterChange={onCenterChange} />
      <ZoomSync zoom={zoom} onZoomChange={onZoomChange} onCenterChange={onCenterChange} />
      <FlyTo target={flyTo} />

      {/* base station */}
      {mapBase && (
        <Marker position={[mapBase.lat, mapBase.lng]} icon={baseIcon} zIndexOffset={1000}>
          <Popup>
            <div style={{ fontFamily: 'Poppins, sans-serif', padding: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingBottom: 8, borderBottom: '1px solid rgba(0,97,148,0.1)', marginBottom: 8
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 10, background: '#16a34a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 11
                }}>B</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1b2432' }}>{BASE_STATION_LABEL}</div>
                  <div style={{ color: '#64748b', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>{formatCoords(mapBase)}</div>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* field nodes */}
      {Object.entries(mapNodes).map(([mac, c]) => {
        const node = nodes[mac]
        const label = node?.name || (node?.id != null && node.id > 0 ? `Node-${node.id}` : mac.slice(-6))
        return (
          <Marker key={mac} position={[c.lat, c.lng]} icon={nodeIcon}>
            <Popup>
              <div style={{ fontFamily: 'Poppins, sans-serif', padding: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  paddingBottom: 8, borderBottom: '1px solid rgba(0,97,148,0.1)', marginBottom: 8
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 10, background: '#2563eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 11
                  }}>N</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1b2432' }}>{label}</div>
                    <div style={{ color: '#64748b', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>{formatCoords(c)}</div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {/* active emergency */}
      {emergency && Number.isFinite(emergency.lat) && Number.isFinite(emergency.lon) && emergency.lat !== 0 && emergency.lon !== 0 && (
        <Marker
          position={[emergency.lat, emergency.lon]}
          icon={emergencyIcon}
          zIndexOffset={2000}
        >
          <Popup>
            <div style={{ fontFamily: 'Poppins, sans-serif', padding: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingBottom: 8, borderBottom: '1px solid rgba(220,38,38,0.15)', marginBottom: 8
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 10, background: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 12
                }}>!</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1b2432' }}>Node-{emergency.nodeId}</div>
                  <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>Emergency signal</div>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

function formatCoords(c: LatLng) {
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`
}
