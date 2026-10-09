import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IconType } from 'react-icons'
import { LuAntenna, LuRadioTower } from 'react-icons/lu'

const cache = new Map<string, Promise<HTMLImageElement>>()

function svgDataUrl(icon: IconType, size: number, color: string): string {
  const svg = renderToStaticMarkup(createElement(icon, { size, color, strokeWidth: 2.2 }))
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function getIconSprite(key: string, icon: IconType, size: number, color: string): Promise<HTMLImageElement> {
  const cacheKey = `${key}:${size}:${color}`
  let p = cache.get(cacheKey)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.src = svgDataUrl(icon, size * 2, color)
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`icon sprite failed: ${cacheKey}`))
    })
    cache.set(cacheKey, p)
  }
  return p
}

export function drawIconSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  icon: IconType,
  size: number,
  color: string,
  alpha = 1,
) {
  getIconSprite(key, icon, size, color)
    .then((img) => {
      ctx.globalAlpha = alpha
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
    })
    .catch(() => {})
}

export function prewarmIconSprites(variants: { key: string; icon: IconType; size: number; color: string }[]) {
  variants.forEach((v) => {
    getIconSprite(v.key, v.icon, v.size, v.color).catch(() => {})
  })
}

export { LuAntenna, LuRadioTower }
