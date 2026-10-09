import { useState } from 'react'
import type { AlertRuleConfig } from '../../store/alertConfig'
import type { AlertSeverity } from '../../lib/alertEngine'
import { Field } from './Field'

export function AddRuleForm({
  onAdd,
  onCancel,
}: {
  onAdd: (rule: Omit<AlertRuleConfig, 'id'>) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('New Rule')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [threshold, setThreshold] = useState(50)
  const [operator, setOperator] = useState<AlertRuleConfig['operator']>('>')
  const [sensorKind, setSensorKind] = useState('water')
  const [unit, setUnit] = useState('%')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    onAdd({
      label: label.trim(),
      description: description.trim() || `${label} condition detected`,
      severity,
      enabled: true,
      threshold,
      thresholdLabel: label.trim(),
      unit,
      sensorKind,
      operator,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Label">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-10 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none transition-colors focus:border-ac/50"
          />
        </Field>
        <Field label="Severity">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
            className="h-10 w-full cursor-pointer rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none focus:border-ac/50"
          >
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </Field>
        <Field label="Threshold">
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
            className="h-10 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 font-mono text-[0.72rem] text-tx outline-none transition-colors focus:border-ac/50"
          />
        </Field>
        <Field label="Operator">
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as AlertRuleConfig['operator'])}
            className="h-10 w-full cursor-pointer rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none focus:border-ac/50"
          >
            <option value=">">&gt; Greater than</option>
            <option value="<">&lt; Less than</option>
            <option value=">=">&ge; Greater or equal</option>
            <option value="<=">&le; Less or equal</option>
            <option value="==">= Equals</option>
            <option value="!=">&ne; Not equal</option>
          </select>
        </Field>
        <Field label="Sensor">
          <select
            value={sensorKind}
            onChange={(e) => setSensorKind(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none focus:border-ac/50"
          >
            <option value="water">Water level</option>
            <option value="rain">Rainfall</option>
            <option value="temp">Temperature</option>
            <option value="atmp">Atmospheric pressure</option>
            <option value="turbidity">Turbidity</option>
            <option value="waterTemp">Water temperature</option>
            <option value="system">System</option>
            <option value="generic">Generic</option>
          </select>
        </Field>
        <Field label="Unit">
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-10 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none transition-colors focus:border-ac/50"
          />
        </Field>
      </div>
      <Field label="Description">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this rule monitors..."
          className="h-10 w-full rounded-xl border-2 border-tx3/10 bg-s1 px-3 text-[0.72rem] text-tx outline-none transition-colors focus:border-ac/50 placeholder:text-tx3/40"
        />
      </Field>
      <div className="flex justify-end gap-2 border-t-2 border-tx3/10 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-xl border-2 border-tx3/15 bg-s2/50 px-4 py-2.5 text-[0.66rem] font-bold text-tx2 transition-colors hover:border-ac/30 hover:text-ac"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="cursor-pointer rounded-xl border-2 border-ac/30 bg-ac/8 px-5 py-2.5 text-[0.66rem] font-bold text-ac transition-all hover:bg-ac/15"
        >
          Add rule
        </button>
      </div>
    </form>
  )
}
