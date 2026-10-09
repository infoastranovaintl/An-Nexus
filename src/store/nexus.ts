import { create } from 'zustand'
import { persist, createJSONStorage, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { MASTER_MAC, macFmt, pad } from '../lib/utils'
import { appendPoints } from '../lib/history'
import type { SensorSample, WaterReading } from '../lib/nexus/sensors'

export type SensorPoint = { ts: number; v: number; unit: string }

/* Sensor timestamps live in *seconds* everywhere. Older sessions (or imported
   files) may contain millisecond values (~1.7e12) — collapse those once at the
   boundary so charts and "… ago" labels always see consistent epoch-seconds. */
export function normTs(ts: number): number {
  return Number.isFinite(ts) && ts > 1e11 ? ts / 1000 : ts
}

/* a node is considered "silent" (soft-offline) only after this long without any
   inbound frame. Kept comfortably above the 5s auto-poll interval so a node that
   responds slower than one poll is not wrongly flagged offline during a fetch. */
export const STALE_MS = 15_000

/* a node is "online" only if heard from within this (tighter) window — used for UI
   freshness shading, but never alone to flip a node to offline. */
export const ONLINE_WINDOW_MS = 10_000

/* default ultrasonic tank depth (cm) used to derive water level = depth − distance */
export const DEFAULT_TANK_DEPTH = 0

export interface NexNode {
  mac: string
  id: number
  name: string
  paired: boolean
  online: boolean
  rssi: number
  parent: string | null
  ssid: string
  lastData: string
  lastSeen: number | null
  isMaster: boolean
  macFmt: string
  /** Reference tank/sensor depth (cm) used to derive water level = depth − distance. */
  tankDepth: number
  /** When the node last genuinely reported (data/pong/hello) — independent of requested poll. */
  lastOnline: number | null
  /** Why the node is marked offline: 'silent' (soft timeout) or 'reported' (base OFFLINE). */
  offlineReason: 'silent' | 'reported' | null
}

export interface Wire {
  from: string
  to: string
  rssi: number
}

export interface ConvMsg {
  msgId: string | number
  dir: 'IN' | 'OUT'
  ts: number
  priority: number
  text: string
  status: string
}

export interface ConvMeta {
  unread: number
  emergency: boolean
  status: 'open' | 'resolved'
  flagged: boolean
  lastMsg: string
  lastTs: number
  firstSeen: number
  movement: { node: number; ts: number }[]
}

export interface LogEntry {
  id: number
  ts: string
  src: string
  msg: string
}

export type ConvFilter = 'all' | 'unread' | 'emergency' | 'open' | 'resolved' | 'flagged'

export interface EmergencyState {
  nodeId: number
  text: string
  lat: number
  lon: number
}

export interface AlertEntry {
  id: string
  severity: 'critical' | 'warning' | 'info'
  label: string
  message: string
  sensorKind: string
  ts: number
  active: boolean
}

export interface IslandNotification {
  id: string
  title: string
  message?: string
  details?: string
  type: 'info' | 'warning' | 'critical'
  ts: number
  read: boolean
  nodeId?: number
  category?: string
  source?: string
}

interface NexusState {
  /* BLE / WS transports */
  bleConnected: boolean
  bleDeviceName: string
  bleScanning: boolean
  bleDevices: { deviceId: string; deviceName: string }[]
  bleDialogOpen: boolean
  wsConnected: boolean
  totalPkts: number
  refreshTick: number

  /* nodes / topology */
  nodes: Record<string, NexNode>
  wires: Wire[]
  selectedMac: string | null
  wireMode: boolean
  forgottenMacs: string[]

  /* sensor readings */
  waterLevels: Record<string, WaterReading>
  waterHistory: Record<string, { ts: number; v: number; unit: WaterReading['unit'] }[]>
  sensorReadings: Record<string, SensorSample[]>
  sensorHistory: Record<string, Record<string, SensorPoint[]>>

  /* drawer */
  logs: LogEntry[]
  rawLogs: string[]

  /* messaging */
  conversations: Record<number, ConvMsg[]>
  convMeta: Record<number, ConvMeta>
  activeConvNode: number | null
  convFilter: ConvFilter
  convSearch: string
  convSort: string
  unreadTotal: number

  /* emergency */
  emergency: EmergencyState | null

  /* alerts & notifications */
  alerts: AlertEntry[]
  islandNotifications: IslandNotification[]
  addIslandNotification: (n: Omit<IslandNotification, 'ts'>) => void
  dismissIslandNotification: (id: string) => void
  clearIslandNotifications: () => void
  markAllAsRead: () => void

  /* actions */
  setBle: (p: Partial<Pick<NexusState, 'bleConnected' | 'bleDeviceName' | 'bleScanning' | 'bleDevices'>>) => void
  setBleDialog: (open: boolean) => void
  setWs: (p: Partial<Pick<NexusState, 'wsConnected'>>) => void
  bumpPkts: () => void
  bumpRefresh: () => void

  ensureNode: (mac: string, props: Partial<NexusNodeProps>) => void
  updateNode: (mac: string, props: Partial<NexusNodeProps>) => void
  /** Mark a node as alive because it just reported (frame / ack received). */
  touchLive: (mac: string) => void
  setTankDepth: (mac: string, depth: number) => void
  selectNode: (mac: string | null) => void
  setWireMode: (on: boolean) => void
  sweepNodes: () => void

  pushWater: (mac: string, reading: WaterReading) => void
  pushSensors: (mac: string, readings: SensorSample[]) => void

  addWire: (from: string, to: string, rssi: number) => void
  removeWire: (mac: string) => void
  clearWires: () => void
  removeNode: (mac: string) => void
  resetNodes: () => void

  addLog: (msg: string, src?: string) => void
  clearLog: () => void
  addRaw: (msg: string) => void
  clearRaw: () => void
  addAlert: (msg: string, type?: 'fire' | 'sound' | 'info') => void

  storeConvMsg: (nodeId: number, entry: ConvMsg) => boolean
  touchConv: (
    nodeId: number,
    fields: Partial<Pick<ConvMeta, 'lastMsg' | 'lastTs' | 'emergency'>>,
    reopen?: boolean,
  ) => void
  bumpUnread: (nodeId: number) => void
  setActiveConv: (nodeId: number | null) => void
  setConvFilter: (f: ConvFilter) => void
  setConvSearch: (q: string) => void
  setConvSort: (s: string) => void
  toggleConvResolved: (nodeId: number) => void
  toggleConvFlag: (nodeId: number) => void
  acknowledgeEmergency: (nodeId: number) => void
  setEmergency: (e: EmergencyState | null) => void
  setAlerts: (alerts: AlertEntry[]) => void
  clearAlerts: () => void

  /* bulk restore (imports / settings) */
  importMesh: (
    data: Partial<
      Pick<
        NexusState,
        | 'nodes'
        | 'wires'
        | 'waterLevels'
        | 'waterHistory'
        | 'sensorReadings'
        | 'sensorHistory'
        | 'conversations'
        | 'convMeta'
        | 'logs'
        | 'rawLogs'
      >
    >,
  ) => void
}

export interface NexusNodeProps {
  id: number
  name: string
  paired: boolean
  online: boolean
  rssi: number
  parent: string | null
  ssid: string
  lastData: string
  lastSeen: number
  isMaster: boolean
  tankDepth: number
  lastOnline: number
  offlineReason: 'silent' | 'reported' | null
}

let logSeq = 0

export const useNexusStore = create<NexusState>()(
  persist<NexusState, [], [], PersistedMesh>(
    (set) => ({
      bleConnected: false,
      bleDeviceName: '',
      bleScanning: false,
      bleDevices: [],
      bleDialogOpen: false,
      wsConnected: false,
      totalPkts: 0,
      refreshTick: 0,

      nodes: {},
      wires: [],
      selectedMac: null,
      wireMode: false,
      forgottenMacs: [],

      waterLevels: {},
      waterHistory: {},
      sensorReadings: {},
      sensorHistory: {},

      logs: [],
      rawLogs: [],

      conversations: {},
      convMeta: {},
      activeConvNode: null,
      convFilter: 'all',
      convSearch: '',
      convSort: 'newest',
      unreadTotal: 0,

      emergency: null,
      alerts: [],
      islandNotifications: [],

      setBle: (p) => set(p),
      setBleDialog: (open) => set({ bleDialogOpen: open }),
      setWs: (p) => set(p),
      bumpPkts: () => set((s) => ({ totalPkts: s.totalPkts + 1 })),
      bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

      ensureNode: (mac, props) =>
        set((s) => {
          if (s.forgottenMacs.includes(mac)) return s
          const nodes = { ...s.nodes }
          const existing = nodes[mac]
          if (!existing) {
            nodes[mac] = {
              mac,
              id: 0,
              name: '',
              paired: false,
              online: false,
              rssi: 0,
              parent: null,
              ssid: '',
              lastData: '',
              lastSeen: null,
              isMaster: false,
              macFmt: mac === MASTER_MAC ? 'BASE' : macFmt(mac),
              tankDepth: DEFAULT_TANK_DEPTH,
              lastOnline: null,
              offlineReason: null,
              ...props,
            } as NexNode
          } else {
            nodes[mac] = { ...existing, ...props }
          }
          const n = nodes[mac]
          if (!n.name) n.name = n.isMaster || mac === MASTER_MAC ? 'BASE' : 'NODE-' + n.id
          return { nodes }
        }),

      updateNode: (mac, props) =>
        set((s) => {
          if (!s.nodes[mac]) return s
          return { nodes: { ...s.nodes, [mac]: { ...s.nodes[mac], ...props } } }
        }),

      touchLive: (mac) =>
        set((s) => {
          if (!s.nodes[mac]) return s
          const now = Date.now()
          return {
            nodes: {
              ...s.nodes,
              [mac]: { ...s.nodes[mac], lastSeen: now, lastOnline: now, offlineReason: null },
            },
          }
        }),

      setTankDepth: (mac, depth) =>
        set((s) => {
          if (!s.nodes[mac]) return s
          const nodes = { ...s.nodes, [mac]: { ...s.nodes[mac], tankDepth: depth } }
          const feed = s.sensorReadings[mac] || []
          const dist = feed.find((r) => r.kind === 'distance')
          if (!dist || depth <= 0) return { nodes }
          const level = Math.max(0, depth - dist.value)
          const sensorReadings = {
            ...s.sensorReadings,
            [mac]: feed.map((r) => (r.kind === 'water' ? { ...r, value: level } : r)),
          }
          const waterLevels = { ...s.waterLevels, [mac]: { v: level, unit: 'cm' as const, ts: dist.ts } }
          return { nodes, sensorReadings, waterLevels }
        }),

      selectNode: (mac) => set({ selectedMac: mac, wireMode: false }),
      setWireMode: (on) => set({ wireMode: on }),

      sweepNodes: () =>
        set((s) => {
          const now = Date.now()
          const off: Record<string, NexNode> = {}
          for (const [mac, n] of Object.entries(s.nodes)) {
            if (n.isMaster || mac === MASTER_MAC) continue
            /* authoritative liveness = last genuine inbound report. A node that
               acknowledged or sent data recently stays online even while a
               slower multi-hop fetch is still in flight. */
            const stale = n.lastOnline == null || now - n.lastOnline > STALE_MS
            if (stale && n.online) off[mac] = { ...n, online: false, offlineReason: 'silent' }
          }
          return Object.keys(off).length > 0 ? { nodes: { ...s.nodes, ...off } } : s
        }),

      pushWater: (mac, reading) =>
        set((s) => {
          const r = { ...reading, ts: normTs(reading.ts) }
          const waterLevels = { ...s.waterLevels, [mac]: r }
          const prev = s.waterHistory[mac] || []
          const waterHistory = {
            ...s.waterHistory,
            [mac]: [...prev, { ts: r.ts, v: r.v, unit: r.unit }].slice(-120),
          }
          appendPoints([{ mac, kind: 'water', ts: r.ts, v: r.v, unit: r.unit }])
          return { waterLevels, waterHistory }
        }),

      pushSensors: (mac, readings) =>
        set((s) => {
          const depth = s.nodes[mac]?.tankDepth
          const normFeed = readings.map((r) => ({ ...r, ts: normTs(r.ts) }))
          let feed = normFeed as SensorSample[]
          const dist = normFeed.find((r) => r.kind === 'distance')
          if (depth != null && depth > 0 && dist) {
            const level = Math.max(0, depth - dist.value)
            feed = [
              ...normFeed,
              { key: 'Water level', kind: 'water', value: level, unit: 'cm', ts: dist.ts },
            ]
          }
          const waterSample = feed.find((r) => r.kind === 'water')
          const sensorReadings = { ...s.sensorReadings, [mac]: feed }
          const waterLevels = waterSample
            ? {
                ...s.waterLevels,
                [mac]: {
                  v: waterSample.value,
                  unit: (waterSample.unit === '%' ? '%' : 'm') as WaterReading['unit'],
                  ts: waterSample.ts,
                },
              }
            : s.waterLevels
          const history = { ...s.sensorHistory }
          const prevForMac = history[mac] || {}
          const nextForMac: Record<string, SensorPoint[]> = {}
          for (const r of feed) {
            const prev = prevForMac[r.key] || []
            nextForMac[r.key] = [...prev, { ts: r.ts, v: r.value, unit: r.unit }].slice(-120)
          }
          history[mac] = nextForMac
          appendPoints(
            feed.map((r) => ({ mac, kind: r.key, ts: r.ts, v: r.value, unit: r.unit })),
          )
          return { sensorReadings, sensorHistory: history, waterLevels }
        }),

      addWire: (from, to, rssi) =>
        set((s) => {
          const wires = s.wires.filter((w) => w.from !== from)
          wires.push({ from, to, rssi })
          return { wires }
        }),
      clearWires: () => set({ wires: [] }),
      removeWire: (mac) =>
        set((s) => ({
          wires: s.wires.filter((w) => w.from !== mac && w.to !== mac),
        })),
      removeNode: (mac) =>
        set((s) => {
          const nodes = { ...s.nodes }
          delete nodes[mac]
          const wires = s.wires.filter((w) => w.from !== mac && w.to !== mac)
          const sensorReadings = { ...s.sensorReadings }
          delete sensorReadings[mac]
          const sensorHistory = { ...s.sensorHistory }
          delete sensorHistory[mac]
          const waterLevels = { ...s.waterLevels }
          delete waterLevels[mac]
          const waterHistory = { ...s.waterHistory }
          delete waterHistory[mac]
          const selectedMac = s.selectedMac === mac ? null : s.selectedMac
          const forgottenMacs = s.forgottenMacs.includes(mac) ? s.forgottenMacs : [...s.forgottenMacs, mac]
          return {
            nodes,
            wires,
            sensorReadings,
            sensorHistory,
            waterLevels,
            waterHistory,
            selectedMac,
            forgottenMacs,
          }
        }),

      resetNodes: () =>
        set((s) => ({
          nodes: {},
          wires: [],
          sensorReadings: {},
          sensorHistory: {},
          waterLevels: {},
          waterHistory: {},
          selectedMac: null,
          forgottenMacs: [],
          refreshTick: s.refreshTick + 1,
        })),

      addLog: (msg, src = 'SYS') =>
        set((s) => {
          const now = new Date()
          const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
          const logs = [...s.logs, { id: ++logSeq, ts, src, msg }].slice(-120)
          return { logs }
        }),
      clearLog: () => set({ logs: [] }),
      addRaw: (msg) =>
        set((s) => {
          const rawLogs = [...s.rawLogs, msg].slice(-80)
          return { rawLogs }
        }),
      clearRaw: () => set({ rawLogs: [] }),
      addAlert: (msg, type = 'info') => {
        // Map legacy 'fire' severity to 'critical' for island notifications
        const islandType = type === 'fire' ? 'critical' : type;
        const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
        useNexusStore.getState().addIslandNotification({ id, title: msg, type: islandType as any, read: false, category: 'alert', source: 'alerts' });
        return {};
      },

      storeConvMsg: (nodeId, entry) => {
        let merged = false
        set((s) => {
          const conv = [...(s.conversations[nodeId] || [])]
          const existing = conv.find((m) => String(m.msgId) === String(entry.msgId) && m.dir === entry.dir && Math.abs(m.ts - entry.ts) < 2)
          if (existing) {
            merged = true
            return { conversations: { ...s.conversations, [nodeId]: conv } }
          }
          conv.push(entry)
          const convCapped = conv.length > 200 ? conv.slice(-200) : conv
          return { conversations: { ...s.conversations, [nodeId]: convCapped } }
        })
        return merged
      },

      touchConv: (nodeId, fields, reopen = true) =>
        set((s) => {
          const m = ensureConvMeta(s.convMeta[nodeId], nodeId)
          if (fields.lastMsg !== undefined) m.lastMsg = fields.lastMsg
          if (fields.lastTs !== undefined) m.lastTs = fields.lastTs
          if (fields.emergency) m.emergency = true
          if (reopen && m.status === 'resolved') m.status = 'open'
          const lastMove = m.movement[m.movement.length - 1]
          if (!lastMove || lastMove.node !== nodeId) {
            m.movement.push({ node: nodeId, ts: fields.lastTs || Date.now() / 1000 })
          }
          return { convMeta: { ...s.convMeta, [nodeId]: m } }
        }),

      bumpUnread: (nodeId) =>
        set((s) => {
          const m = ensureConvMeta(s.convMeta[nodeId], nodeId)
          if (s.activeConvNode !== nodeId) {
            m.unread = (m.unread || 0) + 1
          }
          const unreadTotal = Object.values(s.convMeta).reduce((sum, x) => sum + (x.unread || 0), 0)
          return { convMeta: { ...s.convMeta, [nodeId]: m }, unreadTotal }
        }),

      setActiveConv: (nodeId) =>
        set((s) => {
          let convMeta = { ...s.convMeta }
          if (nodeId != null) {
            const m = ensureConvMeta(convMeta[nodeId], nodeId)
            m.unread = 0
            convMeta = { ...convMeta, [nodeId]: m }
          }
          const unreadTotal = Object.values(convMeta).reduce((sum, x) => sum + (x.unread || 0), 0)
          return { activeConvNode: nodeId, convMeta, unreadTotal }
        }),

      setConvFilter: (convFilter) => set({ convFilter }),
      setConvSearch: (convSearch) => set({ convSearch }),
      setConvSort: (convSort) => set({ convSort }),
      toggleConvResolved: (nodeId) =>
        set((s) => {
          const convMeta = { ...s.convMeta }
          const m = ensureConvMeta(convMeta[nodeId], nodeId)
          m.status = m.status === 'resolved' ? 'open' : 'resolved'
          return { convMeta: { ...convMeta, [nodeId]: m } }
        }),
      toggleConvFlag: (nodeId) =>
        set((s) => {
          const convMeta = { ...s.convMeta }
          const m = ensureConvMeta(convMeta[nodeId], nodeId)
          m.flagged = !m.flagged
          return { convMeta: { ...convMeta, [nodeId]: m } }
        }),
      acknowledgeEmergency: (nodeId) =>
        set((s) => {
          const convMeta = { ...s.convMeta }
          const m = ensureConvMeta(convMeta[nodeId], nodeId)
          m.emergency = false
          return { convMeta: { ...convMeta, [nodeId]: m } }
        }),
      setEmergency: (emergency) => set({ emergency }),
      setAlerts: (alerts) => set({ alerts }),
      clearAlerts: () => set({ alerts: [] }),
      addIslandNotification: (n) =>
        set((s) => ({
          islandNotifications: [...s.islandNotifications, { ...n, ts: Date.now() }],
        })),
      dismissIslandNotification: (id) =>
        set((s) => ({
          islandNotifications: s.islandNotifications.filter((x) => x.id !== id),
        })),
      clearIslandNotifications: () => set({ islandNotifications: [] }),
      markAllAsRead: () =>
        set((s) => ({
          islandNotifications: s.islandNotifications.map((n) => ({ ...n, read: true })),
        })),

      importMesh: (data) => {
        const normWaterLevels = (w?: Record<string, WaterReading>) =>
          w
            ? Object.fromEntries(Object.entries(w).map(([mac, lv]) => [mac, { ...lv, ts: normTs(lv.ts) }]))
            : undefined
        const normWaterHistory = (h?: Record<string, { ts: number; v: number; unit: WaterReading['unit'] }[]>) =>
          h
            ? Object.fromEntries(
                Object.entries(h).map(([mac, pts]) => [mac, pts.map((p) => ({ ...p, ts: normTs(p.ts) }))]),
              )
            : undefined
        const normSensorHistory = (h?: Record<string, Record<string, SensorPoint[]>>) =>
          h
            ? Object.fromEntries(
                Object.entries(h).map(([mac, byKey]) => [
                  mac,
                  Object.fromEntries(Object.entries(byKey).map(([k, pts]) => [k, pts.map((p) => ({ ...p, ts: normTs(p.ts) }))])),
                ]),
              )
            : undefined
        const normReadings = (r?: Record<string, SensorSample[]>) =>
          r
            ? Object.fromEntries(
                Object.entries(r).map(([mac, samples]) => [mac, samples.map((s2) => ({ ...s2, ts: normTs(s2.ts) }))]),
              )
            : undefined

        set((s) => ({
          nodes: data.nodes ?? s.nodes,
          wires: data.wires ?? s.wires,
          waterLevels: normWaterLevels(data.waterLevels) ?? s.waterLevels,
          waterHistory: normWaterHistory(data.waterHistory) ?? s.waterHistory,
          sensorReadings: normReadings(data.sensorReadings) ?? s.sensorReadings,
          sensorHistory: normSensorHistory(data.sensorHistory) ?? s.sensorHistory,
          conversations: data.conversations ?? s.conversations,
          convMeta: data.convMeta ?? s.convMeta,
          logs: data.logs ?? s.logs,
          rawLogs: data.rawLogs ?? s.rawLogs,
        }))
        if (data.logs?.length) logSeq = Math.max(logSeq, ...data.logs.map((l) => l.id))
      },
    }),
    {
      name: 'an-nexus-mesh-v1',
      storage: throttledPersist<PersistedMesh>(createJSONStorage<PersistedMesh>(() => localStorage)),
      /* old sessions + imported archives can carry ms timestamps — normalize
         them to seconds as state comes back in so charts and "… ago" stay sane */
      merge: (persisted, current) => {
        const p = persisted as Partial<NexusState> | null
        const normWaterLevels = (w?: Record<string, WaterReading>) =>
          w
            ? Object.fromEntries(Object.entries(w).map(([mac, lv]) => [mac, { ...lv, ts: normTs(lv.ts) }]))
            : undefined
        const normWaterHistory = (h?: Record<string, { ts: number; v: number; unit: WaterReading['unit'] }[]>) =>
          h
            ? Object.fromEntries(
                Object.entries(h).map(([mac, pts]) => [mac, pts.map((pt) => ({ ...pt, ts: normTs(pt.ts) }))]),
              )
            : undefined
        const normSensorHistory = (h?: Record<string, Record<string, SensorPoint[]>>) =>
          h
            ? Object.fromEntries(
                Object.entries(h).map(([mac, byKey]) => [
                  mac,
                  Object.fromEntries(
                    Object.entries(byKey).map(([k, pts]) => [k, pts.map((pt) => ({ ...pt, ts: normTs(pt.ts) }))]),
                  ),
                ]),
              )
            : undefined
        const normReadings = (r?: Record<string, SensorSample[]>) =>
          r
            ? Object.fromEntries(
                Object.entries(r).map(([mac, samples]) => [mac, samples.map((s2) => ({ ...s2, ts: normTs(s2.ts) }))]),
              )
            : undefined
        return {
          ...current,
          ...p,
          waterLevels: normWaterLevels(p?.waterLevels) ?? current.waterLevels,
          waterHistory: normWaterHistory(p?.waterHistory) ?? current.waterHistory,
          sensorReadings: normReadings(p?.sensorReadings) ?? current.sensorReadings,
          sensorHistory: normSensorHistory(p?.sensorHistory) ?? current.sensorHistory,
        }
      },
      partialize: (s) => ({
        nodes: s.nodes,
        wires: s.wires,
        forgottenMacs: s.forgottenMacs,
        waterLevels: s.waterLevels,
        waterHistory: Object.fromEntries(Object.entries(s.waterHistory).map(([mac, pts]) => [mac, thin(pts, 40)])),
        sensorHistory: Object.fromEntries(
          Object.entries(s.sensorHistory).map(([mac, byKey]) => [
            mac,
            Object.fromEntries(Object.entries(byKey).map(([k, pts]) => [k, thin(pts, 40)])),
          ]),
        ),
      }),
    },
  ),
)

export function ensureConvMeta(m: ConvMeta | undefined, nodeId: number): ConvMeta {
  if (!m) {
    return {
      unread: 0,
      emergency: false,
      status: 'open',
      flagged: false,
      lastMsg: '',
      lastTs: Date.now() / 1000,
      firstSeen: Date.now() / 1000,
      movement: [{ node: nodeId, ts: Date.now() / 1000 }],
    }
  }
  return m
}

/* Downsample a series to at most `max` evenly spaced points (keeps the tail). */
function thin<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const step = Math.ceil(arr.length / max)
  return arr.filter((_, i) => i % step === 0).slice(-max)
}

export interface PersistedMesh {
  nodes: Record<string, NexNode>
  wires: Wire[]
  forgottenMacs: string[]
  waterLevels: Record<string, WaterReading>
  waterHistory: Record<string, { ts: number; v: number; unit: WaterReading['unit'] }[]>
  sensorHistory: Record<string, Record<string, SensorPoint[]>>
}

/* Debounce persisted writes so telemetry bursts coalesce into one localStorage write. */
function throttledPersist<S>(storage: PersistStorage<S> | undefined, ms = 1000): PersistStorage<S> | undefined {
  if (!storage) return storage
  let timer: number | undefined
  let pendingName: string | null = null
  let pendingValue: StorageValue<S> | null = null
  const flush = () => {
    if (pendingName !== null && pendingValue !== null) {
      storage.setItem(pendingName, pendingValue)
      pendingName = null
      pendingValue = null
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
  }
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      pendingName = name
      pendingValue = value
      if (timer !== undefined) return
      timer = window.setTimeout(() => {
        timer = undefined
        flush()
      }, ms)
    },
    removeItem: (name) => storage.removeItem(name),
  }
}
