export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-36 bg-[#ECECEC] rounded" />
          <div className="h-3.5 w-24 bg-[#ECECEC] rounded" />
        </div>
        <div className="h-8 w-32 bg-[#ECECEC] rounded" />
      </div>

      <div className="border border-[#ECECEC] rounded-md overflow-hidden">
        <div className="hidden md:grid grid-cols-[60px_1fr_80px_100px_100px_100px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-[#ECECEC] rounded w-3/4" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`flex md:grid md:grid-cols-[60px_1fr_80px_100px_100px_100px] items-center px-5 py-3 gap-4 ${i < 7 ? 'border-b border-[#F5F5F5]' : ''}`}
          >
            <div className="hidden md:block h-3 w-8 bg-[#ECECEC] rounded" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-48 bg-[#ECECEC] rounded" />
              <div className="h-3 w-32 bg-[#ECECEC] rounded" />
            </div>
            <div className="hidden md:block h-3 w-14 bg-[#ECECEC] rounded" />
            <div className="hidden md:block h-3 w-10 bg-[#ECECEC] rounded" />
            <div className="hidden md:block h-5 w-20 bg-[#ECECEC] rounded" />
            <div className="hidden md:block h-5 w-16 bg-[#ECECEC] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
