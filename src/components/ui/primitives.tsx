import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

/* ── Button ── */
type ButtonVariant = 'default' | 'primary' | 'green' | 'red' | 'amber' | 'blue' | 'cyan'
type ButtonSize = 'xs' | 'sm' | 'md' | 'full'

const btnVariants: Record<ButtonVariant, string> = {
  default: 'border-tx3/20 bg-s1 text-tx2 hover:border-ac/40 hover:text-ac',
  primary: 'border-ac bg-ac text-white hover:bg-ac2',
  green: 'border-gn/30 text-gn hover:bg-gn/10 hover:border-gn/60',
  red: 'border-rd/30 text-rd hover:bg-rd/10 hover:border-rd/60',
  amber: 'border-am/30 text-am hover:bg-am/10 hover:border-am/60',
  blue: 'border-ac/30 text-ac hover:bg-ac/10 hover:border-ac/60',
  cyan: 'border-ac2/30 text-ac2 hover:bg-ac2/10 hover:border-ac2/60',
}

const btnSizes: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-[0.62rem] gap-1',
  sm: 'px-2.5 py-1.5 text-[0.66rem] gap-1',
  md: 'px-3 py-2 text-[0.72rem] gap-1.5',
  full: 'px-3 py-2 text-[0.66rem] gap-1 w-full',
}

export function Button({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center select-none whitespace-nowrap rounded-md border font-medium transition-[background-color,border-color,color,transform] duration-100 cursor-pointer active:scale-[0.96] disabled:pointer-events-none disabled:opacity-25',
        btnVariants[variant],
        btnSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ── Panel ── */
export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative flex-shrink-0 rounded-2xl border-2 border-tx3/10 bg-s1 p-3 shadow-[0_2px_8px_rgba(16,24,40,0.04)] sm:rounded-3xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── Panel Title ── */
export function PanelTitle({ icon, badge, children }: { icon?: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-shrink-0 items-center gap-1.5 border-b border-tx3/10 pb-2 text-[0.66rem] font-semibold tracking-[0.08em] text-tx uppercase">
      {icon && <span className="opacity-70">{icon}</span>}
      <span className="flex-1">{children}</span>
      {badge}
    </div>
  )
}

/* ── Badge ── */
export function Badge({
  variant = 'default',
  className,
  children,
}: {
  variant?: 'default' | 'green' | 'amber' | 'red'
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-medium tracking-[0.06em]',
        variant === 'default' && 'border-tx3/20 text-tx3',
        variant === 'green' && 'border-gn/30 text-gn',
        variant === 'amber' && 'border-am/30 text-am',
        variant === 'red' && 'border-rd/30 text-rd',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ── Status Dot ── */
export function StatusDot({
  tone = 'off',
  pulse,
  className,
}: {
  tone?: 'green' | 'amber' | 'red' | 'off'
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        tone === 'green' && 'bg-gn',
        tone === 'amber' && 'bg-am',
        tone === 'red' && 'bg-rd',
        tone === 'off' && 'bg-tx3/50',
        pulse && 'animate-dot-pulse',
        className,
      )}
    />
  )
}

/* ── Empty State ── */
export function Empty({ icon, title, sub }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-[0.7rem] text-tx3">
      {icon && <span className="opacity-25">{icon}</span>}
      <div>{title}</div>
      {sub && <div className="text-[0.62rem]">{sub}</div>}
    </div>
  )
}

/* ── Safe Rich Text ──
   Renders plain text safely (React-escaped) while honoring only the
   whitelisted <b>, <code> and <br> tags. Any other HTML stays escaped. */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = []
  let bold = false
  let code = false
  text.split(/(<\/?(?:b|code|br)\s*\/?>)/gi).forEach((part, i) => {
    const t = part.trim().toLowerCase()
    if (t === '<b>') {
      bold = true
      return
    }
    if (t === '</b>') {
      bold = false
      return
    }
    if (t === '<code>') {
      code = true
      return
    }
    if (t === '</code>') {
      code = false
      return
    }
    if (t === '<br>' || t === '<br/>') {
      out.push(<br key={i} />)
      return
    }
    out.push(
      <span key={i} className={cn(code && 'rounded bg-s3 px-1 font-mono text-[0.95em]')}>
        {bold ? <b>{part}</b> : part}
      </span>,
    )
  })
  return <>{out}</>
}
