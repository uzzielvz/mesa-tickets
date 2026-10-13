import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Download, ShieldCheck } from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import ImprimirBoton from '@/components/vacaciones/imprimir-boton'
import { camposFormato, codigoLegible, momentoFirma, type CamposFormato, type FirmaFormato } from '@/lib/vacaciones/formato'
import { FIRMA_TTF_BASE64, LOGO_PNG_BASE64 } from '@/lib/vacaciones/recursos'
import type { DatosFormato } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

/**
 * Formato GYC-VAC012026 (vacaciones) o GYC-DF012026 (días flotantes).
 *
 * Desde el 2026-10-05 la firma en la plataforma reemplaza al papel (VAC-005):
 *   · Si los días vienen de una solicitud, esto es la CONSTANCIA de tres firmas
 *     electrónicas: el nombre de quien firmó trazado como firma, con fecha y
 *     hora, y el QR que la verifica en /verificar/<código> (VAC-008).
 *   · Si los registró Gente y Cultura a mano, no hubo firmas en la plataforma:
 *     sale como siempre, para firmar en papel.
 * Lo pueden abrir Gente y Cultura, la persona y su jefe; lo valida `vac_formato`.
 * El PDF (/api/vacaciones/constancia/[id]) sale de los mismos `camposFormato`.
 */
export default async function FormatoVacacionesPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()
  const supabase = createClient()

  const { data, error } = await supabase.rpc('vac_formato', { p_movimiento: params.id })
  if (error?.code === '42501') redirect('/vacaciones/mias')
  const d = data as unknown as DatosFormato | null
  if (!d || !d.movimiento.fecha_inicio) notFound()

  const c = camposFormato(d)
  const volver = c.electronico ? '/vacaciones/mias' : `/vacaciones/${d.empleado.id}`
  const qr = c.urlVerificacion
    ? await QRCode.toString(c.urlVerificacion, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
    : null

  return (
    <div className="max-w-[820px] mx-auto px-4 py-6 print:p-0 print:max-w-none">
      <style>{`
        @page { size: letter; margin: 14mm; }
        @font-face { font-family: 'FirmaGYC'; src: url(data:font/ttf;base64,${FIRMA_TTF_BASE64}) format('truetype'); font-display: block; }
      `}</style>

      <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
        <Link href={volver} className="text-[13px] text-navy hover:underline font-medium">← Volver</Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/vacaciones/constancia/${params.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3.5 py-1.5"
          >
            <Download size={14} /> Descargar PDF
          </a>
          <ImprimirBoton />
        </div>
      </div>

      <article className="bg-white border border-ink-900 text-[12.5px] text-black leading-snug">
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-ink-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${LOGO_PNG_BASE64}`} alt="CrediFlexi" width={116} height={42} />
          <p className="text-[14px] font-bold">{c.titulo}</p>
          <p className="text-[11px] text-ink-500">Folio {c.folio}</p>
        </header>

        {c.electronico && (
          <p className="flex items-center gap-2 px-5 py-2 border-b border-ink-900 bg-[#F1F8F2] text-[11.5px] text-[#2E7D32]">
            <ShieldCheck size={14} className="shrink-0" />
            Firmado electrónicamente en la plataforma de CrediFlexi (solicitud {c.folioSolicitud}). No requiere firma autógrafa.
          </p>
        )}

        <section className="px-5 py-4 flex flex-col gap-2.5">
          <Fila>
            <Campo etiqueta="Nombre de la Empresa" valor={c.empresa} />
            <Campo etiqueta="Área y/o Departamento" valor={c.area} />
          </Fila>
          <Fila>
            <Campo etiqueta="No. de Empleado" valor={c.numeroEmpleado} />
            <Campo etiqueta="Nombre del Empleado" valor={c.nombre} ancho />
          </Fila>
          <Fila>
            <Campo etiqueta="Fecha de Ingreso" valor={c.ingreso} />
            <Campo etiqueta="Años de Servicio" valor={`${c.aniosServicio} ${c.aniosServicio === 1 ? 'AÑO' : 'AÑOS'}`} />
          </Fila>
          <Fila>
            <Campo etiqueta="Días que corresponden" valor={c.diasCorresponden} />
            <Campo etiqueta="Días a disfrutar" valor={c.diasDisfrutar} />
            <Campo etiqueta="Días Pendientes" valor={c.diasPendientes} />
          </Fila>
          <Fila>
            <Campo etiqueta="Período a Disfrutar" valor={c.periodo} ancho />
          </Fila>

          <div className="mt-1">
            <p className="font-medium">{c.esVacaciones ? 'Días que inician sus vacaciones' : 'Días que inician sus días flotantes'}</p>
            <div className="grid grid-cols-[40px_1fr] gap-y-1.5 mt-1.5 pl-6">
              <span>del</span>
              <span className="border-b border-ink-900 pb-0.5">{c.inicio.dia} de {c.inicio.mes} del {c.inicio.anio}</span>
              <span>al</span>
              <span className="border-b border-ink-900 pb-0.5">{c.fin.dia} de {c.fin.mes} del {c.fin.anio}</span>
            </div>
          </div>

          <Fila>
            <Campo etiqueta="Fecha en que deberá presentarse a trabajar" valor={c.regreso} ancho />
          </Fila>
          <Fila>
            <Campo etiqueta="Observaciones" valor={c.observaciones} ancho />
          </Fila>
        </section>

        <section className="px-5 py-4 border-t border-ink-900">
          {c.esVacaciones && (
            <p className="text-[11.5px] uppercase">
              Por el presente expreso mi conformidad de solicitar y gozar mis vacaciones de acuerdo a lo que
              establece el artículo 76 de la Ley Federal del Trabajo, considerando los siguientes datos:
            </p>
          )}
          <p className="text-center mt-3">
            <strong>{c.ciudad}</strong> a {c.elaborado.dia} de {c.elaborado.mes} de {c.elaborado.anio}
          </p>

          <div className={`grid grid-cols-3 gap-6 text-center text-[11.5px] ${c.electronico ? 'mt-8' : 'mt-14'}`}>
            {c.firmas.map(f => <Firma key={f.rol} firma={f} electronico={c.electronico} />)}
          </div>
        </section>
      </article>

      {c.electronico && c.codigo && c.urlVerificacion && qr && (
        <Verificacion c={c} qr={qr} />
      )}

      <p className="text-[10.5px] text-ink-400 mt-2">
        Generado en la plataforma de CrediFlexi a partir de la base de Gente y Cultura · Folio {c.folio}
        {c.folioSolicitud && <> · Solicitud {c.folioSolicitud}</>}
      </p>
    </div>
  )
}

/** Con firma electrónica: el nombre trazado sobre la línea, nombre impreso, cargo y fecha y hora. */
function Firma({ firma, electronico }: { firma: FirmaFormato; electronico: boolean }) {
  const e = firma.electronica
  return (
    <div className="flex flex-col items-center">
      <div className="h-9 w-full flex items-end justify-center overflow-visible">
        {e ? (
          <span className="text-[26px] leading-none text-navy whitespace-nowrap translate-y-2" style={{ fontFamily: 'FirmaGYC, cursive' }}>
            {e.quien}
          </span>
        ) : electronico ? (
          <span className="text-[10.5px] text-ink-400 mb-1">No aplica: sin jefe asignado</span>
        ) : null}
      </div>
      <div className="w-full border-t border-ink-900 pt-1 min-h-[16px] font-medium">{firma.nombre ?? ''}</div>
      <p className="font-bold mt-0.5">{firma.rol}</p>
      {e && <p className="text-[10px] text-[#2E7D32]">Firmado electrónicamente · {momentoFirma(e.cuando)} h</p>}
    </div>
  )
}

function Verificacion({ c, qr }: { c: CamposFormato; qr: string }) {
  return (
    <section className="flex items-start gap-4 mt-4 print:mt-6">
      <div className="w-[96px] h-[96px] shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="text-[11.5px] text-ink-700 leading-snug">
        <p className="text-[12.5px] font-semibold text-navy">Verifica este documento</p>
        <p className="text-ink-500">Escanea el código o entra a:</p>
        <a href={c.urlVerificacion!} className="font-medium text-navy hover:underline break-all">
          {c.urlVerificacion!.replace(/^https?:\/\//, '')}
        </a>
        <p className="mt-1">Código de verificación: <span className="tabular-nums">{codigoLegible(c.codigo!)}</span></p>
        <p className="text-[10.5px] text-ink-400 mt-1">
          Cada firma registra quién la dio y cuándo, con su cuenta de la plataforma. Si la solicitud se anula, la verificación lo indica.
        </p>
      </div>
    </section>
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
