import { useEffect, useState } from 'react'

/**
 * Current wall-clock time, refreshed every `intervalMs`.
 * All `Date.now()` calls happen inside an interval callback so renders stay pure.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}