// Informe ejecutivo de vacaciones en PDF (VAC-009): una hoja carta para Felix y
// Javier, con fecha y hora de emisión. Lee lo mismo que la página de reportes
// (`cargarSeguimiento`). Solo servidor.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { LOGO_PNG_BASE64 } from './recursos'
import { fechaCorta, fechaLarga, partesFecha } from './calendario'
import { momentoFirma } from './formato'
import { ajustar, ansi } from './pdf-util'
import { COLOR_AUSENCIA, duracion, claseDe, type Ausencia } from './seguimiento'
import { DIAS_ANIVERSARIO, DIAS_TIEMPOS, type Seguimiento } from './seguimiento-carga'

const ANCHO = 612
const ALTO = 792
const X0 = 40
const X1 = ANCHO - 40
const NAVY = rgb(15 / 255, 27 / 255, 61 / 255)
const NARANJA = rgb(245 / 255, 130 / 255, 32 / 255)
const TINTA = rgb(0.07, 0.07, 0.07)
const GRIS = rgb(0.42, 0.42, 0.42)
const GRIS_CLARO = rgb(0.61, 0.61, 0.61)
const LINEA = rgb(0.925, 0.925, 0.925)

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const y = (desdeArriba: number) => ALTO - desdeArriba

/** "16 oct": en una hoja de un solo año, el año sobra y aprieta los nombres. */
function corta(iso: string): string {
  const f = partesFecha(iso)
  return `${f.dia} ${f.mes.slice(0, 3)}`
}

/** "16–19 oct", "30 nov – 4 dic", "20 nov". */
function rangoCorto(a: Ausencia): string {
  if (a.fecha_inicio === a.fecha_fin) return corta(a.fecha_inicio)
  const i = partesFecha(a.fecha_inicio)
  const f = partesFecha(a.fecha_fin)
  return i.mes === f.mes ? `${i.dia}–${f.dia} ${f.mes.slice(0, 3)}` : `${corta(a.fecha_inicio)} – ${corta(a.fecha_fin)}`
}

interface F {
  normal: PDFFont
  negrita: PDFFont
}

function texto(p: PDFPage, f: PDFFont, t: string, x: number, top: number, size: number, color: RGB = TINTA, ancho?: number) {
  const a = ancho ? ajustar(f, ansi(t), size, ancho) : { texto: ansi(t), size }
  p.drawText(a.texto, { x, y: y(top), size: a.size, font: f, color })
}

function titulo(p: PDFPage, fx: F, t: string, nota: string | null, top: number) {
  texto(p, fx.negrita, t.toUpperCase(), X0, top, 8, GRIS)
  if (nota) {
    const n = ansi(nota)
    p.drawText(n, { x: X1 - fx.normal.widthOfTextAtSize(n, 7.5), y: y(top), size: 7.5, font: fx.normal, color: GRIS_CLARO })
  }
  p.drawLine({ start: { x: X0, y: y(top + 5) }, end: { x: X1, y: y(top + 5) }, thickness: 0.5, color: LINEA })
}

/** Columna con el extremo de arriba redondeado (4 px ≈ 3 pt) y la base recta. */
function columna(p: PDFPage, x: number, base: number, ancho: number, alto: number, color: RGB, redondear: boolean) {
  if (alto <= 0) return
  const r = redondear ? Math.min(3, ancho / 2, alto) : 0
  const ruta = r > 0
    ? `M0,${r} Q0,0 ${r},0 L${ancho - r},0 Q${ancho},0 ${ancho},${r} L${ancho},${alto} L0,${alto} Z`
    : `M0,0 L${ancho},0 L${ancho},${alto} L0,${alto} Z`
  p.drawSvgPath(ruta, { x, y: y(base - alto), color })
}

export async function informePdf(d: Seguimiento, meta: { generadoPor: string; generado: Date }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Informe ejecutivo de vacaciones')
  pdf.setAuthor('Plataforma CrediFlexi')
  pdf.setCreator('Plataforma CrediFlexi')
  pdf.setProducer('Plataforma CrediFlexi')
  pdf.setCreationDate(meta.generado)
  const fx: F = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  const p = pdf.addPage([ANCHO, ALTO])
  const emitido = momentoFirma(meta.generado.toISOString())

  // ── Encabezado ──
  let top = 36
  p.drawImage(logo, { x: X0, y: y(top + 38), width: 105, height: 38 })
  texto(p, fx.negrita, 'Informe ejecutivo de vacaciones', X0 + 122, top + 18, 15, NAVY)
  texto(p, fx.normal, `Emitido el ${emitido} h por ${meta.generadoPor}. Datos al ${fechaLarga(d.hoy)}, calculados con la fecha real.`,
    X0 + 122, top + 32, 8, GRIS, X1 - X0 - 122)
  top += 54

  // ── Indicadores ──
  const semana = d.porSemana[0]
  const tiles: [string, string, string][] = [
    ['Días por tomar', d.totales.porTomar.toLocaleString('es-MX', { maximumFractionDigits: 1 }),
      `${d.totales.conDerecho} con derecho · ${d.totales.enTramite} en trámite`],
    ['Fuera esta semana', String(semana.aprobadas + semana.tramite), `semana del ${semana.semana.etiqueta}`],
    ['Cumplen años de servicio', String(d.aniversarios.length), `en los próximos ${DIAS_ANIVERSARIO} días`],
    ['Solicitudes atoradas', String(d.resumen.atoradas.length),
      d.resumen.pendientes ? `de ${d.resumen.pendientes} pendientes · 2+ días hábiles` : 'nada pendiente'],
  ]
  const gap = 10
  const anchoTile = (X1 - X0 - gap * 3) / 4
  tiles.forEach(([etq, valor, apoyo], i) => {
    const x = X0 + i * (anchoTile + gap)
    p.drawRectangle({ x, y: y(top + 58), width: anchoTile, height: 58, borderColor: LINEA, borderWidth: 0.8 })
    texto(p, fx.negrita, etq.toUpperCase(), x + 9, top + 14, 6.8, GRIS, anchoTile - 18)
    texto(p, fx.negrita, valor, x + 9, top + 36, 20, i === 0 ? NARANJA : NAVY)
    texto(p, fx.normal, apoyo, x + 9, top + 49, 6.8, GRIS, anchoTile - 18)
  })
  top += 76

  // ── Personas fuera por semana ──
  titulo(p, fx, 'Personas fuera por semana', `del ${fechaCorta(d.semanas[0].inicio)} al ${fechaCorta(d.semanas[d.semanas.length - 1].fin)}`, top)
  top += 16
  // Leyenda: dos series, siempre.
  let xl = X0
  for (const [color, etq] of [[COLOR_AUSENCIA.vacaciones, 'Con días aprobados'], [COLOR_AUSENCIA.tramite, 'Solo en trámite']] as const) {
    p.drawRectangle({ x: xl, y: y(top + 1), width: 7, height: 7, color: hex(color) })
    texto(p, fx.normal, etq, xl + 10, top, 7.5, TINTA)
    xl += 10 + fx.normal.widthOfTextAtSize(etq, 7.5) + 16
  }
  top += 10
  const altoGrafica = 92
  const base = top + altoGrafica + 14
  const maximo = Math.max(1, ...d.porSemana.map(w => w.aprobadas + w.tramite))
  const slot = (X1 - X0) / d.porSemana.length
  const grosor = Math.min(18, slot * 0.45)
  d.porSemana.forEach((w, i) => {
    const cx = X0 + slot * i + slot / 2
    const x = cx - grosor / 2
    const hA = (w.aprobadas / maximo) * altoGrafica
    const hT = (w.tramite / maximo) * altoGrafica
    columna(p, x, base, grosor, hA, hex(COLOR_AUSENCIA.vacaciones), w.tramite === 0)
    const separacion = hA > 0 && hT > 0 ? 1.5 : 0
    columna(p, x, base - hA - separacion, grosor, hT, hex(COLOR_AUSENCIA.tramite), true)
    const total = String(w.aprobadas + w.tramite)
    p.drawText(total, {
      x: cx - fx.normal.widthOfTextAtSize(total, 8) / 2, y: y(base - hA - hT - separacion - 4), size: 8, font: fx.normal, color: TINTA,
    })
    const etq = ansi(w.semana.etiqueta)
    const a = ajustar(fx.normal, etq, 7, slot - 4)
    p.drawText(a.texto, { x: cx - fx.normal.widthOfTextAtSize(a.texto, a.size) / 2, y: y(base + 11), size: a.size, font: fx.normal, color: GRIS })
  })
  p.drawLine({ start: { x: X0, y: y(base) }, end: { x: X1, y: y(base) }, thickness: 0.6, color: GRIS_CLARO })
  top = base + 28

  // ── Próximas ausencias | Aniversarios ──
  const mitad = (X1 - X0 - 20) / 2
  const xDer = X0 + mitad + 20
  const proximas = d.calendario.ausencias.filter(a => a.fecha_inicio <= d.semanas[Math.min(3, d.semanas.length - 1)].fin)
  texto(p, fx.negrita, 'PRÓXIMAS AUSENCIAS (4 SEMANAS)', X0, top, 8, GRIS)
  texto(p, fx.negrita, `ANIVERSARIOS (${DIAS_ANIVERSARIO} DÍAS)`, xDer, top, 8, GRIS)
  p.drawLine({ start: { x: X0, y: y(top + 5) }, end: { x: X0 + mitad, y: y(top + 5) }, thickness: 0.5, color: LINEA })
  p.drawLine({ start: { x: xDer, y: y(top + 5) }, end: { x: X1, y: y(top + 5) }, thickness: 0.5, color: LINEA })
  top += 18
  const MAX = 9
  const filas = (items: { izq: string; der: string; color?: string }[], x: number, ancho: number, vacio: string) => {
    if (items.length === 0) {
      texto(p, fx.normal, vacio, x, top, 8, GRIS, ancho)
      return
    }
    items.slice(0, MAX).forEach((it, i) => {
      const t = top + i * 13
      let xi = x
      if (it.color) {
        p.drawRectangle({ x, y: y(t + 0.5), width: 6, height: 6, color: hex(it.color) })
        xi += 10
      }
      const der = ansi(it.der)
      const wDer = fx.normal.widthOfTextAtSize(der, 7.5)
      texto(p, fx.normal, it.izq, xi, t, 8, TINTA, ancho - (xi - x) - wDer - 8)
      p.drawText(der, { x: x + ancho - wDer, y: y(t), size: 7.5, font: fx.normal, color: GRIS })
    })
    if (items.length > MAX) texto(p, fx.normal, `y ${items.length - MAX} más en el Excel de seguimiento`, x, top + MAX * 13, 7.5, GRIS_CLARO, ancho)
  }
  filas(
    proximas.map(a => ({
      izq: a.nombre,
      der: `${rangoCorto(a)} · ${Number(a.dias)} ${Number(a.dias) === 1 ? 'día' : 'días'}${a.estado === 'aprobada' ? '' : ' · en trámite'}`,
      color: COLOR_AUSENCIA[claseDe(a)],
    })),
    X0, mitad, 'Nadie tiene días fuera en las próximas 4 semanas.',
  )
  filas(
    d.aniversarios.map(a => ({ izq: a.nombre, der: `${corta(a.fecha)} · ${a.cumple} ${a.cumple === 1 ? 'año' : 'años'} · +${a.gana} días` })),
    xDer, mitad, `Nadie cumple años de servicio en los próximos ${DIAS_ANIVERSARIO} días.`,
  )
  top += Math.max(1, Math.min(MAX, Math.max(proximas.length, d.aniversarios.length))) * 13
    + (proximas.length > MAX || d.aniversarios.length > MAX ? 13 : 0) + 18

  // ── Tiempos de respuesta ──
  const r = d.resumen
  titulo(p, fx, 'Tiempos de respuesta', `solicitudes de los últimos ${DIAS_TIEMPOS} días y todo lo pendiente`, top)
  top += 20
  const stats: [string, string][] = [
    ['Respuesta del jefe (mediana)', duracion(r.medianaJefe)],
    ['Vo. Bo. de Gente y Cultura (mediana)', duracion(r.medianaRh)],
    ['Pendientes ahora', String(r.pendientes)],
    ['Atoradas (2+ días hábiles)', String(r.atoradas.length)],
  ]
  const anchoStat = (X1 - X0) / 4
  stats.forEach(([etq, valor], i) => {
    texto(p, fx.negrita, valor, X0 + i * anchoStat, top, 13, NAVY)
    texto(p, fx.normal, etq, X0 + i * anchoStat, top + 12, 7, GRIS, anchoStat - 8)
  })
  top += 28
  if (r.porJefe.length === 0) {
    texto(p, fx.normal, 'Todavía no hay solicitudes en este periodo.', X0, top, 8, GRIS)
    top += 14
  } else {
    texto(p, fx.negrita, 'Jefe', X0, top, 7.5, GRIS)
    for (const [t, x] of [['Solicitudes', 330], ['Mediana', 400], ['Más lenta', 460], ['Pendientes', 520]] as const) {
      texto(p, fx.negrita, t, x, top, 7.5, GRIS)
    }
    top += 12
    for (const j of r.porJefe.slice(0, 6)) {
      texto(p, fx.normal, j.jefe, X0, top, 8, TINTA, 280)
      texto(p, fx.normal, String(j.solicitudes), 330, top, 8)
      texto(p, fx.normal, duracion(j.mediana), 400, top, 8)
      texto(p, fx.normal, duracion(j.maxima), 460, top, 8)
      texto(p, fx.normal, String(j.pendientes), 520, top, 8)
      top += 12
    }
  }

  // ── Pie ──
  texto(p, fx.normal,
    '"Días por tomar" suma todos los periodos cumplidos (Art. 76 LFT). La mediana de respuesta mide el proceso, no a las personas.',
    X0, ALTO - 48, 6.8, GRIS_CLARO, X1 - X0)
  texto(p, fx.normal, `Generado en la plataforma de CrediFlexi el ${emitido} h · Fuente: base de Gente y Cultura · Página 1 de 1`,
    X0, ALTO - 36, 6.8, GRIS_CLARO, X1 - X0)

  return pdf.save()
}
