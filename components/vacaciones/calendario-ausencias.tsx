import {
  COLOR_AUSENCIA, ETIQUETA_AUSENCIA, ausenciaEnDia, claseDe, rangoAusencia,
  type ClaseAusencia, type GrupoCalendario, type Semana,
} from '@/lib/vacaciones/seguimiento'

const INICIAL = ['L', 'M', 'M', 'J', 'V']
const FESTIVO = '#f0efec'

/**
 * Quién estará fuera, día por día (VAC-009). Una fila por persona con alguna
 * ausencia en la ventana; columnas de lunes a viernes. El color dice el estado
 * (validado para daltonismo, ver `COLOR_AUSENCIA`), y la leyenda y la lista lo
 * dicen con palabras: el color nunca va solo.
 */
export default function CalendarioAusencias({
  grupos,
  semanas,
  festivos,
  hoy,
  mostrarGrupos = true,
}: {
  grupos: GrupoCalendario[]
  semanas: Semana[]
  festivos: { fecha: string; nombre: string }[]
  hoy: string
  mostrarGrupos?: boolean
}) {
  const festivoDe = new Map(festivos.map(f => [f.fecha, f.nombre]))
  const columnas = semanas.reduce((n, s) => n + s.dias.length, 0)
  const personas = grupos.reduce((n, g) => n + g.personas.length, 0)

  if (personas === 0) {
    return <p className="px-5 py-6 text-[12.5px] text-ink-500">Nadie tiene días fuera en estas semanas.</p>
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <Leyenda />
      <div className="overflow-x-auto px-5">
        <table className="border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 bg-white text-left font-medium text-ink-400 pr-3 pb-1 min-w-[160px] align-bottom">
                Persona
              </th>
              {semanas.map(s => (
                <th key={s.inicio} colSpan={5} className="text-center font-medium text-ink-500 pb-1 border-l border-[#ECECEC] px-1 whitespace-nowrap">
                  {s.etiqueta}
                </th>
              ))}
            </tr>
            <tr>
              {semanas.flatMap(s =>
                s.dias.map((d, i) => (
                  <th
                    key={d}
                    title={festivoDe.get(d)}
                    className={`w-[20px] min-w-[20px] text-center font-normal leading-tight pb-1 ${i === 0 ? 'border-l border-[#ECECEC]' : ''} ${
                      d === hoy ? 'text-orange font-semibold' : festivoDe.has(d) ? 'text-ink-400' : 'text-ink-500'
                    }`}
                  >
                    {INICIAL[i]}
                    <br />
                    <span className="tabular-nums">{Number(d.slice(8))}</span>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {grupos.map(g => (
              <Grupo key={g.grupo || 'todos'} grupo={g} mostrar={mostrarGrupos} columnas={columnas} semanas={semanas} festivoDe={festivoDe} />
            ))}
          </tbody>
        </table>
      </div>

      <details className="px-5">
        <summary className="text-[12px] text-navy font-medium cursor-pointer">Ver como lista</summary>
        <table className="w-full text-[12px] mt-2">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
              <th className="py-1.5 pr-3 font-medium">Persona</th>
              <th className="py-1.5 pr-3 font-medium">Fechas</th>
              <th className="py-1.5 pr-3 font-medium text-right">Días</th>
              <th className="py-1.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {grupos.flatMap(g => g.personas.flatMap(p => p.ausencias.map(a => (
              <tr key={`${p.empleado_id}-${a.fecha_inicio}-${a.estado}`} className="border-b border-[#F5F5F5] last:border-0">
                <td className="py-1.5 pr-3 text-ink-900">{p.nombre}</td>
                <td className="py-1.5 pr-3 text-ink-700 whitespace-nowrap">{rangoAusencia(a)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">{Number(a.dias)}</td>
                <td className="py-1.5 text-ink-700">{ETIQUETA_AUSENCIA[claseDe(a)]}</td>
              </tr>
            ))))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function Grupo({
  grupo, mostrar, columnas, semanas, festivoDe,
}: {
  grupo: GrupoCalendario
  mostrar: boolean
  columnas: number
  semanas: Semana[]
  festivoDe: Map<string, string>
}) {
  return (
    <>
      {mostrar && (
        <tr>
          <td className="sticky left-0 z-10 bg-white pt-3 pb-1 text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium whitespace-nowrap">
            {grupo.grupo}
          </td>
          <td colSpan={columnas} />
        </tr>
      )}
      {grupo.personas.map(p => (
        <tr key={p.empleado_id}>
          <td className="sticky left-0 z-10 bg-white pr-3 py-[3px] max-w-[200px]">
            <span className="block text-[12px] text-ink-900 truncate">{p.nombre}</span>
          </td>
          {semanas.flatMap(s =>
            s.dias.map((d, i) => {
              const festivo = festivoDe.get(d)
              const a = festivo ? null : ausenciaEnDia(p, d)
              const clase: ClaseAusencia | null = a ? claseDe(a) : null
              return (
                <td key={d} className={`p-px ${i === 0 ? 'border-l border-[#ECECEC]' : ''}`}>
                  <div
                    title={
                      festivo ? `${festivo} (festivo)`
                        : a ? `${p.nombre} · ${ETIQUETA_AUSENCIA[clase!]}: ${rangoAusencia(a)} (${Number(a.dias)} ${Number(a.dias) === 1 ? 'día' : 'días'})`
                          : undefined
                    }
                    className="h-[18px] w-[18px] rounded-[3px]"
                    style={{ backgroundColor: festivo ? FESTIVO : clase ? COLOR_AUSENCIA[clase] : undefined }}
                  />
                </td>
              )
            }),
          )}
        </tr>
      ))}
    </>
  )
}

export function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 text-[11.5px] text-ink-700">
      {(Object.keys(COLOR_AUSENCIA) as ClaseAusencia[]).map(c => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLOR_AUSENCIA[c] }} />
          {ETIQUETA_AUSENCIA[c]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: FESTIVO }} />
        Festivo
      </span>
    </div>
  )
}
