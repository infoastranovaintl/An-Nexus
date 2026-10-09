import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { getRegions, type TileRegion } from '../../lib/map/tileStorage'

/**
 * Shows downloaded tile regions as white overlays and restricts map bounds.
 */
export function TileRegionOverlay() {
  const map = useMap()
  const [regions, setRegions] = useState<TileRegion[]>([])

  useEffect(() => {
    let alive = true
    const refresh = () => {
      getRegions().then((r) => { if (alive) setRegions(r) })
    }
    refresh()
    const iv = window.setInterval(refresh, 8000)
    return () => { alive = false; window.clearInterval(iv) }
  }, [])

  // Draw white overlays only — never fight FlyTo/ZoomSync for control
  useEffect(() => {
    if (regions.length === 0) return

    const layers: L.Rectangle[] = []
    for (const r of regions) {
      const bounds = L.latLngBounds(
        [r.bounds.south, r.bounds.west],
        [r.bounds.north, r.bounds.east],
      )
      const rect = L.rectangle(bounds, {
        color: '#ffffff',
        weight: 2,
        opacity: 0.6,
        fillColor: '#ffffff',
        fillOpacity: 0.08,
        dashArray: '6 4',
        interactive: false,
      })
      rect.addTo(map)
      layers.push(rect)
    }

    return () => { layers.forEach((l) => l.remove()) }
  }, [map, regions])

  // Restrict map bounds to downloaded regions (soft, doesn't override user zoom)
  useEffect(() => {
    if (regions.length === 0) {
      map.setMaxBounds(undefined)
      return
    }

    const allBounds = regions.reduce<L.LatLngBounds | null>((acc, r) => {
      const b = L.latLngBounds(
        [r.bounds.south, r.bounds.west],
        [r.bounds.north, r.bounds.east],
      )
      return acc ? acc.extend(b) : b
    }, null)

    if (allBounds) {
      const pad = 0.2
      const latSpan = allBounds.getNorth() - allBounds.getSouth()
      const lngSpan = allBounds.getEast() - allBounds.getWest()
      const padded = L.latLngBounds(
        [allBounds.getSouth() - latSpan * pad, allBounds.getWest() - lngSpan * pad],
        [allBounds.getNorth() + latSpan * pad, allBounds.getEast() + lngSpan * pad],
      )
      map.setMaxBounds(padded)
    }
  }, [map, regions])

  return null
}
