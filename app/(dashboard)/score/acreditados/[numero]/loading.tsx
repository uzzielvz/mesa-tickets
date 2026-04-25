export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 w-24 bg-[#ECECEC] rounded" />
          <div className="h-5 w-52 bg-[#ECECEC] rounded mt-1" />
          <div className="h-3 w-40 bg-[#ECECEC] rounded" />
        </div>
        <div className="h-8 w-20 bg-[#ECECEC] rounded" />
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Izquierda */}
        <div className="flex-1 flex flex-col gap-4">
          {/* ScoreCard */}
          <div className="border border-[#ECECEC] rounded-md px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-14 w-28 bg-[#ECECEC] rounded" />
              <div className="h-10 w-32 bg-[#ECECEC] rounded" />
            </div>
            <div className="h-2 w-full bg-[#ECECEC] rounded-full" />
          </div>
          {/* Desglose */}
          <div className="border border-[#ECECEC] rounded-md px-5 py-3 h-12 bg-[#FAFAFA]" />
          {/* Evaluación */}
          <div className="border border-[#ECECEC] rounded-md px-5 py-5 h-28 bg-[#FAFAFA]" />
        </div>

        {/* Derecha */}
        <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-3">
          <div className="h-3 w-24 bg-[#ECECEC] rounded" />
          <div className="border border-[#ECECEC] rounded-md overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`flex justify-between px-4 py-2.5 gap-3 ${i < 7 ? 'border-b border-[#F5F5F5]' : ''}`}>
                <div className="h-3 w-24 bg-[#ECECEC] rounded" />
                <div className="h-3 w-16 bg-[#ECECEC] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
