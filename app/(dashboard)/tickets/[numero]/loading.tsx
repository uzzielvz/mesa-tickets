export default function TicketDetailLoading() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="px-5 pt-16 pb-5 md:px-9 md:pt-9 md:pb-6">
        <div className="h-6 w-72 bg-[#ECECEC] rounded animate-pulse mb-2" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 bg-[#F5F5F5] rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-[#F5F5F5] rounded animate-pulse" />
          <div className="h-3 w-28 bg-[#F5F5F5] rounded animate-pulse" />
        </div>
      </div>

      {/* Thread skeleton */}
      <div className="mx-5 md:mx-9 flex flex-col gap-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`flex flex-col gap-2 py-5 ${i < 2 ? 'border-b border-[#F5F5F5]' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#ECECEC] animate-pulse flex-shrink-0" />
              <div className="h-3 w-28 bg-[#ECECEC] rounded animate-pulse" />
            </div>
            <div className="pl-8 flex flex-col gap-1.5">
              <div className="h-3 w-full bg-[#F5F5F5] rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-[#F5F5F5] rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-[#F5F5F5] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
