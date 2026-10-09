import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'an-nexus-theme'

export function systemTheme(): Theme {
  return 'light'
}

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
}

/** Apply stored theme (or system preference) before the app renders. */
export function initTheme() {
  applyTheme(getStoredTheme() ?? systemTheme())
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook — re-renders when the theme changes. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme)
  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t)
    applyTheme(t)
    emit()
  }
  return [theme, setTheme]
}
