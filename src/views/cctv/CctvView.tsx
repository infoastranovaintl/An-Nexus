import { useEffect, useState } from 'react'
import {
  LuFolder as Folder,
  LuPlus as Plus,
  LuScrollText as ScrollText,
  LuVideoOff as VideoOff,
  LuVideo,
} from 'react-icons/lu'
import { useCctvStore, MAX_CAMERAS } from '../../store/cctv'
import { CameraTile } from './CameraTile'
import { CameraWizard } from './CameraWizard'
import { EventsPanel } from './EventsPanel'
import {
  chooseSaveFolder,
  getSaveDirName,
  isFsSupported,
  restoreSaveFolder,
} from '../../lib/cctv/core'
import { cn } from '../../lib/utils'

export function CctvView() {
  const cameras = useCctvStore((s) => s.cameras)
  const saveDirName = useCctvStore((s) => s.saveDirName)
  const setSaveDirName = useCctvStore((s) => s.setSaveDirName)
  const tileOnline = useCctvStore((s) => s.tileOnline)
  const cctvLog = useCctvStore((s) => s.cctvLog)
  const wizardOpen = useCctvStore((s) => s.wizardOpen)
  const setWizardOpen = useCctvStore((s) => s.setWizardOpen)

  const [showEvents, setShowEvents] = useState(false)

  useEffect(() => {
    void restoreSaveFolder().then(() => setSaveDirName(getSaveDirName()))
    if (!isFsSupported()) {
      cctvLog(
        "This browser can't save directly to a folder — snapshots and recordings will use normal downloads instead.",
      )
    }
  }, [setSaveDirName, cctvLog])

  const pickFolder = async () => {
    const ok = await chooseSaveFolder()
    if (ok) {
      setSaveDirName(getSaveDirName())
      cctvLog(`Save folder set to <b>${getSaveDirName()}</b>`, 'ok')
    }
  }

  const online = cameras.filter((c) => tileOnline[c.id]).length
  const camCount = cameras.length

  return (
<div
         className="relative flex h-full gap-2 overflow-hidden"
      >
      <div className="flex h-full min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="relative z-[80] flex flex-shrink-0 items-center justify-between rounded-3xl border-2 border-tx3/10 bg-s1 px-4 py-2.5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-tx3/10 bg-s2/50 px-3 py-1.5">
              <span className="flex items-center gap-1.5 font-display text-[0.72rem] font-bold tracking-[0.04em] text-tx">
                <LuVideo size={13} className="text-ac" />
                CCTV
              </span>
              <span className="h-3 w-px bg-tx3/15" />
              <span className="flex items-center gap-1 font-mono text-[0.58rem]">
                <span className="h-1.5 w-1.5 rounded-full bg-gn" />
                <span className="font-bold text-gn">{online}</span>
                <span className="text-tx3">/</span>
                <span className="text-tx3">{camCount}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWizardOpen(true)}
                disabled={cameras.length >= MAX_CAMERAS}
                data-tip={cameras.length >= MAX_CAMERAS ? `Camera limit reached (${MAX_CAMERAS})` : 'Add camera'}
                data-tip-pos="bottom"
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-[0.62rem] font-bold transition-all active:scale-[0.96]',
                  cameras.length >= MAX_CAMERAS
                    ? 'cursor-default border-tx3/10 bg-s2/30 text-tx3 opacity-50'
                    : 'border-ac/30 bg-ac/8 text-ac hover:bg-ac/15',
                )}
              >
                <Plus size={11} />
                <span className="hidden sm:inline">Add camera</span>
              </button>
              <button
                onClick={() => setShowEvents((v) => !v)}
                data-tip="Event log"
                data-tip-pos="bottom"
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-[0.62rem] font-bold transition-all active:scale-[0.96]',
                  showEvents
                    ? 'border-ac/30 bg-ac/8 text-ac'
                    : 'border-tx3/15 bg-s2/50 text-tx2 hover:border-ac/30 hover:text-ac',
                )}
              >
                <ScrollText size={11} />
                <span className="hidden sm:inline">Events</span>
              </button>
              <button
                onClick={() => void pickFolder()}
                data-tip="Set save folder"
                data-tip-pos="bottom"
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-tx3/15 bg-s2/50 px-3 py-1.5 text-[0.62rem] font-bold text-tx2 transition-all hover:border-ac/30 hover:text-ac active:scale-[0.96]"
              >
                <Folder size={11} />
                <span className="max-w-[140px] truncate">
                  {saveDirName || (isFsSupported() ? 'Set save folder' : 'Downloads')}
                </span>
              </button>
            </div>
          </div>

           <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_8px_rgba(16,24,40,0.04)] p-3">
            {cameras.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-tx3/15 bg-s2/20 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-tx3/10 bg-s1">
                  <VideoOff size={24} className="text-tx3" />
                </div>
                <div className="text-center">
                  <div className="text-[0.82rem] font-bold text-tx">No cameras yet</div>
                  <div className="mt-1 max-w-[340px] text-[0.62rem] leading-relaxed text-tx3">
                    Click <span className="font-bold text-ac">Add camera</span> and connect one over USB to
                    provision it onto your Wi-Fi network.
                  </div>
                </div>
              </div>
            ) : (
               <div className="grid flex-1 min-h-0 gap-3" style={{ gridTemplateColumns: camCount <= 1 ? '1fr' : camCount <= 4 ? 'repeat(2, minmax(0, 1fr))' : camCount <= 9 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
                {cameras.map((cam, i) => (
                  <div key={cam.id} className="min-h-[240px]">
                    <CameraTile cam={cam} index={i} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showEvents && (
          <div className="absolute inset-0 z-[4990] bg-tx/40 backdrop-blur-[2px] lg:hidden" onClick={() => setShowEvents(false)} />
        )}
        <div
          className={cn(
            'flex h-full w-[300px] max-w-[86vw] flex-shrink-0 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_12px_rgba(16,24,40,0.06)] lg:static lg:z-auto lg:w-[300px]',
            'absolute inset-y-0 right-0 z-[5000] rounded-l-3xl lg:rounded-3xl',
            !showEvents && 'hidden',
          )}
        >
          <EventsPanel />
        </div>
        {wizardOpen && <CameraWizard onClose={() => setWizardOpen(false)} />}
    </div>
  )
}
