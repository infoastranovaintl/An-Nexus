import { useState } from 'react'
import {
  LuBellRing,
  LuRotateCcw,
  LuSlidersHorizontal,
  LuPower,
  LuInfo,
  LuCircleCheck,
  LuPlus,
  LuTrash2,
  LuSettings2,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { useAlertConfigStore, type AlertRuleConfig } from '../../store/alertConfig'
import type { AlertSeverity } from '../../lib/alertEngine'
import { cn } from '../../lib/utils'
import { Dialog } from '../../components/ui/Dialog'
import { SEV } from './alertTypes'
import { AlertCard } from './AlertCard'
import { AddRuleForm } from './AddRuleForm'
import { Pagination } from './Pagination'
import { Field } from './Field'

const PAGE_SIZE = 10

export function AlertsView() {
  const alerts = useNexusStore((s) => s.alerts)
  const clearAlerts = useNexusStore((s) => s.clearAlerts)
  const rules = useAlertConfigStore((s) => s.rules)
  const updateRule = useAlertConfigStore((s) => s.updateRule)
  const addRule = useAlertConfigStore((s) => s.addRule)
  const removeRule = useAlertConfigStore((s) => s.removeRule)
  const resetRules = useAlertConfigStore((s) => s.resetRules)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [alertPage, setAlertPage] = useState(0)
  const [rulePage, setRulePage] = useState(0)

  const alertPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE))
  const rulePages = Math.max(1, Math.ceil(rules.length / PAGE_SIZE))
  const pagedAlerts = alerts.slice(alertPage * PAGE_SIZE, (alertPage + 1) * PAGE_SIZE)
  const pagedRules = rules.slice(rulePage * PAGE_SIZE, (rulePage + 1) * PAGE_SIZE)

  return (
<div
         className="nexus-scroll flex h-full flex-col gap-4 overflow-y-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-tx3/10 bg-s1 px-4 py-2.5">
            <LuBellRing size={16} className="text-ac" />
            <span className="text-[0.82rem] font-bold text-tx">Alerts</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-ac/30 bg-ac/8 px-3 py-2 text-[0.62rem] font-bold text-ac transition-all hover:bg-ac/15 active:scale-[0.96]"
            >
              <LuPlus size={12} />
              Add rule
            </button>
            {alerts.length > 0 && (
              <button
                onClick={clearAlerts}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-rd/20 bg-rd/8 px-3 py-2 text-[0.6rem] font-bold text-rd transition-all hover:bg-rd/15 active:scale-[0.96]"
              >
                <LuRotateCcw size={10} />
                Clear all
              </button>
            )}
          </div>
        </div>

         <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
           <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 border-b-2 border-tx3/10 px-5 py-3.5">
              <LuBellRing size={14} className="text-ac" />
              <span className="text-[0.72rem] font-bold text-tx">Active Alerts</span>
              <span className="ml-auto rounded-full border-2 border-tx3/10 bg-s2/40 px-2 py-0.5 font-mono text-[0.52rem] font-bold text-tx3">
                {alerts.length}
              </span>
            </div>
            <div className="nexus-scroll min-h-0 overflow-y-auto p-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-tx3/10 py-12 text-center">
                  <LuCircleCheck size={28} className="text-gn" />
                  <div>
                    <div className="text-[0.78rem] font-bold text-tx">All clear</div>
                    <div className="mt-1 text-[0.58rem] text-tx3">No alerts firing right now</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {pagedAlerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                  {alertPages > 1 && (
                    <Pagination page={alertPage} pages={alertPages} onPage={setAlertPage} />
                  )}
                </>
              )}
            </div>
          </div>

           <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 border-b-2 border-tx3/10 px-5 py-3.5">
              <LuSlidersHorizontal size={14} className="text-ac" />
              <span className="text-[0.72rem] font-bold text-tx">Alert Rules</span>
              <span className="ml-auto rounded-full border-2 border-tx3/10 bg-s2/40 px-2 py-0.5 font-mono text-[0.52rem] font-bold text-tx3">
                {rules.length}
              </span>
            </div>
            <div className="nexus-scroll min-h-0 overflow-y-auto p-4">
              <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-ac/15 bg-ac/5 px-4 py-3">
                <LuInfo size={14} className="mt-0.5 shrink-0 text-ac" />
                <div className="min-w-0 flex-1 text-[0.62rem] leading-relaxed text-tx2">
                  Adjust thresholds to match your site. Changes save automatically and take effect next cycle.
                </div>
                <button
                  onClick={resetRules}
                  className="shrink-0 cursor-pointer rounded-xl border-2 border-tx3/15 bg-s1 px-2.5 py-1.5 text-[0.54rem] font-bold text-tx2 transition-colors hover:border-ac/30 hover:text-ac"
                >
                  Reset
                </button>
              </div>
              {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-tx3/10 py-12 text-center">
                  <LuInfo size={24} className="text-tx3" />
                  <div>
                    <div className="text-[0.76rem] font-bold text-tx">No rules configured</div>
                    <div className="mt-1 text-[0.58rem] text-tx3">Click "Add rule" to start monitoring</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {pagedRules.map((rule) => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        expanded={expanded === rule.id}
                        onToggle={() => setExpanded(expanded === rule.id ? null : rule.id)}
                        onUpdate={(u) => updateRule(rule.id, u)}
                        onDelete={() => removeRule(rule.id)}
                      />
                    ))}
                  </div>
                  {rulePages > 1 && (
                    <Pagination page={rulePage} pages={rulePages} onPage={setRulePage} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Dialog open={showAdd} onClose={() => setShowAdd(false)} title="Add Alert Rule" width="max-w-[560px]">
          <AddRuleForm
            onAdd={(rule) => { addRule(rule); setShowAdd(false) }}
            onCancel={() => setShowAdd(false)}
         />
       </Dialog>
       </div>
   )
}

function RuleCard({
  rule,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  rule: AlertRuleConfig
  expanded: boolean
  onToggle: () => void
  onUpdate: (u: Partial<AlertRuleConfig>) => void
  onDelete: () => void
}) {
  const s = SEV[rule.severity]

  return (
    <div className={cn('rounded-2xl border-2 transition-all', rule.enabled ? cn(s.border, s.bg, s.glow) : 'border-tx3/10 bg-s2/30')}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => onUpdate({ enabled: !rule.enabled })}
          className={cn(
            'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all',
            rule.enabled ? `${s.color} ${s.bg} border ${s.border}` : 'text-tx3 bg-tx3/10',
          )}
        >
          <LuPower size={13} />
        </button>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className={cn('text-[0.72rem] font-bold', rule.enabled ? 'text-tx' : 'text-tx3')}>
              {rule.label}
            </span>
          </div>
          <div className="mt-0.5 text-[0.56rem] text-tx3">{rule.description}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-lg border-2 border-tx3/10 bg-s1 px-2.5 py-1 font-mono text-[0.62rem] font-bold text-tx">
            {rule.operator} {rule.threshold}{rule.unit}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-tx3 transition-colors hover:bg-rd/10 hover:text-rd"
          >
            <LuTrash2 size={12} />
          </button>
          <button
            onClick={onToggle}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-tx3 transition-colors hover:bg-tx3/10"
          >
            <LuSettings2 size={12} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t-2 border-tx3/10 px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Threshold">
              <input
                type="number"
                value={rule.threshold}
                onChange={(e) => onUpdate({ threshold: parseFloat(e.target.value) || 0 })}
                className="h-9 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 font-mono text-[0.68rem] text-tx outline-none focus:border-ac/50"
              />
            </Field>
            <Field label="Operator">
              <select
                value={rule.operator}
                onChange={(e) => onUpdate({ operator: e.target.value as AlertRuleConfig['operator'] })}
                className="h-9 w-full cursor-pointer rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.68rem] text-tx outline-none focus:border-ac/50"
              >
                <option value=">">&gt; Greater than</option>
                <option value="<">&lt; Less than</option>
                <option value=">=">&ge; Greater or equal</option>
                <option value="<=">&le; Less or equal</option>
                <option value="==">= Equals</option>
                <option value="!=">&ne; Not equal</option>
              </select>
            </Field>
            <Field label="Severity">
              <select
                value={rule.severity}
                onChange={(e) => onUpdate({ severity: e.target.value as AlertSeverity })}
                className="h-9 w-full cursor-pointer rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.68rem] text-tx outline-none focus:border-ac/50"
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </Field>
            <Field label="Label">
              <input
                type="text"
                value={rule.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                className="h-9 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.68rem] text-tx outline-none focus:border-ac/50"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description">
              <input
                type="text"
                value={rule.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className="h-9 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.68rem] text-tx outline-none focus:border-ac/50"
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3 font-mono text-[0.52rem] text-tx3">
            <span>sensor: {rule.sensorKind}</span>
            <span>.</span>
            <span>unit: {rule.unit || 'none'}</span>
          </div>
        </div>
      )}
    </div>
  )
}
