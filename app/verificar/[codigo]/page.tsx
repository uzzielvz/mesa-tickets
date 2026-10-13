import type { Metadata } from 'next'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga } from '@/lib/vacaciones/calendario'
import { codigoLegible, momentoFirma } from '@/lib/vacaciones/formato'
import { LOGO_PNG_BASE64 } from '@/lib/vacaciones/recursos'
import type { Verificacion } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Verificación de documentos · CrediFlexi',
  robots: { index: false, follow: false },
}

/**
 * A donde lleva el QR de la constancia (VAC-008). PÚBLICA: quien recibe el
 * papel no necesariamente tiene cuenta. `vac_verificar` solo responde por
 * solicitudes que pasaron por el Vo. Bo., y enseña lo mismo que trae el papel.
 */
export default async function VerificarPage({ params }: { params: { codigo: string } }) {
  const codigo = params.codigo.toLowerCase().replace(/[^0-9a-f]/g, '')
  const supabase = createClient()
  const { data } = await supabase.rpc('vac_verificar', { p_codigo: codigo })
  const v = data as unknown as Verificacion | null
  const ahora = new Date().toISOString()

  return (
    <main className="min-h-screen bg-surface-sidebar px-4 py-10">
      <div className="max-w-[560px] mx-auto flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${LOGO_PNG_BASE64}`} alt="CrediFlexi" width={116} height={42} />
          <p className="text-[12px] text-ink-500">Verificación de documentos</p>
        </header>

        {!v ? (
          <section className="bg-white border border-border rounded-md p-6 flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[16px] font-semibold text-[#C62828]">
              <ShieldX size={20} /> No encontramos este documento
            </p>
            <p className="text-[13px] text-ink-700 leading-relaxed">
              El código no corresponde a ninguna constancia emitida por la plataforma de CrediFlexi. Puede estar mal
              escrito, o el documento no salió de la plataforma.
            </p>
            <p className="text-[11.5px] text-ink-400 mt-2">Código consultado: {codigo ? codigoLegible(codigo) : '—'}</p>
          </section>
        ) : (
          <section className="bg-white border border-border rounded-md overflow-hidden">
            {v.estado === 'aprobada' ? (
              <div className="bg-[#F1F8F2] border-b border-[#C8E6C9] px-6 py-4">
                <p className="flex items-center gap-2 text-[16px] font-semibold text-[#2E7D32]">
                  <ShieldCheck size={20} /> Documento auténtico y vigente
                </p>
                <p className="text-[12.5px] text-[#2E7D32] mt-0.5">
                  Lo emitió la plataforma de CrediFlexi y sus firmas electrónicas están registradas.
                </p>
              </div>
            ) : (
              <div className="bg-[#FFEBEE] border-b border-[#FFCDD2] px-6 py-4">
                <p className="flex items-center gap-2 text-[16px] font-semibold text-[#C62828]">
                  <ShieldAlert size={20} /> Documento auténtico, pero anulado
                </p>
                <p className="text-[12.5px] text-[#C62828] mt-0.5">
                  Gente y Cultura anuló estos días{v.cancelada_at ? ` el ${momentoFirma(v.cancelada_at)} h` : ''}: ya no
                  cuentan como {v.tipo === 'vacaciones' ? 'vacaciones' : 'días flotantes'}.
                </p>
              </div>
            )}

            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
                  {v.tipo === 'vacaciones' ? 'Constancia de vacaciones · GYC-VAC012026' : 'Constancia de días flotantes · GYC-DF012026'}
                </p>
                <p className="text-[18px] font-semibold text-navy mt-1">{v.empleado}</p>
                {v.puesto && <p className="text-[12.5px] text-ink-500">{v.puesto}</p>}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                <Dato etiqueta="Solicitud" valor={`Folio ${v.folio}`} />
                <Dato
                  etiqueta="Días"
                  valor={`${Number(v.dias)} ${v.tipo === 'vacaciones' ? (Number(v.dias) === 1 ? 'día hábil' : 'días hábiles') : (Number(v.dias) === 1 ? 'día flotante' : 'días flotantes')}`}
                />
                <Dato etiqueta="Del" valor={fechaLarga(v.fecha_inicio)} />
                <Dato etiqueta="Al" valor={fechaLarga(v.fecha_fin)} />
                <Dato etiqueta="Regresa a trabajar" valor={fechaLarga(v.fecha_regreso)} />
              </dl>

              <div>
                <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mb-1.5">Firmas electrónicas</p>
                <ul className="divide-y divide-border-subtle border border-border rounded">
                  {v.firmas.map(f => (
                    <li key={f.rol} className="px-3 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink-900 font-medium">{f.nombre ?? '—'}</span>
                        <span className="block text-[11.5px] text-ink-500">{f.rol}</span>
                      </span>
                      <span className="text-[12px] text-ink-700 tabular-nums">
                        {f.at ? `${momentoFirma(f.at)} h` : 'No aplica'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        <p className="text-[11px] text-ink-400 leading-relaxed">
          Consultado el {momentoFirma(ahora)} h (hora de la Ciudad de México). Si los datos de tu documento no coinciden con
          los de esta página, el documento fue alterado.
        </p>
      </div>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-400">{etiqueta}</dt>
      <dd className="text-ink-900 font-medium">{valor}</dd>
    </div>
  )
}
