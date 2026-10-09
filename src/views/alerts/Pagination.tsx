import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { cn } from '../../lib/utils'

export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5">
      <button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className={cn(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 transition-all',
          page === 0 ? 'border-tx3/10 text-tx3/30' : 'border-tx3/10 text-tx2 hover:border-ac/30 hover:text-ac',
        )}
      >
        <LuChevronLeft size={13} />
      </button>
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          onClick={() => onPage(i)}
          className={cn(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 font-mono text-[0.56rem] font-bold transition-all',
            i === page ? 'border-ac/30 bg-ac/10 text-ac' : 'border-tx3/10 text-tx3 hover:border-ac/20 hover:text-tx',
          )}
        >
          {i + 1}
        </button>
      ))}
      <button
        disabled={page === pages - 1}
        onClick={() => onPage(page + 1)}
        className={cn(
          'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 transition-all',
          page === pages - 1 ? 'border-tx3/10 text-tx3/30' : 'border-tx3/10 text-tx2 hover:border-ac/30 hover:text-ac',
        )}
      >
        <LuChevronRight size={13} />
      </button>
    </div>
  )
}
