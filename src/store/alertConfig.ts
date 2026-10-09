import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AlertSeverity } from '../lib/alertEngine'

export interface AlertRuleConfig {
  id: string
  label: string
  description: string
  severity: AlertSeverity
  enabled: boolean
  threshold: number
  thresholdLabel: string
  unit: string
  sensorKind: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
}

const DEFAULT_RULES: AlertRuleConfig[] = [
  { id: 'overflow_risk', label: 'Overflow Risk', description: 'Water level critically high — overflow imminent', severity: 'critical', enabled: true, threshold: 95, thresholdLabel: 'Water level', unit: '%', sensorKind: 'water', operator: '>' },
  { id: 'rising_water', label: 'Rising Water Level', description: 'Water level above threshold and continuing to rise', severity: 'warning', enabled: true, threshold: 80, thresholdLabel: 'Water level', unit: '%', sensorKind: 'water', operator: '>' },
  { id: 'rapid_water_drop', label: 'Rapid Water Drop', description: 'Water level dropped significantly — possible breach or leak', severity: 'warning', enabled: true, threshold: 10, thresholdLabel: 'Drop amount', unit: '%', sensorKind: 'water', operator: '>' },
  { id: 'critical_low', label: 'Critical Low Level', description: 'Water level critically low — reservoir nearly empty', severity: 'critical', enabled: true, threshold: 20, thresholdLabel: 'Water level', unit: '%', sensorKind: 'water', operator: '<' },
  { id: 'flash_flood', label: 'Flash Flood Risk', description: 'Heavy rainfall combined with rising water — flash flood danger', severity: 'critical', enabled: true, threshold: 50, thresholdLabel: 'Rainfall', unit: 'mm', sensorKind: 'rain', operator: '>' },
  { id: 'heavy_rain', label: 'Heavy Rainfall', description: 'Sustained heavy rainfall — monitor water levels closely', severity: 'warning', enabled: true, threshold: 20, thresholdLabel: 'Rainfall', unit: 'mm', sensorKind: 'rain', operator: '>' },
  { id: 'storm_approaching', label: 'Storm Approaching', description: 'Atmospheric pressure very low — storm conditions likely', severity: 'warning', enabled: true, threshold: 985, thresholdLabel: 'Pressure', unit: 'hPa', sensorKind: 'atmp', operator: '<' },
  { id: 'severe_storm', label: 'Severe Storm', description: 'Rapid pressure drop detected — severe storm imminent', severity: 'critical', enabled: true, threshold: 5, thresholdLabel: 'Pressure drop', unit: 'hPa', sensorKind: 'atmp', operator: '>' },
  { id: 'extreme_heat', label: 'Extreme Heat', description: 'Temperature dangerously high — infrastructure stress risk', severity: 'warning', enabled: true, threshold: 45, thresholdLabel: 'Temperature', unit: '°C', sensorKind: 'temp', operator: '>' },
  { id: 'freeze_risk', label: 'Freeze Risk', description: 'Temperature at or below freezing — ice damage risk', severity: 'warning', enabled: true, threshold: 0, thresholdLabel: 'Temperature', unit: '°C', sensorKind: 'temp', operator: '<' },
  { id: 'turbidity_critical', label: 'Water Quality Critical', description: 'Turbidity extremely high — severe sediment contamination', severity: 'critical', enabled: true, threshold: 200, thresholdLabel: 'Turbidity', unit: 'NTU', sensorKind: 'turbidity', operator: '>' },
  { id: 'high_turbidity', label: 'High Turbidity', description: 'Water turbidity elevated — possible contamination or runoff', severity: 'warning', enabled: true, threshold: 100, thresholdLabel: 'Turbidity', unit: 'NTU', sensorKind: 'turbidity', operator: '>' },
  { id: 'water_temp_abnormal', label: 'Abnormal Water Temp', description: 'Water temperature high — aquatic ecosystem stress', severity: 'warning', enabled: true, threshold: 32, thresholdLabel: 'Water temp', unit: '°C', sensorKind: 'waterTemp', operator: '>' },
  { id: 'sensor_fluctuation', label: 'Sensor Fluctuation', description: 'Abnormal readings detected — possible sensor malfunction', severity: 'info', enabled: true, threshold: 0.4, thresholdLabel: 'StdDev/Range ratio', unit: '', sensorKind: 'generic', operator: '>' },
  { id: 'node_offline', label: 'Node Offline', description: 'Field node lost connection — data gap risk', severity: 'warning', enabled: true, threshold: 1, thresholdLabel: 'Offline nodes', unit: '', sensorKind: 'system', operator: '>=' },
]

interface AlertConfigState {
  rules: AlertRuleConfig[]
  updateRule: (id: string, updates: Partial<AlertRuleConfig>) => void
  addRule: (rule: Omit<AlertRuleConfig, 'id'>) => void
  removeRule: (id: string) => void
  resetRules: () => void
  getEnabledRules: () => AlertRuleConfig[]
}

export const useAlertConfigStore = create<AlertConfigState>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_RULES,
      updateRule: (id, updates) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      addRule: (rule) =>
        set((s) => ({
          rules: [...s.rules, { ...rule, id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }],
        })),
      removeRule: (id) =>
        set((s) => ({
          rules: s.rules.filter((r) => r.id !== id),
        })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
      getEnabledRules: () => get().rules.filter((r) => r.enabled),
    }),
    { name: 'hydropower-alert-config' },
  ),
)
