import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ImprimirBoton from '@/components/vacaciones/imprimir-boton'
import { partesFecha, fechaLarga } from '@/lib/vacaciones/calendario'
import { EMPRESA, CIUDAD, type Movimiento, type SaldoEmpleado } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

/** Años cumplidos entre dos fechas ISO. */
function aniosEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}

/**
 * Formato GYC-VAC012026 (vacaciones) o GYC-DF012026 (días flotantes),
 * prellenado desde la base. Mismos campos y mismas tres firmas que el papel de
 * Gente y Cultura; lo único que cambia es que ya nadie lo teclea.
 *
 * Fase 1: se imprime y se firma a mano. La fase 2 decidirá si la autorización
 * en la plataforma sustituye a las firmas.
 */
export default async function FormatoVacacionesPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const supabase = createClient()

  const { data: mov } = await supabase.from('vac_movimientos').select('*').eq('id', params.id).maybeSingle()
  const m = mov as Movimiento | null
  if (!m || m.anulado_at || !m.fecha_inicio) notFound()

  const [{ data: saldo }, { data: hermanos }, { data: quien }] = await Promise.all([
    supabase.rpc('vac_saldos', { p_empleado: m.empleado_id }),
    supabase
      .from('vac_movimientos')
      .select('id, dias, created_at')
      .eq('empleado_id', m.empleado_id)
      .eq('tipo', 'vacaciones')
      .eq('periodo', m.periodo ?? -1)
      .is('anulado_at', null),
    m.registrado_por
      ? supabase.from('profiles').select('nombre_completo').eq('id', m.registrado_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const e = ((saldo as unknown as SaldoEmpleado[] | null) ?? [])[0]
  if (!e) notFound()

  const esVacaciones = m.tipo === 'vacaciones'
  const periodo = esVacaciones ? e.periodos.find(p => p.periodo === m.periodo) : undefined
  // "Días pendientes" al momento de ESTE registro, no al día de hoy: el formato
  // se puede reimprimir semanas después y debe decir lo mismo que el original.
  const tomadosHastaAqui = (hermanos ?? [])
    .filter(h => h.created_at <= m.created_at)
    .reduce((a, h) => a + Number(h.dias), 0)
  const pendientes = periodo ? periodo.derecho - tomadosHastaAqui : null

  const ini = partesFecha(m.fecha_inicio)
  const fin = partesFecha(m.fecha_fin ?? m.fecha_inicio)
  const elaborado = partesFecha(
    new Date(m.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
  )
  const titulo = esVacaciones ? 'VACACIONES GYC-VAC012026' : 'DÍAS FLOTANTES GYC-DF012026'
  const rhFirma = esVacaciones ? 'Vo. Bo. Recursos Humanos' : 'Vo. Bo. Coordinador Gente y Cultura'
  const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })

  return (
    <div className="max-w-[820px] mx-auto px-4 py-6 print:p-0 print:max-w-none">
      <style>{'@page { size: letter; margin: 14mm; }'}</style>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href={`/vacaciones/${e.id}`} className="text-[13px] text-navy hover:underline font-medium">
          ← Volver a {e.nombre}
        </Link>
        <ImprimirBoton />
      </div>

      <article className="bg-white border border-ink-900 text-[12.5px] text-black leading-snug">
        {/* ── Encabezado ── */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink-900">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange" />
            <span className="text-[18px] font-bold tracking-tight text-navy">CREDIFLEXI</span>
          </p>
          <p className="text-[14px] font-bold">{titulo}</p>
          <p className="text-[11px] text-ink-500">Folio {m.folio}</p>
        </header>

        <section className="px-5 py-4 flex flex-col gap-2.5">
          <Fila>
            <Campo etiqueta="Nombre de la Empresa" valor={EMPRESA} />
            <Campo etiqueta="Área y/o Departamento" valor={e.area} />
          </Fila>
          <Fila>
            <Campo etiqueta="No. de Empleado" valor={e.numero_empleado} />
            <Campo etiqueta="Nombre del Empleado" valor={e.nombre} ancho />
          </Fila>
          <Fila>
            <Campo etiqueta="Fecha de Ingreso" valor={fechaLarga(e.fecha_ingreso)} />
            <Campo etiqueta="Años de Servicio" valor={`${aniosEntre(e.fecha_ingreso, m.fecha_inicio)} AÑOS`} />
          </Fila>
          <Fila>
            <Campo etiqueta="Días que corresponden" valor={periodo ? String(periodo.derecho) : null} />
            <Campo etiqueta="Días a disfrutar" valor={fmt(m.dias)} />
            <Campo etiqueta="Días Pendientes" valor={pendientes !== null ? fmt(pendientes) : null} />
          </Fila>
          <Fila>
            <Campo
              etiqueta="Período a Disfrutar"
              valor={periodo
                ? `del año ${periodo.desde.slice(0, 4)} al año ${periodo.hasta.slice(0, 4)}`
                : `año ${ini.anio}`}
              ancho
            />
          </Fila>

          <div className="mt-1">
            <p className="font-medium">{esVacaciones ? 'Días que inician sus vacaciones' : 'Días que inician sus días flotantes'}</p>
            <div className="grid grid-cols-[40px_1fr] gap-y-1.5 mt-1.5 pl-6">
              <span>del</span>
              <span className="border-b border-ink-900 pb-0.5">{ini.dia} de {ini.mes} del {ini.anio}</span>
              <span>al</span>
              <span className="border-b border-ink-900 pb-0.5">{fin.dia} de {fin.mes} del {fin.anio}</span>
            </div>
          </div>

          <Fila>
            <Campo etiqueta="Fecha en que deberá presentarse a trabajar" valor={m.fecha_regreso ? fechaLarga(m.fecha_regreso) : null} ancho />
          </Fila>
          <Fila>
            <Campo etiqueta="Observaciones" valor={m.observaciones} ancho />
          </Fila>
        </section>

        <section className="px-5 py-4 border-t border-ink-900">
          {esVacaciones && (
            <p className="text-[11.5px] uppercase">
              Por el presente expreso mi conformidad de solicitar y gozar mis vacaciones de acuerdo a lo que
              establece el artículo 76 de la Ley Federal del Trabajo, considerando los siguientes datos:
            </p>
          )}
          <p className="text-center mt-3">
            <strong>{CIUDAD}</strong> a {elaborado.dia} de {elaborado.mes} de {elaborado.anio}
          </p>

          <div className="grid grid-cols-3 gap-6 mt-14 text-center text-[11.5px]">
            <Firma nombre={e.nombre} rol="Firma de Conformidad del Empleado" />
            <Firma nombre={e.jefe_nombre} rol="Firma de Autorización del Jefe directo" />
            <Firma nombre={(quien as { nombre_completo?: string } | null)?.nombre_completo ?? null} rol={rhFirma} />
          </div>
        </section>
      </article>

      <p className="text-[10.5px] text-ink-400 mt-2">
        Generado en la plataforma de CrediFlexi a partir de la base de Gente y Cultura · Folio {m.folio}
      </p>
    </div>
  )
}

function Fila({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-2">{children}</div>
}

function Campo({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | null; ancho?: boolean }) {
  return (
    <p className={`flex items-baseline gap-2 ${ancho ? 'flex-1 min-w-[260px]' : 'min-w-[180px]'}`}>
      <span className="whitespace-nowrap">{etiqueta}:</span>
      <span className="flex-1 border-b border-ink-900 pb-0.5 min-h-[18px] font-medium">{valor ?? ''}</span>
    </p>
  )
}

function Firma({ nombre, rol }: { nombre: string | null; rol: string }) {
  return (
    <div>
      <div className="border-t border-ink-900 pt-1 min-h-[16px] font-medium">{nombre ?? ''}</div>
      <p className="font-bold mt-0.5">{rol}</p>
    </div>
  )
}
