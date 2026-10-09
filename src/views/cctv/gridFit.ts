import { useEffect, useRef, useState } from 'react'

interface CameraGridFitOptions {
  count: number
  targetAspect?: number
  minTileWidth?: number
  barHeight?: number
  gap?: number
  maxCols?: number
}

/* Rough height of the DVR control bar inside each tile — row height minus bar
   leaves the visible video area, which is what the aspect-fit targets. */
const DEFAULT_BAR_HEIGHT = 34
const DEFAULT_GAP = 10
const TARGET_ASPECT = 16 / 9

/**
 * Sizes the camera wall to its container: picks the column count whose tiles
 * come closest to the target aspect ratio (so video fills as much space as
 * possible), while never letting tiles get cramped or overflow the viewport.
 *
 * - 1 camera → 1 column → the whole monitor area.
 * - wide/narrow screens adapt via ResizeObserver.
 * - many cameras → capped at `maxCols` so tiles stay usable.
 */
export function useCameraGridFit({
  count,
  targetAspect = TARGET_ASPECT,
  minTileWidth = 200,
  barHeight = DEFAULT_BAR_HEIGHT,
  gap = DEFAULT_GAP,
  maxCols = 6,
}: CameraGridFitOptions): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const compute = () => {
      const rect = el.getBoundingClientRect()
      const W = rect.width
      const H = rect.height
      if (count <= 1 || !W || !H) {
        setCols(1)
        return
      }
      let best = 1
      let bestScore = -Infinity
      const max = Math.min(count, maxCols)
      for (let c = 1; c <= max; c++) {
        const rows = Math.ceil(count / c)
        const tileW = (W - gap * (c - 1)) / c
        const tileH = (H - gap * (rows - 1)) / rows
        const videoH = Math.max(tileH - barHeight, 1)
        if (tileW < minTileWidth && c > 1) continue
        const aspect = tileW / videoH
        const fit = -Math.abs(aspect - targetAspect)
        const area = Math.log10(tileW * tileH)
        const score = fit * 10 + area
        if (score > bestScore) {
          bestScore = score
          best = c
        }
      }
      setCols(best)
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [count, targetAspect, minTileWidth, barHeight, gap, maxCols])

  return [ref as React.RefObject<HTMLDivElement | null>, cols]
}