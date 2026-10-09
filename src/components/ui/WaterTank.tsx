import { cn } from '@/lib/utils'

/** Compact liquid tank gauge with animated surface wave. */
export function WaterTank({ pct, className }: { pct: number; className?: string }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-tx3/15 bg-s2', className)}>
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between px-1.5">
        {[25, 50, 75].map((t) => (
          <span key={t} className="block border-t border-tx3/10" />
        ))}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{ height: `${Math.max(p, p > 0 ? 4 : 0)}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/80 to-indigo-400/70" />
        <div className="absolute inset-x-0 top-0 h-3 overflow-hidden">
          <svg className="liquid-wave absolute -top-1 h-6 w-[200%]" viewBox="0 0 200 20" preserveAspectRatio="none">
            <path d="M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V 20 H 0 Z" fill="rgba(255,255,255,0.35)" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/** Minimal smooth polyline sparkline. */
export function Sparkline({
  values,
  color = '#006194',
  className,
}: {
  values: number[]
  color?: string
  className?: string
}) {
  if (values.length < 2) return null
  const w = 100
  const h = 24
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / range) * (h - 4) - 2])
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [x, y] = pts[i]
    const mx = (px + x) / 2
    d += ` Q ${px} ${py}, ${mx} ${(py + y) / 2} T ${x} ${y}`
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
