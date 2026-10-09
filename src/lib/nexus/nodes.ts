import { useNexusStore, type NexusNodeProps } from '../../store/nexus'
import { usePositionsStore } from '../../store/positions'
import { MASTER_MAC } from '../utils'

export function canvasSize(): { W: number; H: number } {
  const el = document.getElementById('topology-canvas')
  return { W: el?.offsetWidth || 600, H: el?.offsetHeight || 400 }
}

export function ensureNodeWithPos(mac: string, props: Partial<NexusNodeProps>) {
  const store = useNexusStore.getState()
  store.ensureNode(mac, props)
  const posStore = usePositionsStore.getState()
  if (!posStore.positions[mac]) {
    const { W, H } = canvasSize()
    const pos =
      mac === MASTER_MAC
        ? { x: W / 2, y: H / 2 }
        : { x: 70 + Math.random() * (W - 140), y: 60 + Math.random() * (H - 120) }
    posStore.setPos(mac, pos)
  }
}

export function autoLayout() {
  const posStore = usePositionsStore.getState()
  const store = useNexusStore.getState()
  const { W, H } = canvasSize()
  const master = store.nodes[MASTER_MAC]
  const positions: Record<string, { x: number; y: number }> = {}
  if (master) positions[MASTER_MAC] = { x: W / 2, y: H / 2 }
  const slaves = Object.values(store.nodes).filter((n) => !n.isMaster && n.mac !== MASTER_MAC)
  slaves.forEach((n, i) => {
    const angle = (i / Math.max(slaves.length, 1)) * Math.PI * 2 - Math.PI / 2
    const rad = Math.min(W, H) * 0.34
    positions[n.mac] = { x: W / 2 + Math.cos(angle) * rad, y: H / 2 + Math.sin(angle) * rad }
  })
  posStore.setMany(positions)
}
