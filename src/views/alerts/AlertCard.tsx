import { type AlertEntry } from '../../store/nexus'
import { cn } from '../../lib/utils'
import { SEV, formatTimeAgo } from './alertTypes'

export function AlertCard({ alert }: { alert: AlertEntry }) {
  const s = SEV[alert.severity] || SEV.info
  const Icon = s.icon
  const timeAgo = alert.ts ? formatTimeAgo(alert.ts) : ''

  return (
    <div className={cn('rounded-2xl border-2 px-4 py-3 transition-all', s.border, s.bg, s.glow)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', s.color)}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-[0.72rem] font-bold', s.color)}>{alert.label}</span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[0.44rem] font-bold uppercase', s.badge)}>
              {alert.severity}
            </span>
          </div>
          <div className="mt-0.5 text-[0.6rem] leading-relaxed text-tx2">{alert.message}</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-[0.5rem] text-tx3">{timeAgo}</span>
            {alert.sensorKind !== 'system' && (
              <span className="rounded-md border-2 border-tx3/10 bg-s1 px-1.5 py-0.5 font-mono text-[0.48rem] text-tx3">
                {alert.sensorKind}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
