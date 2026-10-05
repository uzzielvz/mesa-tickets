import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ImprimirBoton from '@/components/vacaciones/imprimir-boton'
import { partesFecha, fechaLarga } from '@/lib/vacaciones/calendario'
import { EMPRESA, CIUDAD, type Movimiento, type SaldoEmpleado } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

interface DatosFormato {
  movimiento: Movimiento
  empleado: SaldoEmpleado
  tomados_hasta_aqui: number
  registrado_por: string | null
  solicitud: {
    folio: number
    created_at: string
    solicitada_por: string | null
    jefe_at: string | null
    jefe_por: string | null
    rh_at: string | null
    rh_por: string | null
  } | null
}

/** Años cumplidos entre dos fechas ISO. */
function aniosEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}

const momento = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  })

/**
 * Formato GYC-VAC012026 (vacaciones) o GYC-DF012026 (días flotantes).
 *
 * Desde el 2026-10-05 la firma en la plataforma reemplaza al papel (VAC-005):
 *   · Si los días vienen de una solicitud, esto es la CONSTANCIA de tres firmas
 *     electrónicas. No lleva líneas para firma autógrafa.
 *   · Si los registró Gente y Cultura a mano, no hubo firmas en la plataforma:
 *     sale como siempre, para firmar en papel.
 * Lo pueden abrir Gente y Cultura, la persona y su jefe; lo valida `vac_formato`.
 */
export default async function FormatoVacacionesPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const supabase = createClient()

  const { data, error } = await supabase.rpc('vac_formato', { p_movimiento: params.id })
  if (error?.code === '42501') redirect('/vacaciones/mias')
  const d = data as unknown as DatosFormato | null
  if (!d || !d.movimiento.fecha_inicio) notFound()

  const m = d.movimiento
  const e = d.empleado
  const sol = d.solicitud
  const electronico = sol !== null

  const esVacaciones = m.tipo === 'vacaciones'
  const periodo = esVacaciones ? e.periodos.find(p => p.periodo === m.periodo) : undefined
  const pendientes = periodo ? periodo.derecho - Number(d.tomados_hasta_aqui) : null

  const ini = partesFecha(m.fecha_inicio!)
  const fin = partesFecha(m.fecha_fin ?? m.fecha_inicio!)
  const elaborado = partesFecha(
    new Date(sol?.rh_at ?? m.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }),
  )
  const titulo = esVacaciones ? 'VACACIONES GYC-VAC012026' : 'DÍAS FLOTANTES GYC-DF012026'
  const rhFirma = esVacaciones ? 'Vo. Bo. Recursos Humanos' : 'Vo. Bo. Coordinador Gente y Cultura'
  const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
  const volver = electronico ? '/vacaciones/mias' : `/vacaciones/${e.id}`

  return (
    <div className="max-w-[820px] mx-auto px-4 py-6 print:p-0 print:max-w-none">
      <style>{'@page { size: letter; margin: 14mm; }'}</style>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link href={volver} className="text-[13px] text-navy hover:underline font-medium">← Volver</Link>
        <ImprimirBoton />
      </div>

      <article className="bg-white border border-ink-900 text-[12.5px] text-black leading-snug">
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink-900">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange" />
            <span className="text-[18px] font-bold tracking-tight text-navy">CREDIFLEXI</span>
          </p>
          <p className="text-[14px] font-bold">{titulo}</p>
          <p className="text-[11px] text-ink-500">Folio {m.folio}</p>
        </header>

        {electronico && (
          <p className="flex items-center gap-2 px-5 py-2 border-b border-ink-900 bg-[#F1F8F2] text-[11.5px] text-[#2E7D32]">
            <ShieldCheck size={14} className="shrink-0" />
            Firmado electrónicamente en la plataforma de CrediFlexi (solicitud {sol!.folio}). No requiere firma autógrafa.
          </p>
        )}

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
            <Campo etiqueta="Años de Servicio" valor={`${aniosEntre(e.fecha_ingreso, m.fecha_inicio!)} AÑOS`} />
          </Fila>
          <Fila>
            <Campo etiqueta="Días que corresponden" valor={periodo ? String(periodo.derecho) : null} />
            <Campo etiqueta="Días a disfrutar" valor={fmt(Number(m.dias))} />
            <Campo etiqueta="Días Pendientes" valor={pendientes !== null ? fmt(pendientes) : null} />
          </Fila>
          <Fila>
            <Campo
              etiqueta="Período a Disfrutar"
              valor={periodo ? `del año ${periodo.desde.slice(0, 4)} al año ${periodo.hasta.slice(0, 4)}` : `año ${ini.anio}`}
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

          <div className={`grid grid-cols-3 gap-6 text-center text-[11.5px] ${electronico ? 'mt-6' : 'mt-14'}`}>
            <Firma
              nombre={e.nombre}
              rol="Firma de Conformidad del Empleado"
              electronica={electronico ? { quien: sol!.solicitada_por, cuando: sol!.created_at } : undefined}
            />
            <Firma
              nombre={e.jefe_nombre}
              rol="Firma de Autorización del Jefe directo"
              electronica={electronico && sol!.jefe_at ? { quien: sol!.jefe_por, cuando: sol!.jefe_at } : undefined}
            />
            <Firma
              nombre={electronico ? sol!.rh_por : d.registrado_por}
              rol={rhFirma}
              electronica={electronico && sol!.rh_at ? { quien: sol!.rh_por, cuando: sol!.rh_at } : undefined}
            />
          </div>
        </section>
      </article>

      <p className="text-[10.5px] text-ink-400 mt-2">
        Generado en la plataforma de CrediFlexi a partir de la base de Gente y Cultura · Folio {m.folio}
        {electronico && <> · Solicitud {sol!.folio}</>}
      </p>
    </div>
  )
}

/** Con `electronica`, la firma ocurrió en la plataforma: nombre, rol y fecha, sin línea para firmar. */
function Firma({
  nombre, rol, electronica,
}: {
  nombre: string | null
  rol: string
  electronica?: { quien: string | null; cuando: string }
}) {
  if (electronica) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <p className="flex items-center gap-1 text-[#2E7D32] font-medium">
          <ShieldCheck size={12} /> Firmado electrónicamente
        </p>
        <div className="w-full border-t border-ink-900 pt-1 font-medium">{electronica.quien ?? nombre ?? ''}</div>
        <p className="font-bold">{rol}</p>
        <p className="text-[10px] text-ink-500">{momento(electronica.cuando)}</p>
      </div>
    )
  }
  return (
    <div>
      <div className="border-t border-ink-900 pt-1 min-h-[16px] font-medium">{nombre ?? ''}</div>
      <p className="font-bold mt-0.5">{rol}</p>
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
