import type { Camera, CctvFps } from '../../store/cctv'
import {
  adaptiveFpsCap,
  adaptiveFramesize,
  adaptiveQuality,
  apiUrl,
  controlUrl,
  DEFAULT_FPS,
  fpsToMinInterval,
  MAX_FB_COUNT,
  REC_FPS,
  saveBlobToDisk,
  statusPollMsWithJitter,
  staggerMs,
  STREAM_BOUNDARY,
  STREAM_FRAME_TIMEOUT_MS,
  streamUrl,
  timestampSlug,
  VIDEO_FAILS_BEFORE_OFFLINE,
  VIDEO_FRAME_TIMEOUT_MS,
  wsAudioUrl,
} from './core'
import { createMjpegParser } from './mjpeg'

export interface TileCallbacks {
  onOffline: (offline: boolean, text: string) => void
  onMeta: (meta: string) => void
  onLog: (msg: string, kind?: 'err' | 'ok') => void
  onRecState: (recording: boolean) => void
  onMicState: (active: boolean) => void
}

export interface TileState {
  img: HTMLImageElement | null
  canvas: HTMLCanvasElement | null
  pullRunning: boolean
  paused: boolean
  isVisible: boolean
  videoAbort: AbortController | null
  everConnected: boolean
  consecFails: number
  retryDelay: number
  offline: boolean
  statusPollTimer: number | null
  wantAudio: boolean
  ws: WebSocket | null
  audioCtx: AudioContext | null
  audioGain: GainNode | null
  audioRecDest: MediaStreamAudioDestinationNode | null
  audioRetryTimer: number | null
  audioConnectAttempts: number
  recording: boolean
  recCanvas: HTMLCanvasElement | null
  recCtx: CanvasRenderingContext2D | null
  recDrawTimer: number | null
  recorder: MediaRecorder | null
  recChunks: BlobPart[]
  recStartSlug: string
  videoMeta: string
  liveFps: number
  liveRes: string
  lastRssi: string
  lastUptime: string
  lastMetaEmit: number
  pendingRestart: boolean
  appliedFps: CctvFps | null
  appliedCamCount: number | null
  decodeBusy: boolean
  pendingFrame: Uint8Array<ArrayBuffer> | null
  lastPaint: number
  fpsCap: number
  minIntervalMs: number
  cb: TileCallbacks
}

export function makeTileState(cb: TileCallbacks): TileState {
  return {
    img: null,
    canvas: null,
    pullRunning: false,
    paused: false,
    isVisible: true,
    videoAbort: null,
    everConnected: false,
    consecFails: 0,
    retryDelay: 800,
    offline: true,
    statusPollTimer: null,
    wantAudio: false,
    ws: null,
    audioCtx: null,
    audioGain: null,
    audioRecDest: null,
    audioRetryTimer: null,
    audioConnectAttempts: 0,
    recording: false,
    recCanvas: null,
    recCtx: null,
    recDrawTimer: null,
    recorder: null,
    recChunks: [],
    recStartSlug: '',
    videoMeta: '',
    liveFps: 0,
    liveRes: '',
    lastRssi: '',
    lastUptime: '',
    lastMetaEmit: 0,
    pendingRestart: false,
    appliedFps: null,
    appliedCamCount: null,
    decodeBusy: false,
    pendingFrame: null,
    lastPaint: 0,
    fpsCap: 5,
    minIntervalMs: 200,
    cb,
  }
}

function emitMeta(state: TileState, force = false) {
  const now = performance.now()
  if (!force && now - state.lastMetaEmit < 180) return
  state.lastMetaEmit = now
  // dedupe tokens — prevents " -55dBm · 0m up · -55dBm · 0m up" if videoMeta already contained status
  const raw = [state.videoMeta, state.lastRssi, state.lastUptime].filter(Boolean).join(' · ')
  const tokens = raw
    .split('·')
    .map((t) => t.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const tok of tokens) {
    const k = tok.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      uniq.push(tok)
    }
  }
  state.cb.onMeta(uniq.join(' · '))
}
function updateVideoMeta(state: TileState, w: number | string, h: number | string, fps: number) {
  const f = Math.max(1, fps)
  state.liveFps = f
  state.liveRes = `${w}×${h}`
  state.videoMeta = `${w}×${h} · ${f}fps`
  emitMeta(state)
}

export function setTilePaused(state: TileState, paused: boolean) {
  state.paused = paused
  state.isVisible = !paused
  if (paused) state.videoAbort?.abort()
}
export function setTileVisible(state: TileState, visible: boolean) {
  state.isVisible = visible
  const shouldPause = !visible && !state.recording
  if (shouldPause !== state.paused) {
    state.paused = shouldPause
    if (shouldPause) state.videoAbort?.abort()
  }
}

function setTileOffline(_cam: Camera, state: TileState, isOffline: boolean, text?: string) {
  state.offline = isOffline
  state.cb.onOffline(isOffline, text || (isOffline ? 'Connecting…' : 'LIVE'))
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function startTile(
  cam: Camera,
  state: TileState,
  opts?: { camCount?: number; index?: number; fpsTarget?: CctvFps },
) {
  state.retryDelay = 800
  state.consecFails = 0
  state.offline = true
  state.pullRunning = true
  state.paused = false
  state.pendingRestart = false
  state.decodeBusy = false
  state.pendingFrame = null
  const camCount = opts?.camCount ?? 1
  const fpsTarget = opts?.fpsTarget ?? DEFAULT_FPS
  state.fpsCap = adaptiveFpsCap(camCount, fpsTarget)
  state.minIntervalMs = fpsToMinInterval(state.fpsCap)
  state.appliedFps = fpsTarget
  state.appliedCamCount = camCount
  await applyAdaptiveQuality(cam, camCount, fpsTarget)
  if (!state.pullRunning) return
  const stagger = staggerMs(opts?.index ?? 0)
  if (stagger) await delay(stagger)
  if (!state.pullRunning) return
  tileLoop(cam, state)
  // stagger status polls too
  const pollDelay = stagger + Math.floor(Math.random() * 600)
  window.setTimeout(() => pollStatus(cam, state), pollDelay)
}

function stopTile(_cam: Camera, state: TileState) {
  state.pullRunning = false
  state.videoAbort?.abort()
}

/* ── adaptive quality for XIAO ESP32S3 Sense ───────────────────────── */
async function applyAdaptiveQuality(cam: Camera, camCount: number, fpsTarget: CctvFps = DEFAULT_FPS) {
  const send = async (varName: string, val: number | string) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    try {
      await fetch(controlUrl(cam, varName, val), { cache: 'no-store', signal: ctrl.signal })
    } catch {
      /* firmware without /control — ignore */
    } finally {
      clearTimeout(t)
    }
  }
  try {
    const fs = adaptiveFramesize(camCount, fpsTarget)
    const q = adaptiveQuality(camCount, fpsTarget)
    const fps = adaptiveFpsCap(camCount, fpsTarget)
    // Await framesize so the camera commits the NEW resolution BEFORE we restart
    // the MJPEG stream. Without this, the restart races the /control write and the
    // stream comes back at the old size — fps changes look like they "do nothing".
    await send('framesize', fs)
    // quality + double-buffer + fps can apply concurrently; not resolution-critical
    void send('quality', q)
    void send('fb_count', MAX_FB_COUNT)
    // Command the camera to actually PRODUCE the promised fps. Without this the
    // camera keeps its own (lower) frame interval and the fps target is only a
    // client-side cap — so the meter never reaches the promised number.
    void send('fps', fps)
  } catch {
    /* keep going without /control */
  }
}

export async function syncTileAdaptive(
  cam: Camera,
  state: TileState,
  camCount: number,
  fpsTarget: CctvFps = DEFAULT_FPS,
  index = 0,
) {
  const newFpsCap = adaptiveFpsCap(camCount, fpsTarget)
  const newMin = fpsToMinInterval(newFpsCap)
  const newFs = adaptiveFramesize(camCount, fpsTarget)
  const newQ = adaptiveQuality(camCount, fpsTarget)
  const prevFs = state.appliedCamCount !== null && state.appliedFps !== null ? adaptiveFramesize(state.appliedCamCount, state.appliedFps) : null
  const prevQ = state.appliedCamCount !== null && state.appliedFps !== null ? adaptiveQuality(state.appliedCamCount, state.appliedFps) : null
  const needsRestart =
    state.appliedFps !== fpsTarget ||
    state.appliedCamCount !== camCount ||
    newFpsCap !== state.fpsCap ||
    newFs !== prevFs ||
    newQ !== prevQ
  // always update caps immediately so next paint respects commitment
  state.fpsCap = newFpsCap
  state.minIntervalMs = newMin
  state.appliedFps = fpsTarget
  state.appliedCamCount = camCount
  // commit camera settings FIRST (await framesize) so the restarted stream uses them
  await applyAdaptiveQuality(cam, camCount, fpsTarget)
  if (needsRestart && state.pullRunning && !state.paused) {
    state.pendingRestart = true
    const stagger = staggerMs(index)
    if (stagger) setTimeout(() => state.videoAbort?.abort(), stagger)
    else state.videoAbort?.abort()
  }
  void newFs
  void newQ
}

/* ── primary path: MJPEG stream ─────────────────────────────────────── */

/**
 * Consumes the camera's /stream MJPEG feed, painting each JPEG to the tile.
 * Returns true when the loop ended because the tile was stopped, false when
 * the stream died or errored (caller should fall back).
 */
async function paintJpegFrame(
  img: HTMLImageElement,
  state: TileState,
  frame: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  // fps cap — drop frames that arrive too fast
  const now = performance.now()
  if (now - state.lastPaint < state.minIntervalMs) return false
  if (state.paused || !state.isVisible) return false
  if (state.decodeBusy) {
    state.pendingFrame = frame
    return false
  }
  state.decodeBusy = true
  try {
    const blob = new Blob([frame], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    const prevUrl = img.dataset.blobUrl as string | undefined
    img.src = url
    // Prefer decode() (off-main-thread) with timeout, fallback to onload
    if (typeof img.decode === 'function') {
      try {
        await Promise.race([
          img.decode(),
          new Promise<void>((_, rej) => setTimeout(() => rej(new Error('decode timeout')), 1800)),
        ])
      } catch {
        // fallback: ensure onload fired
        if (!img.complete) {
          await new Promise<void>((res) => {
            const t = setTimeout(res, 400)
            img.onload = () => {
              clearTimeout(t)
              res()
            }
            img.onerror = () => {
              clearTimeout(t)
              res()
            }
          })
        }
      }
    } else {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 1800)
        img.onload = () => {
          clearTimeout(t)
          resolve()
        }
        img.onerror = () => {
          clearTimeout(t)
          resolve()
        }
      })
    }
    if (prevUrl) URL.revokeObjectURL(prevUrl)
    img.dataset.blobUrl = url
    state.lastPaint = performance.now()
    drawUpscaled(state, img)
    return true
  } finally {
    state.decodeBusy = false
  }
}

/**
 * Real-time GPU upscale of the (small) MJPEG frame to the tile's canvas.
 * Uses high-quality resampling + a subtle overlay-contrast pass to lift
 * perceived sharpness — runs on the 2D canvas (GPU-composited) so it adds
 * ~0 main-thread cost and holds the 30fps cap. No backend required.
 */
function drawUpscaled(state: TileState, img: HTMLImageElement) {
  const cv = state.canvas
  if (!cv) return
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = cv.getBoundingClientRect()
  const cw = Math.max(1, Math.round(rect.width * dpr))
  const ch = Math.max(1, Math.round(rect.height * dpr))
  if (cv.width !== cw || cv.height !== ch) {
    cv.width = cw
    cv.height = ch
  }
  const ctx = cv.getContext('2d')
  if (!ctx) return
  // object-contain fit
  const scale = Math.min(cw / iw, ch / ih)
  const dw = Math.max(1, Math.round(iw * scale))
  const dh = Math.max(1, Math.round(ih * scale))
  const dx = Math.round((cw - dw) / 2)
  const dy = Math.round((ch - dh) / 2)
  ctx.clearRect(0, 0, cw, ch)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
  // subtle uplift: overlay the same frame to boost local contrast/detail
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.22
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

function onMjpegConnected(cam: Camera, state: TileState, _img: HTMLImageElement, connectedRef: { v: boolean }) {
  if (connectedRef.v) return
  connectedRef.v = true
  state.consecFails = 0
  state.retryDelay = 800
  if (state.offline) {
    setTileOffline(cam, state, false)
    if (state.everConnected) onCameraBackOnline(cam, state)
    else {
      state.everConnected = true
      state.cb.onLog(`Camera <b>${cam.name}</b> streaming`, 'ok')
    }
  }
}

async function runMjpeg(cam: Camera, state: TileState): Promise<boolean> {
  const img = state.img
  if (!img) return false

  const ctrl = new AbortController()
  state.videoAbort = ctrl
  state.decodeBusy = false
  state.pendingFrame = null

  let resp: Response
  try {
    resp = await fetch(streamUrl(cam), { cache: 'no-store', signal: ctrl.signal })
    if (!resp.ok || !resp.body) throw new Error('http ' + resp.status)
  } catch {
    return false
  }

  const reader = resp.body.getReader()
  const parser = createMjpegParser(STREAM_BOUNDARY)
  const connectedRef = { v: false }
  let frameCount = 0
  let windowStart = performance.now()
  let lastActivity = performance.now()

  const watchdog = window.setInterval(() => {
    if (state.paused) return
    if (performance.now() - lastActivity > STREAM_FRAME_TIMEOUT_MS) ctrl.abort()
  }, 2000)

  try {
    for (;;) {
      if (state.paused) {
        // paused (off-screen) — abort this stream, tileLoop will restart when visible
        ctrl.abort()
        break
      }
      let value: Uint8Array | undefined
      let done = false
      try {
        const r = await reader.read()
        value = r.value
        done = r.done
      } catch {
        break
      }
      if (done) break
      if (value) {
        lastActivity = performance.now()
        const frames = parser.push(value)
        if (frames.length === 0) continue
        // backpressure: only the freshest frame matters — drop intermediates
        const latest = frames[frames.length - 1]
        const painted = await paintJpegFrame(img, state, latest)
        if (painted) {
          onMjpegConnected(cam, state, img, connectedRef)
          frameCount++
          const now = performance.now()
          const span = now - windowStart
          if (span >= 5000) {
            windowStart = now
            frameCount = 1
          }
          const fps = Math.round(frameCount / Math.max(1, (now - windowStart) / 1000))
          updateVideoMeta(state, img.naturalWidth || '?', img.naturalHeight || '?', fps)
        } else if (state.pendingFrame) {
          // fps-throttled or busy — keep latest for next tick, don't spam
        }
        // drain pending if we now have headroom (e.g. capped fps interval elapsed)
        while (state.pendingFrame && !state.decodeBusy && performance.now() - state.lastPaint >= state.minIntervalMs) {
          const p = state.pendingFrame
          state.pendingFrame = null
          const ok = await paintJpegFrame(img, state, p)
          if (ok) {
            onMjpegConnected(cam, state, img, connectedRef)
            frameCount++
            const now2 = performance.now()
            const span2 = now2 - windowStart
            if (span2 >= 5000) {
              windowStart = now2
              frameCount = 1
            }
            const fps2 = Math.round(frameCount / Math.max(1, (now2 - windowStart) / 1000))
            updateVideoMeta(state, img.naturalWidth || '?', img.naturalHeight || '?', fps2)
          } else break
        }
      }
    }
  } finally {
    clearInterval(watchdog)
    try {
      await reader.cancel()
    } catch {
      /* ignore */
    }
  }
  return !state.pullRunning
}

/* ── fallback path: /capture frame polling ──────────────────────────── */

/**
 * Polls /capture until it fails hard (or the tile is stopped).
 * Returns true on clean stop, false after persistent failures.
 */
async function runCapture(cam: Camera, state: TileState): Promise<boolean> {
  const img = state.img
  if (!img) return true
  let capFrames = 0
  let capWindow = performance.now()
  while (state.pullRunning && img) {
    if (state.paused || !state.isVisible) {
      await delay(600)
      continue
    }
    const frameStart = performance.now()
    const ctrl = new AbortController()
    state.videoAbort = ctrl
    const watchdog = setTimeout(() => ctrl.abort(), VIDEO_FRAME_TIMEOUT_MS)
    try {
      const res = await fetch(apiUrl(cam, '/capture'), { cache: 'no-store', signal: ctrl.signal })
      clearTimeout(watchdog)
      if (!res.ok) throw new Error('http ' + res.status)
      const buf = new Uint8Array(await res.arrayBuffer())
      if (!state.pullRunning) break
      if (state.paused || !state.isVisible) {
        const elapsedSkip = performance.now() - frameStart
        const waitSkip = Math.max(0, state.minIntervalMs - elapsedSkip)
        if (waitSkip) await delay(waitSkip)
        continue
      }
      // fps cap — if we painted too recently, drop this capture
      if (performance.now() - state.lastPaint < state.minIntervalMs) {
        const elapsed = performance.now() - frameStart
        const wait = Math.max(0, state.minIntervalMs - elapsed)
        if (wait) await delay(wait)
        continue
      }
      const painted = await paintJpegFrame(img, state, buf)
      if (painted) {
        capFrames++
        const now = performance.now()
        if (now - capWindow >= 5000) {
          capWindow = now
          capFrames = 1
        }
        const fps = Math.round(capFrames / Math.max(1, (now - capWindow) / 1000))
        updateVideoMeta(state, img.naturalWidth || '?', img.naturalHeight || '?', fps)
      }
      // drain any pending that arrived while busy
      if (state.pendingFrame && performance.now() - state.lastPaint >= state.minIntervalMs) {
        const p = state.pendingFrame
        state.pendingFrame = null
        const ok2 = await paintJpegFrame(img, state, p)
        if (ok2) {
          capFrames++
          const now2 = performance.now()
          if (now2 - capWindow >= 5000) {
            capWindow = now2
            capFrames = 1
          }
          const fps2 = Math.round(capFrames / Math.max(1, (now2 - capWindow) / 1000))
          updateVideoMeta(state, img.naturalWidth || '?', img.naturalHeight || '?', fps2)
        }
      }
      if (!painted && !state.pendingFrame) {
        // dropped due to cap — still count as success to avoid offline flicker
      }

      const wasOffline = state.offline
      state.consecFails = 0
      state.retryDelay = 800
      if (wasOffline) {
        setTileOffline(cam, state, false)
        if (state.everConnected) onCameraBackOnline(cam, state)
        else {
          state.everConnected = true
          state.cb.onLog(`Camera <b>${cam.name}</b> connected`, 'ok')
        }
      }

      const elapsed = performance.now() - frameStart
      const wait = Math.max(0, state.minIntervalMs - elapsed)
      if (wait) await delay(wait)
    } catch {
      clearTimeout(watchdog)
      if (!state.pullRunning) break
      if (state.paused) {
        await delay(500)
        continue
      }
      state.consecFails++
      if (state.consecFails >= VIDEO_FAILS_BEFORE_OFFLINE) {
        setTileOffline(cam, state, true, state.everConnected ? 'Reconnecting…' : 'Connecting…')
        const d = state.retryDelay
        state.retryDelay = Math.min(d * 1.4, 8000)
        await delay(d)
        return false
      }
      await delay(200)
    }
  }
  return true
}

async function tileLoop(cam: Camera, state: TileState) {
  for (;;) {
    if (!state.pullRunning) return
    if (state.paused) {
      await delay(700)
      continue
    }
    // pending preset/fps change — restart stream immediately with new commitment
    if (state.pendingRestart) {
      state.pendingRestart = false
      state.consecFails = 0
      state.retryDelay = 1500
      continue
    }
    const streamOk = await runMjpeg(cam, state)
    if (!state.pullRunning) return
    if (streamOk) return
    // if preset/fps changed while stream was running, skip fallback and restart MJPEG directly
    if (state.pendingRestart) {
      state.pendingRestart = false
      state.consecFails = 0
      continue
    }
    if (state.paused) {
      await delay(600)
      continue
    }

    // stream died — fall back to frame polling
    if (!state.paused && state.offline) state.cb.onLog(`Stream lost — frame polling <b>${cam.name}</b>…`, 'err')
    const pollOk = await runCapture(cam, state)
    if (!state.pullRunning) return
    if (pollOk) return
    if (state.pendingRestart) {
      state.pendingRestart = false
      continue
    }
    if (state.paused) {
      await delay(600)
      continue
    }

    // both paths failed — back off, then try the stream again
    if (state.everConnected) state.cb.onLog(`Camera <b>${cam.name}</b> offline — retrying…`, 'err')
    const d = state.retryDelay
    state.retryDelay = Math.min(d * 1.4, 8000)
    setTileOffline(cam, state, true, state.everConnected ? 'Reconnecting…' : 'Connecting…')
    await delay(d)
  }
}

function onCameraBackOnline(cam: Camera, state: TileState) {
  state.cb.onLog(`Camera <b>${cam.name}</b> reconnected`, 'ok')
  if (state.wantAudio && !state.ws) openAudioSocket(cam, state)
}

function pollStatus(cam: Camera, state: TileState) {
  if (!state.pullRunning) return
  if (state.paused) {
    state.statusPollTimer = window.setTimeout(() => pollStatus(cam, state), 4000)
    return
  }
  fetch(apiUrl(cam, '/status'), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((s) => {
      state.lastRssi = `${s.rssi}dBm`
      state.lastUptime = `${Math.floor(s.uptime / 60)}m up`
      emitMeta(state, true)
    })
    .catch(() => {})
    .finally(() => {
      if (state.pullRunning)
        state.statusPollTimer = window.setTimeout(() => pollStatus(cam, state), statusPollMsWithJitter())
    })
}

export async function takeSnapshot(cam: Camera, state: TileState) {
  const filename = `${cam.name.replace(/\s+/g, '_')}_${timestampSlug()}.jpg`
  try {
    const r = await fetch(apiUrl(cam, '/capture'), { cache: 'no-store' })
    if (!r.ok) throw new Error('camera returned ' + r.status)
    const blob = await r.blob()
    const savedToDisk = await saveBlobToDisk(filename, blob)
    state.cb.onLog(`Snapshot saved — <b>${cam.name}</b>${savedToDisk ? '' : ' (downloaded)'}`, 'ok')
  } catch (e) {
    // fallback: grab the currently displayed frame so a snapshot still works
    // even if the /capture endpoint is missing or busy on the camera
    try {
      if (state.img && state.img.src.startsWith('blob:')) {
        const blob = await (await fetch(state.img.src)).blob()
        const savedToDisk = await saveBlobToDisk(filename, blob)
        state.cb.onLog(
          `Snapshot saved (live frame) — <b>${cam.name}</b>${savedToDisk ? '' : ' (downloaded)'}`,
          'ok',
        )
        return
      }
    } catch {
      /* ignore — fall through to failure log */
    }
    state.cb.onLog(`Snapshot failed — <b>${cam.name}</b>: ${(e as Error).message}`, 'err')
  }
}

function pickRecMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || ''
}

export function toggleRecording(cam: Camera, state: TileState) {
  if (state.recording) stopRecording(cam, state)
  else startRecording(cam, state)
}

function startRecording(cam: Camera, state: TileState) {
  if (state.recording || !state.img) return
  const mimeType = pickRecMimeType()
  if (!mimeType) {
    state.cb.onLog(`Recording isn't supported in this browser — <b>${cam.name}</b>`, 'err')
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = state.img.naturalWidth || 640
  canvas.height = state.img.naturalHeight || 480
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  state.recCanvas = canvas
  state.recCtx = ctx

  // Attach the capture canvas to the DOM (hidden, off-screen). captureStream()
  // only reliably emits frames when the canvas is in the document in some
  // browsers (notably Safari), so this is what makes recording actually work.
  canvas.style.cssText =
    'position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(canvas)
  // paint one frame immediately so the recorder has content from t=0
  if (state.img && state.img.naturalWidth) {
    try {
      ctx.drawImage(state.img, 0, 0, canvas.width, canvas.height)
    } catch {
      /* ignore */
    }
  }

  state.recDrawTimer = window.setInterval(() => {
    if (!state.img) return
    if (
      state.img.naturalWidth &&
      (canvas.width !== state.img.naturalWidth || canvas.height !== state.img.naturalHeight)
    ) {
      canvas.width = state.img.naturalWidth
      canvas.height = state.img.naturalHeight
    }
    try {
      ctx.drawImage(state.img, 0, 0, canvas.width, canvas.height)
    } catch {
      /* keep recording */
    }
  }, 1000 / REC_FPS)

  const stream = canvas.captureStream(REC_FPS)
  if (state.wantAudio && state.audioRecDest) {
    const audioTrack = state.audioRecDest.stream.getAudioTracks()[0]
    if (audioTrack) stream.addTrack(audioTrack)
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 })
  state.recChunks = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) state.recChunks.push(e.data)
  }
  recorder.onstop = async () => {
    if (state.recDrawTimer) clearInterval(state.recDrawTimer)
    const blob = new Blob(state.recChunks, { type: mimeType })
    state.recChunks = []
    const filename = `${cam.name.replace(/\s+/g, '_')}_${state.recStartSlug}.webm`
    const savedToDisk = await saveBlobToDisk(filename, blob)
    state.cb.onLog(`Recording saved — <b>${cam.name}</b>${savedToDisk ? '' : ' (downloaded)'}`, 'ok')
  }

  recorder.start(1000)
  state.recorder = recorder
  state.recording = true
  state.recStartSlug = timestampSlug()
  state.cb.onRecState(true)
  state.cb.onLog(`Recording started — <b>${cam.name}</b>`, 'ok')
}

function stopRecording(_cam: Camera, state: TileState) {
  if (!state.recording) return
  state.recording = false
  if (state.recDrawTimer) {
    clearInterval(state.recDrawTimer)
    state.recDrawTimer = null
  }
  state.recorder?.stop()
  state.recorder = null
  if (state.recCanvas) {
    try {
      document.body.removeChild(state.recCanvas)
    } catch {
      /* already removed */
    }
  }
  state.recCanvas = null
  state.recCtx = null
  state.cb.onRecState(false)
}

export function toggleAudio(cam: Camera, state: TileState) {
  if (state.wantAudio) {
    state.wantAudio = false
    state.audioConnectAttempts = 0
    stopAudio(cam, state)
    state.cb.onMicState(false)
    state.cb.onLog(`Mic audio off — <b>${cam.name}</b>`, 'ok')
    return
  }
  state.wantAudio = true
  state.audioConnectAttempts = 0
  state.cb.onMicState(true)
  openAudioSocket(cam, state)
  if (state.recording) {
    state.cb.onLog(
      `Audio enabled after recording started — stop and restart recording to include audio in <b>${cam.name}</b>`,
    )
  }
}

function openAudioSocket(cam: Camera, state: TileState) {
  if (state.audioRetryTimer) clearTimeout(state.audioRetryTimer)
  const Ctor: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    state.wantAudio = false
    state.cb.onMicState(false)
    state.cb.onLog(`Mic audio isn't supported in this browser — <b>${cam.name}</b>`, 'err')
    return
  }
  /* created synchronously inside the user's click so the autoplay policy lets
     it run; guarded on reconnect (non-gesture) so suspended contexts never
     queue up audio and blast it out all at once */
  let ctx: AudioContext
  try {
    ctx = new Ctor({ sampleRate: 16000 })
  } catch {
    state.wantAudio = false
    state.cb.onMicState(false)
    state.cb.onLog(`Mic audio couldn't start — <b>${cam.name}</b>`, 'err')
    return
  }
  state.audioCtx = ctx
  void ctx.resume().catch(() => {})
  const recDest = ctx.createMediaStreamDestination()
  state.audioRecDest = recDest
  /* gentle boost — the XIAO ESP32S3 board mic is quiet compared to phone mics,
     so PCM playback gets a modest +gain before it reaches the speakers */
  const gain = ctx.createGain()
  gain.gain.value = 1.5
  gain.connect(ctx.destination)
  state.audioGain = gain
  const ws = new WebSocket(wsAudioUrl(cam))
  ws.binaryType = 'arraybuffer'
  /* playhead is lazily anchored to the running context's timeline, so gapless
     chunks don't pile up at t=0 (which would sound like garbled noise) */
  let playhead: number | null = null

  ws.onopen = () => {
    state.audioConnectAttempts = 0
    state.ws = ws
    state.cb.onLog(`Mic audio connected — <b>${cam.name}</b>`, 'ok')
  }
  ws.onerror = () => {
    state.cb.onLog(`Mic audio error (camera may not stream audio) — <b>${cam.name}</b>`, 'err')
  }
  ws.onclose = (ev) => {
    state.ws = null
    void ctx.close().catch(() => {})
    state.audioCtx = null
    state.audioRecDest = null
    state.audioGain = null
    if (state.wantAudio) {
      // cap retries so a camera without audio doesn't retry forever / spam logs
      if (state.audioConnectAttempts < 6) {
        state.audioConnectAttempts++
        state.audioRetryTimer = window.setTimeout(() => {
          if (state.wantAudio && !state.ws) openAudioSocket(cam, state)
        }, 1200)
      } else {
        state.cb.onLog(`Mic audio unavailable on <b>${cam.name}</b> — ${ev.reason || 'no stream'}`, 'err')
        state.wantAudio = false
        state.cb.onMicState(false)
      }
    } else {
      state.cb.onMicState(false)
    }
  }
  ws.onmessage = (ev) => {
    /* only play into a running context — if autoplay policy suspended it,
       resume and drop this chunk rather than buffering at time 0 */
    if (ctx.state !== 'running') {
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') void ctx.resume().catch(() => {})
      return
    }
    const raw = ev.data as unknown
    if (!(raw instanceof ArrayBuffer)) return
    const int16 = new Int16Array(raw)
    if (int16.length === 0) return
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
    const buf = ctx.createBuffer(1, float32.length, 16000)
    buf.copyToChannel(float32, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(gain)
    src.connect(recDest)
    const now = ctx.currentTime
    if (playhead === null || playhead < now) playhead = now + 0.04
    src.start(playhead)
    playhead += buf.duration
    src.onended = () => {
      try {
        src.disconnect()
      } catch {
        /* already disconnected */
      }
    }
  }

  state.ws = ws
}

function stopAudio(_cam: Camera, state: TileState) {
  if (state.audioRetryTimer) clearTimeout(state.audioRetryTimer)
  state.audioConnectAttempts = 0
  state.ws?.close()
  state.ws = null
  void state.audioCtx?.close().catch(() => {})
  state.audioCtx = null
  state.audioGain = null
  state.audioRecDest = null
}

export function disposeTile(cam: Camera, state: TileState) {
  if (state.recording) stopRecording(cam, state)
  stopAudio(cam, state)
  stopTile(cam, state)
  if (state.statusPollTimer) clearTimeout(state.statusPollTimer)
  state.decodeBusy = false
  state.pendingFrame = null
  state.pendingRestart = false
  state.paused = false
  if (state.img?.dataset.blobUrl) {
    try {
      URL.revokeObjectURL(state.img.dataset.blobUrl as string)
    } catch {
      /* ignore */
    }
    delete state.img.dataset.blobUrl
  }
}