/**
 * Sync service — orchestrates offline-first data sync.
 *
 * - Subscribes to Zustand store changes
 * - Queues dirty data to IndexedDB outbox
 * - Drains queue when online via HTTP transport
 * - Provides sync status to the UI
 */

import { useNexusStore } from '../../store/nexus'
import { usePositionsStore } from '../../store/positions'
import { useCctvStore } from '../../store/cctv'
import { useSyncStore } from '../../store/sync'
import { enqueue, peekAll, dequeue, count } from './queue'
import { sendSync, getDeviceId, type SyncPayload } from './transport'

const SYNC_INTERVAL_MS = 30_000
const DEBOUNCE_MS = 2_000

let syncTimer: ReturnType<typeof setInterval> | undefined
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let isSyncing = false

function collectState(): Record<string, unknown> {
  const mesh = useNexusStore.getState()
  const positions = usePositionsStore.getState()
  const cctv = useCctvStore.getState()
  return {
    nodes: mesh.nodes,
    wires: mesh.wires,
    waterLevels: mesh.waterLevels,
    waterHistory: mesh.waterHistory,
    sensorHistory: mesh.sensorHistory,
    conversations: mesh.conversations,
    convMeta: mesh.convMeta,
    positions: positions.positions,
    cameras: cctv.cameras,
  }
}

function markDirty() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void doEnqueue()
  }, DEBOUNCE_MS)
}

async function doEnqueue() {
  const data = collectState()
  await enqueue(data)
  const pending = await count()
  useSyncStore.getState().setPendingCount(pending)
}

async function drainQueue() {
  if (isSyncing) return
  const serverUrl = useSyncStore.getState().serverUrl
  if (!serverUrl) return
  if (!navigator.onLine) return

  isSyncing = true
  useSyncStore.getState().setSyncStatus('syncing')

  try {
    const entries = await peekAll()
    if (entries.length === 0) {
      useSyncStore.getState().setSyncStatus('idle')
      isSyncing = false
      return
    }

    const entry = entries[0]
    const payload: SyncPayload = {
      deviceId: getDeviceId(),
      timestamp: entry.timestamp,
      data: entry.data,
    }

    const result = await sendSync(serverUrl, payload, entry.retries)

    if (result.ok) {
      await dequeue(entry.id)
      const remaining = entries.length - 1
      useSyncStore.getState().setPendingCount(remaining)
      useSyncStore.getState().setLastSyncTime(Date.now())
      useSyncStore.getState().setSyncStatus('idle')

      if (remaining > 0) {
        setTimeout(drainQueue, 500)
      }
    } else {
      useSyncStore.getState().setSyncStatus('error')
      useSyncStore.getState().setLastSyncError(result.message)
    }
  } catch {
    useSyncStore.getState().setSyncStatus('error')
  } finally {
    isSyncing = false
  }
}

function handleOnline() {
  useSyncStore.getState().setIsOnline(true)
  void drainQueue()
}

function handleOffline() {
  useSyncStore.getState().setIsOnline(false)
  useSyncStore.getState().setSyncStatus('idle')
}

export function initSync() {
  if (typeof window === 'undefined') return

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  useSyncStore.getState().setIsOnline(navigator.onLine)

  useNexusStore.subscribe(markDirty)
  usePositionsStore.subscribe(markDirty)
  useCctvStore.subscribe(markDirty)

  syncTimer = setInterval(() => {
    if (navigator.onLine && useSyncStore.getState().serverUrl) {
      void drainQueue()
    }
  }, SYNC_INTERVAL_MS)

  count().then((c) => useSyncStore.getState().setPendingCount(c))
}

export function destroySync() {
  if (syncTimer) clearInterval(syncTimer)
  if (debounceTimer) clearTimeout(debounceTimer)
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
}

export async function forceSyncNow(): Promise<boolean> {
  const serverUrl = useSyncStore.getState().serverUrl
  if (!serverUrl) return false
  if (!navigator.onLine) return false

  await doEnqueue()
  await drainQueue()
  return useSyncStore.getState().syncStatus !== 'error'
}
