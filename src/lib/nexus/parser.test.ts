import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storeState = {
  nodes: {},
  conversations: {} as Record<
    number,
    { msgId: string | number; dir: string; ts: number; priority: number; text: string; status: string }[]
  >,
  convMeta: {},
  addLog: vi.fn(),
  addAlert: vi.fn(),
  updateNode: vi.fn(),
  touchLive: vi.fn(),
  pushWater: vi.fn(),
  pushSensors: vi.fn(),
  storeConvMsg: vi.fn((_n: number, _e: unknown) => false),
  touchConv: vi.fn(),
  bumpUnread: vi.fn(),
  setEmergency: vi.fn(),
  setState: vi.fn(),
}

vi.mock('../../store/nexus', () => ({
  useNexusStore: {
    getState: () => storeState,
    setState: (updater: unknown) => {
      const next = typeof updater === 'function' ? updater(storeState) : updater
      Object.assign(storeState, next)
    },
  },
}))

vi.mock('./nodes', () => ({
  ensureNodeWithPos: vi.fn(),
}))

vi.mock('../notify', () => ({
  notifyNewMessage: vi.fn(),
}))

import { bleSend, getConversation, handleBleMessage, registerBleSender, sendChatReply } from './parser'
import { ensureNodeWithPos } from './nodes'

beforeEach(() => {
  vi.clearAllMocks()
  storeState.conversations = {}
  storeState.nodes = {}
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bleSend default', () => {
  it('defaults to a no-op that reports failure', async () => {
    expect(await bleSend('SENDMSG:1:1:x')).toBe(false)
  })
})

describe('MSG lines', () => {
  it('accepts a well-formed MSG line', () => {
    handleBleMessage('MSG:42:3:0:2:Hello from the field')
    expect(storeState.storeConvMsg).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ msgId: '42', dir: 'IN', priority: 2, text: 'Hello from the field' }),
    )
    expect(storeState.touchConv).toHaveBeenCalledWith(3, expect.objectContaining({ emergency: false }))
  })

  it('flags priority 3 as emergency', () => {
    handleBleMessage('MSG:1:7:0:3:HELP')
    expect(storeState.touchConv).toHaveBeenCalledWith(7, expect.objectContaining({ emergency: true }))
  })

  it('rejects a malformed MSG line without storing a conversation', () => {
    handleBleMessage('MSG::not-a-number:0:2:text')
    expect(storeState.storeConvMsg).not.toHaveBeenCalled()
    expect(storeState.addLog).toHaveBeenCalledWith('MSG::not-a-number:0:2:text', 'BLE')
  })

  it('clamps out-of-range priority to 0..3', () => {
    handleBleMessage('MSG:9:2:0:99:hi')
    expect(storeState.storeConvMsg).toHaveBeenCalledWith(2, expect.objectContaining({ priority: 3 }))
  })
})

describe('EMERGENCY lines', () => {
  it('stores a valid emergency with coordinates', () => {
    handleBleMessage('EMERGENCY:5:Im stuck:28.6139:77.209')
    expect(storeState.storeConvMsg).toHaveBeenCalledWith(5, expect.objectContaining({ priority: 3 }))
    expect(storeState.setEmergency).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 5, lat: 28.6139, lon: 77.209 }),
    )
  })

  it('handles missing coordinates gracefully', () => {
    handleBleMessage('EMERGENCY:5:Im stuck')
    expect(storeState.setEmergency).toHaveBeenCalledWith(expect.objectContaining({ lat: 0, lon: 0 }))
  })

  it('rejects a malformed node id', () => {
    handleBleMessage('EMERGENCY:x:text')
    expect(storeState.setEmergency).not.toHaveBeenCalled()
  })
})

describe('sendChatReply', () => {
  it('marks the reply failed when BLE is not connected', async () => {
    registerBleSender(async () => false)
    await sendChatReply(3, 'Stay put', 2)
    expect(storeState.storeConvMsg).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ dir: 'OUT', text: 'Stay put', status: 'failed' }),
    )
    expect(storeState.addLog).toHaveBeenCalledWith(expect.stringContaining('not sent'), 'ERR')
  })

  it('marks the reply sending, then delivered after the ACK window', async () => {
    vi.useFakeTimers()
    registerBleSender(async () => true)
    const p = sendChatReply(3, 'Help is coming', 2)
    await p
    expect(storeState.storeConvMsg).toHaveBeenCalledWith(3, expect.objectContaining({ dir: 'OUT', status: 'sending' }))
    const call = storeState.storeConvMsg.mock.calls[0]
    const msgId = (call?.[1] as unknown as { msgId?: string | number })?.msgId ?? 'm'
    storeState.conversations[3] = [{ msgId, dir: 'OUT', ts: 0, priority: 2, text: 'Help is coming', status: 'sending' }]
    await vi.advanceTimersByTimeAsync(1600)
    expect(storeState.conversations[3]?.[0]?.status).toBe('delivered')
  })

  it('does nothing for an empty message', async () => {
    await sendChatReply(3, '   ', 1)
    expect(storeState.storeConvMsg).not.toHaveBeenCalled()
  })
})

describe('getConversation', () => {
  it('issues a GETMSGS command', () => {
    const spy = vi.fn(async () => true)
    registerBleSender(spy)
    getConversation(4)
    expect(spy).toHaveBeenCalledWith('GETMSGS:4')
  })
})

describe('node lifecycle lines', () => {
  it('HELLO never claims pairing — only explicit PAIRED:/NODE: lines do', () => {
    handleBleMessage('HELLO:AA:BB:CC:DD:EE:FF:rssi=-42:paired=1:id=3:ssid=n1')
    expect(ensureNodeWithPos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 3, rssi: -42, online: true }),
    )
    const call = (ensureNodeWithPos as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).not.toHaveProperty('paired')
  })

  it('HELLO keeps the node online but never reports pairing', () => {
    handleBleMessage('HELLO:AA:BB:CC:DD:EE:FF:rssi=-1:id=1:paired=0')
    expect(ensureNodeWithPos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 1, rssi: -1 }),
    )
    const call = (ensureNodeWithPos as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).not.toHaveProperty('paired')
  })

  it('HELLO parses fields in any order', () => {
    handleBleMessage('HELLO:AA:BB:CC:DD:EE:FF:id=7:paired=1:rssi=-52')
    expect(ensureNodeWithPos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 7, rssi: -52 }),
    )
    const call = (ensureNodeWithPos as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).not.toHaveProperty('paired')
  })

  it('PAIRED: line is the explicit pairing confirmation', () => {
    handleBleMessage('PAIRED:AA:id=5')
    expect(ensureNodeWithPos).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ paired: true, id: 5 }),
    )
  })

  it('DATA stamps lastSeen but never claims the node is paired', () => {
    handleBleMessage('DATA:AA:BB:CC:DD:EE:FF:id=3:payload=sensor=1:v0=28.24')
    expect(storeState.updateNode).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ lastSeen: expect.any(Number) }))
    const calls = (ensureNodeWithPos as unknown as ReturnType<typeof vi.fn>).mock.calls
    for (const c of calls) {
      expect(c[1]).not.toHaveProperty('paired', true)
    }
  })

  it('DATA parses the full payload even when it contains colons', () => {
    handleBleMessage('DATA:90:64:9B:08:38:58:id=1:payload=sensor=1:v0=28.48:v1=862.12:v2=1341.92')
    expect(storeState.updateNode).toHaveBeenCalledWith(
      '90:64:9B:08:38:58',
      expect.objectContaining({ lastData: 'sensor=1:v0=28.48:v1=862.12:v2=1341.92' }),
    )
    expect(storeState.pushSensors).toHaveBeenCalledWith(
      '90:64:9B:08:38:58',
      expect.arrayContaining([
        expect.objectContaining({ kind: 'temp', value: 28.48 }),
        expect.objectContaining({ kind: 'atmp', value: 862.12 }),
        expect.objectContaining({ kind: 'altitude', value: 1341.92 }),
      ]),
    )
  })

  it('DATA yields water + turbidity samples from a prefixed payload', () => {
    handleBleMessage('DATA:90:64:9B:08:38:02:id=2:payload=water=1.42:turb=85')
    expect(storeState.updateNode).toHaveBeenCalledWith(
      '90:64:9B:08:38:02',
      expect.objectContaining({ lastData: 'water=1.42:turb=85' }),
    )
    expect(storeState.pushWater).toHaveBeenCalledWith('90:64:9B:08:38:02', expect.objectContaining({ v: 1.42 }))
    expect(storeState.pushSensors).toHaveBeenCalledWith(
      '90:64:9B:08:38:02',
      expect.arrayContaining([expect.objectContaining({ kind: 'turbidity', value: 85 })]),
    )
  })

  it('DATA parses a colon-formatted ultrasonic reading as distance (not water)', () => {
    handleBleMessage('DATA:90:64:9B:08:38:03:id=2:ultrasonic:420')
    expect(storeState.updateNode).toHaveBeenCalledWith(
      '90:64:9B:08:38:03',
      expect.objectContaining({ lastData: 'ultrasonic:420' }),
    )
    expect(storeState.pushWater).not.toHaveBeenCalledWith('90:64:9B:08:38:03', expect.objectContaining({ v: 420 }))
    expect(storeState.pushSensors).toHaveBeenCalledWith(
      '90:64:9B:08:38:03',
      expect.arrayContaining([
        expect.objectContaining({ kind: 'distance', value: 420, unit: 'cm' }),
      ]),
    )
  })

  it('DATA parses the hardware sensor=2:v0=<dist-cm> payload as distance', () => {
    handleBleMessage('DATA:90:64:9B:08:38:09:id=2:payload=sensor=2:v0=31.00')
    expect(storeState.updateNode).toHaveBeenCalledWith(
      '90:64:9B:08:38:09',
      expect.objectContaining({ lastData: 'sensor=2:v0=31.00' }),
    )
    expect(storeState.pushSensors).toHaveBeenCalledWith(
      '90:64:9B:08:38:09',
      expect.arrayContaining([expect.objectContaining({ kind: 'distance', value: 31, unit: 'cm' })]),
    )
  })

  it('DATA parses the hardware sensor=3:v0=<water-temp> payload as water temperature', () => {
    handleBleMessage('DATA:90:64:9B:08:38:0A:id=3:payload=sensor=3:v0=18.5')
    expect(storeState.updateNode).toHaveBeenCalledWith(
      '90:64:9B:08:38:0A',
      expect.objectContaining({ lastData: 'sensor=3:v0=18.5' }),
    )
    expect(storeState.pushSensors).toHaveBeenCalledWith(
      '90:64:9B:08:38:0A',
      expect.arrayContaining([expect.objectContaining({ kind: 'waterTemp', value: 18.5, unit: '°C' })]),
    )
  })

  it('PAIRED extracts the id from any id= segment', () => {
    handleBleMessage('PAIRED:90:64:9B:08:38:58:id=5')
    expect(ensureNodeWithPos).toHaveBeenCalledWith(
      '90:64:9B:08:38:58',
      expect.objectContaining({ paired: true, id: 5 }),
    )
  })

  it('CMD_ACK proves the node is alive (touchLive) so it is not swept mid-fetch', () => {
    handleBleMessage('CMD_ACK:90:64:9B:08:38:58:03')
    expect(storeState.touchLive).toHaveBeenCalledWith('90:64:9B:08:38:58')
  })
})
