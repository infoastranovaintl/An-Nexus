import { useMemo, useState, useEffect } from 'react'
import { useNexusStore } from '../../store/nexus'
import { useCctvStore } from '../../store/cctv'
import { UnifiedGraph } from '../../components/UnifiedGraph'
import { type SensorKind } from '../../lib/nexus/sensors'
import { SiteMap } from './SiteMap'
import { CameraTile } from '../cctv/CameraTile'
import { AlertCard } from '../alerts/AlertCard'


const ALL_SENSOR_KINDS: SensorKind[] = ['temp', 'atmp', 'water', 'waterTemp', 'hum', 'turbidity', 'ph', 'rain', 'wind', 'distance', 'battery']
const TIME_PRESETS = [
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
]

function ConnectionCard() {
  const bleConnected = useNexusStore((s) => s.bleConnected)
  const wsConnected = useNexusStore((s) => s.wsConnected)
  const bleDeviceName = useNexusStore((s) => s.bleDeviceName)
  const totalPkts = useNexusStore((s) => s.totalPkts)
  const nodes = useNexusStore((s) => s.nodes)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const online = Object.values(nodes).filter((n) => n.online).length
  const all = Object.values(nodes).length
  const avgRssi = Math.round(Object.values(nodes).filter((n) => n.rssi != null).reduce((s, n) => s + n.rssi, 0) / Math.max(1, Object.values(nodes).filter((n) => n.rssi != null).length))

  const rssiLevel = (r: number) => Math.max(0, Math.min(5, Math.round((r + 100) / 25)))
  const rssiColor = (r: number) => r >= -50 ? 'bg-gn' : r >= -70 ? 'bg-yellow-500' : 'bg-rd'

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Connections</span>
        <span className="font-mono text-[0.6rem] rounded-full px-2 py-0.5 bg-gn/15 text-gn">{online}/{all}</span>
      </div>
      <div className="flex gap-1.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6rem] font-mono transition-colors ${bleConnected ? 'border-gn/40 bg-gn/10 text-gn' : 'border-rd/30 bg-rd/10 text-rd'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${bleConnected ? 'bg-gn' : 'bg-rd'}`} />BLE
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6rem] font-mono transition-colors ${wsConnected ? 'border-gn/40 bg-gn/10 text-gn' : 'border-rd/30 bg-rd/10 text-rd'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-gn' : 'bg-rd'}`} />WS
        </span>
      </div>
      <div className="flex items-center gap-2 text-[0.65rem] font-mono text-tx2">
        <span>Device <span className="text-tx">{bleDeviceName || '—'}</span></span>
        <span className="text-tx3">·</span>
        <span>Pkts <span className="text-tx">{totalPkts}</span></span>
        <span className="text-tx3">·</span>
        <span>RSSI <span className="text-tx">{avgRssi} dBm</span></span>
      </div>
      <div className="flex flex-col gap-1 overflow-auto flex-1 min-h-0">
        {Object.values(nodes).map((n) => (
          <div key={n.mac} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-s2/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className={`text-[0.65rem] ${n.online ? 'text-green-500' : 'text-red-500'}`}>{n.online ? '●' : '○'}</span>
              <span className="truncate text-[0.7rem] text-tx">{n.name}</span>
              {n.isMaster && <span className="text-[0.5rem] rounded bg-ac/15 px-1.5 py-0.5 text-ac font-bold">MASTER</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {n.rssi != null ? (
                <div className="flex items-end gap-[1px]" style={{ height: 12 }}>
                  {[1, 2, 3, 4, 5].map((h) => (
                    <div key={h} className={`rounded-[1px] ${h <= rssiLevel(n.rssi) ? rssiColor(n.rssi) : 'bg-tx3/20'}`} style={{ height: `${h * 2.4}px`, width: 3 }} />
                  ))}
                </div>
              ) : <span className="text-tx3 w-5 text-center text-[0.55rem]">—</span>}
              <span className="text-[0.55rem] text-tx3 shrink-0">{n.lastSeen != null ? `${Math.round((now - n.lastSeen) / 1000)}s` : '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapCard() {
  const [view, setView] = useState<'map' | 'satellite'>('map')
  const [zoom, setZoom] = useState(15)
  const [center, setCenter] = useState({ lat: 27.7172, lng: 85.324 })

  return (
    <div className="flex flex-col gap-2 h-full">
<div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Site Map</span>
        <div className="flex gap-0.5">
            {(['map', 'satellite'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`font-mono text-[0.65rem] rounded px-2 border ${view === v ? 'border-ac bg-ac/15 text-ac' : 'border-tx3/10 bg-s2 text-tx3'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-lg border border-tx3/10">
        <SiteMap view={view} zoom={zoom} center={center} onZoomChange={setZoom} onCenterChange={setCenter} flyTo={null} />
      </div>
    </div>
  )
}

function CameraCard() {
  const cameras = useCctvStore((s) => s.cameras)
  const tileOnline = useCctvStore((s) => s.tileOnline)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (cameras.length <= 1) { setActive(0); return }
    const id = setInterval(() => setActive((p) => (p + 1) % cameras.length), 5000)
    return () => clearInterval(id)
  }, [cameras.length])

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Cameras ({cameras.length})</span>
      </div>
      <div className="flex-1 min-h-0 relative rounded-lg border border-tx3/10 bg-s2 overflow-hidden">
        {cameras.length === 0 && (
          <div className="flex h-full items-center justify-center font-mono text-[0.6rem] text-tx3">No cameras configured</div>
        )}
        {cameras.map((cam, i) => (
          <div key={cam.id} className={i === active ? 'absolute inset-0' : 'hidden'}>
            <CameraTile cam={cam} index={i} />
            <div className="absolute bottom-0 left-0 right-0 font-mono text-[0.5rem] bg-black/60 text-white px-1">
              {cam.name} · {tileOnline[cam.id] ? '● LIVE' : '○ OFF'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertsCard() {
  const alerts = useNexusStore((s) => s.alerts)
  const activeAlerts = alerts.filter((a) => a.active).slice(0, 5)

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Alerts ({activeAlerts.length})</span>
      </div>
      <div className="flex flex-col gap-1 overflow-auto flex-1 min-h-0">
        {activeAlerts.length === 0 && (
          <div className="font-mono text-[0.55rem] text-tx3">No active alerts</div>
        )}
        {activeAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  )
}

function MessagesCard() {
  const convMeta = useNexusStore((s) => s.convMeta)

  const convList = useMemo(() => {
    return Object.keys(convMeta).map((k) => ({
      nodeId: Number(k),
      meta: convMeta[Number(k)],
      lastMsg: convMeta[Number(k)].lastMsg,
      lastTs: convMeta[Number(k)].lastTs,
      unread: convMeta[Number(k)].unread,
    }))
  }, [convMeta])

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Messages</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-auto flex-1 min-h-0">
        {convList.length === 0 && (
          <div className="font-mono text-[0.55rem] text-tx3">No conversations</div>
        )}
        {convList.slice(0, 4).map((c) => (
          <div key={c.nodeId} className="flex items-center justify-between rounded-lg border border-tx3/10 bg-s2 px-3 py-2 font-mono text-[0.55rem]">
            <div>
              <span className="text-tx font-bold">Node {c.nodeId}</span>
              <div className="text-tx3 truncate max-w-[100px]">{c.lastMsg}</div>
            </div>
            <div className="text-right">
              {c.unread > 0 && <span className="text-ac font-bold">{c.unread}</span>}
              <div className="text-tx3">{new Date(c.lastTs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogsCard() {
  const logs = useNexusStore((s) => s.logs)
  const recentLogs = logs.slice(-10).reverse()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[1.1rem] font-bold text-ac">Activity ({logs.length})</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-auto flex-1 min-h-0 font-mono text-[0.55rem]">
        {recentLogs.length === 0 && (
          <div className="text-tx3">No activity yet</div>
        )}
        {recentLogs.map((log) => (
          <div key={log.id} className="flex items-center gap-2 text-tx2">
            <span className="text-tx3 shrink-0">{log.ts}</span>
            <span className="truncate">{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SensorCard() {
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const sensorHistory = useNexusStore((s) => s.sensorHistory)
  const [timeFilter, setTimeFilter] = useState(5)

  const sensorKinds = useMemo(() => {
    const kinds: SensorKind[] = ['temp', 'atmp', 'altitude']
    for (const k of ALL_SENSOR_KINDS) {
      if (kinds.includes(k)) continue
      const present = Object.values(sensorReadings).some((samples) => samples.some((s) => s.kind === k))
      if (present) kinds.push(k)
      if (kinds.length >= 6) break
    }
    return kinds
  }, [sensorReadings])

  const allData = useMemo(() => {
    const byKind = new Map<SensorKind, { v: number; ts?: number }[]>()
    sensorKinds.forEach((kind) => {
      const pts: { v: number; ts: number }[] = []
      for (const [mac, samples] of Object.entries(sensorReadings)) {
        if (!samples) continue
        samples.filter((s) => s.kind === kind).forEach((s) => {
          let hist = sensorHistory[mac]?.[s.key]
          if (!hist) hist = sensorHistory[mac]?.[s.kind]
          if (hist) pts.push(...hist.map((p) => ({ v: p.v, ts: p.ts })))
        })
      }
      const seen = new Set<number>()
      const unique = pts.filter((p) => { const k = p.ts ?? 0; if (seen.has(k)) return false; seen.add(k); return true })
      unique.sort((a, b) => a.ts - b.ts)
      byKind.set(kind, unique)
    })
    return byKind
  }, [sensorKinds, sensorHistory, sensorReadings])

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="text-[1.1rem] font-bold text-ac">Sensor Dashboard</span>
        <div className="flex gap-0.5">
          {TIME_PRESETS.map((t) => (
            <button
              key={t.label}
              onClick={() => setTimeFilter(t.minutes)}
              className={`font-mono text-[0.65rem] rounded px-2 border transition-colors ${timeFilter === t.minutes ? 'border-ac bg-ac/15 text-ac' : 'border-tx3/10 bg-s2 text-tx3 hover:text-ac'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <UnifiedGraph sensorKinds={sensorKinds} allData={allData} timeFilter={timeFilter} />
    </div>
  )
}

export function DashboardView() {
   return (
<div
          className="flex flex-col flex-1 min-h-0 px-4 overflow-y-auto pb-4"
         >
<div
           className="mb-3 mt-2 text-2xl md:text-[3.2rem] leading-none font-bold uppercase text-tx font-poppins font-extrabold"
         >
          Welcome to AN·<span className="text-ac">Nexus</span>
        </div>

<div
           className="grid grid-cols-2 md:grid-cols-4 grid-rows-2 gap-3 flex-1 min-h-0"
         >
          {[
            { card: <SensorCard />, span: 'col-span-2 row-span-1' },
            { card: <MapCard />, span: 'col-span-1 row-span-1' },
            { card: <LogsCard />, span: 'col-span-1 row-span-1' },
            { card: <CameraCard />, span: 'col-span-1 row-span-1' },
            { card: <AlertsCard />, span: 'col-span-1 row-span-1' },
            { card: <MessagesCard />, span: 'col-span-1 row-span-1' },
            { card: <ConnectionCard />, span: 'col-span-1 row-span-1' },
          ].map((item, i) => (
            <div
              key={i}
              className={`${item.span} rounded-xl border border-tx3/10 bg-s1 p-2 overflow-hidden`}
            >
            {item.card}
          </div>
        ))}
      </div>
    </div>
  )
}
