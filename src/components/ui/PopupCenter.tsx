import { useEffect, useState } from 'react'
import { LuInfo, LuTriangleAlert } from 'react-icons/lu'
import { Dialog } from './Dialog'
import { cn } from '../../lib/utils'
import { getActivePopup, settlePopup, subscribePopup } from '../../lib/popup'
import { notifyDynamicIsland } from './DynamicIsland'

const btnBase =
  'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[0.7rem] font-semibold transition-colors active:scale-[0.97]'

/** Fire an alert as a dynamic island notification. */
function fireAlertIsland(item: ReturnType<typeof getActivePopup>) {
  if (!item) return
  const danger = Boolean(item.danger)
  notifyDynamicIsland({
    id: `alert-${item.id}`,
    title: item.title,
    message: item.message,
    details: `Severity: ${danger ? 'Critical' : 'Warning'}\nTime: ${new Date().toLocaleTimeString()}\n\n${item.message || ''}`,
    type: danger ? 'critical' : 'warning',
  })
}

export function PopupCenter() {
  const [current, setCurrent] = useState(() => getActivePopup())

  useEffect(() => {
    const unsub = subscribePopup(() => {
      const next = getActivePopup()
      setCurrent(next)
      if (next && next.kind === 'alert') fireAlertIsland(next)
    })
    return () => {
      unsub()
      const a = getActivePopup()
      if (a && a.kind === 'alert') settlePopup(a.id, false)
    }
  }, [])

  if (!current) return null
  if (current.kind === 'alert') return null

  const close = (v: boolean) => settlePopup(current.id, v)
  const danger = Boolean(current.danger)
  const Icon = danger ? LuTriangleAlert : LuInfo

  return (
    <Dialog
      open
      onClose={() => close(false)}
      dismissible
      width="max-w-[400px]"
      panelClassName="overflow-hidden p-0"
    >
      <div className="flex flex-col">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              danger ? 'bg-rd/12 text-rd' : 'bg-ac/12 text-ac',
            )}
          >
            <Icon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.82rem] leading-tight font-bold tracking-wide text-tx">{current.title}</h2>
            <p className="mt-1 text-[0.72rem] leading-relaxed break-words text-tx2">{current.message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-tx3/10 bg-s2/60 px-5 py-3">
          <button
            onClick={() => close(false)}
            className={cn(btnBase, 'border border-tx3/15 bg-s1 text-tx2 hover:border-tx3/30 hover:text-tx')}
          >
            {current.cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            className={cn(btnBase, danger ? 'bg-rd text-bg hover:bg-rd/90' : 'bg-ac text-bg hover:bg-ac/90')}
          >
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
