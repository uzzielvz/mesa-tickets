export default function DashboardLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="px-5 pt-16 pb-5 md:px-9 md:pt-9 md:pb-6">
        <div className="h-7 w-36 bg-[#ECECEC] rounded animate-pulse mb-2" />
        <div className="h-3.5 w-48 bg-[#F5F5F5] rounded animate-pulse" />
      </div>

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8">
        {/* Sección mis tickets */}
        <div>
          <div className="h-2.5 w-20 bg-[#F5F5F5] rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[#ECECEC] rounded-md px-5 py-4 flex flex-col gap-2">
                <div className="h-2.5 w-14 bg-[#F5F5F5] rounded animate-pulse" />
                <div className="h-8 w-10 bg-[#ECECEC] rounded animate-pulse" />
                <div className="h-2.5 w-24 bg-[#F5F5F5] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Sección asignados */}
        <div>
          <div className="h-2.5 w-24 bg-[#F5F5F5] rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-[#ECECEC] rounded-md px-5 py-4 flex flex-col gap-2">
                <div className="h-2.5 w-16 bg-[#F5F5F5] rounded animate-pulse" />
                <div className="h-8 w-10 bg-[#ECECEC] rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-[#F5F5F5] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
