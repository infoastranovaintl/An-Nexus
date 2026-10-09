import { useNexusStore, type ConvMsg } from '../../store/nexus'
import { ensureNodeWithPos } from './nodes'
import { parseSensorPayload, parseWaterPayload } from './sensors'
import { macFmt } from '../utils'
import { notifyNewMessage } from '../notify'

/**
 * Registered by the BLE module so the parser never needs to import it
 * (avoids a circular dependency).
 */
export let bleSend: (cmd: string) => Promise<boolean> = async () => false
export function registerBleSender(fn: (cmd: string) => Promise<boolean>) {
  bleSend = fn
}

/**
 * A MAC may be sent colon-formatted (`90:64:9B:...`) or as a bare hex string.
 * `:` also separates fields, so join leading segments until the first
 * `key=value` field appears.
 */
function collectMac(segments: string[], start = 1): { mac: string; rest: string[] } {
  let end = start
  while (end < segments.length && !segments[end].includes('=')) end += 1
  return { mac: segments.slice(start, end).join(':'), rest: segments.slice(end) }
}

/**
 * Ported verbatim from the AN-Nexus v6 parser. Handles every protocol line
 * the base station can emit over BLE.
 */
export function handleBleMessage(msg: string) {
  const store = useNexusStore.getState()

  if (msg.startsWith('HELLO:')) {
    const p = msg.split(':')
    const { mac, rest } = collectMac(p)
    const fields: Record<string, string> = {}
    for (const seg of rest) {
      const eq = seg.indexOf('=')
      if (eq > 0) fields[seg.slice(0, eq).toLowerCase()] = seg.slice(eq + 1)
    }
    const rssi = parseInt(fields['rssi'] || '0', 10) || 0
    const id = parseInt(fields['id'] || '0', 10) || 0
    const ssid = fields['ssid'] || ''
    ensureNodeWithPos(mac, { id, rssi, online: true, ssid })
    store.updateNode(mac, { lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
    store.addLog(`Node discovered: ${macFmt(mac)} rssi=${rssi}${ssid ? ' ssid=' + ssid : ''}`, 'NOW')
    return
  }

  if (msg.startsWith('PAIRED:')) {
    const p = msg.split(':')
    const { mac, rest } = collectMac(p)
    const idSeg = rest.find((s) => /^id=/i.test(s)) || rest[0] || 'id=0'
    const id = parseInt(idSeg.split('=')[1]) || 0
    ensureNodeWithPos(mac, { id, paired: true, online: true })
    store.updateNode(mac, { lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
    store.addLog(`Node PAIRED: ${macFmt(mac)} id=${id}`, 'OK')
    return
  }

  if (msg.startsWith('DATA:')) {
    const p = msg.split(':')
    const { mac, rest } = collectMac(p)
    const idSeg = rest.find((s) => /^id=/i.test(s)) || rest[0] || 'id=0'
    const id = parseInt(idSeg.split('=')[1]) || 0
    /* payload starts at the first payload=/sensor= segment; otherwise keep the whole field list */
    const fields = rest.filter((s) => !/^id=/i.test(s))
    const pi = fields.findIndex((s) => s.startsWith('payload=') || s.startsWith('sensor='))
    const payload = (pi >= 0 ? fields.slice(pi) : fields).join(':').replace(/^payload=/, '')
    ensureNodeWithPos(mac, { id, online: true })
    store.updateNode(mac, { lastData: payload, lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
    const water = parseWaterPayload(payload)
    if (water) store.pushWater(mac, water)
    const samples = parseSensorPayload(payload)
    if (samples.length > 0) store.pushSensors(mac, samples)
    store.addLog(`DATA node-${id}: ${payload}${water ? ` · water=${water.v}${water.unit}` : ''}`, 'NOW')
    return
  }

  if (msg.startsWith('RELAY_DATA:')) {
    const p = msg.split(':')
    const { mac: relayMac, rest } = collectMac(p)
    const viaMac = (rest[0] || '').split('=')[1] || ''
    store.updateNode(relayMac, { lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
    store.addLog(`RELAY …${macFmt(relayMac).slice(-5)} via …${macFmt(viaMac).slice(-5)}`, 'NOW')
    return
  }

  if (msg.startsWith('PONG:')) {
    const p = msg.split(':')
    const { mac, rest } = collectMac(p)
    const rssi = parseInt((rest[0] || 'rssi=0').split('=')[1]) || 0
    ensureNodeWithPos(mac, { online: true, rssi })
    store.updateNode(mac, { lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
    store.addLog(`PONG …${macFmt(mac).slice(-5)} rssi=${rssi}`, 'NOW')
    return
  }

  if (msg.startsWith('OFFLINE:')) {
    const { mac } = collectMac(msg.split(':'))
    const node = store.nodes[mac]
    if (node) {
      store.updateNode(mac, { online: false, offlineReason: 'reported' })
      const nodeName = node.name || `…${macFmt(mac).slice(-5)}`
      store.addLog(`OFFLINE ${nodeName}`, 'ERR')
      store.addAlert(`${nodeName} went offline — check power/range`, 'fire')
    }
    return
  }

  if (msg.startsWith('CMD_ACK:')) {
    const p = msg.split(':')
    /* format: CMD_ACK:<6-octet mac>:<fn> — drop the trailing fn code, then join */
    const mac = p.slice(1, 7).join(':')
    const fn = p.slice(7).join(':')
    store.addLog(`ACK …${macFmt(mac).slice(-5)}: ${fn || 'ok'}`, 'OK')
    /* an acknowledged command is proof the node is alive — keeps it from being
       swept offline while its (possibly slower) DATA frame is still in flight */
    store.touchLive(mac)
    return
  }

  if (msg.startsWith('LIST_START:')) {
    store.addLog(`Node list (${msg.split(':')[1]} nodes)`, 'BLE')
    return
  }

  if (msg.startsWith('NODE:')) {
    try {
      const j = JSON.parse(msg.substring(5))
      ensureNodeWithPos(j.mac, {
        id: j.id,
        ...(typeof j.paired === 'boolean' ? { paired: j.paired } : {}),
        ...(typeof j.online === 'boolean' ? { online: j.online } : {}),
        rssi: j.rssi,
        parent: j.parent !== '000000000000' ? j.parent : null,
        ssid: j.ssid || '',
      })
      store.updateNode(j.mac, { lastSeen: Date.now(), lastOnline: Date.now(), offlineReason: null })
      if (j.unread > 0) {
        store.touchConv(j.id, {}, false)
        useNexusStore.setState((s) => {
          const convMeta = { ...s.convMeta }
          const m = convMeta[j.id]
          if (m) m.unread = j.unread
          const unreadTotal = Object.values(convMeta).reduce((sum, x) => sum + (x.unread || 0), 0)
          return { convMeta, unreadTotal }
        })
      }
    } catch {
      /* ignore malformed */
    }
    return
  }

  if (msg === 'LIST_END') {
    store.addLog('Node list complete', 'OK')
    return
  }

  if (msg.startsWith('STATUS:')) {
    try {
      const j = JSON.parse(msg.substring(7))
      store.addLog(`Base: ${j.nodes} nodes, ${j.msgs} msgs, uptime ${j.uptime}s`, 'BLE')
    } catch {
      store.addLog(msg, 'BLE')
    }
    return
  }

  if (msg === 'MASTER_READY') {
    store.addLog('Base station ready', 'OK')
    return
  }

  /* ── v2.0: Incoming user message ──
     MSG:<msgId>:<fromId>:<toId>:<priority>:<text> */
  if (msg.startsWith('MSG:')) {
    const idx1 = msg.indexOf(':')
    const idx2 = msg.indexOf(':', idx1 + 1)
    const idx3 = msg.indexOf(':', idx2 + 1)
    const idx4 = msg.indexOf(':', idx3 + 1)
    const idx5 = msg.indexOf(':', idx4 + 1)
    const msgId = msg.substring(idx1 + 1, idx2) || 'in-' + Date.now()
    const fromId = parseInt(msg.substring(idx2 + 1, idx3))
    const rawPriority = parseInt(msg.substring(idx4 + 1, idx5))
    const text = msg.substring(idx5 + 1)
    if (!Number.isFinite(fromId) || fromId < 0) {
      store.addLog(msg, 'BLE')
      return
    }
    const priority = Number.isFinite(rawPriority) && rawPriority >= 0 ? Math.min(rawPriority, 3) : 0
    const senderMac = Object.values(store.nodes).find((n) => n.id === fromId)?.mac
    if (senderMac) store.touchLive(senderMac)
    const wasMerged = store.storeConvMsg(fromId, {
      msgId,
      dir: 'IN',
      ts: Date.now() / 1000,
      priority,
      text,
      status: 'delivered',
    })
    if (wasMerged) return
    store.touchConv(fromId, { lastMsg: text, lastTs: Date.now() / 1000, emergency: priority === 3 })
    store.bumpUnread(fromId)
    const priLabel = ['Low', 'Normal', 'High', 'EMERGENCY'][priority] || ''
    store.addLog(
      `MSG from Node-${fromId}: ${text.substring(0, 40)}${text.length > 40 ? '…' : ''}${priLabel ? ' [' + priLabel + ']' : ''}`,
      'NOW',
    )
    store.addAlert(`Node-${fromId}: ${text.substring(0, 30)}…`, priority === 3 ? 'fire' : 'info')
    notifyNewMessage(fromId, text, priority)
    return
  }

  /* ── v2.0: Message ACK ──
     MSG_ACK:<msgId>:<nodeId>   OR   MSG_SENT:<msgId>:to=<id> */
  if (msg.startsWith('MSG_ACK:') || msg.startsWith('MSG_SENT:')) {
    store.addLog(msg, 'OK')
    const p = msg.split(':')
    const msgId = p[1]
    let nodeId: number | null = null
    if (p[2] && p[2].startsWith('to=')) nodeId = parseInt(p[2].substring(3))
    else if (p[2]) nodeId = parseInt(p[2])
    if (nodeId != null && store.conversations[nodeId]) {
      const m = store.conversations[nodeId].find((x) => String(x.msgId) === String(msgId) && x.dir === 'OUT')
      if (m) {
        m.status = 'delivered'
        useNexusStore.setState((s) => ({ conversations: { ...s.conversations } }))
      }
    }
    return
  }

  /* ── v2.0: Emergency alert ──
     EMERGENCY:<nodeId>:<text>:<lat>:<lon> */
  if (msg.startsWith('EMERGENCY:')) {
    const parts = msg.split(':')
    const nodeId = parseInt(parts[1])
    if (!Number.isFinite(nodeId) || nodeId < 0) {
      store.addLog(msg, 'BLE')
      return
    }
    const lat = parts.length >= 4 ? parseFloat(parts[parts.length - 2]) : NaN
    const lon = parts.length >= 4 ? parseFloat(parts[parts.length - 1]) : NaN
    const text = parts.length >= 4 ? parts.slice(2, parts.length - 2).join(':') : parts.slice(2).join(':')
    store.storeConvMsg(nodeId, {
      msgId: Date.now(),
      dir: 'IN',
      ts: Date.now() / 1000,
      priority: 3,
      text,
      status: 'delivered',
    })
    store.touchConv(nodeId, { lastMsg: text, lastTs: Date.now() / 1000, emergency: true })
    store.bumpUnread(nodeId)
    store.setEmergency({
      nodeId,
      text,
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
    })
    store.addLog(`🆘 EMERGENCY Node-${nodeId}: ${text}`, 'ERR')
    store.addAlert(`🆘 EMERGENCY Node-${nodeId}: ${text.substring(0, 30)}`, 'fire')
    notifyNewMessage(nodeId, text, 3)
    return
  }

  /* ── v2.0: Conversation dump ── */
  if (msg.startsWith('CONV_START:')) {
    const p = msg.split(':')
    const nodeId = parseInt(p[1])
    useNexusStore.setState((s) => ({ conversations: { ...s.conversations, [nodeId]: [] } }))
    store.addLog(`Loading conversation with Node-${nodeId} (${p[2]} msgs)`, 'BLE')
    return
  }
  // CONV_MSG:<msgId>:<dir>:<ts>:<priority>:<text>
  if (msg.startsWith('CONV_MSG:')) {
    const idx1 = msg.indexOf(':')
    const idx2 = msg.indexOf(':', idx1 + 1)
    const idx3 = msg.indexOf(':', idx2 + 1)
    const idx4 = msg.indexOf(':', idx3 + 1)
    const idx5 = msg.indexOf(':', idx4 + 1)
    const msgId = msg.substring(idx1 + 1, idx2)
    const dir = msg.substring(idx2 + 1, idx3) as 'IN' | 'OUT'
    const ts = parseInt(msg.substring(idx3 + 1, idx4))
    const pri = parseInt(msg.substring(idx4 + 1, idx5))
    const text = msg.substring(idx5 + 1)
    const active = useNexusStore.getState().activeConvNode
    if (active != null) {
      const wasMerged = store.storeConvMsg(active, {
        msgId,
        dir,
        ts,
        priority: pri,
        text,
        status: 'delivered',
      })
      if (!wasMerged) store.touchConv(active, { lastMsg: text, lastTs: ts, emergency: pri === 3 }, false)
    }
    return
  }
  if (msg === 'CONV_END') {
    store.addLog('Conversation loaded', 'OK')
    return
  }

  /* ── v2.0: Search results ── */
  if (msg.startsWith('SEARCH_RESULT:')) {
    if (msg === 'SEARCH_RESULT:NONE') {
      store.addLog('Search: no results', 'SYS')
      return
    }
    const p = msg.split(':')
    const msgId = p[1]
    const fromId = p[2]
    const text = p.slice(3).join(':')
    store.addLog(`Search hit [${msgId}] Node-${fromId}: ${text.substring(0, 50)}`, 'OK')
    return
  }

  store.addLog(msg, 'BLE')
}

export const QUICK_REPLIES = [
  'Stay where you are.',
  'Help is on the way.',
  'Can you describe surroundings?',
  'Are you injured?',
  'Remain connected.',
  'Do not move.',
  'Need medical assistance?',
  'Send location description.',
]

export async function sendChatReply(nodeId: number, text: string, priority: number) {
  const store = useNexusStore.getState()
  if (nodeId == null || !text.trim()) return
  const msgId = Date.now()
  const sent = await bleSend(`SENDMSG:${nodeId}:${priority}:${text}`)
  const entry: ConvMsg = {
    msgId,
    dir: 'OUT',
    ts: Date.now() / 1000,
    priority,
    text,
    status: sent ? 'sending' : 'failed',
  }
  store.storeConvMsg(nodeId, entry)
  store.touchConv(nodeId, { lastMsg: 'You: ' + text, lastTs: Date.now() / 1000 }, false)
  if (!sent) {
    store.addLog(`MSG → Node-${nodeId} not sent — BLE disconnected`, 'ERR')
    return
  }
  store.addLog(`MSG → Node-${nodeId}: ${text.substring(0, 40)}`, 'NOW')
  setTimeout(() => {
    const m = useNexusStore.getState().conversations[nodeId]?.find((x) => x.msgId === msgId)
    if (m && m.status === 'sending') {
      m.status = 'delivered'
      useNexusStore.setState((s) => ({ conversations: { ...s.conversations } }))
    }
  }, 1500)
}

export function getConversation(nodeId: number) {
  bleSend(`GETMSGS:${nodeId}`)
}

export function searchMessages(q: string) {
  if (!q) return
  const store = useNexusStore.getState()
  bleSend(`SEARCH:${q}`)
  store.addLog(`Searching: "${q}"`, 'BLE')
}
