import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface KMLFile {
  id: string
  name: string
  content: string
  size: number
  addedAt: number
}

interface KMLState {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const useKMLStore = create<KMLState>()(
  persist(
    (set) => ({
      selectedId: null,
      setSelectedId: (id) => set({ selectedId: id }),
    }),
    {
      name: 'hydropower-kml-selected',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
