import { useEffect, useRef, useState } from 'react'
import {
  LuCamera as CameraIcon,
  LuMaximize2 as Maximize2,
  LuMic as Mic,
  LuMicOff as MicOff,
  LuTrash2 as Trash2,
  LuVideo as Video,
  LuVideoOff as VideoOff,
  LuWifiOff as WifiOff,
} from 'react-icons/lu'
import type { Camera } from '../../store/cctv'
import { useCctvStore } from '../../store/cctv'
import {
  disposeTile,
  makeTileState,
  setTileVisible,
  startTile,
  syncTileAdaptive,
  takeSnapshot,
  toggleAudio,
  toggleRecording,
  type TileState,
} from '../../lib/cctv/tile'
import { Dialog } from '../../components/ui/Dialog'
import { cn } from '../../lib/utils'

function useClock(): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return new Date(now).toLocaleTimeString('en-GB', { hour12: false })
}

export function CameraTile({ cam, index = 0 }: { cam: Camera; index?: number }) {
  const removeCamera = useCctvStore((s) => s.removeCamera)
  const cctvLog = useCctvStore((s) => s.cctvLog)
  const setTileOnline = useCctvStore((s) => s.setTileOnline)
  const camCount = useCctvStore((s) => s.cameras.length)
  const fpsTarget = useCctvStore((s) => s.fpsTarget)

  const [offline, setOffline] = useState(true)
  const [offlineText, setOfflineText] = useState('Connecting…')
  const [meta, setMeta] = useState('')
  const [recording, setRecording] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const ts = useClock()

  const [state] = useState<TileState>(() =>
    makeTileState({
      onOffline: (o, text) => {
        setOffline(o)
        setOfflineText(text)
        setTileOnline(cam.id, !o)
      },
      onMeta: setMeta,
      onLog: (msg, kind) => cctvLog(msg, kind),
      onRecState: setRecording,
      onMicState: setMicOn,
    }),
  )

  const tileRef = useRef<HTMLDivElement | null>(null)

  const setImg = (el: HTMLImageElement | null) => {
    // TileState is an imperative handle owned by tile.ts — direct mutation is intentional.
    // eslint-disable-next-line react-hooks/immutability
    state.img = el
  }
  const setCanvas = (el: HTMLCanvasElement | null) => {
    // eslint-disable-next-line react-hooks/immutability
    state.canvas = el
  }

  useEffect(() => {
    startTile(cam, state, { camCount, index, fpsTarget })
    return () => {
      disposeTile(cam, state)
    }
  }, [cam, state]) // start once; adaptive updates handled separately

  // keep fps cap + camera quality in sync when fleet size or fps target changes — restarts stream for perfect commitment
  useEffect(() => {
    syncTileAdaptive(cam, state, camCount, fpsTarget, index)
  }, [cam, state, camCount, fpsTarget, index])

  // viewport-aware pause — off-screen tiles don't burn WiFi / decode
  useEffect(() => {
    const el = tileRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setTileVisible(state, e.isIntersecting)
      },
      { threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [state])

  // tab hidden → pause all streams to save WiFi/CPU, resume on visible
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) setTileVisible(state, false)
      else {
        // re-check intersection
        const el = tileRef.current
        if (!el) setTileVisible(state, true)
        else {
          const r = el.getBoundingClientRect()
          const visible = r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0
          setTileVisible(state, visible)
        }
        // if paused due to earlier tab-hide, kick loop if needed
        if (state.isVisible && !state.pullRunning) startTile(cam, state, { camCount, index, fpsTarget })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [cam, state, camCount, index, fpsTarget])

  return (
    <div
      ref={tileRef}
      id={'tile-' + cam.id}
      className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-tx3/10 bg-s1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-ac/30"
    >
       {/* monitor screen */}
      <div className="tile-video-wrap relative flex min-h-0 w-full flex-1 overflow-hidden bg-s3">
        {/* hidden decode target — frames are painted to the canvas below with GPU upscaling */}
        <img ref={setImg} className="hidden" alt={cam.name} />
        <canvas ref={setCanvas} className="h-full w-full" />
        {offline ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-s1">
            <WifiOff size={22} className="text-tx3" />
            <span className="text-[0.6rem] font-semibold tracking-[0.14em] text-tx2 uppercase">{offlineText}</span>
          </div>
        ) : null}

        {/* top-left — channel + camera name */}
        <div className="pointer-events-none absolute top-0 left-0 z-10 flex items-center gap-1.5 px-2 py-1.5">
          <span className="rounded-sm bg-white/80 px-1.5 py-0.5 font-mono text-[0.56rem] font-bold tracking-[0.1em] text-tx shadow-sm backdrop-blur-[2px]">
            CAM-{String(cam.id).padStart(2, '0')}
          </span>
          <span className="hidden max-w-[140px] truncate rounded-sm bg-white/70 px-1.5 py-0.5 font-mono text-[0.54rem] text-tx2 shadow-sm backdrop-blur-[2px] sm:inline">
            {cam.name}
          </span>
        </div>

        {/* top-right — REC + ticking clock */}
        <div className="pointer-events-none absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2 py-1.5">
          {recording && (
            <span className="flex items-center gap-1 rounded-sm bg-rd px-1.5 py-0.5 font-mono text-[0.52rem] font-bold tracking-[0.08em] text-white shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> REC
            </span>
          )}
          <span className="rounded-sm bg-white/80 px-1.5 py-0.5 font-mono text-[0.52rem] text-tx2 shadow-sm tabular-nums backdrop-blur-[2px]">
            {ts}
          </span>
        </div>

        {/* bottom-right — live status */}
        <div className="pointer-events-none absolute right-0 bottom-0 z-10 px-2 py-1.5">
          <span
            className={cn(
              'flex items-center gap-1 font-mono text-[0.52rem] font-bold tracking-[0.12em]',
              offline ? 'text-tx3' : 'text-gn',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', offline ? 'bg-tx3' : 'bg-gn')} />
            {offline ? 'OFFLINE' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* DVR control bar */}
      <div className="flex flex-shrink-0 items-center gap-1 border-t border-tx3/10 bg-s2 px-1.5 py-1.5">
        <button
          onClick={() => toggleAudio(cam, state)}
          aria-label={micOn ? 'Mute microphone' : 'Enable microphone'}
          className={cn(
            'flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1.5 text-[0.58rem] transition-colors',
            micOn
              ? 'border-ac/50 bg-ac/10 text-ac'
              : 'border-tx3/20 text-tx hover:border-ac/40 hover:text-tx2',
          )}
          data-tip={micOn ? 'Mute microphone' : 'Toggle microphone audio'}
        >
          {micOn ? <Mic size={12} /> : <MicOff size={12} />}
        </button>
        <button
          onClick={() => void takeSnapshot(cam, state)}
          aria-label="Take snapshot"
          className="flex cursor-pointer items-center gap-1 rounded-md border border-tx3/20 px-1.5 py-1.5 text-[0.58rem] text-tx transition-colors hover:border-ac/40 hover:text-tx2"
          data-tip="Snapshot"
        >
          <CameraIcon size={12} />
        </button>
        <button
          onClick={() => toggleRecording(cam, state)}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className={cn(
            'flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1.5 text-[0.58rem] transition-colors',
            recording
              ? 'border-rd/50 bg-rd/10 text-rd'
              : 'border-tx3/20 text-tx hover:border-rd/40 hover:text-rd',
          )}
          data-tip={recording ? 'Stop recording' : 'Record video'}
        >
          {recording ? <VideoOff size={12} /> : <Video size={12} />}
        </button>
        <button
          onClick={() => {
            const wrap = document.getElementById('tile-' + cam.id)?.querySelector('.tile-video-wrap')
            wrap?.requestFullscreen?.()
          }}
          aria-label="Toggle fullscreen"
          className="flex cursor-pointer items-center gap-1 rounded-md border border-tx3/20 px-1.5 py-1.5 text-[0.58rem] text-tx transition-colors hover:border-ac/40 hover:text-tx2"
          data-tip="Fullscreen"
        >
          <Maximize2 size={12} />
        </button>
        <button
          onClick={() => setConfirmRemove(true)}
          aria-label="Remove camera"
          className="flex cursor-pointer items-center gap-1 rounded-md border border-tx3/20 px-1.5 py-1.5 text-[0.58rem] text-tx transition-colors hover:border-rd/50 hover:text-rd"
          data-tip="Remove camera"
        >
          <Trash2 size={12} />
        </button>
        {/* fps meter + signal/uptime — live fps, deduped */}
        {(() => {
          const fpsMatch = meta.match(/(\d+)fps/)
          const fps = fpsMatch ? Number(fpsMatch[1]) : null
          const fpsTone =
            fps === null
              ? 'text-tx3'
              : fps >= 24
                ? 'text-gn'
                : fps >= 12
                  ? 'text-[#c08b00]'
                  : fps >= 5
                    ? 'text-tx2'
                    : 'text-rd'
          // dedupe "·" tokens so "-55dBm · 0m up · -55dBm · 0m up" never shows
          const tokens = meta
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
          const fpsToken = uniq.find((t) => /fps/i.test(t)) || ''
          const resToken = uniq.find((t) => /×/i.test(t)) || ''
          const restTokens = uniq.filter((t) => t !== fpsToken && t !== resToken)
          return (
            <span className="ml-auto mr-1 flex items-center gap-1 font-mono text-[0.5rem] tabular-nums">
              {fps !== null ? (
                <span className={cn('rounded px-1 py-0.5 font-bold', fpsTone, fps && fps >= 15 ? 'bg-gn/10' : 'bg-tx3/10')}>
                  {fps}fps
                </span>
              ) : null}
              {resToken ? <span className="hidden text-tx3 sm:inline">{resToken}</span> : null}
              {restTokens.length ? <span className="text-tx3">{restTokens.join(' · ')}</span> : null}
            </span>
          )
        })()}
      </div>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove camera">
        <p className="text-[0.72rem] leading-relaxed text-tx2">
          Remove <span className="font-semibold text-tx">{cam.name}</span> from the dashboard?
          <br />
          This only removes it here — the camera keeps its Wi-Fi credentials.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setConfirmRemove(false)}
            className="cursor-pointer rounded-lg border border-tx3/15 px-3.5 py-1.5 text-[0.66rem] font-medium text-tx2 transition-colors hover:border-tx3/30 hover:text-tx"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setConfirmRemove(false)
              removeCamera(cam.id)
            }}
            className="cursor-pointer rounded-lg border border-rd/40 bg-rd/10 px-3.5 py-1.5 text-[0.66rem] font-semibold text-rd transition-colors hover:bg-rd/15"
          >
            Remove
          </button>
        </div>
      </Dialog>
    </div>
  )
}