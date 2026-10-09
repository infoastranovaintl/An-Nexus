import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SyncState {
  serverUrl: string
  isOnline: boolean
  lastSyncTime: number | null
  lastSyncError: string | null
  syncStatus: 'idle' | 'syncing' | 'error'
  pendingCount: number
  setServerUrl: (url: string) => void
  setIsOnline: (online: boolean) => void
  setLastSyncTime: (ts: number) => void
  setLastSyncError: (msg: string | null) => void
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => void
  setPendingCount: (count: number) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      serverUrl: '',
      isOnline: false,
      lastSyncTime: null,
      lastSyncError: null,
      syncStatus: 'idle',
      pendingCount: 0,
      setServerUrl: (serverUrl) => set({ serverUrl, lastSyncError: null }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setLastSyncTime: (lastSyncTime) => set({ lastSyncTime, lastSyncError: null }),
      setLastSyncError: (lastSyncError) => set({ lastSyncError }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setPendingCount: (pendingCount) => set({ pendingCount }),
    }),
    {
      name: 'an-nexus-sync-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        serverUrl: s.serverUrl,
      }),
    },
  ),
)
