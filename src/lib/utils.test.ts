import { describe, it, expect } from 'vitest'
import {
  canvasBearing,
  distLabel,
  escHtml,
  macFmt,
  pad,
  rssiToDistance,
  shortMac,
  sigQuality,
  timeSince,
} from './utils'

describe('pad', () => {
  it('zero-pads to 2 digits by default', () => {
    expect(pad(5)).toBe('05')
    expect(pad(12)).toBe('12')
  })
  it('supports custom length', () => {
    expect(pad(7, 3)).toBe('007')
  })
})

describe('macFmt', () => {
  it('formats a 12-char hex mac', () => {
    expect(macFmt('a1b2c3d4e5f6')).toBe('A1:B2:C3:D4:E5:F6')
  })
  it('passes through short or missing values', () => {
    expect(macFmt('abc')).toBe('abc')
    expect(macFmt(null)).toBe('?')
    expect(macFmt(undefined)).toBe('?')
  })
})

describe('shortMac', () => {
  it('returns BASE for the master', () => {
    expect(shortMac('MASTER')).toBe('BASE')
  })
  it('returns last 4 chars of a raw mac', () => {
    expect(shortMac('a1b2c3d4e5f6')).toBe('E5F6')
  })
  it('returns last 2 groups of a formatted mac', () => {
    expect(shortMac('A1:B2:C3:D4:E5:F6')).toBe('E5F6')
  })
})

describe('timeSince', () => {
  it('handles recent timestamps', () => {
    expect(timeSince(Date.now() - 1000)).toBe('just now')
    expect(timeSince(Date.now() - 30_000)).toBe('30s ago')
    expect(timeSince(Date.now() - 90_000)).toBe('1m ago')
    expect(timeSince(Date.now() - 7_200_000)).toBe('2h ago')
  })
})

describe('rssiToDistance', () => {
  it('returns null for falsy rssi', () => {
    expect(rssiToDistance(null)).toBeNull()
    expect(rssiToDistance(0)).toBeNull()
  })
  it('clamps to the 1..500 range', () => {
    expect(rssiToDistance(-25)).toBe(1)
    expect(rssiToDistance(-120)).toBe(500)
  })
  it('returns a plausible distance', () => {
    expect(rssiToDistance(-70)).toBeCloseTo(10, 0)
  })
})

describe('distLabel', () => {
  it('shows a dash for null', () => {
    expect(distLabel(null)).toBe('—')
  })
  it('formats meters and kilometers', () => {
    expect(distLabel(42)).toBe('~42m')
    expect(distLabel(1500)).toBe('~1.50km')
  })
})

describe('sigQuality', () => {
  it('returns 0 for falsy rssi', () => {
    expect(sigQuality(0)).toBe(0)
  })
  it('maps rssi to 0..100', () => {
    expect(sigQuality(-100)).toBe(0)
    expect(sigQuality(-75)).toBe(50)
    expect(sigQuality(-45)).toBe(100)
    expect(sigQuality(-20)).toBe(100)
  })
})

describe('escHtml', () => {
  it('escapes html metacharacters', () => {
    expect(escHtml('<script>alert("x")&</script>')).toBe('&lt;script&gt;alert("x")&amp;&lt;/script&gt;')
  })
  it('handles nullish values', () => {
    expect(escHtml(null)).toBe('')
    expect(escHtml(undefined)).toBe('')
  })
})

describe('canvasBearing', () => {
  it('returns a degree + compass label', () => {
    const b = canvasBearing(100, 100, 0, 0)
    expect(b.deg).toBeGreaterThanOrEqual(0)
    expect(b.deg).toBeLessThan(360)
    expect(b.label).toBeTruthy()
  })
})
