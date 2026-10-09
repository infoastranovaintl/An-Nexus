import { useState } from 'react'
import { useNexusStore } from '../../store/nexus'
import { ConversationList } from './ConversationList'
import { ChatWindow } from './ChatWindow'
import { VisitorDetails } from './VisitorDetails'
import { cn } from '../../lib/utils'

export function MessagesView() {
  const activeConvNode = useNexusStore((s) => s.activeConvNode)
  const [showVisitor, setShowVisitor] = useState(false)

  return (
<div
         className="relative flex h-full gap-2 overflow-hidden"
        >
      {/* list — mobile: overlay when no active conversation */}
      <div
        className={cn(
          'flex h-full flex-shrink-0 flex-col overflow-hidden',
          'absolute inset-y-0 left-0 z-[5000] w-[320px] max-w-[86vw] lg:static lg:z-auto lg:w-[320px] lg:max-w-none',
          activeConvNode != null && 'hidden lg:flex',
        )}
      >
        <ConversationList />
      </div>

      {/* chat */}
      <div
        className={cn('min-w-0 flex-1 flex-col lg:flex', activeConvNode == null ? 'hidden' : 'flex')}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s0 shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
          <ChatWindow onToggleVisitor={() => setShowVisitor((v) => !v)} />
        </div>
      </div>

      {/* visitor — desktop: static right · mobile: overlay */}
      {showVisitor && (
        <div
          className="absolute inset-0 z-[4990] bg-tx/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setShowVisitor(false)}
        />
      )}
      <div
        className={cn(
          'hidden h-full w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border-2 border-tx3/10 bg-s1 shadow-[0_2px_8px_rgba(16,24,40,0.06)] lg:flex',
          showVisitor &&
            'absolute inset-y-0 right-0 z-[5000] flex w-[300px] max-w-[86vw] rounded-none border-l-2 border-tx3/10 bg-s1 shadow-[0_12px_40px_rgba(16,24,40,0.12)] lg:hidden',
        )}
      >
        <VisitorDetails />
      </div>
    </div>
  )
}
