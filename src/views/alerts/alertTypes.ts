import {
  LuShieldAlert,
  LuTriangleAlert,
  LuActivity,
} from 'react-icons/lu'

export const SEV = {
  critical: { icon: LuShieldAlert, color: 'text-rd', bg: 'bg-rd/8', border: 'border-rd/20', badge: 'bg-rd/10 text-rd', glow: 'shadow-[0_0_20px_rgba(220,38,38,0.08)]' },
  warning: { icon: LuTriangleAlert, color: 'text-am', bg: 'bg-am/8', border: 'border-am/20', badge: 'bg-am/10 text-am', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.08)]' },
  info: { icon: LuActivity, color: 'text-ac', bg: 'bg-ac/8', border: 'border-ac/20', badge: 'bg-ac/10 text-ac', glow: 'shadow-[0_0_20px_rgba(0,97,148,0.08)]' },
} as const

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}
