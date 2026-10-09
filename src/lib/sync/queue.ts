/**
 * IndexedDB outbox — stores pending sync payloads until they can be delivered.
 * Survives app restarts. Each entry is a full snapshot of the app state.
 */

export interface SyncEntry {
  id: number
  timestamp: string
  data: Record<string, unknown>
  retries: number
}

const DB_NAME = 'an-nexus-sync-v1'
const STORE = 'outbox'
const KEY_PATH = 'id'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: KEY_PATH })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let nextId = Date.now()

export async function enqueue(data: Record<string, unknown>): Promise<number> {
  const db = await openDb()
  const id = nextId++
  const entry: SyncEntry = {
    id,
    timestamp: new Date().toISOString(),
    data,
    retries: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return id
}

export async function dequeue(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function peekAll(): Promise<SyncEntry[]> {
  const db = await openDb()
  return new Promise<SyncEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    const results: SyncEntry[] = []
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        results.push(cursor.value as SyncEntry)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function count(): Promise<number> {
  const db = await openDb()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function clearAll(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
