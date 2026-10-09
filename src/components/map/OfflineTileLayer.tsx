import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { tileTemplate, useTilesStore, getOfflineTileUrl } from '../../lib/map/tiles'

const IndexedDBTileLayer = L.TileLayer.extend({
  createTile(coords: L.Coords, done: (error: any, tile: HTMLImageElement) => void) {
    const tile = document.createElement('img')
    tile.alt = ''
    tile.setAttribute('role', 'presentation')
    
    L.DomEvent.on(tile, 'load', L.Util.bind((this as any)._tileOnLoad, this, done, tile))
    L.DomEvent.on(tile, 'error', L.Util.bind((this as any)._tileOnError, this, done, tile))

    if (this.options.offline) {
      getOfflineTileUrl(this.options.provider, coords.z, coords.x, coords.y).then((url) => {
        tile.src = url
        // Store URL on the tile for cleanup later
        ;(tile as any)._objectUrl = url
      }).catch((_err) => {
        tile.src = ''
      })
    } else {
      tile.src = this.getTileUrl(coords)
    }
    
    return tile
  },
  _removeTile(key: string) {
    const tile = (this as any)._tiles[key]
    if (tile && tile.el && tile.el._objectUrl) {
      if (tile.el._objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tile.el._objectUrl)
      }
    }
    ;(L.TileLayer.prototype as any)._removeTile.call(this, key)
  }
})

export function OfflineTileLayer({ provider }: { provider: string }) {
  const map = useMap()
  const offline = useTilesStore((s) => s.offline)
  const layerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    const template = tileTemplate(provider as any, offline)
    
    const layer = new (IndexedDBTileLayer as any)(template, {
      provider,
      offline,
      maxZoom: 18,
      minZoom: 1,
      attribution: '&copy; OpenStreetMap contributors',
      maxNativeZoom: 19,
      crossOrigin: true,
      tileSize: 256,
    } as any)

    layer.addTo(map)
    layerRef.current = layer

    return () => {
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [map, offline, provider])

  return null
}
