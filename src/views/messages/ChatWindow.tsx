import { useEffect, useRef, useState } from 'react'
import {
  LuArrowDown as ArrowDown,
  LuArrowLeft as ArrowLeft,
  LuCheck as Check,
  LuCheckCheck as CheckCheck,
  LuCircleAlert as CircleAlert,
  LuClock as Clock,
  LuMessageSquare as MessageSquare,
  LuSend as Send,
  LuUserRound as UserRound,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { QUICK_REPLIES, sendChatReply } from '../../lib/nexus/parser'
import { cn } from '../../lib/utils'

const DAY_LABEL = (d: Date) => {
  const today = new Date()
  const yest = new Date(Date.now() - 864e5)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

const TIME = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function ChatWindow({ onToggleVisitor }: { onToggleVisitor: () => void }) {
  const nodeId = useNexusStore((s) => s.activeConvNode)
  const nodes = useNexusStore((s) => s.nodes)
  const convMeta = useNexusStore((s) => s.convMeta)
  const conversations = useNexusStore((s) => s.conversations)

  const [text, setText] = useState('')
  const [pri, setPri] = useState('1')
  const [scrolledUp, setScrolledUp] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const m = nodeId != null ? convMeta[nodeId] : undefined
  const node = nodeId != null ? nodes[nodeId] : undefined
  const msgs = nodeId != null ? (conversations[nodeId] || []).slice().sort((a, b) => a.ts - b.ts) : []

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [nodeId, msgs.length])

  const onScroll = () => {
    const el = bodyRef.current
    if (!el) return
    setScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 240)
  }

  if (nodeId == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b-2 border-tx3/8 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-s3 text-tx3">
            <MessageSquare size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[0.82rem] font-bold text-tx">Messages</div>
            <div className="font-mono text-[0.56rem] text-tx2">Select a conversation</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-s3 text-tx3">
            <MessageSquare size={28} />
          </div>
          <div>
            <div className="text-[0.82rem] font-bold text-tx2">No conversation selected</div>
            <div className="mt-1 max-w-[260px] text-[0.64rem] leading-relaxed text-tx3">
              Pick a visitor from the list to review their messages and reply over the mesh.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const emergency = m?.emergency && m?.status !== 'resolved'

  const send = () => {
    if (!text.trim()) return
    sendChatReply(nodeId, text.trim(), parseInt(pri))
    setText('')
    const t = bodyRef.current
    if (t) requestAnimationFrame(() => (t.scrollTop = t.scrollHeight))
  }

  const grow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 96) + 'px'
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-s0">
      {/* header */}
      <div
        className={cn(
          'flex flex-shrink-0 items-center gap-3 border-b-2 border-tx3/8 px-4 py-2.5',
          emergency && 'border-b-rd/30 bg-rd/5',
        )}
      >
        <div className="relative shrink-0">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl text-[0.72rem] font-bold',
              emergency ? 'bg-rd/10 text-rd' : 'bg-ac/10 text-ac',
            )}
          >
            {nodeId === 0 ? 'GW' : 'N' + nodeId}
          </div>
          <span
            className={cn(
              'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-s0',
              node?.online ? 'bg-gn' : 'bg-tx3/40',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.82rem] font-bold text-tx">
            {node?.ssid || (nodeId === 0 ? 'Gateway' : 'Visitor · Node-' + nodeId)}
          </div>
          <div className="font-mono text-[0.56rem] text-tx2">
            <span className={node?.online ? 'text-gn' : ''}>{node?.online ? 'Online' : 'Offline'}</span>
            {m?.status === 'resolved' ? ' · resolved' : ''}
            {emergency ? ' · SOS' : ''}
          </div>
        </div>
        <button
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-tx3/10 bg-s2 text-tx2 transition-colors hover:border-ac/30 hover:text-ac lg:hidden"
          onClick={() => useNexusStore.getState().setActiveConv(null)}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border-2 border-tx3/10 bg-s2 text-tx2 transition-colors hover:border-ac/30 hover:text-ac lg:hidden"
          onClick={onToggleVisitor}
          aria-label="Visitor details"
        >
          <UserRound size={14} />
        </button>
      </div>

      {/* body */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={bodyRef}
          onScroll={onScroll}
          className="nexus-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-4 py-4"
        >
          {msgs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-tx3">
              <div className="text-[0.76rem] font-bold text-tx2">No messages yet</div>
              <div className="text-[0.64rem]">Replies sent here are delivered over the mesh</div>
            </div>
          ) : (
            msgs.map((msg, i) => {
              const prev = msgs[i - 1]
              const d = new Date(msg.ts * 1000)
              const showDivider = !prev || new Date(prev.ts * 1000).toDateString() !== d.toDateString()
              const isOut = msg.dir === 'OUT'
              const grouped = prev && prev.dir === msg.dir && new Date(prev.ts * 1000).toDateString() === d.toDateString()
              return (
                <div key={msg.msgId + '-' + i} className={cn('flex flex-col', grouped ? 'mt-0.5' : 'mt-2')}>
                  {showDivider && (
                    <div className="relative my-3 flex items-center justify-center">
                      <span className="absolute inset-x-0 top-1/2 h-px bg-tx3/10" />
                      <span className="relative z-10 rounded-full border-2 border-tx3/10 bg-s1 px-4 py-1 text-[0.56rem] font-bold tracking-wider text-tx3 uppercase">
                        {DAY_LABEL(d)}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex max-w-[75%] flex-col', isOut ? 'ml-auto items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'relative px-4 py-2.5 text-[0.74rem] leading-relaxed break-words whitespace-pre-wrap',
                        isOut
                          ? 'rounded-2xl rounded-br-md bg-ac text-white shadow-[0_1px_3px_rgba(0,97,148,0.2)]'
                          : 'rounded-2xl rounded-bl-md border-2 border-tx3/10 bg-s1 text-tx shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
                        msg.priority === 3 && !isOut && 'border-rd/30 bg-rd/8 text-rd',
                      )}
                    >
                      {msg.text}
                      <span
                        className={cn(
                          'ml-2 inline-flex items-center gap-1 align-baseline text-[0.54rem] whitespace-nowrap tabular-nums',
                          isOut ? 'text-white/70' : 'text-tx3',
                        )}
                      >
                        {isOut && statusIcon(msg.status)}
                        {TIME(msg.ts)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {scrolledUp && (
          <button
            onClick={() => {
              const el = bodyRef.current
              if (el) el.scrollTop = el.scrollHeight
            }}
            className="absolute right-4 bottom-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-2xl border-2 border-tx3/10 bg-s1 text-tx2 shadow-[0_4px_16px_rgba(16,24,40,0.18)] transition-colors hover:border-ac/30 hover:text-ac"
            aria-label="Jump to latest"
          >
            <ArrowDown size={14} />
          </button>
        )}
      </div>

      {/* quick replies */}
      <div className="nexus-scroll flex max-h-[62px] flex-shrink-0 flex-wrap gap-1.5 overflow-y-auto border-t-2 border-tx3/8 bg-s1 px-4 py-2.5">
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr}
            onClick={() => setText(qr)}
            className="cursor-pointer rounded-2xl border-2 border-tx3/10 bg-s2/50 px-3 py-1.5 text-[0.6rem] font-medium whitespace-nowrap text-tx2 transition-colors hover:border-ac/30 hover:text-ac"
          >
            {qr}
          </button>
        ))}
      </div>

      {/* reply bar */}
      <div className="flex flex-shrink-0 items-end gap-2 border-t-2 border-tx3/8 bg-s1 px-3 py-3">
        <select
          className={cn(
            'h-10 shrink-0 cursor-pointer rounded-2xl border-2 border-tx3/10 bg-s2 px-2.5 text-[0.62rem] font-bold outline-none transition-colors focus:border-ac/40',
            pri === '3' ? 'text-rd' : pri === '2' ? 'text-am' : 'text-tx2',
          )}
          value={pri}
          onChange={(e) => setPri(e.target.value)}
          aria-label="Message priority"
        >
          <option value="0">Low</option>
          <option value="1">Normal</option>
          <option value="2">High</option>
          <option value="3">Emergency</option>
        </select>
        <textarea
          rows={1}
          className="min-h-[40px] max-h-[96px] flex-1 resize-none rounded-2xl border-2 border-tx3/10 bg-s2 px-4 py-2.5 text-[0.74rem] text-tx outline-none placeholder:text-tx3 focus:border-ac/40"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={grow}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-ac text-white transition-all hover:bg-ac2 disabled:cursor-default disabled:opacity-30 disabled:grayscale"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function statusIcon(s?: string) {
  switch (s) {
    case 'queued':
      return <Clock size={11} />
    case 'sending':
      return <Clock size={11} className="animate-sys-pulse" />
    case 'delivered':
      return <Check size={11} />
    case 'read':
      return <CheckCheck size={11} />
    case 'failed':
      return <CircleAlert size={11} />
    default:
      return null
  }
}
