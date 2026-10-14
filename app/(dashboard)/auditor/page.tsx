import Link from 'next/link'
import { Search, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import TablaConciliacion from '@/components/auditor/tabla-conciliacion'
import { ETIQUETA_CONTEO, pesos, type Conciliacion, type CuentaPromotor, type EstadoConciliacion, type PapelAuditor } from '@/lib/auditor/tipos'

export const dynamic = 'force-dynamic'

const sinCeros = (s: string) => s.replace(/^0+(?=\d)/, '')
const fecha = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—'
const momento = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

const TITULO: Record<PapelAuditor, { titulo: string; subtitulo: string }> = {
  todo: {
    titulo: 'Depósitos sin conciliar',
    subtitulo: 'Depósitos del banco que siguen sin conciliar, comparados contra lo que registraron los promotores.',
  },
  gerente: {
    titulo: 'Depósitos sin conciliar de tu equipo',
    subtitulo: 'Depósitos de los grupos de tus promotores que siguen sin conciliar, comparados contra lo que registraron.',
  },
  promotor: {
    titulo: 'Tus depósitos sin conciliar',
    subtitulo: 'Depósitos de tus grupos que siguen sin conciliar, comparados contra lo que registraste.',
  },
}

/** Solo se marca lo que impide que el promotor vea lo suyo. */
const CUENTA: Partial<Record<CuentaPromotor, { texto: string; tono: string }>> = {
  sin_correo: { texto: 'sin cuenta', tono: 'bg-[#FFEBEE] text-[#C62828]' },
  sin_entrar: { texto: 'no ha entrado', tono: 'bg-[#FFF8E1] text-[#8A6100]' },
}

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
 *
 * AUD-004: cada promotor ve solo lo suyo y el gerente lo de su equipo; quien
 * tiene bandera ve todo y puede filtrar por promotor. El alcance lo decide la
 * RPC, no la página.
 */
export default async function AuditorPage({ searchParams }: { searchParams: { grupo?: string; promotor?: string } }) {
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
  const promotor = (searchParams.promotor ?? '').trim().slice(0, 120)
  const { data, error } = await supabase.rpc('aud_conciliacion', { p_grupo: grupo || null, p_promotor: promotor || null })
  const d = data as unknown as Conciliacion | null
  const papel: PapelAuditor = d?.papel ?? 'todo'
  const enlace = (q: Record<string, string>) => {
    const u = new URLSearchParams(q).toString()
    return u ? `/auditor?${u}` : '/auditor'
  }

  return (
    <div>
      <Header
        title={TITULO[papel].titulo}
        subtitle={TITULO[papel].subtitulo}
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

            {papel !== 'promotor' && (d.promotores.length > 0 || d.sin_promotor > 0 || !d.ant_carga) && (
              <Panel
                titulo="Por promotor"
                nota={d.promotores.length ? `${d.promotores.length} con pendientes` : undefined}
              >
                {!d.ant_carga ? (
                  <div className="px-5 py-4 flex flex-col gap-1.5">
                    <p className="text-[12.5px] text-ink-500">
                      Falta el reporte de antigüedad grupal para saber de quién es cada grupo. Sin él, solo quien ve toda la cartera entra al Auditor.
                    </p>
                    {puedeCargar && (
                      <Link href="/auditor/cargar" className="inline-flex items-center gap-1.5 text-[13px] text-navy font-medium hover:underline">
                        <Upload size={14} /> Cargar el reporte de antigüedad
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-[#F5F5F5]">
                    {d.promotores.map(pr => {
                      const elegido = d.promotor?.clave === pr.clave
                      const marca = pr.cuenta ? CUENTA[pr.cuenta] : undefined
                      return (
                        <li key={pr.clave}>
                          <Link
                            href={elegido ? enlace({}) : enlace({ promotor: pr.clave })}
                            className={`px-5 py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 hover:bg-surface-hover ${elegido ? 'bg-[#FFF8F2]' : ''}`}
                          >
                            <span className="min-w-0">
                              <span className={`text-[13px] ${elegido ? 'text-navy font-semibold' : 'text-ink-900 font-medium'}`}>{pr.nombre}</span>
                              {marca && (
                                <span className={`ml-2 text-[11px] font-medium rounded px-1.5 py-[1px] ${marca.tono}`}>{marca.texto}</span>
                              )}
                              {papel === 'todo' && pr.gerente && (
                                <span className="block text-[11.5px] text-ink-400">Gerente: {pr.gerente}</span>
                              )}
                            </span>
                            <span className="text-[12.5px] text-ink-700 tabular-nums whitespace-nowrap">
                              {pr.depositos} {Number(pr.depositos) === 1 ? 'depósito' : 'depósitos'} · <span className="text-ink-900 font-medium">{pesos(Number(pr.monto))}</span>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                    {d.sin_promotor > 0 && (
                      <li className="px-5 py-2.5 text-[12.5px] text-[#8A6100]">
                        {d.sin_promotor} {d.sin_promotor === 1 ? 'fila es de un grupo' : 'filas son de grupos'} que no vienen en el reporte de antigüedad: solo se ven aquí.
                      </li>
                    )}
                  </ul>
                )}
              </Panel>
            )}

            <form action="/auditor" method="get" className="flex flex-wrap items-center gap-2">
              {d.promotor && <input type="hidden" name="promotor" value={d.promotor.clave} />}
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
              {grupo && (
                <Link href={enlace(d.promotor ? { promotor: d.promotor.clave } : {})} className="text-[12.5px] text-ink-500 hover:text-ink-900">
                  Quitar filtro
                </Link>
              )}
              {d.promotor && (
                <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-700 bg-[#FFF8F2] border border-[#F5D9C0] rounded px-2.5 py-1">
                  Promotor: <span className="font-medium text-ink-900">{d.promotor.nombre}</span>
                  <Link href={enlace(grupo ? { grupo } : {})} className="text-ink-500 hover:text-ink-900">Quitar</Link>
                </span>
              )}
            </form>

            <Panel
              titulo="Por grupo, ciclo y día"
              nota={`${d.filas.length} ${d.filas.length === 1 ? 'fila' : 'filas'}${grupo ? ` del grupo ${sinCeros(grupo)}` : ''}`}
            >
              {d.filas.length === 0 ? (
                <Vacio
                  mensaje={
                    grupo
                      ? `El grupo ${sinCeros(grupo)} no tiene depósitos sin conciliar${papel === 'todo' ? '' : ' o no es de tus grupos'}.`
                      : papel === 'promotor'
                        ? 'Todos los depósitos de tus grupos están conciliados.'
                        : 'Todos los depósitos están conciliados.'
                  }
                />
              ) : (
                <TablaConciliacion filas={d.filas} mostrarPromotor={papel !== 'promotor' && !d.promotor} />
              )}
            </Panel>

            <p className="text-[11.5px] text-ink-400">
              Depósitos: <span className="font-mono">{d.dep_carga.nombre_archivo}</span> ({fecha(d.dep_carga.fecha_min)} – {fecha(d.dep_carga.fecha_max)}), cargado el {momento(d.dep_carga.created_at)}.
              {d.reg_carga && (
                <> Registros: <span className="font-mono">{d.reg_carga.nombre_archivo}</span> ({fecha(d.reg_carga.fecha_min)} – {fecha(d.reg_carga.fecha_max)}), cargado el {momento(d.reg_carga.created_at)}.</>
              )}
              {d.ant_carga && (
                <> Promotores: <span className="font-mono">{d.ant_carga.nombre_archivo}</span>{d.ant_carga.fecha_corte && <> (corte del {fecha(d.ant_carga.fecha_corte)})</>}.</>
              )}
              {' '}Se comparan por grupo, ciclo y fecha exacta del depósito.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
