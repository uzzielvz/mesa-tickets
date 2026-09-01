import Link from 'next/link'
import { Download, AlertTriangle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { etiquetaPeriodo } from '@/lib/inversiones/periodo'
import { NOMBRE_REPORTE, type TipoReporte } from '@/lib/inversiones/excel'
import ReprocesarBoton from '@/components/inversiones/reprocesar-boton'

export const dynamic = 'force-dynamic'

interface CargaFila {
  id: string
  tipo_reporte: TipoReporte
  periodo_inicio: string
  periodo_fin: string
  nombre_archivo: string
  tamano_bytes: number | null
  estado: string
  error_detalle: string | null
  filas: number
  avisos: string[] | null
  hojas_degradadas: string[] | null
  created_at: string
}

function peso(bytes: number | null): string {
  if (!bytes) return '—'
  const kb = bytes / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
}

export default async function CargasInversionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_pagos, acceso_inversiones_desempeno, acceso_inversiones_carga')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const admin = p?.rol === 'admin'
  const puedeReprocesar = admin || p?.acceso_inversiones_carga === true
  const puedeBajar: Record<TipoReporte, boolean> = {
    calendario: admin || p?.acceso_inversiones_pagos === true,
    tablero: admin || p?.acceso_inversiones_desempeno === true,
  }

  const { data } = await supabase
    .from('inv_cargas')
    // Un solo literal: partirlo con `+` deja a TypeScript sin poder inferir las
    // columnas y la fila se degrada a `GenericStringError[]`.
    .select('id, tipo_reporte, periodo_inicio, periodo_fin, nombre_archivo, tamano_bytes, estado, error_detalle, filas, avisos, hojas_degradadas, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const cargas = (data ?? []) as CargaFila[]

  return (
    <div>
      <Header
        title="Historial de cargas"
        subtitle="Cada archivo que se ha subido, con el original tal como llegó."
        action={
          <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12">
        {cargas.length === 0 ? (
          <p className="text-[13px] text-ink-500">
            Todavía no se ha cargado ningún reporte.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 max-w-3xl">
            {cargas.map(c => {
              const avisos = c.avisos ?? []
              const puede = puedeBajar[c.tipo_reporte]
              return (
                <li
                  key={c.id}
                  className="border border-[#ECECEC] rounded-md bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink-900 font-medium truncate">
                        {NOMBRE_REPORTE[c.tipo_reporte]}
                      </p>
                      <p className="text-[12px] text-ink-500 mt-0.5">
                        {etiquetaPeriodo(c.tipo_reporte, c.periodo_inicio, c.periodo_fin)}
                        {' · '}{peso(c.tamano_bytes)}
                        {c.estado === 'procesado' && c.filas > 0 && (
                          <span className="text-ink-500"> · {c.filas.toLocaleString('es-MX')} pagos</span>
                        )}
                        {c.estado === 'pendiente' && (
                          <span className="text-ink-400"> · sin procesar</span>
                        )}
                        {c.estado === 'error' && (
                          <span className="text-[#C62828]"> · falló: {c.error_detalle}</span>
                        )}
                      </p>
                      <p className="text-[11.5px] text-ink-400 mt-0.5 font-mono truncate">
                        {c.nombre_archivo}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <time className="text-[11.5px] text-ink-400 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </time>
                      {puedeReprocesar && <ReprocesarBoton cargaId={c.id} />}
                      {puede ? (
                        <a
                          href={`/api/inversiones/descargar/${c.id}`}
                          className="flex items-center gap-1 text-[12px] text-navy hover:underline font-medium"
                        >
                          <Download size={13} /> Descargar
                        </a>
                      ) : (
                        <span
                          className="flex items-center gap-1 text-[11.5px] text-ink-400"
                          title="No tienes acceso a este reporte"
                        >
                          <Lock size={12} /> Sin acceso
                        </span>
                      )}
                    </div>
                  </div>

                  {avisos.length > 0 && (
                    <ul className="mt-2 pt-2 border-t border-[#F5F5F5] flex flex-col gap-1">
                      {avisos.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[11.5px] text-[#8A6100]"
                        >
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
