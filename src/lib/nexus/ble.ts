import { useNexusStore } from '../../store/nexus'
import { handleBleMessage, registerBleSender } from './parser'
import { BASE_STATION_LABEL, BASE_STATION_NAME, MASTER_MAC } from '../utils'
import { ensureNodeWithPos } from './nodes'
import { markBaseOnline } from './baseStatus'

const SVC_UUID = '12345678-1234-1234-1234-1234567890ab'
const TX_UUID = '12345678-1234-1234-1234-1234567890ac'
const RX_UUID = '12345678-1234-1234-1234-1234567890ad'

const BLE_DEVICE_KEY = 'an-nexus-ble-device'
const RETRY_DELAYS = [0, 5000, 10_000]

let bleDevice: BluetoothDevice | null = null
let rxChar: BluetoothRemoteGATTCharacteristic | null = null
let bleConnected = false
let manualDisconnect = false
let retryTimer: number | undefined
let retryIndex = 0
const wiredDevices = new WeakSet<BluetoothDevice>()
const wiredChars = new WeakSet<BluetoothRemoteGATTCharacteristic>()

export const isBleConnected = () => bleConnected

function rememberDevice(id: string) {
  try {
    localStorage.setItem(BLE_DEVICE_KEY, id)
  } catch {
    /* ignore */
  }
}

function rememberedDeviceId(): string | null {
  try {
    return localStorage.getItem(BLE_DEVICE_KEY)
  } catch {
    return null
  }
}

async function attachDevice(device: BluetoothDevice) {
  if (!device?.gatt) throw new Error('device has no GATT server')
  if (!device.gatt.connected) await device.gatt.connect()
  const server = device.gatt
  const svc = await server.getPrimaryService(SVC_UUID)
  const txChar = await svc.getCharacteristic(TX_UUID)
  await txChar.startNotifications()
  rxChar = await svc.getCharacteristic(RX_UUID)
  if (!wiredDevices.has(device)) {
    device.addEventListener('gattserverdisconnected', onDisconnect)
    wiredDevices.add(device)
    if (typeof device.watchAdvertisements === 'function') {
      device.addEventListener('advertisementreceived', onAdvertisement)
      device.watchAdvertisements().catch(() => {
        /* advertisement feed unavailable — keep rssi from node reports */
      })
    }
  }
  if (!wiredChars.has(txChar)) {
    txChar.addEventListener('characteristicvaluechanged', onNotify)
    wiredChars.add(txChar)
  }
  bleDevice = device
  bleConnected = true
  rememberDevice(device.id)
  const store = useNexusStore.getState()
  store.setBle({ bleConnected: true, bleDeviceName: device.name || BASE_STATION_NAME, bleScanning: false })
  store.addLog(`BLE connected: ${device.name || BASE_STATION_NAME}`, 'BLE')
  const existingMaster = store.nodes[MASTER_MAC]
  ensureNodeWithPos(MASTER_MAC, {
    id: 0,
    /* only default the base name when it hasn't been customized by the user */
    name: existingMaster?.name || BASE_STATION_LABEL,
    paired: true,
    online: true,
    rssi: 0,
    isMaster: true,
  })
  markBaseOnline('ble', true)
  store.updateNode(MASTER_MAC, { lastSeen: Date.now() })
  setTimeout(() => bleCmd('LIST'), 800)
}

export async function bleConnect() {
  const store = useNexusStore.getState()
  if (!navigator.bluetooth) {
    store.addLog('Web Bluetooth not supported — use Chrome or Edge', 'ERR')
    store.addAlert('Web Bluetooth not supported', 'fire')
    return
  }
  cancelRetry()
  manualDisconnect = false
  store.setBle({ bleScanning: true, bleDevices: [] })
  store.addLog('Scanning for base station…', 'BLE')
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SVC_UUID],
    })
    await attachDevice(device)
    store.setBle({ bleDevices: [] })
    store.addAlert('Base station connected', 'info')
  } catch (e) {
    store.setBle({ bleScanning: false, bleDevices: [] })
    const err = e as { name?: string; message?: string }
    const msg = err?.name === 'NotFoundError' ? 'Scan cancelled' : `Error: ${err?.message}`
    store.addLog(`BLE error: ${msg}`, 'ERR')
    store.addAlert(`BLE connection failed: ${msg}`, 'fire')
  }
}

export function bleDisconnect() {
  manualDisconnect = true
  cancelRetry()
  try {
    if (bleDevice?.gatt?.connected) bleDevice.gatt.disconnect()
  } catch {
    /* ignore */
  }
  if (bleDevice) {
    bleDevice = null
    rxChar = null
  }
  bleConnected = false
  const store = useNexusStore.getState()
  store.setBle({ bleConnected: false, bleDeviceName: '', bleScanning: false })
  markBaseOnline('ble', false)
  store.addLog('BLE disconnected', 'BLE')
}

function onDisconnect() {
  bleConnected = false
  const store = useNexusStore.getState()
  store.setBle({ bleConnected: false, bleDeviceName: '' })
  markBaseOnline('ble', false)
  if (manualDisconnect) return
  store.addLog('BLE disconnected — reconnecting…', 'ERR')
  scheduleRetry()
}

function cancelRetry() {
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer)
    retryTimer = undefined
  }
  retryIndex = 0
}

function scheduleRetry() {
  if (retryTimer !== undefined || manualDisconnect) return
  const delay = RETRY_DELAYS[retryIndex]
  if (delay === undefined) {
    retryIndex = 0
    useNexusStore.getState().addLog('BLE auto-reconnect failed — press Connect to retry', 'ERR')
    return
  }
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined
    retryIndex += 1
    if (manualDisconnect) return
    void tryAutoReconnect().then((ok) => {
      if (!ok) scheduleRetry()
    })
  }, delay)
}

/**
 * Silently reattaches the last-known base station without a chooser.
 * Relies on Chrome's persistent Web Bluetooth permission (getDevices).
 */
export async function tryAutoReconnect(): Promise<boolean> {
  const store = useNexusStore.getState()
  if (
    bleConnected ||
    manualDisconnect ||
    !navigator.bluetooth ||
    typeof navigator.bluetooth.getDevices !== 'function'
  ) {
    return false
  }
  try {
    const devices = await navigator.bluetooth.getDevices()
    const wanted = rememberedDeviceId()
    const device =
      devices.find((d) => wanted !== null && d.id === wanted) ||
      devices.find((d) => d.name === BASE_STATION_NAME) ||
      null
    if (!device) return false
    await attachDevice(device)
    store.addLog(`BLE reconnected: ${device.name || BASE_STATION_NAME}`, 'BLE')
    return true
  } catch {
    return false
  }
}

function onAdvertisement(e: Event) {
  const adv = e as BluetoothAdvertisingEvent
  if (!Number.isFinite(adv.rssi)) return
  useNexusStore.getState().updateNode(MASTER_MAC, { rssi: adv.rssi })
}

function onNotify(e: Event) {
  const target = e.target as BluetoothRemoteGATTCharacteristic
  const msg = new TextDecoder().decode(target.value)
  const store = useNexusStore.getState()
  store.addRaw(`RX: ${msg}`)
  store.bumpPkts()
  store.updateNode(MASTER_MAC, { lastSeen: Date.now() })
  handleBleMessage(msg)
}

export async function bleCmd(cmd: string): Promise<boolean> {
  const store = useNexusStore.getState()
  if (!rxChar || !bleConnected) {
    store.addLog('BLE not connected', 'ERR')
    return false
  }
  try {
    await rxChar.writeValue(new TextEncoder().encode(cmd))
    store.addRaw(`TX: ${cmd}`)
    return true
  } catch (e) {
    store.addLog(`BLE write: ${(e as Error).message}`, 'ERR')
    return false
  }
}

registerBleSender(bleCmd)

/* ---- Electron BLE device chooser ---------------------------------------- */
/* In the packaged app, discovered BLE devices are forwarded from the main
   process and surfaced in the app's own "join" list, mirroring the native
   browser chooser. */

let deviceListener: ((devices: { deviceId: string; deviceName: string }[]) => void) | null = null

export function initBleChooser() {
  const api = window.electronAPI
  if (!api?.onBluetoothDevices) return
  destroyBleChooser()
  deviceListener = (devices) => {
    const store = useNexusStore.getState()
    if (!store.bleScanning) return
    store.setBle({ bleDevices: devices })
  }
  api.onBluetoothDevices(deviceListener)
}

export function destroyBleChooser() {
  deviceListener = null
}

export function selectBleDevice(deviceId: string) {
  window.electronAPI?.selectBluetoothDevice?.(deviceId)
}

export function cancelBleScan() {
  window.electronAPI?.cancelBluetoothScan?.()
}