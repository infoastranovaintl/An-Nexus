import { create } from 'zustand'

export type CctvFps = 5 | 12 | 30
export const FPS_OPTIONS: CctvFps[] = [5, 12, 30]
export const DEFAULT_FPS: CctvFps = 12

export interface Camera {
  id: string
  name: string
  ip: string
  mdns?: string
  token: string
}

export interface CctvLog {
  id: number
  t: string
  msg: string
  kind?: 'err' | 'ok'
}

const STORAGE_KEY = 'an_cctv_cameras_v1'
const FPS_KEY = 'an_cctv_fps_v1'
export const MAX_CAMERAS = 12

function loadCameras(): Camera[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Camera[]
  } catch {
    return []
  }
}
function loadFps(): CctvFps {
  try {
    const v = Number(localStorage.getItem(FPS_KEY))
    if (v === 5 || v === 12 || v === 30) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_FPS
}

let logSeq = 0

interface CctvState {
  cameras: Camera[]
  saveDirName: string | null
  tileOnline: Record<string, boolean>
  logs: CctvLog[]
  wizardOpen: boolean
  fpsTarget: CctvFps

  addCamera: (cam: Camera) => void
  removeCamera: (id: string) => void
  importCctv: (data: { cameras: Camera[]; saveDirName: string | null }) => void
  setSaveDirName: (name: string | null) => void
  setTileOnline: (id: string, online: boolean) => void
  setWizardOpen: (open: boolean) => void
  setFps: (f: CctvFps) => void
  cctvLog: (msg: string, kind?: 'err' | 'ok') => void
  clearCctvLog: () => void
}

export const useCctvStore = create<CctvState>((set) => ({
  cameras: loadCameras(),
  saveDirName: null,
  tileOnline: {},
  logs: [],
  wizardOpen: false,
  fpsTarget: loadFps(),

  addCamera: (cam) =>
    set((s) => {
      const cameras = s.cameras.filter((c) => c.id !== cam.id)
      cameras.push(cam)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras))
      return { cameras }
    }),

  removeCamera: (id) =>
    set((s) => {
      const cameras = s.cameras.filter((c) => c.id !== id)
      const tileOnline = { ...s.tileOnline }
      delete tileOnline[id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras))
      return { cameras, tileOnline }
    }),

  importCctv: (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.cameras))
    return { cameras: data.cameras, saveDirName: data.saveDirName }
  },
  setSaveDirName: (saveDirName) => set({ saveDirName }),
  setTileOnline: (id, online) =>
    set((s) => {
      if (s.tileOnline[id] === online) return {}
      return { tileOnline: { ...s.tileOnline, [id]: online } }
    }),
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setFps: (f) =>
    set(() => {
      try {
        localStorage.setItem(FPS_KEY, String(f))
      } catch {
        /* ignore */
      }
      return { fpsTarget: f }
    }),

  cctvLog: (msg, kind) =>
    set((s) => {
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const logs = [{ id: ++logSeq, t, msg, kind }, ...s.logs].slice(-80)
      return { logs }
    }),
  clearCctvLog: () => set({ logs: [] }),
}))
