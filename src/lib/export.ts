import { useNexusStore } from '../store/nexus'
import { usePositionsStore } from '../store/positions'
import { useCctvStore, type Camera } from '../store/cctv'
import { csvRows } from './history'
import type { SensorKind, SensorSample } from './nexus/sensors'

export interface AppBundle {
  app: 'an-nexus-command'
  exportedAt: string
  mesh: {
    nodes: ReturnType<typeof useNexusStore.getState>['nodes']
    wires: ReturnType<typeof useNexusStore.getState>['wires']
    waterLevels: ReturnType<typeof useNexusStore.getState>['waterLevels']
    waterHistory: ReturnType<typeof useNexusStore.getState>['waterHistory']
    conversations: ReturnType<typeof useNexusStore.getState>['conversations']
    convMeta: ReturnType<typeof useNexusStore.getState>['convMeta']
    logs: ReturnType<typeof useNexusStore.getState>['logs']
    rawLogs: ReturnType<typeof useNexusStore.getState>['rawLogs']
  }
  positions: ReturnType<typeof usePositionsStore.getState>['positions']
  cctv: { cameras: Camera[]; saveDirName: string | null }
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function collectBundle(): AppBundle {
  const mesh = useNexusStore.getState()
  const cctv = useCctvStore.getState()
  return {
    app: 'an-nexus-command',
    exportedAt: new Date().toISOString(),
    mesh: {
      nodes: mesh.nodes,
      wires: mesh.wires,
      waterLevels: mesh.waterLevels,
      waterHistory: mesh.waterHistory,
      conversations: mesh.conversations,
      convMeta: mesh.convMeta,
      logs: mesh.logs,
      rawLogs: mesh.rawLogs,
    },
    positions: usePositionsStore.getState().positions,
    cctv: { cameras: cctv.cameras, saveDirName: cctv.saveDirName },
  }
}

/** Full backup — mesh state, positions and cameras as one JSON file. */
export function exportAll() {
  downloadJson(collectBundle(), `an-nexus-backup-${stamp()}.json`)
}

/** Human-readable text export of every log stream. */
export function exportLogsTxt() {
  const mesh = useNexusStore.getState()
  const cctv = useCctvStore.getState()
  const lines: string[] = ['AN-NEXUS LOG EXPORT', `Exported ${new Date().toLocaleString()}`, '']
  lines.push('=== LIVE FEED ===')
  mesh.logs.forEach((l) => lines.push(`[${l.ts}] [${l.src}] ${l.msg}`))
  lines.push('', '=== RAW BLE ===')
  mesh.rawLogs.forEach((r) => lines.push(r))
  lines.push('', '=== CCTV LOG ===')
  cctv.logs.forEach((l) => lines.push(`[${l.t}] ${l.msg}`))
  downloadText(lines.join('\n'), `an-nexus-logs-${stamp()}.txt`)
}

/** Flatten the current in-memory history (sensors + water) into a CSV file. */
export function exportLiveCsv() {
  const { sensorHistory, waterHistory } = useNexusStore.getState()
  const rows: { mac: string; kind: string; ts: number; v: number; unit: string }[] = []
  for (const [mac, byKey] of Object.entries(sensorHistory)) {
    for (const [kind, pts] of Object.entries(byKey)) {
      for (const p of pts) rows.push({ mac, kind, ts: p.ts, v: p.v, unit: p.unit })
    }
  }
  for (const [mac, pts] of Object.entries(waterHistory)) {
    for (const p of pts) rows.push({ mac, kind: 'water', ts: p.ts, v: p.v, unit: p.unit })
  }
  rows.sort((a, b) => a.ts - b.ts)
  downloadText(csvRows(rows), `an-nexus-live-history-${stamp()}.csv`)
}

/** Restore a previously exported JSON backup. Returns false when invalid. */
export async function importBundle(file: File): Promise<boolean> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return false
  }
  const b = data as Partial<AppBundle>
  if (!b || typeof b !== 'object' || !b.mesh || typeof b.mesh !== 'object' || !b.mesh.nodes) return false
  useNexusStore.getState().importMesh(b.mesh)
  if (b.positions && typeof b.positions === 'object') usePositionsStore.getState().setMany(b.positions)
  if (b.cctv && Array.isArray(b.cctv.cameras)) {
    useCctvStore.getState().importCctv({
      cameras: b.cctv.cameras,
      saveDirName: b.cctv.saveDirName ?? null,
    })
  }
  return true
}

/** Export a single sensor kind as CSV + JSON. */
export function exportSensorData(kind: SensorKind) {
  const { sensorHistory, sensorReadings } = useNexusStore.getState()
  const rows: { mac: string; kind: string; ts: number; v: number; unit: string }[] = []
  let meta: SensorSample | null = null
  for (const [, samples] of Object.entries(sensorReadings)) {
    for (const s of samples) {
      if (s.kind === kind && (!meta || s.ts > meta.ts)) meta = s
    }
  }
  for (const [mac, byKey] of Object.entries(sensorHistory)) {
    for (const [key, pts] of Object.entries(byKey)) {
      const match = sensorReadings[mac]?.find((s) => s.key === key && s.kind === kind)
      if (match) {
        for (const p of pts) rows.push({ mac, kind, ts: p.ts, v: p.v, unit: p.unit })
      }
    }
  }
  rows.sort((a, b) => a.ts - b.ts)
  const ts = stamp()
  if (rows.length > 0) downloadText(csvRows(rows), `an-nexus-${kind}-${ts}.csv`)
  if (meta) {
    const jsonExport = {
      sensor: kind,
      exportedAt: new Date().toISOString(),
      currentValue: meta.value,
      unit: meta.unit,
      lastUpdate: meta.ts,
      dataPoints: rows.length,
      readings: rows,
    }
    downloadJson(jsonExport, `an-nexus-${kind}-${ts}.json`)
  }
}

export const STORAGE_KEYS = [
  'an-nexus-mesh-v1',
  'an-nexus-positions-v1',
  'an_cctv_cameras_v1',
  'an_cctv_fps_v1',
  'an-nexus-theme',
  'an-nexus-tiles-offline',
  'an-nexus-ble-device',
  'an-nexus-map-v1',
  'an-nexus-device-id',
] as const

/** Current size of each persisted store key (characters), for the Settings panel. */
export function storageInfo(): { key: string; bytes: number }[] {
  if (typeof localStorage === 'undefined') return STORAGE_KEYS.map((key) => ({ key, bytes: 0 }))
  return STORAGE_KEYS.map((key) => ({ key, bytes: (localStorage.getItem(key) || '').length }))
}
