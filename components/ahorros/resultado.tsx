import Link from 'next/link'
import { Download, Info, AlertTriangle } from 'lucide-react'
import { Tile, Panel, VIZ } from '@/components/viz'
import {
  PAGOS_CORTE, pesos, sinCeros, fechaCorta, momento,
  type BusquedaAhorros, type PagoCorte, type SemanaAhorro,
} from '@/lib/ahorros/tipos'

type Encontrado = Extract<BusquedaAhorros, { encontrado: true }>

const enlace = (grupo: string, ciclo: string, n: PagoCorte) =>
  `/ahorros?grupo=${sinCeros(grupo)}&ciclo=${sinCeros(ciclo)}&n=${n}`

/**
 * El estado de ahorro de un grupo-ciclo. Lo que antes era una hoja de Excel
 * armada a mano y mandada por correo: aquí el asesor lo ve y lo descarga solo.
 *
 * Presentacional y sin estado: todo llega ya sumado por `aho_buscar`. El pago
 * de corte vive en la URL (?n=12), así que "el grupo 439 al pago 13" se puede
 * mandar como link.
 */
export default function ResultadoAhorros({
  datos,
  corte,
  hoy,
}: {
  datos: Encontrado
  corte: PagoCorte
  /** YYYY-MM-DD en hora de México: separa semanas vencidas de las que vienen. */
  hoy: string
}) {
  const { resumen, clientes } = datos
  const grupo = sinCeros(datos.grupo_id)
  const ciclo = sinCeros(datos.ciclo)
  const inicio = clientes.find(c => c.inicio_ciclo)?.inicio_ciclo ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* ── Encabezado del grupo ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-navy leading-tight">
            Grupo {grupo} · Ciclo {ciclo}
          </h2>
          <p className="text-[12.5px] text-ink-500 mt-0.5">
            <span className="font-mono text-[11.5px]">{datos.key_grupo}</span>
            {' · '}{resumen.clientes} {resumen.clientes === 1 ? 'clienta' : 'clientas'}
            {inicio && <> · inicio de ciclo {fechaCorta(inicio)}</>}
          </p>
        </div>
        {!datos.sin_datos_credito && (
          <a
            href={`/api/ahorros/descargar?grupo=${datos.grupo_id}&ciclo=${datos.ciclo}&n=${corte}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3.5 py-2 transition-colors"
          >
            <Download size={14} /> Descargar Excel
          </a>
        )}
      </div>

      {datos.ciclos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-ink-400 mr-1">Ciclos de este grupo:</span>
          {datos.ciclos.map(c => {
            const activo = c === datos.ciclo
            return (
              <Link
                key={c}
                href={enlace(datos.grupo_id, c, corte)}
                className={`text-[12px] font-medium rounded px-2.5 py-[3px] border transition-colors ${
                  activo
                    ? 'border-orange bg-orange/10 text-orange-dark'
                    : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                }`}
              >
                {sinCeros(c)}
              </Link>
            )
          })}
        </div>
      )}

      {datos.sin_datos_credito ? (
        <div className="border border-[#FFE0B2] bg-[#FFF8E1] rounded-md px-4 py-3">
          <p className="flex items-start gap-1.5 text-[13px] text-[#8A6100] font-medium">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Este ciclo está en el archivo, pero todavía sin información del crédito ni pagos.
          </p>
          <p className="text-[12px] text-[#8A6100] mt-1">
            Clientas registradas: {clientes.map(c => c.cliente_id).join(', ')}. En cuanto
            Data Science cargue sus pagos, aquí aparecen.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile
              etiqueta="Ahorro acumulado"
              valor={pesos(resumen.ahorro)}
              apoyo="suma de garantías del ciclo"
              acento
            />
            <Tile
              etiqueta={`Rendimiento al pago ${corte}`}
              valor={pesos(resumen.rend[`${corte}`])}
              apoyo="de las garantías · sin la base"
            />
            <Tile
              etiqueta="Monto prestado"
              valor={pesos(resumen.prestado)}
              apoyo={`base de ahorro ${pesos(resumen.base)}`}
            />
            <Tile
              etiqueta="Clientas"
              valor={String(resumen.clientes)}
              apoyo="en este ciclo"
            />
          </div>

          {/* ── Pago de corte ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-ink-400 mr-1">Rendimiento hasta el pago:</span>
            {PAGOS_CORTE.map(n => {
              const activo = n === corte
              return (
                <Link
                  key={n}
                  href={enlace(datos.grupo_id, datos.ciclo, n)}
                  scroll={false}
                  className={`text-[12px] font-medium rounded px-2.5 py-[3px] border tabular-nums transition-colors ${
                    activo
                      ? 'border-navy bg-navy text-white'
                      : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                  }`}
                >
                  {n}
                </Link>
              )
            })}
            <span className="text-[11.5px] text-ink-400 ml-1">
              La plantilla usa el 12; cámbialo si el grupo renueva en otra semana.
            </span>
          </div>

          <p className="flex items-start gap-1.5 text-[12px] text-ink-500 border border-[#ECECEC] bg-surface-sidebar rounded-md px-3.5 py-2.5">
            <Info size={13} className="mt-0.5 shrink-0 text-ink-400" />
            <span>
              El rendimiento es el de las <strong className="text-ink-700">garantías semanales</strong>.
              No incluye el rendimiento sobre la <strong className="text-ink-700">base de ahorro</strong>,
              que Data Science todavía no manda en el archivo.
            </span>
          </p>

          {/* ── Tabla por clienta ── */}
          <Panel titulo="Por clienta" nota={`rendimiento al pago ${corte}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                    <th className="px-5 py-2 font-medium">Clienta</th>
                    <th className="px-3 py-2 font-medium text-right">Prestado</th>
                    <th className="px-3 py-2 font-medium text-right">Base</th>
                    <th className="px-3 py-2 font-medium text-right">Pago semanal</th>
                    <th className="px-3 py-2 font-medium text-right">Ahorro</th>
                    <th className="px-3 py-2 font-medium text-right">Rendimiento</th>
                    <th className="px-5 py-2 font-medium">Semanas</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.cliente_id} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-5 py-2.5 font-mono text-[12px] text-ink-900">{c.cliente_id}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{pesos(c.cantidad_prestada)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{pesos(c.base_ahorro)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{pesos(c.pago_semanal)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium">{pesos(c.ahorro)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium">{pesos(c.rend[`${corte}`])}</td>
                      <td className="px-5 py-2.5">
                        <TiraSemanas semanas={c.semanas} corte={corte} hoy={hoy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#ECECEC] bg-surface-sidebar">
                    <td className="px-5 py-2.5 text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Total</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{pesos(resumen.prestado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{pesos(resumen.base)}</td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-semibold">{pesos(resumen.ahorro)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-semibold">{pesos(resumen.rend[`${corte}`])}</td>
                    <td className="px-5 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Leyenda corte={corte} />
          </Panel>
        </>
      )}

      <p className="text-[11.5px] text-ink-400">
        Cifras de Data Science, actualizadas el {momento(datos.actualizado_at)}
        {datos.carga && <> · archivo <span className="font-mono">{datos.carga.nombre_archivo}</span></>}.
      </p>
    </div>
  )
}

/**
 * Una celda por semana. Se lee de un vistazo qué clientas ahorraron todas las
 * semanas y cuáles no, que es justo lo que la plantilla escondía en columnas
 * ocultas. Las semanas después del pago de corte se atenúan: no generan
 * rendimiento hasta ese pago (así lo calcula el archivo).
 */
function TiraSemanas({ semanas, corte, hoy }: { semanas: SemanaAhorro[]; corte: PagoCorte; hoy: string }) {
  const conAhorro = semanas.filter(s => (s.garantia ?? 0) > 0).length
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[2px]" aria-hidden>
        {semanas.map(s => {
          const ahorro = (s.garantia ?? 0) > 0
          const futura = !!s.fecha_pago && s.fecha_pago > hoy && !ahorro
          const fueraDeCorte = s.semana > corte
          return (
            <span
              key={s.semana}
              title={`Semana ${s.semana}${s.fecha_pago ? ` · ${fechaCorta(s.fecha_pago)}` : ''}\nAhorro: ${pesos(s.garantia)} · Pago: ${pesos(s.pago)}${fueraDeCorte ? `\nDespués del pago ${corte}: no suma rendimiento` : ''}`}
              className="w-[8px] h-[16px] rounded-[2px] border"
              style={{
                backgroundColor: ahorro ? VIZ.barra : futura ? '#FFFFFF' : '#E6E6E3',
                borderColor: ahorro ? VIZ.barra : futura ? '#DADAD6' : '#E6E6E3',
                opacity: fueraDeCorte ? 0.35 : 1,
              }}
            />
          )
        })}
      </div>
      <span className="text-[11.5px] text-ink-500 tabular-nums whitespace-nowrap">
        {conAhorro}/{semanas.length}
      </span>
    </div>
  )
}

function Leyenda({ corte }: { corte: PagoCorte }) {
  const muestra = (fondo: string, borde: string, opacidad = 1) => (
    <span
      className="inline-block w-[8px] h-[12px] rounded-[2px] border align-middle mr-1.5"
      style={{ backgroundColor: fondo, borderColor: borde, opacity: opacidad }}
    />
  )
  return (
    <div className="px-5 py-2.5 border-t border-[#F5F5F5] flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-500">
      <span>{muestra(VIZ.barra, VIZ.barra)}ahorró esa semana</span>
      <span>{muestra('#E6E6E3', '#E6E6E3')}sin ahorro</span>
      <span>{muestra('#FFFFFF', '#DADAD6')}todavía no vence</span>
      <span>{muestra(VIZ.barra, VIZ.barra, 0.35)}después del pago {corte}</span>
    </div>
  )
}
