import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TipDir = 'top' | 'bottom' | 'left' | 'right'
type Tip = { text: string; x: number; y: number; dir: TipDir }

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: HTMLElement | null = null

    const show = (target: HTMLElement) => {
      const text = target.getAttribute('data-tip') || ''
      const dir = (target.getAttribute('data-tip-pos') as TipDir) || 'top'
      const r = target.getBoundingClientRect()
      let x: number
      let y: number
      if (dir === 'top') {
        x = r.left + r.width / 2
        y = r.top - 8
      } else if (dir === 'bottom') {
        x = r.left + r.width / 2
        y = r.bottom + 8
      } else if (dir === 'left') {
        x = r.left - 8
        y = r.top + r.height / 2
      } else {
        x = r.right + 8
        y = r.top + r.height / 2
      }
      current = target
      setShift({ x: 0, y: 0 })
      setTip({ text, x, y, dir })
    }

    const hide = () => {
      current = null
      setTip(null)
    }

    const onOver = (e: MouseEvent) => {
      const host = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
      if (host && host !== current) show(host)
      else if (!host && current) hide()
    }

    const onOut = (e: MouseEvent) => {
      const host = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
      if (host && host !== current) show(host)
      else if (!host && current) hide()
    }

    const onFocusIn = (e: FocusEvent) => {
      const host = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
      if (host) show(host)
    }

    const onHide = () => hide()

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onHide, true)
    window.addEventListener('scroll', onHide, true)
    window.addEventListener('resize', onHide)

    return () => {
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onHide, true)
      window.removeEventListener('scroll', onHide, true)
      window.removeEventListener('resize', onHide)
    }
  }, [])

  useEffect(() => {
    const el = elRef.current
    if (!el || !tip) return
    const r = el.getBoundingClientRect()
    const pad = 8
    let dx = 0
    let dy = 0
    if (r.left < pad) dx = pad - r.left
    if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right
    if (r.top < pad) dy = pad - r.top
    if (r.bottom > window.innerHeight - pad) dy = window.innerHeight - pad - r.bottom
    if (dx !== 0 || dy !== 0) setShift({ x: dx, y: dy })
  }, [tip])

  if (!tip) return null

  const translate =
    tip.dir === 'top'
      ? 'translate(-50%, -100%)'
      : tip.dir === 'bottom'
        ? 'translate(-50%, 0)'
        : tip.dir === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)'

  return createPortal(
    <div
      ref={elRef}
      role="tooltip"
      className="pointer-events-none fixed z-[2147483647] max-w-[280px] rounded-lg bg-tx px-2.5 py-1.5 font-sans text-[0.62rem] font-medium leading-snug text-bg shadow-[0_6px_24px_rgba(16,24,40,0.35)]"
      style={{ left: tip.x + shift.x, top: tip.y + shift.y, transform: translate }}
    >
      {tip.text}
    </div>,
    document.body,
  )
}
