import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { getTile, getAllTileKeys, clearAllTiles, saveTile } from './tileStorage'

/**
 * Tile URL resolution with IndexedDB offline support.
 *
 * Online: fetches from remote CDNs (OSM, Esri).
 * Offline: loads from IndexedDB cache, falls back to online if tile not cached.
 */

export type TileProvider = 'osm' | 'satellite' | 'osmtopo' | 'terrain-dem'

// List of all supported providers for UI selection
export const PROVIDERS: TileProvider[] = ['osm', 'satellite', 'osmtopo', 'terrain-dem']

// Maximum number of tiles allowed per ZIP export to prevent memory overload
export const MAX_EXPORT_TILES = 50000

const STORAGE_KEY = 'an-nexus-tiles-offline'

/** No online templates – the app is offline‑only. */
export const REMOTE_TEMPLATES: Record<TileProvider, string> = {}

interface TilesState {
  offline: boolean
  setOffline: (v: boolean) => void
}

export const useTilesStore = create<TilesState>()(
  persist(
    (set) => ({
      // Offline‑only mode – always true
      offline: true,
      // setOffline becomes a no‑op to keep the API stable
      setOffline: (_) => set({ offline: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export async function exportTilesZip(selectedProviders: TileProvider[] = PROVIDERS): Promise<void> {
  const zip = new JSZip()
  let exportedCount = 0
  // Get all tile keys for selected providers
  const allKeys = await getAllTileKeys(selectedProviders)
  for (const { provider, z, x, y } of allKeys) {
    // Guard against exceeding max tiles
    if (exportedCount >= MAX_EXPORT_TILES) {
      zip.file('EXPORT_WARNING.txt', `Export limit of ${MAX_EXPORT_TILES} tiles reached. Only a subset of tiles was exported.`)
      break
    }
    const blob = await getTile(provider, z, x, y)
    if (!blob) continue // skip missing
    const folder = zip.folder(`tiles/${provider}/${z}/${x}`)
    if (folder) {
      folder.file(`${y}.png`, blob)
    }
    exportedCount++
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'offline-tiles.zip')
}

// Import a ZIP file of tiles and store them into IndexedDB
export async function importTilesZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file)
  const entries = Object.keys(zip.files)
  // Filter tile entries (exclude directories and warning files)
  const tileEntries = entries.filter(e => e.endsWith('.png') && !e.includes('EXPORT_WARNING'))
  if (tileEntries.length > MAX_EXPORT_TILES) {
    throw new Error(`Import limit exceeded: ${tileEntries.length} tiles (max ${MAX_EXPORT_TILES})`)
  }
  // Clear existing tiles before import to avoid duplicates
  await clearAllTiles()
  for (const entryName of tileEntries) {
    const match = entryName.match(/^tiles\/(\w+)\/(\d+)\/(\d+)\/(\d+)\.png$/)
    if (!match) continue
    const [, provider, zStr, xStr, yStr] = match
    const z = parseInt(zStr, 10)
    const x = parseInt(xStr, 10)
    const y = parseInt(yStr, 10)
    const blob = await zip.file(entryName)!.async('blob')
    await saveTile(provider, z, x, y, blob)
  }
  // Notify map layers to refresh
  const event = new Event('offline-tiles-updated')
  window.dispatchEvent(event)
}


export const isTilesOffline = () => useTilesStore.getState().offline
export const setTilesOffline = (v: boolean) => useTilesStore.getState().setOffline(v)

/**
 * Generate a tile URL. In online mode, returns the remote URL directly.
 * In offline mode, returns a path under /tiles/ for static file serving.
 */
export function tileTemplate(provider: TileProvider, offline: boolean = true): string {
  // Offline‑only – always serve from local /tiles folder
  return `/tiles/${provider}/{z}/{x}/{y}.png`
}

/** Per-coordinate DEM tile URL for leaflet-relief (offline-aware, reactive). */
export function demTileUrl(z: number, x: number, y: number): string {
  if (useTilesStore.getState().offline) return `/tiles/terrain-dem/${z}/${x}/${y}.png`
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
}

/**
 * Create a 1x1 transparent PNG blob URL as fallback for missing offline tiles.
 */
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
export const FALLBACK_TILE = TRANSPARENT_PIXEL

/**
 * Generate a blob URL for an offline tile from IndexedDB.
 * Returns a transparent pixel if the tile is not cached.
 */
export async function getOfflineTileUrl(provider: string, z: number, x: number, y: number): Promise<string> {
  try {
    const blob = await getTile(provider, z, x, y)
    if (blob) return URL.createObjectURL(blob)
  } catch {
    // ignore errors – fall back to placeholder
  }
  // Return a custom offline placeholder (gray dashed tile)
  return '/assets/offline-placeholder.png'
}
