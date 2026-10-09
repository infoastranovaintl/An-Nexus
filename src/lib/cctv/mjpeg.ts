/**
 * MJPEG (multipart/x-mixed-replace) frame splitter.
 *
 * The ESP32-CAM stream handler writes frames as:
 *   --frame\r\nContent-Type: image/jpeg\r\nContent-Length: N\r\n\r\n<JPEG>\r\n
 * Network chunks split these frames arbitrarily, so the parser buffers bytes
 * and only emits complete JPEG payloads once a following boundary is seen.
 */

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  if (a.length === 0) return new Uint8Array(b)
  if (b.length === 0) return new Uint8Array(a)
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  if (needle.length === 0 || haystack.length < needle.length) return -1
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

export function createMjpegParser(boundary: string) {
  const marker = new TextEncoder().encode(boundary)
  const headerEnd = new TextEncoder().encode('\r\n\r\n')
  let buf: Uint8Array<ArrayBuffer> = new Uint8Array(0)

  return {
    /** Feed a network chunk; returns the complete JPEG payloads it contains. */
    push(chunk: Uint8Array): Uint8Array<ArrayBuffer>[] {
      buf = concat(buf, chunk)
      // anti-bloat: camera bug or desync could pump unbounded bytes → drop to fresh boundary
      if (buf.length > 3 * 1024 * 1024) {
        const last = indexOfBytes(buf, marker, Math.max(0, buf.length - 8192))
        buf = last >= 0 ? new Uint8Array(buf.slice(last)) : new Uint8Array(0)
      }
      const out: Uint8Array<ArrayBuffer>[] = []
      for (;;) {
        const start = indexOfBytes(buf, marker, 0)
        if (start !== 0) {
          // garbage before the boundary — drop it and resync
          if (start < 0) {
            // keep only a tail that could be the start of a boundary split by a chunk edge
            const keep = Math.min(marker.length - 1, buf.length)
            buf = new Uint8Array(buf.slice(buf.length - keep))
            break
          }
          buf = new Uint8Array(buf.slice(start))
          continue
        }
        const headerIdx = indexOfBytes(buf, headerEnd, marker.length)
        if (headerIdx < 0) break // header not fully buffered yet
        const frameStart = headerIdx + headerEnd.length
        const next = indexOfBytes(buf, marker, frameStart)
        if (next < 0) break // payload not fully buffered yet
        let payload = new Uint8Array(buf.slice(frameStart, next))
        // strip the trailing \r\n the server appends after each payload
        if (payload.length >= 2 && payload[payload.length - 2] === 13 && payload[payload.length - 1] === 10) {
          payload = new Uint8Array(payload.slice(0, -2))
        }
        if (payload.length > 0) out.push(payload)
        buf = new Uint8Array(buf.slice(next))
      }
      return out
    },
  }
}