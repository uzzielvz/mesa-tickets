'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCw, AlertTriangle } from 'lucide-react'

/**
 * UI-004 — Frontera de error de la aplicación.
 *
 * Sin esto, cualquier excepción del servidor deja la pantalla en blanco de Next
 * con "Application error: a server-side exception has occurred" y un digest
 * suelto. Para quien la ve, eso es indistinguible de que la plataforma se cayó.
 *
 * Qué se muestra y qué no:
 *  · El **digest** SÍ. Es el identificador con el que Vercel correlaciona el
 *    error en sus logs, así que es lo único que convierte "no me sirve" en algo
 *    diagnosticable. Copiarlo tiene que ser fácil.
 *  · El **mensaje** solo en desarrollo. En producción Next ya lo censura para
 *    no filtrar internals, y mostrarlo no le sirve a nadie que no sea dev.
 *
 * `reset()` reintenta el render del segmento. Sirve de verdad cuando el fallo
 * fue transitorio (una consulta que expiró); si el error es de código, vuelve a
 * fallar, y por eso también hay salida al dashboard.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sin servicio de error-tracking todavía; al menos queda en la consola del
    // navegador con la traza completa para quien tenga el inspector abierto.
    console.error('[app/error]', error)
  }, [error])

  const esDev = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-[60vh] flex items-start justify-center px-5 py-16 md:px-9">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-2 text-orange">
          <AlertTriangle size={18} />
          <p className="text-[11px] uppercase tracking-[0.4px] font-medium">Algo se rompió</p>
        </div>

        <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] leading-tight mt-3">
          Esta pantalla no se pudo cargar
        </h1>
        <p className="text-[13px] text-ink-500 mt-1.5">
          El resto de la plataforma sigue funcionando. Puedes reintentar; si vuelve a
          fallar, avisa a Sistemas con el código de abajo.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 bg-navy text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-navy/90 transition-colors"
          >
            <RotateCw size={14} />
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="text-[13px] text-ink-500 hover:text-ink-900 border border-[#ECECEC] rounded-md px-4 py-2 hover:bg-surface-hover transition-colors"
          >
            Ir al inicio
          </Link>
        </div>

        {error.digest && (
          <div className="mt-6 border border-[#ECECEC] rounded-md bg-surface-sidebar px-4 py-3">
            <p className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium">
              Código del error
            </p>
            <p className="text-[13px] text-ink-900 font-mono mt-1 select-all break-all">
              {error.digest}
            </p>
            <p className="text-[11.5px] text-ink-400 mt-1">
              Con este código se encuentra el detalle en los registros del servidor.
            </p>
          </div>
        )}

        {esDev && (
          <pre className="mt-4 text-[11.5px] text-[#C62828] bg-[#FFEBEE] border border-[#FFCDD2] rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        )}
      </div>
    </div>
  )
}
