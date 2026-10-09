import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX as X } from 'react-icons/lu'
import { cn } from '../../lib/utils'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
  dismissible?: boolean
  centered?: boolean
  panelClassName?: string
  header?: React.ReactNode
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 'max-w-[380px]',
  dismissible = true,
  centered = false,
  panelClassName,
  header,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const wasOpen = useRef(open)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const firstOpen = !wasOpen.current
    wasOpen.current = true
    if (firstOpen && !panel?.contains(previouslyFocused)) panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab' && panel) {
        const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (wasOpen.current) {
        wasOpen.current = false
        previouslyFocused?.focus()
      }
    }
  }, [open, dismissible])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[6000] flex items-center justify-center bg-white/40 p-4 backdrop-blur-[16px] dark:bg-black/50"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-3xl border-2 border-tx3/10 bg-s1 p-5 shadow-[0_16px_48px_rgba(16,24,40,0.18)] outline-none',
          width,
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-tx3 transition-colors hover:bg-rd/10 hover:text-rd"
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        )}
        {title && (
          <div className="mb-4 flex items-center gap-2">
            <div
              className={cn(
                'font-display text-[0.82rem] font-bold tracking-[0.04em] text-tx',
                centered && 'mb-4 text-center text-[0.95rem]',
              )}
            >
              {title}
            </div>
            {header}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
