import type { Camera, CctvFps } from '../../store/cctv'
import { DEFAULT_FPS } from '../../store/cctv'
export { DEFAULT_FPS }

/* MJPEG streaming is the primary video path; /capture polling is the fallback. */
export const VIDEO_FRAME_TIMEOUT_MS = 5000
export const VIDEO_MIN_INTERVAL_MS = 33 // allow 30fps for super smooth
export const VIDEO_FAILS_BEFORE_OFFLINE = 3
export const REC_FPS = 10

/* Stream path */
export const STREAM_FRAME_TIMEOUT_MS = 3000
export const STREAM_BOUNDARY = '--frame'

/* Forced max quality (esp32cam / CameraWebServer /control endpoint) */
export const MAX_FRAMESIZE = 13 // UXGA 1600×1200 (OV2640 ceiling)
export const MAX_QUALITY = 10
export const MAX_FB_COUNT = 2 // double-buffer so the stream can keep up

export const STATUS_POLL_MS = 10000

/* ── anti-lag adaptive tuning (XIAO ESP32S3 + WiFi) ──────────────── */
/**
 * WiFi airtime is the bottleneck: UXGA @5fps ≈3.6 Mbps/cam → 12× = 43 Mbps
 * > 2.4GHz usable ≈18-30 Mbps → contention/freezes. The user picks a target
 * FPS (5 / 12 / 30); we cap it to what the fleet's link can carry and pick the
 * smallest framesize + JPEG quality that hits that FPS within the WiFi budget.
 */
// FPS ceiling the 2.4GHz link can sustain for N cameras (aggregate ~18-30 Mbps)
function fpsCeiling(camCount: number): number {
  if (camCount <= 2) return 30
  if (camCount <= 4) return 24
  if (camCount <= 8) return 20
  return 15
}

export function adaptiveFpsCap(camCount: number, fpsTarget: CctvFps = DEFAULT_FPS): number {
  return Math.min(fpsTarget, fpsCeiling(camCount))
}

// resolution chosen so fps*frameBytes stays under the WiFi budget
function fpsFramesize(fpsTarget: CctvFps, camCount: number): number {
  if (fpsTarget >= 30) return 7 // HVGA 480×320 — super fluid, always smallest for headroom
  if (fpsTarget >= 12) {
    if (camCount <= 2) return 10 // XGA
    if (camCount <= 4) return 9 // SVGA
    return 8 // VGA
  }
  // 5fps or fewer — max quality, only shrink as the fleet grows
  if (camCount <= 2) return 13 // UXGA
  if (camCount <= 4) return 11 // SXGA
  if (camCount <= 6) return 10 // XGA
  if (camCount <= 9) return 9 // SVGA
  return 8 // VGA
}

// ESP32 quality scale 10(best)-63(worst), lower=better. Pillow mapping in mock: 92→60
function fpsQuality(fpsTarget: CctvFps, camCount: number): number {
  if (fpsTarget >= 30) {
    if (camCount <= 4) return 24
    if (camCount <= 8) return 28
    return 32
  }
  if (fpsTarget >= 12) {
    if (camCount <= 4) return 14
    if (camCount <= 8) return 18
    return 22
  }
  if (camCount <= 4) return 10
  if (camCount <= 8) return 12
  return 14
}

export function adaptiveFramesize(camCount: number, fpsTarget: CctvFps = DEFAULT_FPS): number {
  return fpsFramesize(fpsTarget, camCount)
}
export function adaptiveQuality(camCount: number, fpsTarget: CctvFps = DEFAULT_FPS): number {
  return fpsQuality(fpsTarget, camCount)
}
export function fpsToMinInterval(fpsCap: number): number {
  return Math.max(VIDEO_MIN_INTERVAL_MS, Math.floor(1000 / fpsCap))
}
/** Stagger concurrent fetches so 12 cameras don't thundering-herd on connect/poll. */
export function staggerMs(index: number): number {
  return (index % 6) * 220
}
export function statusPollMsWithJitter(): number {
  return STATUS_POLL_MS + Math.floor(Math.random() * 2500)
}

export function camPorts(cam: Camera): { http: number; stream: number; audio: number } {
  const i = cam.ip.lastIndexOf(':')
  if (i >= 0) {
    const base = Number(cam.ip.slice(i + 1))
    return { http: base, stream: base + 1, audio: base + 2 }
  }
  return { http: 80, stream: 81, audio: 82 }
}

export function streamUrl(cam: Camera): string {
  const p = camPorts(cam)
  const host = cam.ip.includes(':') ? cam.ip.slice(0, cam.ip.lastIndexOf(':')) : cam.ip
  return `http://${host}:${p.stream}/stream?t=${cam.token}`
}
export function apiUrl(cam: Camera, path: string): string {
  const p = camPorts(cam)
  const host = cam.ip.includes(':') ? cam.ip.slice(0, cam.ip.lastIndexOf(':')) : cam.ip
  return `http://${host}:${p.http}${path}?t=${cam.token}`
}
export function wsAudioUrl(cam: Camera): string {
  const p = camPorts(cam)
  const host = cam.ip.includes(':') ? cam.ip.slice(0, cam.ip.lastIndexOf(':')) : cam.ip
  return `ws://${host}:${p.audio}/audio?t=${cam.token}`
}
export function controlUrl(cam: Camera, varName: string, val: number | string): string {
  return `http://${cam.ip}/control?var=${encodeURIComponent(varName)}&val=${val}&t=${cam.token}`
}

export function timestampSlug(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/* ── save folder (File System Access API) ─────────────────────────── */

const FS_SUPPORTED = typeof window !== 'undefined' && 'showDirectoryPicker' in window
let saveDirHandle: FileSystemDirectoryHandle | null = null

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open('an_cctv_fs', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('handles')
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function idbGet(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await idbOpen()
  return new Promise((res, rej) => {
    const tx = db.transaction('handles', 'readonly')
    const r = tx.objectStore('handles').get(key)
    r.onsuccess = () => res((r.result as FileSystemDirectoryHandle) || null)
    r.onerror = () => rej(r.error)
  })
}

async function idbSet(key: string, val: FileSystemDirectoryHandle): Promise<void> {
  const db = await idbOpen()
  return new Promise((res, rej) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(val, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

async function verifyDirPermission(handle: FileSystemDirectoryHandle, requestIfNeeded: boolean): Promise<boolean> {
  const opts = { mode: 'readwrite' as FileSystemPermissionMode }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  if (!requestIfNeeded) return false
  return (await handle.requestPermission(opts)) === 'granted'
}

export function isFsSupported(): boolean {
  return FS_SUPPORTED
}

export function getSaveDirName(): string | null {
  return saveDirHandle?.name || null
}

export async function chooseSaveFolder(): Promise<boolean> {
  if (!FS_SUPPORTED) return false
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    saveDirHandle = handle
    await idbSet('saveDir', handle)
    return true
  } catch {
    return false
  }
}

export async function restoreSaveFolder(): Promise<void> {
  if (!FS_SUPPORTED) return
  try {
    const handle = await idbGet('saveDir')
    if (handle && (await verifyDirPermission(handle, false))) saveDirHandle = handle
  } catch {
    /* ignore */
  }
}

export async function saveBlobToDisk(filename: string, blob: Blob): Promise<boolean> {
  if (saveDirHandle) {
    try {
      if (!(await verifyDirPermission(saveDirHandle, true))) throw new Error('permission denied')
      const fileHandle = await saveDirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch {
      /* fall through to download */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return false
}
