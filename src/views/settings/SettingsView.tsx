import { useEffect, useState, type ChangeEvent } from 'react'
import {
  LuBluetooth as Bluetooth,
  LuDatabase as Database,
  LuDownload as Download,
  LuFolder as Folder,
LuInfo as Info,
    LuMoon as Moon,
  LuRadio as Radio,
  LuSun as Sun,
  LuTrash2 as Trash2,
  LuUpload as Upload,
  LuVideo as Video,
  LuCloud as Cloud,
  LuRefreshCw as RefreshCw,
} from 'react-icons/lu'
import { GearSix } from '@phosphor-icons/react'
import { useNexusStore } from '../../store/nexus'
import { usePositionsStore } from '../../store/positions'
import { useCctvStore } from '../../store/cctv'
import { useSyncStore } from '../../store/sync'
import { bleCmd, bleConnect, bleDisconnect } from '../../lib/nexus/ble'
import { connectWs, disconnectWs, wsUrl } from '../../lib/nexus/ws'
import { chooseSaveFolder, getSaveDirName, restoreSaveFolder } from '../../lib/cctv/core'
import { exportLiveCsv, importBundle, storageInfo, STORAGE_KEYS } from '../../lib/export'
import { archiveInfo, clearArchive, exportArchiveCsv } from '../../lib/history'
import { forceSyncNow } from '../../lib/sync/service'
import { requestConfirm } from '../../lib/popup'
import { useTheme } from '../../lib/theme'
import { cn, BASE_STATION_NAME } from '../../lib/utils'

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-tx3/10 bg-s2/40 px-3 py-3">
      <span className="text-[1.1rem] leading-none font-bold" style={{ color: color || 'var(--color-tx)' }}>{value}</span>
      <span className="text-[0.56rem] font-bold tracking-wider text-tx3 uppercase">{label}</span>
    </div>
  )
}

function fmtBytes(b: number) {
  if (b >= 1 << 30) return (b / (1 << 30)).toFixed(1) + ' GB'
  if (b >= 1 << 20) return (b / (1 << 20)).toFixed(1) + ' MB'
  if (b >= 1 << 10) return (b / (1 << 10)).toFixed(1) + ' KB'
  return b + ' B'
}

function Section({ icon, title, shape, right, children }: { icon: React.ReactNode; title: string; shape?: 'a' | 'b' | 'c' | 'd' | 'e'; right?: React.ReactNode; children: React.ReactNode }) {
  const radius = {
    a: 'rounded-[1.5rem]',
    b: 'rounded-3xl',
    c: 'rounded-[2rem_1rem_2rem_1rem]',
    d: 'rounded-[1rem_2rem_1rem_2rem]',
    e: 'rounded-[1.8rem_1.2rem_1.5rem_1.3rem]',
  }[shape || 'a']
  return (
      <div className={cn('flex flex-col gap-3 border-2 border-tx3/10 bg-s1 p-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]', radius)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-ac">{icon}</span>
          <span className="text-[0.82rem] font-bold text-tx">{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function StatusRow({ label, sub, tone, pulse, children }: { label: string; sub?: string; tone: 'green' | 'amber' | 'off' | 'red'; pulse?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-tx3/10 bg-s2/30 px-4 py-3">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', tone === 'green' && 'bg-gn', tone === 'amber' && 'bg-am', tone === 'red' && 'bg-rd', tone === 'off' && 'bg-tx3/40', pulse && 'animate-dot-pulse')} />
      <div className="min-w-0 flex-1">
        <div className="text-[0.72rem] font-bold text-tx">{label}</div>
        {sub && <div className="mt-0.5 font-mono text-[0.54rem] text-tx3">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Btn({ variant = 'default', size = 'sm', className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'green' | 'red'; size?: 'xs' | 'sm' }) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 font-bold transition-all active:scale-[0.96] disabled:pointer-events-none disabled:opacity-25',
        variant === 'default' && 'border-tx3/15 bg-s2/50 text-tx2 hover:border-ac/30 hover:text-ac',
        variant === 'green' && 'border-gn/25 bg-gn/8 text-gn hover:bg-gn/15',
        variant === 'red' && 'border-rd/25 bg-rd/8 text-rd hover:bg-rd/15',
        size === 'xs' && 'px-2.5 py-1.5 text-[0.6rem]',
        size === 'sm' && 'px-3.5 py-2 text-[0.66rem]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SettingsView() {
  const [theme, setTheme] = useTheme()
  const bleConnected = useNexusStore((s) => s.bleConnected)
  const bleDeviceName = useNexusStore((s) => s.bleDeviceName)
  const bleScanning = useNexusStore((s) => s.bleScanning)
  const wsConnected = useNexusStore((s) => s.wsConnected)
  const cameras = useCctvStore((s) => s.cameras)
  const saveDirName = useCctvStore((s) => s.saveDirName)
  const setSaveDirName = useCctvStore((s) => s.setSaveDirName)
  const cctvLog = useCctvStore((s) => s.cctvLog)
  const addLog = useNexusStore((s) => s.addLog)
  const syncServerUrl = useSyncStore((s) => s.serverUrl)
  const setSyncServerUrl = useSyncStore((s) => s.setServerUrl)
  const isOnline = useSyncStore((s) => s.isOnline)
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime)
  const pendingCount = useSyncStore((s) => s.pendingCount)
  const lastSyncError = useSyncStore((s) => s.lastSyncError)
  const [syncUrlInput] = useState(syncServerUrl)
  const [isSyncing, setIsSyncing] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [archive, setArchive] = useState<{ points: number; usageBytes: number }>({ points: 0, usageBytes: 0 })

  useEffect(() => {
    void restoreSaveFolder().then(() => setSaveDirName(getSaveDirName()))
  }, [setSaveDirName])

  useEffect(() => {
    let alive = true
    const refresh = () =>
      void archiveInfo().then((i) => {
        if (alive) setArchive({ points: i.points, usageBytes: i.usageBytes })
      })
    refresh()
    const t = window.setInterval(refresh, 5000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  const pickFolder = async () => {
    const ok = await chooseSaveFolder()
    if (ok) {
      setSaveDirName(getSaveDirName())
      cctvLog(`Save folder set to <b>${getSaveDirName()}</b>`, 'ok')
    }
  }

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ok = await importBundle(f)
    setImportMsg(ok ? { ok: true, text: `Restored from ${f.name}` } : { ok: false, text: `${f.name} is not a valid backup` })
    if (ok) addLog(`Data imported from ${f.name}`, 'SYS')
  }

  const clearArchiveUi = async () => {
    if (archive.points === 0) return
    const ok = await requestConfirm({ title: 'Clear telemetry archive', message: `Delete all ${archive.points.toLocaleString()} archived telemetry points? This cannot be undone.`, confirmLabel: 'OK', cancelLabel: 'Cancel', danger: true })
    if (!ok) return
    await clearArchive()
    const i = await archiveInfo()
    setArchive({ points: i.points, usageBytes: i.usageBytes })
    addLog('Telemetry archive cleared', 'SYS')
  }

  const handleSaveSyncUrl = () => {
    setSyncServerUrl(syncUrlInput.trim())
    addLog(`Sync server URL updated: ${syncUrlInput.trim() || 'cleared'}`, 'SYS')
  }

  const handleForceSync = async () => {
    setIsSyncing(true)
    try { await forceSyncNow() } finally { setIsSyncing(false) }
  }

  const resetAll = async () => {
    const ok = await requestConfirm({ title: 'Reset everything', message: 'This wipes ALL local data — nodes, telemetry, messages, cameras, positions, logs, settings, sync data — and reloads the dashboard fresh.', confirmLabel: 'OK', cancelLabel: 'Cancel', danger: true })
    if (!ok) return
    try {
      useNexusStore.getState().resetNodes()
      useNexusStore.getState().clearLog()
      useNexusStore.getState().clearRaw()
      usePositionsStore.getState().clear()
      useCctvStore.getState().importCctv({ cameras: [], saveDirName: null })
      for (const k of STORAGE_KEYS) localStorage.removeItem(k)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('an-')) localStorage.removeItem(key)
      }
      if ('caches' in window) {
        try { await (caches as any).keys().then((names: string[]) => Promise.all(names.map((n) => caches.delete(n)))) } catch { /* ignore */ }
      }
      try { await clearArchive() } catch { /* ignore */ }
      if (typeof indexedDB !== 'undefined') {
        try {
          await new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase('an_cctv_fs')
            req.onsuccess = () => resolve()
            req.onerror = () => resolve()
            req.onblocked = () => resolve()
          })
        } catch { /* ignore */ }
      }
      localStorage.removeItem('an-nexus-mesh-v1')
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key) localStorage.removeItem(key)
      }
      window.location.reload()
    } catch (e) {
      console.error('Reset failed:', e)
      window.location.reload()
    }
  }

  const storage = storageInfo()
  const storageBytes = storage.reduce((sum, s) => sum + s.bytes, 0)

  return (
<div
          className="nexus-scroll h-full overflow-y-auto mb-5"
      >
        <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center gap-3 lg:col-span-2 xl:col-span-3">
            <GearSix size={22} className="text-ac" />
            <div>
              <div className="text-[1rem] font-bold text-tx">Settings</div>
              <div className="font-mono text-[0.58rem] text-tx3">AN-Nexus · system configuration</div>
            </div>
          </div>

          <Section icon={<Bluetooth size={18} />} title="Connection" shape="a">
            <StatusRow
              label={bleScanning ? 'Scanning…' : bleConnected ? bleDeviceName || BASE_STATION_NAME : 'Not connected'}
              sub="Base station · C6 mesh"
              tone={bleConnected ? 'green' : bleScanning ? 'amber' : 'off'}
              pulse={bleConnected}
            >
              <Btn variant={bleConnected ? 'red' : 'green'} onClick={() => (bleConnected ? bleDisconnect() : void bleConnect())} disabled={bleScanning}>
                <Bluetooth size={12} />
                {bleConnected ? 'Disconnect' : 'Connect'}
              </Btn>
            </StatusRow>
            <div className="flex gap-2">
              <Btn className="flex-1" disabled={!bleConnected} onClick={() => bleCmd('LIST')}>
                <Radio size={11} /> List nodes
              </Btn>
              <Btn className="flex-1" disabled={!bleConnected} onClick={() => bleCmd('STATUS')}>
                <Info size={11} /> System status
              </Btn>
            </div>
            <StatusRow
              label={wsConnected ? 'WebSocket live' : 'WebSocket link'}
              sub={wsUrl()}
              tone={wsConnected ? 'green' : 'off'}
              pulse={wsConnected}
            >
              <Btn variant={wsConnected ? 'red' : 'green'} onClick={() => (wsConnected ? void disconnectWs() : void connectWs())} disabled={wsConnected && isSyncing}>
                {wsConnected ? 'Disconnect' : 'Connect'}
              </Btn>
            </StatusRow>
             <StatusRow label="Sync status" sub={lastSyncError || (lastSyncTime ? String(lastSyncTime) : 'Idle')} tone={lastSyncError ? 'red' : isOnline ? 'green' : 'off'} pulse={isOnline}>
              <span className="font-mono text-[0.54rem] text-tx3">{pendingCount} pending</span>
            </StatusRow>
          </Section>

          <Section icon={<Video size={18} />} title="CCTV" shape="c">
            <StatusRow label={cameras.length > 0 ? 'Cameras active' : 'No cameras'} sub={`${cameras.length} connected`} tone={cameras.length > 0 ? 'green' : 'off'}>
              <span className="font-mono text-[0.54rem] text-tx3">{cameras.length}</span>
            </StatusRow>
            <StatusRow label="Save folder" sub={saveDirName || 'Not set'} tone={saveDirName ? 'green' : 'off'}>
              <Btn variant="default" size="xs" onClick={() => void pickFolder()}>
                <Folder size={10} /> {saveDirName ? 'Change' : 'Set'}
              </Btn>
            </StatusRow>
          </Section>

          <Section icon={<Cloud size={18} />} title="Sync" shape="d">
            <StatusRow label="Server URL" sub={syncServerUrl || 'Not configured'} tone={syncServerUrl ? 'green' : 'off'}>
              <Btn variant="default" size="xs" onClick={handleSaveSyncUrl}>Save</Btn>
            </StatusRow>
            <div className="flex gap-2">
              <Btn className="flex-1" disabled={!syncServerUrl || isSyncing} onClick={handleForceSync}>
                <RefreshCw size={11} /> {isSyncing ? 'Syncing…' : 'Force sync'}
              </Btn>
              <Btn variant="green" className="flex-1" onClick={() => void exportLiveCsv()}>
                <Download size={11} /> Export
              </Btn>
            </div>
          </Section>

           <Section icon={<Database size={18} />} title="Storage" shape="e" right={archive.points > 0 ? <div className="flex flex-col items-end gap-1"><span className="font-mono text-[0.56rem] text-tx3">{archive.points.toLocaleString()} pts · ~{fmtBytes(archive.usageBytes)}</span><div className="flex flex-wrap gap-1.5"><Btn size="sm" onClick={() => void exportArchiveCsv()} disabled={archive.points === 0}><Download size={10} /> Export telemetry (.csv)</Btn><Btn size="sm" variant="red" onClick={() => void clearArchiveUi()} disabled={archive.points === 0}><Trash2 size={10} /> Clear ({archive.points.toLocaleString()})</Btn></div></div> : undefined}>
             <div className="flex gap-3">
               <Stat label="Used" value={fmtBytes(storageBytes)} />
               <Stat label="Points" value={archive.points.toLocaleString()} />
</div>
              <div className="flex gap-2 mt-2">
                <Btn className="flex-1" onClick={() => void exportLiveCsv()}>
                  <Download size={11} /> Export live
               </Btn>
               <Btn className="flex-1" onClick={() => {
                 const input = document.createElement('input')
                 input.type = 'file'
                 input.accept = '.json'
                 input.onchange = (e) => void handleImport(e as unknown as ChangeEvent<HTMLInputElement>)
                 input.click()
               }}>
                 <Upload size={11} /> Import
               </Btn>
             </div>
            {importMsg && (
              <div className={cn('mt-2 rounded-xl border-2 px-3 py-2 text-[0.62rem] font-bold', importMsg.ok ? 'border-gn/25 bg-gn/8 text-gn' : 'border-rd/25 bg-rd/8 text-rd')}>
                {importMsg.text}
              </div>
            )}
            <div className="flex flex-col gap-1 rounded-2xl border-2 border-tx3/10 bg-s2/40 px-4 py-3 font-mono text-[0.56rem] text-tx3">
              {storage.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.key}</span>
                  <span className="shrink-0 tabular-nums">{s.bytes.toLocaleString()} B</span>
                </div>
              ))}
              <div className="mt-1 border-t-2 border-tx3/10 pt-1.5 text-[0.54rem]">
                {storageBytes.toLocaleString()} B total · kept in this browser's local storage
              </div>
</div>
           </Section>

          <Section icon={<Trash2 size={18} />} title="Danger zone" shape="a">
            <div className="rounded-2xl border-2 border-rd/20 bg-rd/5 p-4">
              <div className="mb-1.5 text-[0.62rem] font-bold tracking-wider text-rd uppercase">Danger zone</div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 text-[0.62rem] leading-relaxed text-tx3">
                  Wipe everything stored in this browser — nodes, telemetry, messages, cameras, positions, logs — and start fresh.
                </div>
                <Btn variant="red" onClick={() => void resetAll()}>
                  <Trash2 size={11} /> Reset all
                </Btn>
              </div>
            </div>
          </Section>

          <Section icon={<Moon size={18} />} title="Appearance" shape="b">
            <div className="flex flex-col gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)} className={cn('flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-[0.66rem] font-bold transition-all', theme === t ? 'border-ac bg-ac/8 text-ac' : 'border-tx3/15 bg-s2/50 text-tx2 hover:border-ac/30')}>
                  {t === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)} mode
                </button>
              ))}
            </div>
          </Section>
         </div>
        </div>
  )
}
