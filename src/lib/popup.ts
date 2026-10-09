/**
 * Queue-based popup state (shared by PopupCenter). Alerts and confirmations
 * render as in-app modal dialogs, one at a time, auto-advancing.
 */

export interface PopupRequest {
  title: string
  message: string
  danger?: boolean
  /** kind 'confirm' renders Cancel/Confirm buttons; 'alert' renders a single OK. */
  kind: 'alert' | 'confirm'
  confirmLabel?: string
  cancelLabel?: string
}

interface Queued extends Required<PopupRequest> {
  id: number
  resolve: (v: boolean) => void
}

let seq = 0
const queue: Queued[] = []
let active: Queued | null = null
const listeners = new Set<() => void>()

function publish() {
  active = queue[0] ?? null
  queueMicrotask(() => {
    listeners.forEach((l) => l())
  })
}

function push(req: PopupRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const item: Queued = {
      id: ++seq,
      title: req.title,
      message: req.message,
      danger: req.danger ?? false,
      kind: req.kind,
      confirmLabel: req.confirmLabel ?? 'OK',
      cancelLabel: req.cancelLabel ?? 'Cancel',
      resolve,
    }
    queue.push(item)
    publish()
  })
}

/** Confirmation popup — resolves true only when the user confirms. */
export function requestConfirm(opts: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}): Promise<boolean> {
  return push({ ...opts, kind: 'confirm' })
}

/** Alert popup — resolves true when acknowledged (auto-dismisses after 6s). */
export function showAlertPopup(opts: { title: string; message: string; danger?: boolean }): Promise<boolean> {
  return push({ ...opts, kind: 'alert', confirmLabel: 'OK' })
}

/** Resolve and remove the popup with the given id (advances the queue). */
export function settlePopup(id: number, value: boolean) {
  const idx = queue.findIndex((q) => q.id === id)
  if (idx === -1) return
  const [item] = queue.splice(idx, 1)
  item.resolve(value)
  queueMicrotask(() => {
    publish()
  })
}

/** Subscribe to active-popup changes. Returns the current popup and an unsubscribe fn. */
export function subscribePopup(listener: () => void): () => void {
  listeners.add(listener)
  queueMicrotask(() => listener())
  return () => {
    listeners.delete(listener)
  }
}

export function getActivePopup(): Queued | null {
  return active
}
