import type { NavigateFunction } from 'react-router-dom'

let navigateFn: NavigateFunction | null = null

export function registerNavigate(fn: NavigateFunction) {
  navigateFn = fn
}

export function nav(path: string) {
  if (navigateFn) navigateFn(path)
  else window.location.assign(path)
}
