import { describe, it, expect } from 'vitest'
import { parseSensorPayload, parseWaterPayload, sensorRange, tankPct, toMeters, type WaterReading } from './sensors'

describe('parseWaterPayload', () => {
  it('returns null for empty input', () => {
    expect(parseWaterPayload('')).toBeNull()
    expect(parseWaterPayload('   ')).toBeNull()
    expect(parseWaterPayload(null as unknown as string)).toBeNull()
  })

  it('parses JSON objects', () => {
    const r = parseWaterPayload('{"water":1.42}')
    expect(r?.v).toBeCloseTo(1.42)
    expect(r?.unit).toBe('')
  })

  it('parses JSON with a unit string', () => {
    const r = parseWaterPayload('{"level":"90cm"}')
    expect(r?.v).toBe(90)
    expect(r?.unit).toBe('cm')
  })

  it('parses key=value token streams', () => {
    const r = parseWaterPayload('water=142cm hum=62 temp=31')
    expect(r?.v).toBe(142)
    expect(r?.unit).toBe('cm')
  })

  it('parses key:value streams with dashes/underscores normalized', () => {
    const r = parseWaterPayload('water_level:1.4m,hum:60')
    expect(r?.v).toBeCloseTo(1.4)
    expect(r?.unit).toBe('m')
  })

  it('falls back to a bare numeric value', () => {
    const r = parseWaterPayload('88.5')
    expect(r?.v).toBeCloseTo(88.5)
    expect(r?.unit).toBe('')
  })

  it('returns null when no water key or value is present', () => {
    expect(parseWaterPayload('hum=62 temp=31')).toBeNull()
    expect(parseWaterPayload('hello world')).toBeNull()
  })
})

describe('toMeters', () => {
  const r = (v: number, unit: WaterReading['unit']) => ({ v, unit })
  it('converts cm and mm', () => {
    expect(toMeters(r(90, 'cm'))).toBeCloseTo(0.9)
    expect(toMeters(r(900, 'mm'))).toBeCloseTo(0.9)
  })
  it('passes meters through', () => {
    expect(toMeters(r(1.42, 'm'))).toBe(1.42)
  })
  it('passes percent through untouched', () => {
    expect(toMeters(r(55, '%'))).toBe(55)
  })
})

describe('tankPct', () => {
  const r = (v: number, unit: WaterReading['unit']) => ({ v, unit })
  it('treats percent as the tank fraction', () => {
    expect(tankPct(r(55, '%'))).toBe(55)
  })
  it('normalizes meters against a 2 m tank', () => {
    expect(tankPct(r(1, 'm'))).toBe(50)
    expect(tankPct(r(2, 'm'))).toBe(100)
  })
  it('normalizes cm against a 2 m tank', () => {
    expect(tankPct(r(100, 'cm'))).toBe(50)
  })
  it('clamps to 0..100', () => {
    expect(tankPct(r(9, 'm'))).toBe(100)
    expect(tankPct(r(-1, 'm'))).toBe(0)
    expect(tankPct(r(-20, '%'))).toBe(0)
  })
})

describe('parseSensorPayload', () => {
  it('maps sensor=1 positional v0/v1/v2 to temp/atmp/altitude', () => {
    const samples = parseSensorPayload('sensor=1:v0=28.24:v1=862.66:v2=1336.72')
    expect(samples.map((s) => s.kind)).toEqual(['temp', 'atmp', 'altitude'])
    expect(samples[0].value).toBeCloseTo(28.24)
    expect(samples[0].unit).toBe('°C')
    expect(samples[1].value).toBeCloseTo(862.66)
    expect(samples[1].unit).toBe('hPa')
    expect(samples[2].value).toBeCloseTo(1336.72)
    expect(samples[2].unit).toBe('m')
  })

  it('maps positional values in JSON payloads too', () => {
    const samples = parseSensorPayload('{"sensor":1,"v0":25.5,"v1":1013.2,"v2":88}')
    expect(samples.map((s) => s.kind)).toEqual(['temp', 'atmp', 'altitude'])
    expect(samples[2].value).toBeCloseTo(88)
  })

  it('maps sensor=2 v0 to ultrasonic distance (cm)', () => {
    const samples = parseSensorPayload('sensor=2:v0=31.00')
    expect(samples).toHaveLength(1)
    expect(samples[0].kind).toBe('distance')
    expect(samples[0].value).toBeCloseTo(31)
    expect(samples[0].unit).toBe('cm')
  })

  it('maps sensor=3 v0 to water temperature (°C)', () => {
    const samples = parseSensorPayload('sensor=3:v0=18.5')
    expect(samples).toHaveLength(1)
    expect(samples[0].kind).toBe('waterTemp')
    expect(samples[0].value).toBeCloseTo(18.5)
    expect(samples[0].unit).toBe('°C')
  })

  it('maps sensor=3 v0 in JSON payloads to water temperature too', () => {
    const samples = parseSensorPayload('{"sensor":3,"v0":18.5}')
    expect(samples.map((s) => s.kind)).toEqual(['waterTemp'])
    expect(samples[0].value).toBe(18.5)
  })

  it('maps sensor=2 v0 in JSON payloads to distance too', () => {
    const samples = parseSensorPayload('{"sensor":2,"v0":420}')
    expect(samples.map((s) => s.kind)).toEqual(['distance'])
    expect(samples[0].value).toBe(420)
  })

  it('does not emit a sample for the sensor index key', () => {
    const samples = parseSensorPayload('sensor=1:temp=31')
    expect(samples).toHaveLength(1)
    expect(samples[0].kind).toBe('temp')
  })

  it('widened atmp range covers high-altitude readings', () => {
    const { min, max } = sensorRange('atmp')
    expect(min).toBe(850)
    expect(max).toBe(1100)
  })

  it('parses distance readings and normalizes m/mm to cm', () => {
    const cm = parseSensorPayload('distance=152cm')
    expect(cm[0].kind).toBe('distance')
    expect(cm[0].value).toBe(152)
    expect(cm[0].unit).toBe('cm')

    const m = parseSensorPayload('dist=1.5m')
    expect(m[0].kind).toBe('distance')
    expect(m[0].value).toBeCloseTo(150)
    expect(m[0].unit).toBe('cm')

    const mm = parseSensorPayload('{"ultrasonic":420}')
    expect(mm[0].kind).toBe('distance')
    expect(mm[0].value).toBe(420)
    expect(mm[0].unit).toBe('cm')

    const range = sensorRange('distance')
    expect(range.min).toBe(0)
    expect(range.max).toBe(400)
  })

  it('maps unquoted JSON brace payloads (no valid quotes) to distance', () => {
    const raw = parseSensorPayload('{ultrasonic:420}')
    expect(raw.length).toBeGreaterThan(0)
    expect(raw[0].kind).toBe('distance')
    expect(raw[0].value).toBe(420)
    expect(raw[0].unit).toBe('cm')
  })
})
