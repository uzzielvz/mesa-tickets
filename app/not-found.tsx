import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-[360px] px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-orange flex-shrink-0" />
          <span className="text-[15px] font-semibold text-navy tracking-tight">CrediFlexi</span>
          <span className="text-[11px] text-ink-400 font-normal">/ Tickets</span>
        </div>
        <p className="text-[13px] text-ink-400 mb-1">404</p>
        <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] mb-2">
          Página no encontrada
        </h1>
        <p className="text-[13px] text-ink-500 mb-8">
          La dirección que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
