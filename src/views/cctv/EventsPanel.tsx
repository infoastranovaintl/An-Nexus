import { LuScrollText as ScrollText } from 'react-icons/lu'
import { useCctvStore } from '../../store/cctv'
import { cn } from '../../lib/utils'
import { RichText } from '../../components/ui/primitives'

export function EventsPanel() {
  const logs = useCctvStore((s) => s.logs)
  const clearCctvLog = useCctvStore((s) => s.clearCctvLog)

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-tx3/10 bg-s1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-tx3/10 px-2.5 py-2.5">
        <ScrollText size={13} className="text-ac" />
        <span className="font-display text-[0.8rem] font-bold tracking-[0.04em] text-tx">Event Log</span>
        <span className="rounded-full border border-tx3/15 px-2 py-0.5 text-[0.56rem] font-bold text-tx3">
          {logs.length}
        </span>
        <button
          onClick={clearCctvLog}
          className="ml-auto cursor-pointer text-[0.58rem] tracking-[0.06em] text-tx3 uppercase transition-colors hover:text-rd"
        >
          Clear
        </button>
      </div>
      <div className="nexus-scroll min-h-0 flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-4 text-center text-[0.64rem] text-tx3">No events yet</div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'border-b border-tx3/5 px-2.5 py-1.5 font-mono text-[0.58rem] leading-relaxed',
                log.kind === 'err' ? 'text-rd' : log.kind === 'ok' ? 'text-tx' : 'text-tx2',
              )}
            >
              <span className="mr-1.5 text-tx3">{log.t}</span>
              <RichText text={log.msg} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
