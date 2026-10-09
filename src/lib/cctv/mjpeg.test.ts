import { describe, expect, it } from 'vitest'
import { createMjpegParser } from './mjpeg'

const BOUNDARY = '--frame'
const enc = new TextEncoder()

function header(len: number): Uint8Array {
  return enc.encode(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${len}\r\n\r\n`)
}
function jpeg(...bytes: number[]): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, ...bytes, 0xff, 0xd9])
}
const TRAILER = enc.encode('\r\n')
const BOUND = enc.encode('--frame')

function stream(...parts: Uint8Array[]): Uint8Array {
  const out: number[] = []
  parts.forEach((p) => out.push(...p))
  return Uint8Array.from(out)
}

/** One full frame on the wire — header + payload + trailer + next boundary. */
function frameWire(payload: Uint8Array): Uint8Array {
  return stream(header(payload.length), payload, TRAILER, BOUND)
}

describe('createMjpegParser', () => {
  it('emits a single complete frame', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(1, 2, 3)
    const chunks = p.push(frameWire(payload))
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual(payload)
  })

  it('emits multiple frames from one chunk', () => {
    const p = createMjpegParser(BOUNDARY)
    const a = jpeg(1)
    const b = jpeg(2, 2)
    const chunks = p.push(stream(header(a.length), a, TRAILER, header(b.length), b, TRAILER, BOUND))
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual(a)
    expect(chunks[1]).toEqual(b)
  })

  it('buffers a frame split across chunks', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(9, 8, 7, 6, 5)
    const wire = frameWire(payload)
    const cut = 3
    expect(p.push(wire.slice(0, cut))).toHaveLength(0)
    const frames = p.push(wire.slice(cut))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual(payload)
  })

  it('buffers when the header arrives in pieces', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(4)
    const wire = frameWire(payload)
    expect(p.push(wire.slice(0, 20))).toHaveLength(0) // header half-arrived
    const frames = p.push(wire.slice(20))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual(payload)
  })

  it('resyncs past garbage before the first boundary', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(7)
    const garbage = Uint8Array.from([65, 66, 67, 68])
    const frames = p.push(stream(garbage, header(payload.length), payload, TRAILER, BOUND))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual(payload)
  })

  it('ignores empty payloads between back-to-back boundaries', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(3)
    // empty frame, then a real frame, then a closing boundary
    const wire = stream(
      enc.encode('--frame\r\nContent-Type: image/jpeg\r\n\r\n'),
      header(payload.length),
      payload,
      TRAILER,
      BOUND,
    )
    const frames = p.push(wire)
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual(payload)
  })

  it('does not emit until the next boundary is seen', () => {
    const p = createMjpegParser(BOUNDARY)
    const payload = jpeg(6)
    const wire = stream(header(payload.length), payload) // no following boundary yet
    expect(p.push(wire)).toHaveLength(0)
    const frames = p.push(stream(TRAILER, BOUND))
    expect(frames).toHaveLength(1)
    expect(frames[0]).toEqual(payload)
  })
})