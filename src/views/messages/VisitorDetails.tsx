import {
  LuFlag as Flag,
  LuPrinter as Printer,
  LuSave as Save,
  LuShieldCheck as ShieldCheck,
  LuSiren as Siren,
  LuUserRound as UserRound,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { cn, timeSince } from '../../lib/utils'

export function VisitorDetails() {
  const nodeId = useNexusStore((s) => s.activeConvNode)
  const nodes = useNexusStore((s) => s.nodes)
  const convMeta = useNexusStore((s) => s.convMeta)
  const conversations = useNexusStore((s) => s.conversations)
  const toggleConvResolved = useNexusStore((s) => s.toggleConvResolved)
  const toggleConvFlag = useNexusStore((s) => s.toggleConvFlag)
  const acknowledgeEmergency = useNexusStore((s) => s.acknowledgeEmergency)
  const setEmergency = useNexusStore((s) => s.setEmergency)

  const m = nodeId != null ? convMeta[nodeId] : undefined
  const node = nodeId != null ? nodes[nodeId] : undefined
  const msgs = nodeId != null ? (conversations[nodeId] || []).slice().sort((a, b) => a.ts - b.ts) : []

  if (nodeId == null) {
    return (
      <div className="flex min-h-0 flex-col bg-s1">
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b-2 border-tx3/8 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-s3 text-tx3">
            <UserRound size={14} />
          </div>
          <span className="text-[0.82rem] font-bold text-tx">Visitor</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-tx3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-s3">
            <UserRound size={24} className="opacity-40" />
          </div>
          <div className="text-[0.72rem] font-bold">No visitor selected</div>
        </div>
      </div>
    )
  }

  const emergency = m?.emergency && m?.status !== 'resolved'

  const exportText = () => {
    const lines = [
      `VISITOR RECORD — Node-${nodeId}`,
      `SSID: ${node?.ssid || 'AN-NODE-' + nodeId}`,
      `Status: ${m?.status}`,
      `First seen: ${m?.firstSeen ? new Date(m.firstSeen * 1000).toLocaleString() : '—'}`,
      `Last seen: ${m?.lastTs ? new Date(m.lastTs * 1000).toLocaleString() : '—'}`,
      '',
      '--- MOVEMENT ---',
      ...(m?.movement || []).map((mv) => `  Node-${mv.node}  ${new Date(mv.ts * 1000).toLocaleString()}`),
      '',
      '--- CONVERSATION ---',
      ...msgs.map((msg) => {
        const who = msg.dir === 'OUT' ? 'GATEWAY' : `NODE-${nodeId}`
        const st = msg.status ? `[${msg.status}]` : ''
        return `[${new Date(msg.ts * 1000).toLocaleString()}] ${who}${st}: ${msg.text}`
      }),
      '',
      `Exported ${new Date().toLocaleString()}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `visitor-node-${nodeId}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  const printView = () => {
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) return
    const who = (msg: { dir: string }) => (msg.dir === 'OUT' ? 'GATEWAY' : 'NODE-' + nodeId)
    win.document.write(
      '<html><head><title>Visitor Node-' + nodeId + '</title></head><body style="font-family:Inter,sans-serif;font-size:13px;color:#111">' +
        '<h2>Visitor Record — Node-' + nodeId + '</h2>' +
        (node?.ssid ? '<p><b>SSID:</b> ' + esc(node.ssid) + '</p>' : '') +
        '<p><b>Status:</b> ' + esc(m?.status || '') + '</p>' +
        '<p><b>First seen:</b> ' + (m?.firstSeen ? new Date(m.firstSeen * 1000).toLocaleString() : '—') + '</p>' +
        '<p><b>Last seen:</b> ' + (m?.lastTs ? new Date(m.lastTs * 1000).toLocaleString() : '—') + '</p>' +
        '<hr><h3>Conversation</h3>' +
        msgs.map((msg) => '<p>[<span style="color:#888">' + new Date(msg.ts * 1000).toLocaleString() + '</span>] <b>' + who(msg) + '</b>: ' + esc(msg.text) + '</p>').join('') +
        '</body></html>',
    )
    win.document.close()
    win.print()
  }

  const parts: { label: string; value: string }[] = [
    { label: 'Node', value: String(nodeId) },
    { label: 'SSID', value: node?.ssid || '—' },
    { label: 'Online', value: node?.online ? 'Yes' : 'No' },
    { label: 'Status', value: m?.status || 'open' },
    { label: 'First seen', value: m?.firstSeen ? timeSince(m.firstSeen * 1000) : '—' },
    { label: 'Last activity', value: m?.lastTs ? timeSince(m.lastTs * 1000) : '—' },
  ]

  const movement = (m?.movement || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 8)

  const sectionHeader = (title: string, right?: React.ReactNode) => (
    <div className="mt-4 flex items-center gap-2">
      <span className="text-[0.56rem] font-bold tracking-wider text-tx3 uppercase">{title}</span>
      <span className="h-px flex-1 bg-tx3/10" />
      {right}
    </div>
  )

  return (
    <div className="flex min-h-0 w-full flex-col bg-s1">
      <div
        className={cn(
          'flex flex-shrink-0 items-center gap-2.5 border-b-2 border-tx3/8 px-4 py-3',
          emergency && 'border-b-rd/30 bg-rd/5',
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-s3 text-tx3">
          <UserRound size={14} />
        </div>
        <span className="text-[0.82rem] font-bold text-tx">Visitor profile</span>
        {emergency && <Siren size={14} className="text-rd" />}
        <button
          className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-tx3 transition-colors hover:bg-rd/10 hover:text-rd"
          onClick={() => setEmergency(null)}
          aria-label="Close visitor details"
        >
          ✕
        </button>
      </div>

      <div className="nexus-scroll min-h-0 flex-1 overflow-y-auto p-4">
        {/* identity card */}
        <div className="flex items-center gap-3.5 rounded-2xl border-2 border-tx3/10 bg-s2/50 p-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[0.82rem] font-bold',
              emergency ? 'bg-rd/10 text-rd' : 'bg-ac/10 text-ac',
            )}
          >
            {nodeId === 0 ? 'GW' : 'N' + nodeId}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.78rem] font-bold text-tx">{node?.ssid || 'AN-NODE-' + nodeId}</div>
            <div className="mt-0.5 font-mono text-[0.56rem] text-tx2">
              Mesh visitor · Node-{nodeId} ·{' '}
              <span className={node?.online ? 'text-gn' : ''}>{node?.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border-2 px-2.5 py-1 text-[0.54rem] font-bold uppercase',
              m?.status === 'resolved'
                ? 'border-ac/30 bg-ac/10 text-ac'
                : emergency
                  ? 'border-rd/30 bg-rd/10 text-rd'
                  : 'border-tx3/15 bg-s3 text-tx2',
            )}
          >
            {emergency ? 'SOS' : m?.status || 'open'}
          </span>
        </div>

        {/* emergency banner */}
        {emergency && (
          <div className="mt-3 rounded-2xl border-2 border-rd/30 bg-rd/8 p-4">
            <div className="flex items-center gap-2 text-[0.74rem] font-bold text-rd">
              <Siren size={15} /> ACTIVE EMERGENCY
            </div>
            <div className="mt-1 text-[0.64rem] text-tx2">Visitor has triggered a distress signal.</div>
            <button
              onClick={() => {
                acknowledgeEmergency(nodeId)
                setEmergency(null)
              }}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-rd/30 bg-s1 px-4 py-2.5 text-[0.66rem] font-bold text-rd transition-colors hover:bg-rd/8"
            >
              <ShieldCheck size={13} /> Acknowledge Emergency
            </button>
          </div>
        )}

        {/* overview */}
        {sectionHeader('Overview')}
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
          {parts.map((p) => (
            <div key={p.label}>
              <div className="text-[0.52rem] font-bold tracking-wider text-tx3 uppercase">{p.label}</div>
              <div className="mt-0.5 truncate font-mono text-[0.7rem] text-tx">{p.value}</div>
            </div>
          ))}
        </div>

        {/* movement */}
        {movement.length > 0 && (
          <>
            {sectionHeader(
              'Movement',
              <span className="font-mono text-[0.52rem] text-tx3">last {movement.length}</span>,
            )}
            <div className="mt-2.5 flex flex-col rounded-2xl border-2 border-tx3/10 bg-s2/50 p-3.5">
              {movement.map((mv, i) => (
                <div key={i} className="relative flex items-center gap-3 pb-3 last:pb-0">
                  <span className="absolute top-1.5 left-0 h-2 w-2 rounded-full bg-ac ring-2 ring-ac/20" />
                  {i < movement.length - 1 && <span className="absolute top-4 left-[3px] h-full w-px bg-tx3/10" />}
                  <span className="pl-4 font-mono text-[0.64rem] text-tx2">Node-{mv.node}</span>
                  <span className="ml-auto font-mono text-[0.58rem] text-tx3 tabular-nums">
                    {timeSince(mv.ts * 1000)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-shrink-0 flex-col gap-2 border-t-2 border-tx3/8 p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => toggleConvResolved(nodeId)}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[0.64rem] font-bold transition-colors',
              m?.status === 'resolved'
                ? 'border-ac bg-ac/10 text-ac'
                : 'border-tx3/15 text-tx2 hover:border-ac/30 hover:text-ac',
            )}
          >
            <ShieldCheck size={13} />
            {m?.status === 'resolved' ? 'Resolved' : 'Mark resolved'}
          </button>
          <button
            onClick={() => toggleConvFlag(nodeId)}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[0.64rem] font-bold transition-colors',
              m?.flagged ? 'border-am bg-am/10 text-am' : 'border-tx3/15 text-tx2 hover:border-am/30 hover:text-am',
            )}
          >
            <Flag size={13} />
            {m?.flagged ? 'Flagged' : 'Flag'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportText}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-tx3/10 bg-s2/50 px-3 py-2 text-[0.64rem] font-bold text-tx2 transition-colors hover:border-ac/30 hover:text-ac"
          >
            <Save size={12} /> Export
          </button>
          <button
            onClick={printView}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-tx3/10 bg-s2/50 px-3 py-2 text-[0.64rem] font-bold text-tx2 transition-colors hover:border-ac/30 hover:text-ac"
          >
            <Printer size={12} /> Print
          </button>
        </div>
      </div>
    </div>
  )
}
