import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTilesStore } from '../../lib/map/tiles'

export interface KMLBounds {
  north: number
  south: number
  east: number
  west: number
}

function parseKMLCoordinates(coordStr: string): [number, number][] {
  const coords: [number, number][] = []
  const cleaned = coordStr.replace(/\n/g, ' ').trim()
  const points = cleaned.split(/\s+/)
  for (const point of points) {
    const parts = point.split(',')
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      if (!isNaN(lat) && !isNaN(lng)) {
        coords.push([lat, lng])
      }
    }
  }
  return coords
}

function getAllCoordinates(doc: Document): [number, number][] {
  const allCoords: [number, number][] = []

  // LineString coordinates
  doc.querySelectorAll('LineString coordinates').forEach((el) => {
    if (el.textContent) allCoords.push(...parseKMLCoordinates(el.textContent))
  })

  // Polygon outerBoundaryIs coordinates (direct child)
  doc.querySelectorAll('Polygon outerBoundaryIs coordinates').forEach((el) => {
    if (el.textContent) allCoords.push(...parseKMLCoordinates(el.textContent))
  })

  // Polygon outerBoundaryIs > LinearRing > coordinates (standard KML format)
  doc.querySelectorAll('Polygon outerBoundaryIs LinearRing coordinates').forEach((el) => {
    if (el.textContent) allCoords.push(...parseKMLCoordinates(el.textContent))
  })

  // Point coordinates
  doc.querySelectorAll('Point coordinates').forEach((el) => {
    if (el.textContent) allCoords.push(...parseKMLCoordinates(el.textContent))
  })

  // GroundOverlay LatLonBox
  doc.querySelectorAll('GroundOverlay LatLonBox').forEach((box) => {
    const north = parseFloat(box.querySelector('north')?.textContent || '0')
    const south = parseFloat(box.querySelector('south')?.textContent || '0')
    const east = parseFloat(box.querySelector('east')?.textContent || '0')
    const west = parseFloat(box.querySelector('west')?.textContent || '0')
    if (north && south && east && west) {
      allCoords.push([north, east])
      allCoords.push([south, west])
    }
  })

  // Fallback: grab any top-level <coordinates> not yet matched
  if (allCoords.length === 0) {
    doc.querySelectorAll('coordinates').forEach((el) => {
      if (el.textContent) allCoords.push(...parseKMLCoordinates(el.textContent))
    })
  }

  return allCoords
}

export function parseKMLBounds(kmlContent: string): KMLBounds | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlContent, 'text/xml')
  const allCoords = getAllCoordinates(doc)

  if (allCoords.length === 0) return null

  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity
  for (const [lat, lng] of allCoords) {
    north = Math.max(north, lat)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    west = Math.min(west, lng)
  }

  return { north, south, east, west }
}

function parseKML(kmlContent: string, offline: boolean): L.Layer[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlContent, 'text/xml')
  const layers: L.Layer[] = []

  const placemarks = doc.querySelectorAll('Placemark')
  placemarks.forEach((pm) => {
    const name = pm.querySelector('name')?.textContent || ''
    const desc = pm.querySelector('description')?.textContent || ''

    // LineString
    const lineString = pm.querySelector('LineString coordinates')
    if (lineString?.textContent) {
      const coords = parseKMLCoordinates(lineString.textContent)
      if (coords.length > 1) {
        const line = L.polyline(coords, {
          color: '#006194',
          weight: 3,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        })
        const popup = buildPopup(name, desc)
        if (popup) line.bindPopup(popup)
        layers.push(line)
      }
    }

    // Polygon — try direct coordinates, then LinearRing
    let polyCoords: [number, number][] = []
    const directPoly = pm.querySelector('Polygon outerBoundaryIs coordinates')
    if (directPoly?.textContent) {
      polyCoords = parseKMLCoordinates(directPoly.textContent)
    }
    if (polyCoords.length <= 2) {
      const linearRing = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates')
      if (linearRing?.textContent) {
        polyCoords = parseKMLCoordinates(linearRing.textContent)
      }
    }
    if (polyCoords.length > 2) {
      const poly = L.polygon(polyCoords, {
        color: '#006194',
        weight: 2,
        fillColor: '#006194',
        fillOpacity: 0.12,
      })
      const popup = buildPopup(name, desc)
      if (popup) poly.bindPopup(popup)
      layers.push(poly)
    }

    // Point
    const point = pm.querySelector('Point coordinates')
    if (point?.textContent) {
      const coords = parseKMLCoordinates(point.textContent)
      if (coords.length > 0) {
        const marker = L.circleMarker(coords[0], {
          radius: 7,
          color: '#006194',
          fillColor: '#ffffff',
          fillOpacity: 0.9,
          weight: 2.5,
        })
        const popup = buildPopup(name, desc)
        if (popup) marker.bindPopup(popup)
        layers.push(marker)
      }
    }
  })

  // GroundOverlays (outside Placemarks)
  const groundOverlays = doc.querySelectorAll('GroundOverlay')
  groundOverlays.forEach((overlay) => {
    const name = overlay.querySelector('name')?.textContent || ''
    const icon = overlay.querySelector('Icon href')?.textContent
    const box = overlay.querySelector('LatLonBox')
    if (box) {
      const north = parseFloat(box.querySelector('north')?.textContent || '0')
      const south = parseFloat(box.querySelector('south')?.textContent || '0')
      const east = parseFloat(box.querySelector('east')?.textContent || '0')
      const west = parseFloat(box.querySelector('west')?.textContent || '0')

      if (icon && north && south && east && west) {
        const isExternal = icon.startsWith('http://') || icon.startsWith('https://')
        if (isExternal && offline) return
        const imageOverlay = L.imageOverlay(icon, [[south, west], [north, east]], { opacity: 0.7 })
        const popup = buildPopup(name, '')
        if (popup) imageOverlay.bindPopup(popup)
        layers.push(imageOverlay)
      }
    }
  })

  return layers
}

function buildPopup(name: string, desc: string): string | null {
  if (!name && !desc) return null
  let html = '<div style="font-family:Poppins,sans-serif;padding:0">'
  if (name || desc) {
    html += '<div style="display:flex;align-items:center;gap:8;padding-bottom:8px;border-bottom:1px solid rgba(0,97,148,0.1);margin-bottom:8px">'
    html += '<div style="width:28px;height:28px;border-radius:10px;background:#006194;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px">K</div>'
    html += '<div>'
    if (name) html += `<div style="font-weight:700;font-size:13px;color:#1b2432">${name}</div>`
    if (desc) html += `<div style="color:#64748b;font-size:11px;line-height:1.4;margin-top:2px">${desc}</div>`
    html += '</div></div>'
  }
  html += '</div>'
  return html
}

interface KMLLayerProps {
  kmlContent: string | null
}

export function KMLLayer({ kmlContent }: KMLLayerProps) {
  const map = useMap()
  const offline = useTilesStore((s) => s.offline)

  useEffect(() => {
    if (!kmlContent) return

    const layers = parseKML(kmlContent, offline)

    if (layers.length === 0) {
      console.warn('[KMLLayer] No features found in KML content')
      return
    }

    const layerGroup = L.layerGroup(layers).addTo(map)

    const group = L.featureGroup(layers)
    const bounds = group.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    return () => {
      layerGroup.remove()
    }
  }, [kmlContent, map, offline])

  return null
}
