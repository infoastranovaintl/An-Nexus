import { afterAll, beforeAll, describe, expect, it } from 'vitest'

class LS {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

beforeAll(() => {
  ;(globalThis as Record<string, unknown>).localStorage = new LS()
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener() {},
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>),
  }
})

afterAll(() => {
  delete (globalThis as Record<string, unknown>).localStorage
  delete (globalThis as Record<string, unknown>).window
})

import { useNexusStore, STALE_MS, type NexNode } from './nexus'
import { MASTER_MAC } from '../lib/utils'

const node = (over: Partial<NexNode>): NexNode => ({
  mac: 'x',
  id: 0,
  name: 'NODE',
  paired: false,
  online: false,
  rssi: 0,
  parent: null,
  ssid: '',
  lastData: '',
  lastSeen: null,
  isMaster: false,
  macFmt: 'x',
  tankDepth: 200,
  lastOnline: null,
  offlineReason: null,
  ...over,
})

describe('sweepNodes', () => {
  it('marks silent nodes offline (soft reason) and keeps freshly-reporting ones online', () => {
    useNexusStore.setState({
      nodes: {
        'stale': node({ mac: 'stale', online: true, lastOnline: Date.now() - 2 * STALE_MS }),
        'fresh': node({ mac: 'fresh', online: true, lastOnline: Date.now() }),
        'never': node({ mac: 'never', online: true, lastOnline: null }),
        'master': node({ mac: MASTER_MAC, online: true, lastSeen: null, isMaster: true }),
      },
    })
    useNexusStore.getState().sweepNodes()
    const nodes = useNexusStore.getState().nodes
    expect(nodes['stale'].online).toBe(false)
    expect(nodes['stale'].offlineReason).toBe('silent')
    expect(nodes['fresh'].online).toBe(true)
    expect(nodes['never'].online).toBe(false)
    expect(nodes['master'].online).toBe(true)
  })

  it('keeps a node online when it re-acknowledged recently even during a slow fetch', () => {
    useNexusStore.setState({
      nodes: {
        ack: node({ mac: 'ack', online: true, lastOnline: Date.now() - 11_000 }),
      },
    })
    /* an incoming CMD_ACK bumps lastOnline → node survives the sweep */
    useNexusStore.getState().touchLive('ack')
    useNexusStore.getState().sweepNodes()
    expect(useNexusStore.getState().nodes['ack'].online).toBe(true)
    expect(useNexusStore.getState().nodes['ack'].offlineReason).toBeNull()
  })
})