import { useMemo } from 'react'
import {
  LuFlag as Flag,
  LuInbox as Inbox,
  LuMessageSquare as MessageSquare,
  LuSearch as Search,
  LuSiren as Siren,
  LuX as X,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { ensureConvMeta } from './convHelpers'
import { getConversation } from '../../lib/nexus/parser'
import { cn, escHtml, timeSince } from '../../lib/utils'

export function ConversationList() {
  const convMeta = useNexusStore((s) => s.convMeta)
  const nodes = useNexusStore((s) => s.nodes)
  const conversations = useNexusStore((s) => s.conversations)
  const activeConvNode = useNexusStore((s) => s.activeConvNode)
  const convSearch = useNexusStore((s) => s.convSearch)
  const setConvSearch = useNexusStore((s) => s.setConvSearch)
  const setActiveConv = useNexusStore((s) => s.setActiveConv)

  const items = useMemo(() => {
    const meta = { ...convMeta }
    Object.keys(nodes).forEach((id) => {
      if (!isNaN(Number(id))) ensureConvMeta(meta, parseInt(id))
    })

    const q = convSearch.trim().toLowerCase()
    return Object.keys(meta)
      .map((id) => ({ id: parseInt(id), m: meta[parseInt(id)] }))
      .filter(({ id, m }) => {
        if (!q) return true
        const node = (nodes[id] || {}) as { ssid?: string }
        const hay =
          `node-${id} ${node.ssid || ''} ${m.lastMsg || ''} ${(conversations[id] || []).map((x) => x.text).join(' ')}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => {
        const ea = a.m.emergency && a.m.status !== 'resolved'
        const eb = b.m.emergency && b.m.status !== 'resolved'
        if (ea !== eb) return ea ? -1 : 1
        return b.m.lastTs - a.m.lastTs
      })
  }, [convMeta, nodes, conversations, convSearch])

  const select = (id: number) => {
    setActiveConv(id)
    getConversation(id)
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
      {/* header */}
      <div className="flex flex-shrink-0 items-center gap-3 px-4 pt-3.5 pb-2.5">
        <MessageSquare size={20} className="text-ac" />
        <div className="min-w-0 flex-1">
<div className="text-[0.85rem] font-bold text-tx">Messages</div>
        </div>
      </div>

      {/* search */}
      <div className="flex-shrink-0 px-3 pb-2">
        <div className="flex items-center gap-2.5 rounded-2xl border-2 border-tx3/10 bg-s2/40 px-3.5 transition-colors focus-within:border-ac/30">
          <Search size={13} className="shrink-0 text-tx3" />
          <input
            className="w-full bg-transparent py-2 text-[0.7rem] text-tx outline-none placeholder:text-tx3"
            placeholder="Search visitors, nodes…"
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
          />
          {convSearch && (
            <button
              onClick={() => setConvSearch('')}
              className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-tx3 transition-colors hover:bg-tx3/10 hover:text-tx"
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* rows */}
      <div className="nexus-scroll min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-s3">
              <Inbox size={24} className="text-tx3/50" />
            </div>
            <div>
              <div className="text-[0.72rem] font-bold text-tx2">Nothing here</div>
              <div className="mt-1 max-w-[200px] text-[0.6rem] leading-relaxed text-tx3">
                {convSearch
                  ? 'No conversations match your search'
                  : 'Messages from field visitors appear here'}
              </div>
            </div>
          </div>
        ) : (
          items.map(({ id, m }) => {
            const emergency = m.emergency && m.status !== 'resolved'
            const active = activeConvNode === id
            const node = (nodes[id] || {}) as { online?: boolean; ssid?: string }
            const name = node.ssid || (id === 0 ? 'Gateway' : 'Node-' + id)
            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => select(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(id)
                  }
                }}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                  active ? 'bg-ac/8' : 'hover:bg-s2/60',
                  emergency && !active && 'bg-rd/[0.03] hover:bg-rd/[0.06]',
                )}
              >
                {active && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-ac" />}
                {emergency && !active && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-rd/60" />}

                {/* avatar */}
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl text-[0.72rem] font-bold',
                      emergency ? 'bg-rd/10 text-rd' : 'bg-ac/10 text-ac',
                    )}
                  >
                    {id === 0 ? 'GW' : 'N' + id}
                  </div>
                  <span
                    className={cn(
                      'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-s1',
                      node.online ? 'bg-gn' : 'bg-tx3/40',
                    )}
                  />
                </div>

                {/* content */}
                <div className="min-w-0 flex-1 border-b border-tx3/8 pb-3">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'flex-1 truncate text-[0.76rem]',
                        m.unread > 0 ? 'font-bold text-tx' : 'font-semibold text-tx',
                      )}
                    >
                      {name}
                    </span>
                    <span className="shrink-0 font-mono text-[0.52rem] text-tx3 tabular-nums">
                      {timeSince(m.lastTs * 1000)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {emergency && <Siren size={10} className="shrink-0 text-rd" />}
                    {m.flagged && <Flag size={10} className="shrink-0 text-am" />}
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[0.64rem]',
                        m.unread > 0 ? 'font-medium text-tx2' : 'text-tx3',
                      )}
                    >
                      {emergency && <span className="font-bold text-rd">SOS · </span>}
                      {escHtml(m.lastMsg || 'No messages yet')}
                    </span>
                    {m.unread > 0 && (
                      <span className="ml-auto flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-ac px-1.5 text-[0.52rem] font-bold text-white tabular-nums">
                        {m.unread > 99 ? '99+' : m.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
