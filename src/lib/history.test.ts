import { describe, it, expect } from 'vitest'
import { buildCsvChunks, csvRows, type ArchiveRow } from './history'

const row = (over: Partial<ArchiveRow> = {}): ArchiveRow => ({
  mac: 'A1B2C3D4E501',
  kind: 'temp',
  ts: 1_700_000_000,
  v: 24.5,
  unit: '°C',
  ...over,
})

describe('csvRows', () => {
  it('emits the header even for empty input', () => {
    expect(csvRows([])).toBe('mac,kind,ts,value,unit\n')
  })
  it('formats one row per point in input order', () => {
    const rows = [row({ ts: 1 }), row({ mac: 'A1B2C3D4E502', kind: 'water', ts: 2, v: 3.1, unit: 'm' })]
    expect(csvRows(rows)).toBe(
      'mac,kind,ts,value,unit\n' + 'A1B2C3D4E501,temp,1,24.5,°C\n' + 'A1B2C3D4E502,water,2,3.1,m\n',
    )
  })
  it('quotes cells containing commas, quotes or newlines', () => {
    const out = csvRows([row({ unit: 'a,b', mac: 'x"y' })])
    expect(out).toContain('"x""y",temp')
    expect(out).toContain(',"a,b"')
  })
})

describe('buildCsvChunks', () => {
  it('splits rows across chunks of at most maxRows, each with its own header', () => {
    const rows = Array.from({ length: 250 }, (_, i) => row({ ts: i }))
    const chunks = buildCsvChunks(rows, 100)
    const lines = (s: string) => s.split('\n').filter(Boolean)
    expect(chunks).toHaveLength(3)
    expect(lines(chunks[0])).toHaveLength(101) // header + 100 rows
    expect(lines(chunks[1])).toHaveLength(101)
    expect(lines(chunks[2])).toHaveLength(51)
    expect(chunks[0].startsWith('mac,kind,ts,value,unit\n')).toBe(true)
    expect(chunks[2]).toContain('249,')
  })
  it('returns a header-only chunk for empty input', () => {
    expect(buildCsvChunks([])).toEqual(['mac,kind,ts,value,unit\n'])
  })
  it('keeps every row exactly once across chunks', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => row({ ts: i, v: i }))
    const chunks = buildCsvChunks(rows, 300)
    const joined = chunks.join('')
    const lines = joined.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1000 + chunks.length) // all rows + one header per chunk
    for (let i = 0; i < 1000; i++) {
      expect(joined).toContain(`temp,${i},${i},°C`)
    }
  })
})