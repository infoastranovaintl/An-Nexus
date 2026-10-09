import { LuAntenna, LuRadioTower } from 'react-icons/lu'
import type { NexNode, Wire } from '../../store/nexus'
import { rssiToDistance, sigTone, SIG_TONE_HEX, distLabel, BASE_STATION_LABEL } from '../utils'
import { drawIconSprite, prewarmIconSprites } from './iconSprite'

const ACCENT = '#006194'
const ACCENT_SOFT = 'rgba(0,97,148,'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'
const INK = '#1b2432'

export const NODE_ICON_SIZE = 13 * 1.62
export const BASE_ICON_SIZE = 20 * 1.55

export function prewarmTopologySprites() {
  prewarmIconSprites([
    { key: 'node-online', icon: LuAntenna, size: NODE_ICON_SIZE, color: ACCENT },
    { key: 'node-unpaired', icon: LuAntenna, size: NODE_ICON_SIZE, color: AMBER },
    { key: 'node-offline', icon: LuAntenna, size: NODE_ICON_SIZE, color: RED },
    { key: 'base', icon: LuRadioTower, size: BASE_ICON_SIZE, color: ACCENT },
  ])
}

/* ── MESH BEACON ── */
export function drawBeacon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  r: number,
  selected: boolean,
  label: string,
  badge: number | null,
  online: boolean,
) {
  // pulse ring
  if (online) {
    const t = (Date.now() % 2200) / 2200
    const pr = r + t * r * 2
    ctx.beginPath()
    ctx.arc(x, y, pr, 0, Math.PI * 2)
    ctx.strokeStyle =
      color +
      Math.round((1 - t) * 28)
        .toString(16)
        .padStart(2, '0')
    ctx.lineWidth = 1
    ctx.stroke()
  }
  // selection ring
  if (selected) {
    ctx.beginPath()
    ctx.arc(x, y, r * 1.45, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, r * 1.45, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  // antenna glyph
  const iconKey = !online ? 'node-offline' : 'node-online'
  drawIconSprite(ctx, iconKey, x, y, LuAntenna, NODE_ICON_SIZE, color, online ? 1 : 0.85)
  // label
  ctx.fillStyle = selected ? INK : 'rgba(27,36,50,.66)'
  ctx.font = `${selected ? '600 ' : ''}10px Inter`
  ctx.textAlign = 'center'
  ctx.fillText(label, x, y + r + 20)
  // ── OFFLINE WARNING BADGE ──
  if (!online) {
    const wx = x
    const wy = y - r * 3.2
    const t2 = (Date.now() % 1800) / 1800
    const pulse = Math.sin(t2 * Math.PI * 2)
    ctx.save()
    ctx.fillStyle = `rgba(220,38,38,${0.06 + 0.06 * pulse})`
    const pw = 84
    const ph = 15
    const pr2 = 3
    ctx.beginPath()
    ctx.moveTo(wx - pw / 2 + pr2, wy - ph / 2)
    ctx.lineTo(wx + pw / 2 - pr2, wy - ph / 2)
    ctx.arcTo(wx + pw / 2, wy - ph / 2, wx + pw / 2, wy - ph / 2 + pr2, pr2)
    ctx.lineTo(wx + pw / 2, wy + ph / 2 - pr2)
    ctx.arcTo(wx + pw / 2, wy + ph / 2, wx + pw / 2 - pr2, wy + ph / 2, pr2)
    ctx.lineTo(wx - pw / 2 + pr2, wy + ph / 2)
    ctx.arcTo(wx - pw / 2, wy + ph / 2, wx - pw / 2, wy + ph / 2 - pr2, pr2)
    ctx.lineTo(wx - pw / 2, wy - ph / 2 + pr2)
    ctx.arcTo(wx - pw / 2, wy - ph / 2, wx - pw / 2 + pr2, wy - ph / 2, pr2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = `rgba(220,38,38,${0.4 + 0.3 * pulse})`
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.fillStyle = `rgba(220,38,38,${0.85 + 0.15 * pulse})`
    ctx.font = '600 7.5px Inter'
    ctx.textAlign = 'center'
    ctx.fillText('⚠  NODE OFFLINE', wx, wy + 3.5)
    ctx.restore()
  }
  // ID badge
  if (badge != null) {
    ctx.beginPath()
    ctx.arc(x + r * 1.15, y - r * 0.9, 9, 0, Math.PI * 2)
    ctx.fillStyle = AMBER
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 8px Inter'
    ctx.textAlign = 'center'
    ctx.fillText(String(badge), x + r * 1.15, y - r * 0.9 + 2.8)
  }
}

/* ── BASE STATION HEX ── */
export function drawBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  selected: boolean,
  online: boolean,
  label: string = BASE_STATION_LABEL,
) {
  const color = ACCENT
  const r = 20
  ;[2, 3, 4].forEach((m, i) => {
    ctx.beginPath()
    ctx.arc(x, y, r * m * 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = ACCENT_SOFT + `${0.06 - i * 0.013})`
    ctx.lineWidth = 1
    ctx.stroke()
  })
  // selection ring
  if (selected) {
    ctx.beginPath()
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  // router glyph
  drawIconSprite(ctx, 'base', x, y, LuRadioTower, BASE_ICON_SIZE, color, 1)
  // label
  ctx.fillStyle = selected ? INK : 'rgba(27,36,50,.7)'
  ctx.font = `${selected ? '600 ' : ''}10px Inter`
  ctx.textAlign = 'center'
  ctx.fillText(label, x, y + r + 16)
  // status dot
  ctx.beginPath()
  ctx.arc(x + r * 0.7, y - r * 0.7, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = online ? GREEN : RED
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/* ── LINK / WIRE ── */
const iconEdge = (n: DrawNode) => (n.isMaster ? 16 : 11)

export function drawLink(
  ctx: CanvasRenderingContext2D,
  from: DrawNode,
  to: DrawNode,
  rssi: number,
) {
  const online = from.online && to.online
  const dist = rssiToDistance(rssi)
  const dx = to.pos.x - from.pos.x
  const dy = to.pos.y - from.pos.y
  const len = Math.hypot(dx, dy) || 1
  const ax = from.pos.x + (dx / len) * (iconEdge(from) + 2)
  const ay = from.pos.y + (dy / len) * (iconEdge(from) + 2)
  const bx = to.pos.x - (dx / len) * (iconEdge(to) + 2)
  const by = to.pos.y - (dy / len) * (iconEdge(to) + 2)

  // wire — rounded, anchored at the icon edges
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.lineCap = 'round'
  ctx.strokeStyle = online ? 'rgba(79,70,229,0.5)' : 'rgba(27,36,50,0.22)'
  ctx.lineWidth = online ? 1.6 : 1.2
  ctx.setLineDash(online ? [] : [4, 6])
  ctx.stroke()
  ctx.setLineDash([])

  if (online && rssi) {
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const qual = sigTone(rssi)
    const qc = SIG_TONE_HEX[qual]
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.beginPath()
    ctx.roundRect(mx - 22, my - 9, 44, 17, 4)
    ctx.fill()
    ctx.strokeStyle = qc
    ctx.lineWidth = 0.7
    ctx.stroke()
    ctx.fillStyle = qc
    ctx.font = '7.5px Inter'
    ctx.textAlign = 'center'
    ctx.fillText(`${rssi}dBm`, mx, my + 4)
    if (dist) {
      ctx.fillStyle = 'rgba(27,36,50,0.55)'
      ctx.font = '7px Inter'
      ctx.fillText(distLabel(dist), mx, my + 14.5)
    }
  }
}

export interface DrawNode extends NexNode {
  pos: { x: number; y: number }
}

export function renderTopology(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  nodes: Record<string, DrawNode>,
  wires: Wire[],
  selectedMac: string | null,
  wireMode: boolean,
) {
  ctx.clearRect(0, 0, W, H)
  wires.forEach((w) => {
    const from = nodes[w.from]
    const to = nodes[w.to]
    if (!from || !to) return
    drawLink(ctx, from, to, from.rssi || w.rssi || 0)
  })
  Object.values(nodes).forEach((n) => {
    const sel = n.mac === selectedMac
    if (n.isMaster || n.mac === 'MASTER') {
      drawBase(ctx, n.pos.x, n.pos.y, sel, n.online, n.name || BASE_STATION_LABEL)
    } else {
      const color = !n.online ? RED : n.paired ? ACCENT : AMBER
      drawBeacon(ctx, n.pos.x, n.pos.y, color, 13, sel, n.name, n.id || null, n.online)
    }
    if (wireMode && n.mac !== selectedMac) {
      ctx.beginPath()
      ctx.arc(n.pos.x, n.pos.y, n.isMaster ? 28 : 20, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(79,70,229,0.22)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
  })
}
