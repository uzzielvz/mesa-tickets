import Link from 'next/link'
import { Search, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import TablaConciliacion from '@/components/auditor/tabla-conciliacion'
import { ETIQUETA_CONTEO, pesos, type Conciliacion, type EstadoConciliacion } from '@/lib/auditor/tipos'

export const dynamic = 'force-dynamic'

const sinCeros = (s: string) => s.replace(/^0+(?=\d)/, '')
const fecha = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—'
const momento = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

const APOYO: Record<EstadoConciliacion, string> = {
  listo: 'montos iguales: falta que Tesorería concilie',
  sin_registro: 'nadie registró ese depósito ese día',
  diferencia: 'lo registrado no cuadra con lo depositado',
  un_registro: 'montos iguales, pero en varios registros',
}

/**
 * Auditor (AUD-003). La base son los depósitos del banco que siguen "No
 * Conciliado" en el reporte de Yunius, comparados contra lo que registraron
 * los promotores: "un join en código, ciclo, fecha" (Felix). Todo sale de
 * `aud_conciliacion`; la leyenda de cada estado, de `leyendaEstado`.
 */
export default async function AuditorPage({ searchParams }: { searchParams: { grupo?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_auditor_carga')
    .eq('id', user!.id)
    .single()
  const p = profile as Record<string, unknown> | null
  const puedeCargar = p?.rol === 'admin' || p?.acceso_auditor_carga === true

  const grupo = (searchParams.grupo ?? '').replace(/\D/g, '').slice(0, 6)
  const { data, error } = await supabase.rpc('aud_conciliacion', { p_grupo: grupo || null })
  const d = data as unknown as Conciliacion | null

  return (
    <div>
      <Header
        title="Depósitos sin conciliar"
        subtitle="Depósitos del banco que siguen sin conciliar, comparados contra lo que registraron los promotores."
        action={puedeCargar ? (
          <Link href="/auditor/cargar" className="text-[13px] text-navy hover:underline font-medium">Cargar archivos</Link>
        ) : undefined}
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {error && <BannerError mensaje={error.message} />}

        {!d?.dep_carga ? (
          <Panel titulo="Todavía no hay reporte de depósitos">
            <div className="px-5 py-5 flex flex-col gap-2">
              <p className="text-[12.5px] text-ink-500">
                La conciliación parte del reporte de depósitos de Yunius. En cuanto se suba, aquí aparecen los que siguen sin conciliar.
              </p>
              {puedeCargar && (
                <Link href="/auditor/cargar" className="inline-flex items-center gap-1.5 text-[13px] text-navy font-medium hover:underline">
                  <Upload size={14} /> Cargar el reporte
                </Link>
              )}
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Tile
                etiqueta="Depósitos sin conciliar"
                valor={String(d.depositos_no_conciliados)}
                apoyo={pesos(Number(d.monto_no_conciliado))}
                acento
              />
              {(['listo', 'sin_registro', 'diferencia', 'un_registro'] as const).map(e => (
                <Tile key={e} etiqueta={ETIQUETA_CONTEO[e]} valor={String(d.conteo[e])} apoyo={APOYO[e]} />
              ))}
            </div>

            <form action="/auditor" method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  id="filtro-grupo"
                  name="grupo"
                  defaultValue={grupo ? sinCeros(grupo) : ''}
                  placeholder="Filtrar por grupo"
                  inputMode="numeric"
                  className="bg-white border border-[#ECECEC] rounded pl-8 pr-3 py-1.5 text-[13px] text-ink-900 outline-none focus:border-orange w-48"
                />
              </div>
              {grupo && <Link href="/auditor" className="text-[12.5px] text-ink-500 hover:text-ink-900">Quitar filtro</Link>}
            </form>

            <Panel
              titulo="Por grupo, ciclo y día"
              nota={`${d.filas.length} ${d.filas.length === 1 ? 'fila' : 'filas'}${grupo ? ` del grupo ${sinCeros(grupo)}` : ''}`}
            >
              {d.filas.length === 0 ? (
                <Vacio mensaje={grupo ? `El grupo ${sinCeros(grupo)} no tiene depósitos sin conciliar.` : 'Todos los depósitos están conciliados.'} />
              ) : (
                <TablaConciliacion filas={d.filas} />
              )}
            </Panel>

            <p className="text-[11.5px] text-ink-400">
              Depósitos: <span className="font-mono">{d.dep_carga.nombre_archivo}</span> ({fecha(d.dep_carga.fecha_min)} – {fecha(d.dep_carga.fecha_max)}), cargado el {momento(d.dep_carga.created_at)}.
              {d.reg_carga && (
                <> Registros: <span className="font-mono">{d.reg_carga.nombre_archivo}</span> ({fecha(d.reg_carga.fecha_min)} – {fecha(d.reg_carga.fecha_max)}), cargado el {momento(d.reg_carga.created_at)}.</>
              )}
              {' '}Se comparan por grupo, ciclo y fecha exacta del depósito.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
