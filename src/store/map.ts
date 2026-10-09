import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface LatLng {
  lat: number
  lng: number
}

export type NodeCoords = Record<string, LatLng>

interface MapState {
  /* base station coordinates */
  base: LatLng | null
  /* per-node coordinates keyed by MAC */
  nodes: NodeCoords
  /* last user-entered map center (set via search / click) */
  center: LatLng | null

  setBase: (coord: LatLng | null) => void
  setNode: (mac: string, coord: LatLng | null) => void
  setCenter: (coord: LatLng | null) => void
  clear: () => void
}

const STORAGE_KEY = 'an-nexus-map-v1'

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      base: null,
      nodes: {},
      center: null,

      setBase: (coord) => set({ base: coord }),
      setNode: (mac, coord) =>
        set((s) => {
          const nodes = { ...s.nodes }
          if (coord) nodes[mac] = coord
          else delete nodes[mac]
          return { nodes }
        }),
      setCenter: (coord) => set({ center: coord }),
      clear: () => set({ base: null, nodes: {}, center: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

/** Parse a "lat, lng" (or "lat lng") string into a valid LatLng, or null. */
export function parseCoords(input: string): LatLng | null {
  const parts = input
    .trim()
    .split(/[\s,]+/)
    .map((p) => parseFloat(p))
  if (parts.length !== 2) return null
  const [lat, lng] = parts
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
