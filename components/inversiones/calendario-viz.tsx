/**
 * Visualización del Calendario de Pagos (I3).
 *
 * Presentacional y sin estado: recibe lo que ya agregó el RPC. Reusa los tokens
 * de color de `components/viz.tsx`, cuyas decisiones ya están validadas ahí
 * (contraste y deuteranopia); aquí no se elige ningún color nuevo.
 *
 * **Por qué columnas verticales y no las barras horizontales de `viz.tsx`.** Los
 * días de un mes son una secuencia ordenada, no categorías: el lector busca la
 * forma del mes —dónde se concentra la salida de efectivo— antes que el valor de
 * un día concreto. Una lista horizontal de 31 renglones ordenada por monto
 * destruye justo esa lectura.
 */

import { VIZ } from '@/components/viz'

export const fmtPesos = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export const fmtPesosExacto = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export interface DiaCurva {
  dia: number
  fecha: string
  pagos: number
  salidas: number
  capitalizado: number
}

/** Sábado o domingo, en la fecha tal cual (sin conversión de zona). */
function esFinDeSemana(fecha: string): boolean {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return d === 0 || d === 6
}

/**
 * Salida de efectivo por día del mes.
 *
 * Solo grafica lo que **sale de caja**. Lo capitalizado no se mezcla en la
 * altura de la columna porque contestaría otra pregunta: quien mira esto está
 * planeando liquidez, y el rendimiento que se capitaliza no le mueve el saldo.
 * Aparece en el tooltip para que el dato no se pierda.
 */
export function CurvaSalidas({ dias, max }: { dias: DiaCurva[]; max: number }) {
  if (dias.length === 0) {
    return <p className="px-5 py-8 text-[13px] text-ink-400 text-center">Sin datos del mes.</p>
  }

  const tope = Math.max(max, 1)
  const pico = dias.reduce((a, b) => (b.salidas > a.salidas ? b : a), dias[0])

  return (
    <div className="px-5 py-4">
      <div className="flex items-end gap-[3px] h-[160px]">
        {dias.map(d => {
          // Mínimo visible para los días con monto pequeño: una columna de 0 px
          // y una de 1,200 pesos se ven igual, y no son lo mismo.
          const alto = d.salidas > 0 ? Math.max((d.salidas / tope) * 100, 1.5) : 0
          const esPico = d.dia === pico.dia && pico.salidas > 0
          return (
            <div key={d.dia} className="flex-1 flex flex-col justify-end h-full min-w-0 group relative">
              <div
                className="w-full rounded-t-[2px] transition-[height] duration-300"
                style={{
                  height: `${alto}%`,
                  backgroundColor: esPico ? VIZ.friccion : VIZ.barra,
                }}
              />
              {/* Tooltip nativo: sin estado, sin librería, funciona en táctil por
                  long-press y lo lee el lector de pantalla. */}
              <span className="absolute inset-0" title={
                `${d.fecha} · ${d.pagos} pago${d.pagos === 1 ? '' : 's'}\n` +
                `Sale de caja: ${fmtPesosExacto(d.salidas)}` +
                (d.capitalizado > 0 ? `\nSe capitaliza: ${fmtPesosExacto(d.capitalizado)}` : '')
              } />
            </div>
          )
        })}
      </div>

      {/* Eje de días. Se etiqueta cada tercer día para que quepan 31 sin
          encimarse, más el pico, que es el que la gente busca. */}
      <div className="flex gap-[3px] mt-1.5">
        {dias.map(d => {
          const marcado = d.dia === pico.dia && pico.salidas > 0
          const visible = marcado || d.dia === 1 || d.dia % 5 === 0
          return (
            <div key={d.dia} className="flex-1 min-w-0 text-center">
              <span
                className={`text-[9.5px] tabular-nums ${
                  marcado ? 'text-[#D9531F] font-semibold' : 'text-ink-400'
                } ${visible ? '' : 'invisible'} ${esFinDeSemana(d.fecha) && !marcado ? 'opacity-50' : ''}`}
              >
                {d.dia}
              </span>
            </div>
          )
        })}
      </div>

      {pico.salidas > 0 && (
        <p className="text-[12px] text-ink-500 mt-3">
          El día más pesado del mes es el <strong className="text-ink-900 font-medium">{pico.dia}</strong>,
          con <strong className="text-ink-900 font-medium">{fmtPesosExacto(pico.salidas)}</strong> en{' '}
          {pico.pagos} pago{pico.pagos === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  )
}

/** Desglose por sección, con la capitalizada marcada como lo que no sale. */
export function Secciones({
  filas,
}: {
  filas: { seccion: string; pagos: number; monto: number; capitaliza: boolean }[]
}) {
  if (filas.length === 0) {
    return <p className="px-5 py-8 text-[13px] text-ink-400 text-center">Sin secciones.</p>
  }
  const tope = Math.max(...filas.map(f => f.monto), 1)

  return (
    <ul className="flex flex-col gap-2.5 px-5 py-4">
      {filas.map(f => (
        <li key={f.seccion} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-baseline">
          <p className="text-[12.5px] text-ink-900 truncate" title={f.seccion}>
            {f.seccion}
            {f.capitaliza && (
              <span className="text-ink-400 font-normal"> · no sale de caja</span>
            )}
          </p>
          <p className="text-[12.5px] text-ink-900 tabular-nums font-medium whitespace-nowrap">
            {fmtPesosExacto(f.monto)}
            <span className="text-ink-400 font-normal"> · {f.pagos}</span>
          </p>
          <div className="col-span-2 h-[7px] bg-[#F5F5F5] rounded-[4px] overflow-hidden">
            <div
              className="h-full rounded-[4px]"
              style={{
                width: `${Math.max((f.monto / tope) * 100, 0.6)}%`,
                // Lo capitalizado va en el tono suave: está en el total del mes,
                // pero no compite por el efectivo.
                backgroundColor: f.capitaliza ? VIZ.barraSuave : VIZ.barra,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
