/**
 * Primitivas de visualización del módulo Actividades.
 *
 * Todas son presentacionales y sin estado: reciben datos ya agregados por el RPC
 * y devuelven marcado. Sin librería de gráficas — el repo no tiene ninguna y para
 * barras, heatmap y tiles no hace falta: son divs con un ancho porcentual.
 *
 * ── Decisiones de color (validadas, no elegidas a ojo) ──────────────────────
 * Los colores de marca no funcionan como relleno de datos: el navy #0F1B3D cae
 * fuera de la banda de luminosidad y lee como gris; el naranja #F58220 no llega
 * a 3:1 contra blanco. Se usan pasos ajustados de esos mismos matices.
 *
 *  · Magnitud (barras de horas): un solo matiz. Comparar tamaños no necesita
 *    identidad, y doce colores para doce categorías serían ruido.
 *  · Rejilla gerencia × categoría: heatmap con rampa secuencial de un matiz.
 *    Es la forma correcta para una malla de magnitudes y además evita el
 *    problema de arriba.
 *  · TIPO_MOTIVO: escala DIVERGENTE (positivo ↔ contexto ↔ fricción), no
 *    categórica — es sentimiento ordenado. Verde/rojo se descartó porque da
 *    ΔE 4.2 en deuteranopia (indistinguible); azul #1C5CAB ↔ naranja #D9531F
 *    pasa las cinco comprobaciones con ΔE 23 en el peor caso.
 */

// ── Tokens ───────────────────────────────────────────────────────────────────
export const VIZ = {
  barra: '#2A5599',
  barraSuave: '#C6D8F0',
  positivo: '#1C5CAB',
  friccion: '#D9531F',
  neutral: '#8A8A85',
  /** Rampa secuencial de un matiz, claro → oscuro. */
  rampa: ['#E7EEF9', '#C6D8F0', '#9CBAE3', '#6E97D2', '#4574BC', '#2A5599', '#1A3B70'],
} as const

// ── Formato ──────────────────────────────────────────────────────────────────
export const fmtHoras = (n: number) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)

export const fmtNum = (n: number) => new Intl.NumberFormat('es-MX').format(n)

export const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`

/** 2.4 h → "2 h 24 min". Las horas decimales son precisas pero no se leen. */
export function fmtDuracion(horas: number) {
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

// ── Tile de KPI ──────────────────────────────────────────────────────────────
export function Tile({
  etiqueta, valor, unidad, apoyo, delta, acento,
}: {
  etiqueta: string
  valor: string
  unidad?: string
  apoyo?: string
  /** Variación en %, ya calculada. `null` = no hay con qué comparar. */
  delta?: number | null
  acento?: boolean
}) {
  return (
    <div className="border border-[#ECECEC] rounded-md bg-white px-4 py-3 flex flex-col gap-1 min-w-0">
      <p className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium truncate">
        {etiqueta}
      </p>
      <p className="flex items-baseline gap-1 min-w-0">
        <span className={`text-[26px] leading-none font-semibold ${acento ? 'text-orange' : 'text-navy'}`}>
          {valor}
        </span>
        {unidad && <span className="text-[12px] text-ink-400">{unidad}</span>}
      </p>
      {delta !== undefined && <Delta pct={delta} />}
      {apoyo && <p className="text-[11.5px] text-ink-500 truncate">{apoyo}</p>}
    </div>
  )
}

/**
 * Variación contra el periodo anterior. `null` se pinta "—": sin periodo previo
 * no hay crecimiento que reportar, y un 0% ahí sería mentira (es justo el error
 * que traía el tablero original, que mostraba +112% comparando contra un mes
 * que no existe).
 */
function Delta({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) {
    return <p className="text-[11.5px] text-ink-400">— sin periodo anterior</p>
  }
  const sube = pct > 0
  const plano = Math.abs(pct) < 0.05
  return (
    <p className={`text-[11.5px] font-medium ${plano ? 'text-ink-500' : sube ? 'text-[#1C5CAB]' : 'text-[#D9531F]'}`}>
      {plano ? 'sin cambio' : `${sube ? '↑' : '↓'} ${fmtPct(Math.abs(pct))}`}
      <span className="text-ink-400 font-normal"> vs periodo anterior</span>
    </p>
  )
}

// ── Barras horizontales ──────────────────────────────────────────────────────
export interface FilaBarra {
  etiqueta: string
  valor: number
  pct?: number
  apoyo?: string
}

/**
 * Un solo matiz: la comparación es de magnitud, no de identidad. La barra más
 * larga define la escala, y el valor va como etiqueta directa (nunca se pide al
 * lector que estime contra un eje).
 */
export function Barras({
  filas, max, sufijo = 'h', destacar, vacio = 'Sin datos para este filtro.',
}: {
  filas: FilaBarra[]
  max?: number
  sufijo?: string
  /** Etiqueta que se pinta en el color de acento (énfasis sobre el resto). */
  destacar?: string
  vacio?: string
}) {
  if (filas.length === 0) return <Vacio mensaje={vacio} />
  const tope = max ?? Math.max(...filas.map(f => f.valor), 1)

  return (
    <ul className="flex flex-col gap-2 px-5 py-4">
      {filas.map(f => {
        const ancho = Math.max((f.valor / tope) * 100, 0.6)
        const resaltada = destacar === f.etiqueta
        return (
          <li key={f.etiqueta} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-baseline">
            <p className="text-[12.5px] text-ink-900 truncate" title={f.etiqueta}>
              {f.etiqueta}
            </p>
            <p className="text-[12.5px] text-ink-900 tabular-nums font-medium whitespace-nowrap">
              {fmtHoras(f.valor)} {sufijo}
              {f.pct !== undefined && (
                <span className="text-ink-400 font-normal"> · {fmtPct(f.pct)}</span>
              )}
            </p>
            <div className="col-span-2 h-[7px] bg-[#F5F5F5] rounded-[4px] overflow-hidden">
              <div
                className="h-full rounded-[4px] transition-[width] duration-300"
                style={{ width: `${ancho}%`, backgroundColor: resaltada ? VIZ.friccion : VIZ.barra }}
                title={f.apoyo}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
/**
 * Rejilla fila × columna con intensidad proporcional. La celda muestra el % que
 * representa dentro de su fila, no el valor absoluto: la pregunta de esta vista
 * es "¿en qué se le va el tiempo a esta gerencia?", no "¿quién trabaja más?"
 * (esa la responden las barras de arriba).
 */
export function Heatmap({
  filas, columnas, valores, tituloFila,
}: {
  filas: string[]
  columnas: string[]
  /** valores[fila][columna] en horas. */
  valores: Map<string, Map<string, number>>
  tituloFila: string
}) {
  if (filas.length === 0 || columnas.length === 0) {
    return <Vacio mensaje="Sin datos para cruzar." />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] border-separate border-spacing-[2px] px-3 pb-3">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium sticky left-0 bg-white z-10 min-w-[150px]">
              {tituloFila}
            </th>
            {columnas.map(c => (
              <th
                key={c}
                className="px-1.5 py-1.5 text-[10px] text-ink-400 font-medium align-bottom w-[52px]"
                title={c}
              >
                <span className="block truncate max-w-[52px]">{abreviar(c)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const fila = valores.get(f) ?? new Map<string, number>()
            const totalFila = Array.from(fila.values()).reduce((a, b) => a + b, 0)
            return (
              <tr key={f}>
                <td className="px-2 py-1.5 text-ink-900 sticky left-0 bg-white z-10 truncate max-w-[150px]" title={f}>
                  {f}
                </td>
                {columnas.map(c => {
                  const v = fila.get(c) ?? 0
                  const pct = totalFila > 0 ? (v / totalFila) * 100 : 0
                  const { fondo, tinta } = tonoHeatmap(pct)
                  return (
                    <td
                      key={c}
                      className="text-center py-1.5 rounded-[4px] tabular-nums"
                      style={{ backgroundColor: fondo, color: tinta }}
                      title={`${f} · ${c}\n${fmtDuracion(v)} · ${fmtPct(pct)} de su tiempo`}
                    >
                      {pct >= 1 ? Math.round(pct) : ''}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Intensidad por tramos discretos de la rampa: siete pasos se leen mejor que un gradiente continuo. */
function tonoHeatmap(pct: number): { fondo: string; tinta: string } {
  if (pct < 1) return { fondo: '#FAFAF9', tinta: '#C8C8C8' }
  const escala = [3, 8, 15, 25, 40, 60]
  let i = 0
  while (i < escala.length && pct >= escala[i]) i++
  return { fondo: VIZ.rampa[i], tinta: i >= 4 ? '#FFFFFF' : '#1A1A1A' }
}

/** "SUPERVISION Y LIDERAZGO" → "Superv." — el título completo vive en el tooltip. */
function abreviar(s: string) {
  const limpio = s.charAt(0) + s.slice(1).toLowerCase()
  return limpio.length > 8 ? `${limpio.slice(0, 7)}.` : limpio
}

// ── Barra apilada divergente ─────────────────────────────────────────────────
export interface SegmentoDiv {
  etiqueta: string
  valor: number
  tipo: 'POSITIVO' | 'CONTEXTO' | 'FRICCION' | string
}

export const colorTipo = (tipo: string) =>
  tipo === 'POSITIVO' ? VIZ.positivo : tipo === 'FRICCION' ? VIZ.friccion : VIZ.neutral

export const etiquetaTipo = (tipo: string) =>
  tipo === 'POSITIVO' ? 'Positivo' : tipo === 'FRICCION' ? 'Fricción' : 'Contexto'

/** Leyenda: con dos o más series la identidad nunca puede depender solo del color. */
export function LeyendaTipos({ tipos }: { tipos: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {tipos.map(t => (
        <span key={t} className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
          <span
            className="w-2.5 h-2.5 rounded-[3px] shrink-0"
            style={{ backgroundColor: colorTipo(t) }}
          />
          {etiquetaTipo(t)}
        </span>
      ))}
    </div>
  )
}

// ── Contenedores ─────────────────────────────────────────────────────────────
export function Panel({
  titulo, nota, children, className = '',
}: {
  titulo: string
  nota?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`border border-[#ECECEC] rounded-md bg-white overflow-hidden ${className}`}>
      <header className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{titulo}</h2>
        {nota && <p className="text-[11.5px] text-ink-400 truncate">{nota}</p>}
      </header>
      {children}
    </section>
  )
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="px-5 py-6 text-[12.5px] text-ink-500">{mensaje}</p>
}

export function BannerError({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">No se pudo cargar el tablero</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
