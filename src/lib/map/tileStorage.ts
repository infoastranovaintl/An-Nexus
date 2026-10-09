
import type { TileProvider } from './tiles'

/**
 * IndexedDB-backed offline tile storage.
 *
 * Tiles are stored as Blobs keyed by `${provider}/${z}/${x}/${y}`.
 * The map creates an object URL from the blob when rendering offline.
 */

const DB_NAME = 'hydropower-tiles'
const DB_VERSION = 1
const STORE_NAME = 'tiles'
const METADATA_STORE = 'metadata'

export interface TileRegion {
  id: string
  label: string
  provider: 'osm' | 'satellite'
  centerLat: number
  centerLng: number
  zoomMin: number
  zoomMax: number
  tileCount: number
  downloadedAt: number
  bounds: { north: number; south: number; east: number; west: number }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveTile(provider: string, z: number, x: number, y: number, blob: Blob): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, `${provider}/${z}/${x}/${y}`)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getTile(provider: string, z: number, x: number, y: number): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(`${provider}/${z}/${x}/${y}`)
    req.onsuccess = () => { db.close(); resolve(req.result || null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function tileExists(provider: string, z: number, x: number, y: number): Promise<boolean> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).count(`${provider}/${z}/${x}/${y}`)
    req.onsuccess = () => { db.close(); resolve(req.result > 0) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function getTileCount(provider: string): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const range = IDBKeyRange.bound(`${provider}/`, `${provider}/\uffff`)
    const req = store.count(range)
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// Retrieve all tile keys for given providers (or all) for export/import purposes
export async function getAllTileKeys(providers?: TileProvider[]): Promise<Array<{ provider: TileProvider; z: number; x: number; y: number }>> {
  const db = await openDB()
  const result: Array<{ provider: TileProvider; z: number; x: number; y: number }> = []
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.openCursor()
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        const key = cursor.key as string
        const parts = key.split('/')
        if (parts.length === 4) {
          const [provider, zStr, xStr, yStr] = parts as [TileProvider, string, string, string]
          if (!providers || providers.includes(provider)) {
            result.push({
              provider,
              z: parseInt(zStr, 10),
              x: parseInt(xStr, 10),
              y: parseInt(yStr, 10),
            })
          }
        }
        cursor.continue()
      } else {
        db.close()
        resolve(result)
      }
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}


export async function deleteTilesForProvider(provider: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const range = IDBKeyRange.bound(`${provider}/`, `${provider}/\uffff`)
    store.delete(range)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function clearAllTiles(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// Metadata (saved regions)
export async function saveRegion(region: TileRegion): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, 'readwrite')
    tx.objectStore(METADATA_STORE).put(region)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getRegions(): Promise<TileRegion[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, 'readonly')
    const req = tx.objectStore(METADATA_STORE).getAll()
    req.onsuccess = () => { db.close(); resolve(req.result || []) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deleteRegion(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, 'readwrite')
    tx.objectStore(METADATA_STORE).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** Create a blob URL for a tile, or null if not cached. Returns a revoke function. */
export async function getTileUrl(provider: string, z: number, x: number, y: number): Promise<{ url: string; revoke: () => void } | null> {
  const blob = await getTile(provider, z, x, y)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}

/** Convert lat/lng to tile coordinates at a given zoom level. */
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n)
  return { x, y }
}

/** Convert tile coordinates back to lat/lng (NW corner of tile). */
export function tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const n = Math.pow(2, zoom)
  const lng = (x / n) * 360 - 180
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
  return { lat, lng }
}

/** Get total tile count for a bounding box at given zoom range. */
export function estimateTileCount(
  centerLat: number,
  _centerLng: number,
  radiusKm: number,
  zoomMin: number,
  zoomMax: number,
): number {
  let total = 0
  for (let z = zoomMin; z <= zoomMax; z++) {
    const tilesPerSide = Math.ceil((radiusKm * 2) / (156543.03392 * Math.cos((centerLat * Math.PI) / 180) / Math.pow(2, z)))
    total += tilesPerSide * tilesPerSide
  }
  return total
}
