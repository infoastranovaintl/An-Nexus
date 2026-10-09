/*
 * AN-Nexus WS gateway simulator.
 *
 * Speaks the same BleMesh protocol the ESP32-C6 base station emits over BLE,
 * so the hydropower UI can be exercised end-to-end without firmware:
 *
 *   HELLO / PAIRED / DATA / PONG / OFFLINE / CMD_ACK
 *   LIST_START / NODE (json) / LIST_END / STATUS
 *   MSG / MSG_ACK / MSG_SENT / EMERGENCY
 *   CONV_START / CONV_MSG / CONV_END / SEARCH_RESULT
 *
 * One simulator instance is created per WebSocket client (isolated state).
 */

const NODE_SEED = [
  {
    mac: 'A1B2C3D4E5F6',
    id: 1,
    name: 'Hyd Inlet',
    ssid: 'AN-HYD-INLET',
    parent: '000000000000',
    rssi: -52,
    online: true,
    paired: true,
    payload: () => `sensor=1:v0=${f(24.8, 0.7)}:v1=${f(1013, 1.5)}:v2=${f(1395, 4)}:flow=${f(38.4, 3.2)}lpm`,
  },
  {
    mac: 'B2C3D4E5F607',
    id: 2,
    name: 'Reservoir',
    ssid: 'AN-RESERVOIR',
    parent: '000000000000',
    rssi: -61,
    online: true,
    paired: true,
    payload: () => `sensor=2:v0=${f(23, 2)}cm:water=${f(1.77, 0.02)}m:hum=${f(68, 3)}`,
  },
  {
    mac: 'C3D4E5F60718',
    id: 3,
    name: 'Hydro Gate',
    ssid: 'AN-HYD-GATE',
    parent: '000000000000',
    rssi: -47,
    online: true,
    paired: true,
    payload: () => `flow=${f(52.1, 4.5)}lpm:pressure=${f(63, 4)}psi:turb=${f(24, 3)}ntu`,
  },
  {
    mac: 'D4E5F6071829',
    id: 4,
    name: 'Weir Station',
    ssid: 'AN-WEIR',
    parent: 'A1B2C3D4E5F6',
    rssi: -74,
    online: true,
    paired: true,
    payload: () => `sensor=3:v0=${f(19.2, 0.6)}:flow=${f(27.4, 2.1)}lpm:ph=${f(6.8, 0.15)}`,
  },
  {
    mac: 'E5F60718293A',
    id: 5,
    name: 'Tailrace',
    ssid: 'AN-TAILRACE',
    parent: '000000000000',
    rssi: -88,
    online: true,
    paired: true,
    payload: () => `wind=${f(11, 4)}km/h:rain=${f(2.3, 0.8)}mm/h:batt=${f(3.92, 0.03)}v`,
  },
  {
    mac: 'F60718293A4B',
    id: 6,
    name: 'Intake Buoy',
    ssid: 'AN-BUOY',
    parent: 'D4E5F6071829',
    rssi: -69,
    online: true,
    paired: true,
    payload: () => `water=${f(1.42, 0.02)}m:temp=${f(18.6, 0.5)}:batt=${f(3.87, 0.04)}v`,
  },
  {
    mac: '0718293A4B5C',
    id: 7,
    name: 'Spare Unit',
    ssid: 'AN-SPARES',
    parent: '000000000000',
    rssi: 0,
    online: false,
    paired: false,
    payload: () => '',
  },
]

const MSG_POOL = [
  'Water level rising at the weir',
  'Gate pressure looks normal',
  'Output flow climbing — check turbine',
  'Humidity spike around the intake',
  'Vibration above threshold on gate 2',
  'Battery dropped, scheduling recharge',
  'Morning check — everything nominal',
]

const BULK_WORDS = ['inlet', 'reservoir', 'gate', 'flow', 'level', 'pressure', 'buoy', 'turbine']

function f(v, spread) {
  const out = v + (Math.random() * 2 - 1) * spread
  return Math.round(out * 100) / 100
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function colMac(bare) {
  return bare.match(/.{2}/g).join(':')
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

export function createSim({ send, log = () => {} }) {
  const nodes = NODE_SEED.map((n) => ({ ...n, rssi: n.rssi, online: n.online, paired: n.paired }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const timers = new Set()
  let step = 0
  let msgSeq = 1000
  let kick = false

  const after = (ms, fn) => {
    const t = setTimeout(() => {
      timers.delete(t)
      fn()
    }, ms)
    timers.add(t)
  }
  const every = (ms, fn) => {
    const t = setInterval(fn, ms)
    timers.add(t)
    return t
  }
  const say = (line) => {
    send(line)
  }
  const online = () => nodes.filter((n) => n.online)

  const listDump = () => {
    const pool = online()
    say(`LIST_START:${pool.length}`)
    for (const n of pool) {
      say(
        `NODE:${JSON.stringify({
          mac: n.mac,
          id: n.id,
          paired: n.paired,
          online: n.online,
          rssi: n.rssi || 0,
          parent: n.parent,
          ssid: n.ssid,
        })}`,
      )
    }
    say('LIST_END')
  }

  const statusFrame = () => {
    say(`STATUS:${JSON.stringify({ nodes: online().length, msgs: msgSeq, uptime: step * 2 })}`)
  }

  const helloFrame = (n) => {
    n.rssi = Math.max(-100, Math.min(-38, Math.round(n.rssi + (Math.random() * 12 - 6))))
    say(`HELLO:${n.mac}:rssi=${n.rssi}:paired=${n.paired ? 1 : 0}:id=${n.id}:ssid=${n.ssid}`)
  }

  const pongFrame = (n) => {
    say(`PONG:${n.mac}:rssi=${n.rssi}`)
  }

  const dataFrame = (n) => {
    n.rssi = Math.max(-100, Math.min(-38, Math.round(n.rssi + (Math.random() * 10 - 5))))
    const pld = n.payload()
    if (pld) say(`DATA:${n.mac}:id=${n.id}:${pld}`)
  }

  const inboundMsg = (n, pri) => {
    const text = pick(MSG_POOL)
    const msgId = msgSeq++ + '-' + nowSec()
    say(`MSG:${msgId}:${n.id}:0:${Math.min(3, pri)}:${text}`)
    if (pri >= 3) log(`emergency -> Node-${n.id}: ${text}`)
    return text
  }

  const conversationFrame = (n) => {
    say(`CONV_START:${n.id}:3`)
    say(`CONV_MSG:${msgSeq++}:IN:${nowSec() - 3000}:0:Station check — state of the ${pick(BULK_WORDS)} node.`)
    say(`CONV_MSG:${msgSeq++}:OUT:${nowSec() - 2600}:0:Copy, all nominal here.`)
    say(`CONV_MSG:${msgSeq++}:IN:${nowSec() - 500}:1:Dimming here, sending status flags.`)
    say('CONV_END')
  }

  const tick = () => {
    step++
    const pool = online()
    if (pool.length === 0) return
    const roll = Math.random()
    const n = pick(pool)
    if (roll < 0.62) {
      dataFrame(n)
    } else if (roll < 0.78) {
      pongFrame(n)
    } else if (roll < 0.9) {
      helloFrame(n)
    } else {
      inboundMsg(pick(pool), Math.random() < 0.85 ? (Math.random() < 0.5 ? 0 : 1) : 2)
    }
    if (!kick && step % 23 === 0) {
      kick = true
      inboundMsg(byId.get(2), 3)
      after(60_000, () => (kick = false))
    }
  }

  const cmdFrame = (n, fn) => {
    const c = colMac(n.mac)
    if (fn === '03') {
      say(`CMD_ACK:${c}:03`)
      after(300 + Math.random() * 500, () => dataFrame(n))
      return
    }
    if (fn === '04') {
      say(`CMD_ACK:${c}:04`)
      after(1800, () => helloFrame(n))
      return
    }
    say(`CMD_ACK:${c}:${fn === '01' ? 'siren_on' : fn === '02' ? 'siren_off' : fn}`)
  }

  /* ── inbound client commands (only reachable when the UI sends them) ── */
  const handle = (raw) => {
    const line = String(raw || '').trim()
    if (line === 'LIST') {
      listDump()
      after(1200, statusFrame)
      return
    }
    if (line === 'STATUS') {
      statusFrame()
      return
    }
    if (line.startsWith('PING:')) {
      const mac = line.slice(5).trim()
      const n = nodes.find((x) => x.mac === mac)
      if (n) pongFrame(n)
      return
    }
    if (line.startsWith('PAIR:')) {
      const [, mac, parent] = line.split(':')
      const n = nodes.find((x) => x.mac === mac)
      if (n) {
        n.paired = true
        n.online = true
        n.parent = parent === '000000000000' ? '000000000000' : parent
        say(`PAIRED:${mac}:id=${n.id}`)
        after(500, () => dataFrame(n))
      }
      return
    }
    if (line.startsWith('CMD:')) {
      const [, mac, fn] = line.split(':')
      const n = nodes.find((x) => x.mac === mac)
      if (n) cmdFrame(n, fn)
      return
    }
    if (line.startsWith('GETMSGS:')) {
      const id = parseInt(line.slice(8), 10)
      const n = byId.get(id)
      if (n) conversationFrame(n)
      return
    }
    if (line.startsWith('SENDMSG:')) {
      const parts = line.split(':')
      const nodeId = parseInt(parts[1], 10)
      const pri = parseInt(parts[2], 10) || 0
      const text = parts.slice(3).join(':')
      const n = byId.get(nodeId)
      if (n) {
        say(`MSG_SENT:${msgSeq++}:to=${nodeId}`)
        log(`SENDMSG -> Node-${nodeId}: ${text}`)
        after(2200, () => inboundMsg(n, pri))
      }
      return
    }
    if (line.startsWith('SEARCH:')) {
      const q = line.slice(7).trim()
      if (q) {
        say(`SEARCH_RESULT:${msgSeq++}:2:${q} — match at ${pick(BULK_WORDS)} node`)
      } else {
        say('SEARCH_RESULT:NONE')
      }
      return
    }
    log('unhandled:', line)
  }

  /* ── lifecycle ── */
  const start = () => {
    say('MASTER_READY')
    after(700, listDump)
    after(2600, statusFrame)
    every(2200, tick)
  }

  const stop = () => {
    for (const t of timers) clearTimeout(t)
    for (const t of timers) clearInterval(t)
    timers.clear()
  }

  return { handle, start, stop }
}