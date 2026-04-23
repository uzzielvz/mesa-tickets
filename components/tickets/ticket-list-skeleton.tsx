const COLUMNS_DESKTOP = 'grid-cols-[80px_1fr_140px_120px_100px]'

function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div className={`hidden md:grid ${COLUMNS_DESKTOP} items-center px-9 py-[14px] ${last ? '' : 'border-b border-[#F5F5F5]'}`}>
      <div className="h-3 w-10 bg-[#ECECEC] rounded animate-pulse" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-48 bg-[#ECECEC] rounded animate-pulse" />
        <div className="h-2.5 w-28 bg-[#F5F5F5] rounded animate-pulse" />
      </div>
      <div className="h-3 w-24 bg-[#ECECEC] rounded animate-pulse" />
      <div className="h-5 w-20 bg-[#F5F5F5] rounded-full animate-pulse" />
      <div className="h-2.5 w-14 bg-[#F5F5F5] rounded animate-pulse" />
    </div>
  )
}

function SkeletonRowMobile({ last }: { last: boolean }) {
  return (
    <div className={`md:hidden px-5 py-[14px] ${last ? '' : 'border-b border-[#F5F5F5]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="h-2.5 w-8 bg-[#ECECEC] rounded animate-pulse" />
        <div className="h-4 w-16 bg-[#F5F5F5] rounded-full animate-pulse" />
      </div>
      <div className="h-3 w-40 bg-[#ECECEC] rounded animate-pulse mb-1" />
      <div className="h-2.5 w-24 bg-[#F5F5F5] rounded animate-pulse" />
    </div>
  )
}

export default function TicketListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      {/* Header desktop */}
      <div className={`hidden md:grid ${COLUMNS_DESKTOP} px-9 pb-2 border-b border-[#ECECEC]`}>
        {['Ticket', 'Asunto', 'Responsable', 'Estatus', 'Fecha'].map(col => (
          <span key={col} className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.3px]">{col}</span>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <SkeletonRow last={i === rows - 1} />
          <SkeletonRowMobile last={i === rows - 1} />
        </div>
      ))}
    </div>
  )
}
