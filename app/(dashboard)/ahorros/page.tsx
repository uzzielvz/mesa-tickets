import Link from 'next/link'
import { Search, Upload, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel, Vacio, BannerError } from '@/components/viz'
import ResultadoAhorros from '@/components/ahorros/resultado'
import { leerBusqueda } from '@/lib/ahorros/csv'
import {
  leerCorte, sinCeros, momento,
  type BusquedaAhorros, type ResumenAhorros,
} from '@/lib/ahorros/tipos'

export const dynamic = 'force-dynamic'

const campo =
  'bg-white border border-[#ECECEC] rounded px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-orange transition-colors'

/**
 * Visor de ahorros (AHO-001). El asesor escribe grupo + ciclo y ve lo mismo que
 * hoy le pide a Felix por correo; descarga el Excel si lo necesita.
 *
 * La búsqueda es un formulario GET sin JavaScript: la consulta vive en la URL
 * (`?grupo=439&ciclo=1`) y se puede mandar como link.
 */
export default async function AhorrosPage({
  searchParams,
}: {
  searchParams: { grupo?: string; ciclo?: string; n?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_ahorros_carga')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const puedeCargar = p?.rol === 'admin' || p?.acceso_ahorros_carga === true

  const busqueda = leerBusqueda(searchParams.grupo, searchParams.ciclo)
  const corte = leerCorte(searchParams.n)
  // Hora de México: una semana "vence" según el calendario de aquí, no el del servidor.
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

  let resultado: BusquedaAhorros | null = null
  let error: string | null = null

  if (busqueda) {
    const { data, error: e } = await supabase.rpc('aho_buscar', {
      p_grupo: busqueda.grupo,
      p_ciclo: busqueda.ciclo,
    })
    if (e) error = e.message
    resultado = data as unknown as BusquedaAhorros | null

    // Cada consulta que encuentra algo se registra: es la evidencia de uso del
    // módulo. Si el registro falla no se le niega la consulta a nadie.
    if (resultado?.encontrado) {
      await supabase.rpc('aho_registrar_evento', { p_tipo: 'consulta', p_key_grupo: resultado.key_grupo })
    }
  }

  const resumen = busqueda
    ? null
    : ((await supabase.rpc('aho_resumen')).data as unknown as ResumenAhorros | null)

  return (
    <div>
      <Header
        title="Ahorros por grupo"
        subtitle="El ahorro y los rendimientos de cada clienta, con las cifras que cuadra Data Science."
        action={
          puedeCargar ? (
            <Link href="/ahorros/cargar" className="text-[13px] text-navy hover:underline font-medium">
              Cargar archivo
            </Link>
          ) : undefined
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        {/* ── Buscador ── */}
        <form action="/ahorros" method="get" className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Grupo</span>
            <input
              name="grupo"
              defaultValue={busqueda ? sinCeros(busqueda.grupo.replace(/\D/g, '') || busqueda.grupo) : ''}
              placeholder="439"
              inputMode="numeric"
              autoComplete="off"
              required
              className={`${campo} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Ciclo</span>
            <input
              name="ciclo"
              defaultValue={busqueda?.ciclo ? sinCeros(busqueda.ciclo.replace(/\D/g, '') || busqueda.ciclo) : ''}
              placeholder="1"
              inputMode="numeric"
              autoComplete="off"
              className={`${campo} w-20`}
            />
          </label>
          {corte !== 12 && <input type="hidden" name="n" value={corte} />}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-4 py-2 transition-colors"
          >
            <Search size={14} /> Buscar
          </button>
          <p className="text-[11.5px] text-ink-400 basis-full">
            También puedes pegar la llave completa en Grupo, por ejemplo <span className="font-mono">000439_C01</span>.
          </p>
        </form>

        {error && <BannerError mensaje={error} />}

        {/* ── Resultado ── */}
        {resultado && !resultado.encontrado && (
          <NoEncontrado datos={resultado} corte={corte} />
        )}
        {resultado?.encontrado && (
          <ResultadoAhorros datos={resultado} corte={corte} hoy={hoy} />
        )}

        {/* ── Portada ── */}
        {resumen && <Portada resumen={resumen} puedeCargar={puedeCargar} />}
      </div>
    </div>
  )
}

function NoEncontrado({
  datos,
  corte,
}: {
  datos: Extract<BusquedaAhorros, { encontrado: false }>
  corte: number
}) {
  const ciclos = datos.ciclos ?? []
  const mensaje =
    datos.motivo === 'grupo_invalido'
      ? 'Escribe el número de grupo, por ejemplo 439.'
      : datos.motivo === 'falta_ciclo'
        ? `Falta el ciclo del grupo ${sinCeros(datos.grupo_id ?? '')}.`
        : `No hay datos del grupo ${sinCeros(datos.grupo_id ?? '')} ciclo ${sinCeros(datos.ciclo ?? '')}.`

  return (
    <div className="border border-[#ECECEC] rounded-md bg-white px-5 py-4">
      <p className="text-[13px] text-ink-900 font-medium">{mensaje}</p>
      {datos.grupo_id && (
        ciclos.length > 0 ? (
          <p className="text-[12.5px] text-ink-500 mt-1.5 flex flex-wrap items-center gap-1.5">
            Ciclos con datos de este grupo:
            {ciclos.map(c => (
              <Link
                key={c}
                href={`/ahorros?grupo=${sinCeros(datos.grupo_id!)}&ciclo=${sinCeros(c)}&n=${corte}`}
                className="text-[12px] font-medium rounded px-2.5 py-[3px] border border-[#ECECEC] text-navy hover:bg-surface-hover"
              >
                {sinCeros(c)}
              </Link>
            ))}
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-500 mt-1">
            Este grupo todavía no tiene ningún ciclo cargado. Si lo necesitas, pídeselo a Data Science.
          </p>
        )
      )}
    </div>
  )
}

function Portada({ resumen, puedeCargar }: { resumen: ResumenAhorros; puedeCargar: boolean }) {
  if (resumen.grupos === 0) {
    return (
      <Panel titulo="Todavía no hay ahorros cargados">
        <div className="px-5 py-5 flex flex-col gap-2">
          <p className="text-[12.5px] text-ink-500">
            En cuanto Data Science suba el archivo, aquí se puede buscar cualquier grupo.
          </p>
          {puedeCargar && (
            <Link href="/ahorros/cargar" className="inline-flex items-center gap-1.5 text-[13px] text-navy font-medium hover:underline">
              <Upload size={14} /> Cargar el archivo
            </Link>
          )}
        </div>
      </Panel>
    )
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
      <Panel titulo="Actualizados recientemente" nota={`${resumen.grupos.toLocaleString('es-MX')} grupo-ciclo cargados`}>
        {resumen.recientes.length === 0 ? (
          <Vacio mensaje="Sin actualizaciones." />
        ) : (
          <ul className="divide-y divide-[#F5F5F5]">
            {resumen.recientes.map(r => (
              <li key={r.key_grupo}>
                <Link
                  href={`/ahorros?grupo=${sinCeros(r.grupo_id)}&ciclo=${sinCeros(r.ciclo)}`}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-[13px] text-ink-900 font-medium">
                      Grupo {sinCeros(r.grupo_id)} · Ciclo {sinCeros(r.ciclo)}
                    </span>
                    <span className="block text-[11.5px] text-ink-400">
                      {r.clientes} {r.clientes === 1 ? 'clienta' : 'clientas'} · {momento(r.actualizado_at)}
                    </span>
                  </span>
                  <ArrowRight size={14} className="text-ink-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        {resumen.ultima_carga && (
          <Panel titulo="Última carga">
            <div className="px-5 py-3 text-[12.5px] text-ink-700 flex flex-col gap-0.5">
              <p className="font-mono text-[11.5px] text-ink-500 truncate">{resumen.ultima_carga.nombre_archivo}</p>
              <p>{momento(resumen.ultima_carga.created_at)}</p>
              <p className="text-ink-500">
                {resumen.ultima_carga.grupos.toLocaleString('es-MX')} grupo-ciclo en el archivo
              </p>
            </div>
          </Panel>
        )}
        {resumen.uso && (
          <Panel titulo="Uso · últimos 30 días">
            <dl className="px-5 py-3 grid grid-cols-[1fr_auto] gap-y-1 text-[12.5px]">
              <dt className="text-ink-500">Consultas</dt>
              <dd className="text-ink-900 font-medium tabular-nums text-right">{resumen.uso.consultas_30d}</dd>
              <dt className="text-ink-500">Descargas</dt>
              <dd className="text-ink-900 font-medium tabular-nums text-right">{resumen.uso.descargas_30d}</dd>
              <dt className="text-ink-500">Personas</dt>
              <dd className="text-ink-900 font-medium tabular-nums text-right">{resumen.uso.usuarios_30d}</dd>
            </dl>
          </Panel>
        )}
      </div>
    </div>
  )
}
