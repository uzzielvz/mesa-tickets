import { COLOR_AUSENCIA, type FueraSemana } from '@/lib/vacaciones/seguimiento'

const ALTO = 112

/**
 * Personas fuera por semana (VAC-009): columnas apiladas, aprobadas abajo y en
 * trámite arriba, separadas por 2 px de superficie. El total va en la tapa de
 * cada columna, así que no lleva eje; el detalle de cada segmento, en el
 * tooltip. Leyenda siempre: son dos series.
 */
export default function FueraPorSemana({ datos }: { datos: FueraSemana[] }) {
  const maximo = Math.max(1, ...datos.map(d => d.aprobadas + d.tramite))
  const px = (n: number) => (n / maximo) * ALTO

  return (
    <figure className="px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLOR_AUSENCIA.vacaciones }} /> Con días aprobados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLOR_AUSENCIA.tramite }} /> Solo en trámite
        </span>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto border-b border-[#ECECEC]" style={{ minHeight: ALTO + 22 }}>
        {datos.map(d => {
          const total = d.aprobadas + d.tramite
          return (
            <div
              key={d.semana.inicio}
              title={`Semana del ${d.semana.etiqueta}: ${d.aprobadas} con días aprobados, ${d.tramite} solo en trámite · ${d.dias} días-persona hábiles`}
              className="flex-1 min-w-[44px] flex flex-col items-center justify-end h-full pt-5"
            >
              <span className="text-[11px] tabular-nums text-ink-700 mb-1">{total}</span>
              <div className="w-full max-w-[24px] flex flex-col gap-[2px]">
                {d.tramite > 0 && (
                  <div className="w-full rounded-t-[4px]" style={{ height: px(d.tramite), backgroundColor: COLOR_AUSENCIA.tramite }} />
                )}
                {d.aprobadas > 0 && (
                  <div
                    className={`w-full ${d.tramite > 0 ? '' : 'rounded-t-[4px]'}`}
                    style={{ height: px(d.aprobadas), backgroundColor: COLOR_AUSENCIA.vacaciones }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 overflow-x-auto -mt-2">
        {datos.map(d => (
          <span key={d.semana.inicio} className="flex-1 min-w-[44px] text-center text-[10.5px] text-ink-500 whitespace-nowrap">
            {d.semana.etiqueta}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {datos.map(d => `Semana del ${d.semana.etiqueta}: ${d.aprobadas + d.tramite} personas fuera`).join('. ')}
      </figcaption>
    </figure>
  )
}
