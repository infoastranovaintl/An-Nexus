import { useNexusStore } from '../../store/nexus'
import { handleBleMessage } from './parser'
import { markBaseOnline } from './baseStatus'

const DEFAULT_WS_URL = 'ws://localhost:8080'
const RECONNECT_DELAYS = [1000, 2000, 5000, 10_000, 20_000, 30_000]

let ws: WebSocket | null = null
let wsConnected = false
let manualClose = false
let retryTimer: number | undefined
let retryIndex = 0

export const isWsConnected = () => wsConnected

export function wsUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined
  return fromEnv || DEFAULT_WS_URL
}

export function connectWs() {
  if (manualClose) return
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  const url = wsUrl()
  const store = useNexusStore.getState()
  store.addLog(`WS connecting… ${url}`, 'WS')
  let socket: WebSocket
  try {
    socket = new WebSocket(url)
  } catch (e) {
    store.addLog(`WS connect failed: ${(e as Error).message}`, 'ERR')
    scheduleReconnect()
    return
  }
  ws = socket

  socket.onopen = () => {
    if (ws !== socket) return
    wsConnected = true
    retryIndex = 0
    const s = useNexusStore.getState()
    s.setWs({ wsConnected: true })
    s.addLog(`WS connected: ${url}`, 'OK')
    markBaseOnline('ws', true)
    setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('LIST')
    }, 800)
  }

  socket.onmessage = (e: MessageEvent) => {
    const text = typeof e.data === 'string' ? e.data : ''
    if (!text) return
    const s = useNexusStore.getState()
    s.addRaw(`WS: ${text}`)
    s.bumpPkts()
    handleBleMessage(text)
  }

  socket.onerror = () => {
    if (ws === socket) useNexusStore.getState().addLog('WS error', 'ERR')
  }

  socket.onclose = () => {
    if (ws !== socket) return
    ws = null
    if (wsConnected) {
      wsConnected = false
      const s = useNexusStore.getState()
      s.setWs({ wsConnected: false })
      s.addLog('WS disconnected', 'ERR')
      markBaseOnline('ws', false)
    }
    scheduleReconnect()
  }
}

export function disconnectWs() {
  manualClose = true
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer)
    retryTimer = undefined
  }
  retryIndex = 0
  const socket = ws
  ws = null
  if (socket) {
    try {
      socket.close()
    } catch {
      /* ignore */
    }
  }
  if (wsConnected) {
    wsConnected = false
    const s = useNexusStore.getState()
    s.setWs({ wsConnected: false })
    markBaseOnline('ws', false)
  }
}

function scheduleReconnect() {
  if (manualClose || retryTimer !== undefined) return
  const delay = RECONNECT_DELAYS[Math.min(retryIndex, RECONNECT_DELAYS.length - 1)]
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined
    retryIndex += 1
    connectWs()
  }, delay)
}