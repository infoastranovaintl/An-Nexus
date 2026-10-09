import { useNexusStore, type AlertEntry } from '../store/nexus'
import { useAlertConfigStore } from '../store/alertConfig'
import { notifyDynamicIsland } from '../components/ui/DynamicIsland'
import type { SensorKind } from './nexus/sensors'

export type AlertSeverity = 'critical' | 'warning' | 'info'

interface AlertRule {
  id: string
  severity: AlertSeverity
  label: string
  description: string
  sensorKind: SensorKind | 'system'
  check: (ctx: RuleContext, threshold: number) => boolean
}

interface RuleContext {
  latest: Map<SensorKind, number>
  history: Record<string, Record<string, { ts: number; v: number; unit: string }[]>>
  waterLevel: number | null
  nodeCount: number
  offlineCount: number
}

function computeCtx(): RuleContext {
  const s = useNexusStore.getState()
  const latest = new Map<SensorKind, number>()
  for (const [, samples] of Object.entries(s.sensorReadings)) {
    for (const r of samples) {
      latest.set(r.kind, r.value)
    }
  }
  const waterMacs = Object.keys(s.waterLevels)
  const waterLevel = waterMacs.length > 0 ? s.waterLevels[waterMacs[0]]?.v ?? null : null
  const nodes = Object.values(s.nodes).filter((n) => !n.isMaster)
  const offlineCount = nodes.filter((n) => !n.online).length
  return { latest, history: s.sensorHistory, waterLevel, nodeCount: nodes.length, offlineCount }
}

function recentValues(history: Record<string, Record<string, { ts: number; v: number }[]>>, kind: SensorKind, count: number): number[] {
  const vals: { ts: number; v: number }[] = []
  for (const byKey of Object.values(history)) {
    const key = Object.keys(byKey).find((k) => {
      const sample = useNexusStore.getState().sensorReadings
      for (const samples of Object.values(sample)) {
        const match = samples.find((s) => s.key === k && s.kind === kind)
        if (match) return true
      }
      return false
    })
    if (key && byKey[key]) {
      for (const p of byKey[key]) vals.push({ ts: p.ts, v: p.v })
    }
  }
  vals.sort((a, b) => b.ts - a.ts)
  return vals.slice(0, count).map((p) => p.v)
}

function waterHistory(ctx: RuleContext, count: number): { ts: number; v: number }[] {
  const pts: { ts: number; v: number }[] = []
  for (const hist of Object.values(ctx.history)) {
    const waterKey = Object.keys(hist).find((k) => {
      const readings = useNexusStore.getState().sensorReadings
      for (const samples of Object.values(readings)) {
        if (samples.some((s) => s.key === k && s.kind === 'water')) return true
      }
      return false
    })
    if (waterKey && hist[waterKey]) {
      for (const p of hist[waterKey]) pts.push({ ts: p.ts, v: p.v })
    }
  }
  pts.sort((a, b) => b.ts - a.ts)
  return pts.slice(0, count)
}

function stdDev(vals: number[]): number {
  if (vals.length < 3) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sq = vals.map((v) => (v - mean) ** 2)
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / vals.length)
}

function avgRecent(history: Record<string, Record<string, { ts: number; v: number }[]>>, kind: SensorKind, count: number): number[] {
  const vals: { ts: number; v: number }[] = []
  for (const hist of Object.values(history)) {
    for (const pts of Object.values(hist)) {
      const match = useNexusStore.getState().sensorReadings
      let matches = false
      for (const samples of Object.values(match)) {
        if (samples.some((s) => s.key === Object.keys(hist).find((k) => hist[k] === pts) && s.kind === kind)) {
          matches = true
          break
        }
      }
      if (matches) for (const p of pts) vals.push({ ts: p.ts, v: p.v })
    }
  }
  vals.sort((a, b) => b.ts - a.ts)
  return vals.slice(0, count).map((p) => p.v)
}

const BUILTIN_RULES: AlertRule[] = [
  {
    id: 'overflow_risk',
    severity: 'critical',
    label: 'Overflow Risk',
    description: 'Water level critically high — overflow imminent',
    sensorKind: 'water',
    check: (ctx, t) => ctx.waterLevel !== null && ctx.waterLevel > t,
  },
  {
    id: 'rising_water',
    severity: 'warning',
    label: 'Rising Water Level',
    description: 'Water level above threshold and continuing to rise',
    sensorKind: 'water',
    check: (ctx, t) => {
      if (ctx.waterLevel === null || ctx.waterLevel <= t) return false
      const recent = waterHistory(ctx, 5)
      return recent.length >= 2 && recent[0].v > recent[recent.length - 1].v
    },
  },
  {
    id: 'rapid_water_drop',
    severity: 'warning',
    label: 'Rapid Water Drop',
    description: 'Water level dropped significantly — possible breach or leak',
    sensorKind: 'water',
    check: (ctx, t) => {
      const recent = waterHistory(ctx, 10)
      if (recent.length < 2) return false
      const newest = recent[0].v
      const oldest = recent[recent.length - 1].v
      return oldest > 0 && ((oldest - newest) / oldest) > (t / 100)
    },
  },
  {
    id: 'critical_low',
    severity: 'critical',
    label: 'Critical Low Level',
    description: 'Water level critically low — reservoir nearly empty',
    sensorKind: 'water',
    check: (ctx, t) => ctx.waterLevel !== null && ctx.waterLevel < t,
  },
  {
    id: 'flash_flood',
    severity: 'critical',
    label: 'Flash Flood Risk',
    description: 'Heavy rainfall combined with rising water — flash flood danger',
    sensorKind: 'rain',
    check: (ctx, t) => {
      const rain = ctx.latest.get('rain') ?? 0
      if (rain <= t) return false
      const recent = waterHistory(ctx, 5)
      return recent.length >= 2 && recent[0].v > recent[recent.length - 1].v
    },
  },
  {
    id: 'heavy_rain',
    severity: 'warning',
    label: 'Heavy Rainfall',
    description: 'Sustained heavy rainfall — monitor water levels closely',
    sensorKind: 'rain',
    check: (ctx, t) => (ctx.latest.get('rain') ?? 0) > t,
  },
  {
    id: 'storm_approaching',
    severity: 'warning',
    label: 'Storm Approaching',
    description: 'Atmospheric pressure very low — storm conditions likely',
    sensorKind: 'atmp',
    check: (ctx, t) => (ctx.latest.get('atmp') ?? 1013) < t,
  },
  {
    id: 'severe_storm',
    severity: 'critical',
    label: 'Severe Storm',
    description: 'Rapid pressure drop detected — severe storm imminent',
    sensorKind: 'atmp',
    check: (ctx, t) => {
      const vals = avgRecent(ctx.history, 'atmp', 10)
      if (vals.length < 4) return false
      return (vals[vals.length - 1] - vals[0]) > t
    },
  },
  {
    id: 'extreme_heat',
    severity: 'warning',
    label: 'Extreme Heat',
    description: 'Temperature dangerously high — infrastructure stress risk',
    sensorKind: 'temp',
    check: (ctx, t) => (ctx.latest.get('temp') ?? 25) > t,
  },
  {
    id: 'freeze_risk',
    severity: 'warning',
    label: 'Freeze Risk',
    description: 'Temperature at or below freezing — ice damage risk',
    sensorKind: 'temp',
    check: (ctx, t) => (ctx.latest.get('temp') ?? 25) < t,
  },
  {
    id: 'turbidity_critical',
    severity: 'critical',
    label: 'Water Quality Critical',
    description: 'Turbidity extremely high — severe sediment contamination',
    sensorKind: 'turbidity',
    check: (ctx, t) => (ctx.latest.get('turbidity') ?? 0) > t,
  },
  {
    id: 'high_turbidity',
    severity: 'warning',
    label: 'High Turbidity',
    description: 'Water turbidity elevated — possible contamination or runoff',
    sensorKind: 'turbidity',
    check: (ctx, t) => (ctx.latest.get('turbidity') ?? 0) > t,
  },
  {
    id: 'water_temp_abnormal',
    severity: 'warning',
    label: 'Abnormal Water Temperature',
    description: 'Water temperature high — aquatic ecosystem stress',
    sensorKind: 'waterTemp',
    check: (ctx, t) => (ctx.latest.get('waterTemp') ?? 20) > t,
  },
  {
    id: 'sensor_fluctuation',
    severity: 'info',
    label: 'Sensor Fluctuation',
    description: 'Abnormal readings detected — possible sensor malfunction',
    sensorKind: 'generic',
    check: (ctx, t) => {
      for (const kind of (['temp', 'pressure', 'atmp', 'water', 'turbidity'] as SensorKind[])) {
        const vals = recentValues(ctx.history, kind, 10)
        if (vals.length >= 5) {
          const sd = stdDev(vals)
          const range = Math.max(...vals) - Math.min(...vals)
          if (range > 0 && sd / range > t) return true
        }
      }
      return false
    },
  },
  {
    id: 'node_offline',
    severity: 'warning',
    label: 'Node Offline',
    description: 'Field node lost connection — data gap risk',
    sensorKind: 'system',
    check: (ctx, t) => ctx.offlineCount > 0 && ctx.nodeCount >= t,
  },
]

let engineTimer: number | undefined
let lastAlertIds = new Set<string>()

export function evaluateAlerts(): AlertEntry[] {
  const ctx = computeCtx()
  const active: AlertEntry[] = []
  const now = Date.now()
  const configRules = useAlertConfigStore.getState().rules

  for (const rule of BUILTIN_RULES) {
    const cfg = configRules.find((r) => r.id === rule.id)
    if (cfg && !cfg.enabled) continue
    const threshold = cfg?.threshold ?? 0
    if (rule.check(ctx, threshold)) {
      active.push({
        id: rule.id,
        severity: cfg?.severity ?? rule.severity,
        label: cfg?.label ?? rule.label,
        message: cfg?.description ?? rule.description,
        sensorKind: rule.sensorKind,
        ts: now,
        active: true,
      })
    }
  }

  const newIds = new Set(active.map((a) => a.id))
  for (const id of newIds) {
    if (!lastAlertIds.has(id)) {
      const alert = active.find((a) => a.id === id)
      if (alert) {
        notifyDynamicIsland({ id: alert.id, title: alert.label, message: alert.message, details: alert.message, type: alert.severity })
      }
    }
  }
  lastAlertIds = newIds

  return active
}

export function startAlertEngine() {
  stopAlertEngine()
  const run = () => {
    try {
      const alerts = evaluateAlerts()
      useNexusStore.getState().setAlerts(alerts)
    } catch {
      /* silently ignore evaluation errors */
    }
  }
  run()
  engineTimer = window.setInterval(run, 10_000)
}

export function stopAlertEngine() {
  if (engineTimer !== undefined) {
    window.clearInterval(engineTimer)
    engineTimer = undefined
  }
}
