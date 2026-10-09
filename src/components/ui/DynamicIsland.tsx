import { useEffect, useState, useRef, useCallback } from 'react'
import { LuBell, LuInfo, LuTriangleAlert, LuX } from 'react-icons/lu'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

interface Notification {
  id: string
  title: string
  message?: string
  details?: string
  type: 'info' | 'warning' | 'critical'
  ts: number
}

let notifyFn: ((n: Notification) => void) | null = null

export function notifyDynamicIsland(n: Omit<Notification, 'ts'>) {
  notifyFn?.({ ...n, ts: Date.now() })
}

export function DynamicIslandNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [state, setState] = useState<'idle' | 'preview' | 'expanded'>('idle')
  const [visible, setVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setState('idle')
      setVisible(false)
    }, 10000)
  }, [])

  useEffect(() => {
    notifyFn = (n) => {
      const item = { ...n, ts: Date.now() }
      setItems((prev) => [...prev.slice(-9), item])
      setVisible(true)
      setState('preview')
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      previewTimerRef.current = setTimeout(() => {
        setState((prev) => (prev === 'preview' ? 'idle' : prev))
      }, 4000)
      resetHideTimer()
    }
    return () => {
      notifyFn = null
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [resetHideTimer])

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [resetHideTimer])

  const count = items.length
  const latest = items[items.length - 1]

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
    if (items.length <= 1) {
      setState('idle')
    }
  }

  const handlePillClick = () => {
    if (count === 0) return
    setVisible(true)
    if (state === 'expanded') {
      setState('idle')
    } else {
      setState('expanded')
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      resetHideTimer()
    }
  }

  const isExpanded = state === 'expanded'
  const isPreview = state === 'preview'
  const showText = isExpanded || isPreview

  return (
    <div
      className={cn(
        'relative z-[300] flex justify-center transition-all duration-500',
        !visible && '-translate-y-20 opacity-0 pointer-events-none',
      )}
    >
      <div className="relative">
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'overflow-hidden border-2 border-tx3/15 bg-s1',
            isExpanded ? 'rounded-3xl w-[26rem]' : 'rounded-full cursor-pointer hover:bg-s2/50',
            !isExpanded && (showText ? 'w-auto' : 'w-11')
          )}
          onClick={!isExpanded ? handlePillClick : undefined}
        >
          <AnimatePresence mode="popLayout">
            {!isExpanded ? (
              <motion.div
                key="pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-[40px] items-center px-1"
              >
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  <LuBell size={20} className={cn(count > 0 ? 'text-ac' : 'text-tx3')} />
                </span>
                {showText && (
                  <span
                    className={cn(
                      'overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                      showText ? 'max-w-[240px] opacity-100 pr-3 ml-1.5' : 'max-w-0 opacity-0 ml-0',
                    )}
                  >
                    {latest && (
                      <>
                        <span className="text-[0.68rem] font-bold text-tx">{latest.title}</span>
                        {latest.message && (
                          <span className="ml-1.5 text-[0.6rem] text-tx2">· {latest.message}</span>
                        )}
                      </>
                    )}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {latest && (
                  <>
                    <div className="flex items-center gap-3 border-b-2 border-tx3/10 px-5 py-4">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                          latest.type === 'critical' && 'bg-rd/15 text-rd',
                          latest.type === 'warning' && 'bg-am/15 text-am',
                          latest.type === 'info' && 'bg-ac/15 text-ac',
                        )}
                      >
                        {latest.type === 'critical' ? <LuTriangleAlert size={20} /> : <LuInfo size={20} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          'text-[0.82rem] font-bold',
                          latest.type === 'critical' && 'text-rd',
                          latest.type === 'warning' && 'text-am',
                          latest.type === 'info' && 'text-ac',
                        )}>
                          {latest.title}
                        </div>
                        {latest.message && (
                          <div className="mt-1 text-[0.68rem] leading-relaxed text-tx2">{latest.message}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setState('idle')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-tx3 transition-colors hover:bg-tx3/10 hover:text-tx"
                      >
                        <LuX size={16} />
                      </button>
                    </div>

                    {latest.details && (
                      <div className="px-5 py-4">
                        <div className="mb-2.5 text-[0.6rem] font-bold tracking-[0.1em] text-tx3 uppercase">Trigger Details</div>
                        <div className="whitespace-pre-wrap rounded-2xl border border-tx3/10 bg-s2/50 p-3 text-[0.66rem] leading-relaxed text-tx2">{latest.details}</div>
                      </div>
                    )}

                    {items.length > 1 && (
                      <div className="border-t-2 border-tx3/10 px-5 py-3">
                        <div className="mb-2 text-[0.6rem] font-bold tracking-[0.1em] text-tx3 uppercase">
                          {items.length - 1} more notifications
                        </div>
                        <div className="flex flex-col gap-1">
                          {items.slice(0, -1).reverse().slice(0, 3).map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => dismiss(n.id)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-s2/50"
                            >
                              <span
                                className={cn(
                                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                                  n.type === 'critical' && 'bg-rd/15 text-rd',
                                  n.type === 'warning' && 'bg-am/15 text-am',
                                  n.type === 'info' && 'bg-ac/15 text-ac',
                                )}
                              >
                                {n.type === 'critical' ? <LuTriangleAlert size={10} /> : <LuInfo size={10} />}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[0.64rem] font-medium text-tx2">{n.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ac px-1.5 text-[0.5rem] font-extrabold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
    </div>
  )
}
