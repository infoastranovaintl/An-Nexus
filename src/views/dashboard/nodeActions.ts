import { useNexusStore } from '../../store/nexus'
import { bleCmd } from '../../lib/nexus/ble'
import { MASTER_MAC, shortMac } from '../../lib/utils'

export function startWireMode() {
  const store = useNexusStore.getState()
  const mac = store.selectedMac
  if (!mac || mac === MASTER_MAC) {
    store.addLog('Select a field node first', 'SYS')
    return
  }
  store.setWireMode(true)
  store.addLog(`Wire mode: select parent for ${shortMac(mac)}`, 'SYS')
}

export function pairNode(slaveMac: string, parentMac: string) {
  const store = useNexusStore.getState()
  store.addWire(slaveMac, parentMac, store.nodes[slaveMac]?.rssi || 0)
  const pm = parentMac === MASTER_MAC ? '000000000000' : parentMac
  bleCmd(`PAIR:${slaveMac}:${pm}`)
  store.updateNode(slaveMac, { parent: parentMac })
  store.addLog(`Paired ${shortMac(slaveMac)} → ${shortMac(parentMac)}`, 'OK')
  store.addAlert(`Paired ${shortMac(slaveMac)} → ${shortMac(parentMac)}`, 'info')
}

/** True when the node has a direct link to the base station. */
export function connectedToBase(mac: string): boolean {
  const wires = useNexusStore.getState().wires
  return wires.some((w) => (w.from === mac && w.to === MASTER_MAC) || (w.from === MASTER_MAC && w.to === mac))
}

/** True when the node participates in any wire/mesh link. */
export function isWired(mac: string): boolean {
  const wires = useNexusStore.getState().wires
  return wires.some((w) => w.from === mac || w.to === mac)
}

/** Wire a node directly to the base (or keep its existing mesh parent). */
export function wireToBase(mac: string) {
  const store = useNexusStore.getState()
  const node = store.nodes[mac]
  if (!node) return
  store.addWire(mac, MASTER_MAC, node.rssi || 0)
  bleCmd(`PAIR:${mac}:000000000000`)
  store.updateNode(mac, { parent: MASTER_MAC })
  store.addLog(`Wired ${node.name || shortMac(mac)} → BASE`, 'OK')
  store.addAlert(`Wired ${node.name || shortMac(mac)} to base`, 'info')
}

/** Remove all links involving a node (unwire). */
export function unwireNode(mac: string) {
  const store = useNexusStore.getState()
  const node = store.nodes[mac]
  store.removeWire(mac)
  store.updateNode(mac, { parent: null })
  bleCmd(`PAIR:${mac}:000000000000`)
  store.addLog(`Unwired ${node?.name || shortMac(mac)}`, 'SYS')
}

/** Ask the base to re-list the mesh and pull fresh DATA from every online field node. */
export async function requestAllData() {
  const store = useNexusStore.getState()
  if (!store.bleConnected) {
    store.addLog('Data request — BLE not connected', 'ERR')
    return false
  }
  store.addLog('Requesting live data…', 'BLE')
  await bleCmd('LIST')
  const online = Object.values(store.nodes).filter(
    (n) => n.online && !n.isMaster && n.mac !== MASTER_MAC,
  )
  for (const n of online) {
    await bleCmd(`CMD:${n.mac}:03`)
  }
  store.bumpRefresh()
  store.addLog(`Requested data from ${online.length} node${online.length === 1 ? '' : 's'}`, 'OK')
  return true
}

/** Send a raw CMD:<mac>:<fn> to every online field node (broadcast to all). */
export async function commandAll(fn: number, label: string) {
  const store = useNexusStore.getState()
  if (!store.bleConnected) {
    store.addLog(`${label} — BLE not connected`, 'ERR')
    return 0
  }
  const online = Object.values(store.nodes).filter(
    (n) => n.online && !n.isMaster && n.mac !== MASTER_MAC,
  )
  for (const n of online) {
    await bleCmd(`CMD:${n.mac}:${fn.toString().padStart(2, '0')}`)
  }
  store.bumpRefresh()
  store.addLog(`${label}: sent to ${online.length} node${online.length === 1 ? '' : 's'}`, 'OK')
  return online.length
}

/** Siren on / off for all online field nodes. */
export function sirenAll(on: boolean) {
  void commandAll(on ? 1 : 2, on ? 'Siren ON · all' : 'Siren OFF · all')
}

/** Reboot all online field nodes. */
export function rebootAll() {
  void commandAll(4, 'Reboot · all')
}

/** Ask one node for fresh data and report whether the sensor is actually sending anything. */
export async function checkSensorData(mac: string) {
  const store = useNexusStore.getState()
  const node = store.nodes[mac]
  if (!node) return
  if (!store.bleConnected) {
    store.addLog('Sensor check — BLE not connected', 'ERR')
    return
  }
  const before = store.sensorReadings[mac]?.length || 0
  const beforeLast = store.sensorReadings[mac]?.[store.sensorReadings[mac]!.length - 1]?.ts || 0
  const beforeLastSeen = store.nodes[mac]?.lastSeen || 0
  store.addLog(`Sensor check on ${node.name || shortMac(mac)}…`, 'BLE')
  await bleCmd(`CMD:${mac}:03`)
  await new Promise((r) => setTimeout(r, 2000))
  const after = useNexusStore.getState()
  const samples = after.sensorReadings[mac] || []
  const fresh = samples.some((s) => s.ts > beforeLast) && samples.length >= before
  const lastSeen = after.nodes[mac]?.lastSeen || 0
  const gotLive = fresh || lastSeen > beforeLastSeen

  if (samples.length === 0) {
    useNexusStore.getState().addAlert(
      `${node.name || shortMac(mac)}: no sensor data received. The sensor/unit is not sending readings.`,
      'fire',
    )
    useNexusStore.getState().addLog(`Sensor check on ${shortMac(mac)}: NO data`, 'ERR')
    return
  }
  if (gotLive) {
    const detail = samples.map((s) => `${s.key}=${s.value}${s.unit}`).join(' · ')
    useNexusStore.getState().addAlert(`${node.name || shortMac(mac)}: sensor sending data — ${detail}`, 'info')
    useNexusStore.getState().addLog(`Sensor check on ${shortMac(mac)}: LIVE · ${detail}`, 'OK')
  } else {
    useNexusStore.getState().addAlert(
      `${node.name || shortMac(mac)}: shows ${samples.length} cached reading(s) but no fresh data arrived — the sensor is probably not transmitting.`,
      'fire',
    )
    useNexusStore.getState().addLog(`Sensor check on ${shortMac(mac)}: stale (no fresh data)`, 'ERR')
  }
}

/** Send CMD:03 to every online field node so fresh sensor readings stream in. */
export async function requestLiveData() {
  const store = useNexusStore.getState()
  if (!store.bleConnected) return false
  const online = Object.values(store.nodes).filter(
    (n) => n.online && !n.isMaster && n.mac !== MASTER_MAC,
  )
  for (const n of online) {
    await bleCmd(`CMD:${n.mac}:03`)
  }
  store.bumpRefresh()
  return online.length > 0
}

let pollTimer: number | undefined
const POLL_MS = 5_000

/** Auto-poll every 5s while BLE is connected so distance/water stay live. */
export function startAutoPoll() {
  if (pollTimer !== undefined) return
  useNexusStore.getState().addLog('Auto-refresh live data every 5s — ON', 'SYS')
  pollTimer = window.setInterval(() => {
    void requestLiveData()
  }, POLL_MS)
}

export function stopAutoPoll() {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}
