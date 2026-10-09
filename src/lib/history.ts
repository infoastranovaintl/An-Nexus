/**
 * Telemetry archive — full-resolution IndexedDB store.
 *
 * Every telemetry point that flows through the mesh store is appended here so
 * recorded data survives reloads at full resolution (the in-memory ring used by
 * the charts is downsampled to 40 points per series on persist).
 *
 * Retention is unlimited; the archive is cleared manually from Settings.
 */

export interface ArchiveRow {
  mac: string
  kind: string
  ts: number
  v: number
  unit: string
}

const DB_NAME = 'an-nexus-archive-v1'
const STORE = 'points'
const KEY = 'byMacKind'

export function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIdbAvailable()) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ['mac', 'kind', 'ts'] })
        store.createIndex(KEY, ['mac', 'kind'])
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/* ---- buffered append --------------------------------------------------- */

let buffer: ArchiveRow[] = []
let timer: number | undefined
let flushing = false

function flush() {
  if (buffer.length === 0 || flushing) return
  const rows = buffer
  buffer = []
  flushing = true
  openDb()
    .then((db) => {
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        for (const r of rows) store.put(r)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    })
    .catch(() => {
      /* push unflushed rows back so nothing is silently dropped */
      buffer = [...rows, ...buffer]
    })
    .finally(() => {
      flushing = false
    })
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
}

/** Queue rows for the archive. Writes are batched and coalesced every ~1s. */
export function appendPoints(rows: ArchiveRow[]) {
  if (!isIdbAvailable() || rows.length === 0) return
  buffer.push(...rows)
  if (timer !== undefined) return
  timer = window.setTimeout(() => {
    timer = undefined
    flush()
  }, 1000)
}

/* ---- queries ----------------------------------------------------------- */

export interface ArchiveInfo {
  points: number
  usageBytes: number
  quotaBytes: number | null
}

/** Count of archived points + approximate origin storage usage. */
export async function archiveInfo(): Promise<ArchiveInfo> {
  if (!isIdbAvailable()) return { points: 0, usageBytes: 0, quotaBytes: null }
  try {
    const db = await openDb()
    const points = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    let usageBytes = 0
    let quotaBytes: number | null = null
    if (navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate()
        usageBytes = est.usage ?? 0
        quotaBytes = est.quota ?? null
      } catch {
        /* keep defaults */
      }
    }
    return { points, usageBytes, quotaBytes }
  } catch {
    return { points: 0, usageBytes: 0, quotaBytes: null }
  }
}

/** Wipe the archive entirely. */
export async function clearArchive(): Promise<void> {
  if (!isIdbAvailable()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export interface ArchiveQuery {
  mac?: string
  kind?: string
  from?: number
  to?: number
  maxPoints?: number
}

/**
 * Read archived points, optionally filtered by mac/kind/time window and
 * downsampled to at most `maxPoints` (keeps the tail). Used by future
 * time-range history views.
 */
export async function queryRange(q: ArchiveQuery): Promise<ArchiveRow[]> {
  if (!isIdbAvailable()) return []
  const db = await openDb()
  const rows = await new Promise<ArchiveRow[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const index = tx.objectStore(STORE).index(KEY)
    let req: IDBRequest<IDBCursorWithValue | null>
    if (q.mac) {
      const lower: (string | number)[] = [q.mac, q.kind ?? '', q.from ?? 0]
      const upper: (string | number)[] = [q.mac, q.kind ?? '\uffff', q.to ?? Infinity]
      req = index.openCursor(IDBKeyRange.bound(lower, upper, true, true))
    } else {
      req = index.openCursor()
    }
    const out: ArchiveRow[] = []
    req.onsuccess = () => {
      const c = req.result
      if (c) {
        const r = c.value as ArchiveRow
        if ((q.from === undefined || r.ts >= q.from) && (q.to === undefined || r.ts <= q.to)) out.push(r)
        c.continue()
      } else {
        resolve(out)
      }
    }
    req.onerror = () => reject(req.error)
  })
  if (q.maxPoints && rows.length > q.maxPoints) {
    const step = Math.ceil(rows.length / q.maxPoints)
    return rows.filter((_, i) => i % step === 0).slice(-q.maxPoints)
  }
  return rows
}

/* ---- CSV --------------------------------------------------------------- */

const CSV_HEADER = 'mac,kind,ts,value,unit\n'

function csvCell(s: string | number): string {
  const str = String(s)
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

function csvLine(r: ArchiveRow): string {
  return [r.mac, r.kind, r.ts, r.v, r.unit].map(csvCell).join(',') + '\n'
}

/** One CSV file's worth of rows (header + lines). */
export function csvRows(rows: ArchiveRow[]): string {
  if (rows.length === 0) return CSV_HEADER
  let out = CSV_HEADER
  for (const r of rows) out += csvLine(r)
  return out
}

/**
 * Split rows into multiple CSV chunks of at most `maxRows` each (Excel's row
 * limit is ~1M, so chunks are kept well below it).
 */
export function buildCsvChunks(rows: ArchiveRow[], maxRows = 100_000): string[] {
  const chunks: string[] = []
  for (let i = 0; i < rows.length; i += maxRows) {
    chunks.push(csvRows(rows.slice(i, i + maxRows)))
  }
  return chunks.length > 0 ? chunks : [CSV_HEADER]
}

/**
 * Stream the whole archive into CSV file(s). Files are downloaded one after
 * another, so the browser only needs one chunk in memory at a time.
 */
export async function exportArchiveCsv() {
  if (!isIdbAvailable()) return
  const db = await openDb()
  const chunks: string[] = []
  let cur: ArchiveRow[] = []
  const MAX = 100_000
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const c = req.result
      if (c) {
        cur.push(c.value as ArchiveRow)
        if (cur.length >= MAX) {
          chunks.push(csvRows(cur))
          cur = []
        }
        c.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
  if (cur.length > 0) chunks.push(csvRows(cur))
  if (chunks.length === 0) chunks.push(CSV_HEADER)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (let i = 0; i < chunks.length; i++) {
    const suffix = chunks.length > 1 ? `-${i + 1}of${chunks.length}` : ''
    const blob = new Blob([chunks[i]], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `an-nexus-telemetry-${stamp}${suffix}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}
