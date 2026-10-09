import { notifyDynamicIsland } from '../components/ui/DynamicIsland'

let audioEl: HTMLAudioElement | null = null

export function ensureAudio() {
  if (!audioEl) {
    audioEl = document.createElement('audio')
    audioEl.preload = 'auto'
    audioEl.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    document.body.appendChild(audioEl)
  }
  return audioEl
}

export function playEmergencyAudio() {
  try {
    const a = ensureAudio()
    a.currentTime = 0
    a.play().catch(() => {})
  } catch {
    /* ignore */
  }
}

export function notifyNewMessage(nodeId: number, text: string, priority: number) {
  const emergency = priority === 3
  notifyDynamicIsland({
    id: `msg-${nodeId}-${Date.now()}`,
    title: emergency ? 'Emergency' : `Message · Node-${nodeId}`,
    message: text.slice(0, 80),
    details: `Node: ${nodeId}\nPriority: ${priority === 3 ? 'Critical' : priority === 2 ? 'High' : 'Normal'}\nTime: ${new Date().toLocaleTimeString()}\n\n${text}`,
    type: emergency ? 'critical' : 'info',
  })
  if (emergency) playEmergencyAudio()
}
