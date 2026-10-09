import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── timing / formatting helpers ── */
export function pad(n: number, len = 2) {
  return String(n).padStart(len, '0')
}

export function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function timestampSlug(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/* ── mesh / RF helpers ── */
export const MASTER_MAC = 'MASTER'
export const BASE_STATION_NAME = 'AN-FOREST-MASTER'
export const BASE_STATION_LABEL = 'BASE (C6)'

export function macFmt(h?: string | null): string {
  if (!h || h.length !== 12) return h || '?'
  return h.match(/.{2}/g)!.join(':').toUpperCase()
}

export function shortMac(mac?: string | null): string {
  if (!mac || mac === MASTER_MAC) return 'BASE'
  return mac.includes(':') ? mac.split(':').slice(-2).join('') : mac.slice(-4).toUpperCase()
}

export function rssiToDistance(rssi: number | null | undefined): number | null {
  if (!rssi || rssi === 0) return null
  const d = Math.pow(10, (-45 - rssi) / (10 * 2.5))
  return Math.min(Math.max(d, 1), 500)
}

export function distLabel(d: number | null): string {
  if (d === null) return '—'
  return d < 1000 ? `~${Math.round(d)}m` : `~${(d / 1000).toFixed(2)}km`
}

export function sigQuality(rssi: number | null | undefined): number {
  if (!rssi) return 0
  return Math.max(0, Math.min(100, Math.round(2 * (rssi + 100))))
}

export type SigTone = 'good' | 'fair' | 'poor'

/* shared quality tiers used by every RSSI indicator in the app */
export function sigTone(rssi: number | null | undefined): SigTone {
  const q = sigQuality(rssi)
  if (q > 60) return 'good'
  if (q > 35) return 'fair'
  return 'poor'
}

export const SIG_TONE_HEX: Record<SigTone, string> = { good: '#16a34a', fair: '#d97706', poor: '#dc2626' }
export const SIG_TONE_CSS: Record<SigTone, string> = {
  good: 'var(--color-gn)',
  fair: 'var(--color-am)',
  poor: 'var(--color-rd)',
}

export function canvasBearing(nx: number, ny: number, mx: number, my: number) {
  const dx = nx - mx
  const dy = ny - my
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI + 360
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return { deg: Math.round(deg) % 360, label: dirs[Math.round(deg / 22.5) % 16] }
}
