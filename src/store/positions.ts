import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Pos = { x: number; y: number }
export type Positions = Record<string, Pos>

interface PositionsState {
  positions: Positions
  setPos: (mac: string, pos: Pos) => void
  setMany: (pos: Positions) => void
  clear: () => void
}

export const usePositionsStore = create<PositionsState>()(
  persist(
    (set) => ({
      positions: {},
      setPos: (mac, pos) => set((s) => ({ positions: { ...s.positions, [mac]: pos } })),
      setMany: (positions) => set({ positions: { ...positions } }),
      clear: () => set({ positions: {} }),
    }),
    {
      name: 'an-nexus-positions-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
