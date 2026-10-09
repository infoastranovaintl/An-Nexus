import { useNexusStore } from '../../store/nexus'
import { MASTER_MAC, BASE_STATION_LABEL } from '../utils'
import { ensureNodeWithPos } from './nodes'

/* per-transport liveness flags for the base station (BLE / WebSocket) */
export const baseOnlineFlags = { ble: false, ws: false }

/**
 * Central place to flip the base's online state. The base is considered
 * active when either transport is connected, so one transport must never
 * clobber the other.
 */
export function markBaseOnline(transport: 'ble' | 'ws', connected: boolean): boolean {
  baseOnlineFlags[transport] = connected
  const online = baseOnlineFlags.ble || baseOnlineFlags.ws
  const store = useNexusStore.getState()
  if (online) {
    const existingMaster = store.nodes[MASTER_MAC]
    ensureNodeWithPos(MASTER_MAC, {
      id: 0,
      /* only default the base name when it hasn't been customized by the user */
      name: existingMaster?.name || BASE_STATION_LABEL,
      paired: true,
      online: true,
      isMaster: true,
    })
  }
  store.updateNode(MASTER_MAC, { online })
  return online
}