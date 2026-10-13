// Reportes en Excel de Gente y Cultura (VAC-008). Puro: recibe los datos ya
// consultados y arma el libro; la ruta /api/vacaciones/reporte los consulta.
//
//   · Base de vacaciones: lo mismo que el Excel de Montellano (una fila por
//     persona), calculado con la fecha real, más una hoja por periodo.
//   · Solicitudes y días tomados en un rango de fechas, con quién autorizó y
//     a qué hora.
// Valores planos, sin fórmulas, con filtros en cada encabezado.

import ExcelJS from 'exceljs'
import { antiguedad, fechaCorta, fechaLarga, hoyMexico } from './calendario'
import { momentoFirma } from './formato'
import type { EstadoSolicitud, ReportePeriodo, SaldoEmpleado } from './tipos'

const NAVY = 'FF0F1B3D'
const GRIS = 'FF6B6B6B'
const FECHA = 'dd/mm/yyyy'
const FECHA_HORA = 'dd/mm/yyyy hh:mm'

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface MetaReporte {
  generadoPor: string
  generado: Date
}

/** Un día de vacaciones ya registrado, para listar las fechas de cada persona. */
export interface DiaTomado {
  empleado_id: string
  tipo: 'vacaciones' | 'flotante'
  dias: number
  fecha_inicio: string | null
  fecha_fin: string | null
  fechas_texto: string | null
}

const ESTADO_REPORTE: Record<EstadoSolicitud, string> = {
  pendiente_jefe: 'Espera al jefe',
  pendiente_rh: 'Espera Vo. Bo. de RH',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

const ORIGEN_REPORTE = {
  solicitud: 'Solicitud en la plataforma',
  registro_rh: 'Registrado por Gente y Cultura',
  importado: 'Importado del Excel',
} as const

/** Una fecha sin hora, para que Excel la muestre igual en cualquier zona. */
const dia = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null)

/** Fecha y hora de la Ciudad de México, como Excel debe enseñarla. */
function fechaHoraMx(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const v = (t: string) => Number(partes.find(p => p.type === t)?.value ?? 0)
  return new Date(Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute')))
}

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} ${n === 1 ? uno : varios}`

function rangoTexto(inicio: string, fin: string | null): string {
  return !fin || fin === inicio ? fechaCorta(inicio) : `${fechaCorta(inicio)} – ${fechaCorta(fin)}`
}

/** Título, notas y encabezado con filtros. Regresa la fila del encabezado. */
function prepararHoja(
  hoja: ExcelJS.Worksheet,
  titulo: string,
  notas: string[],
  columnas: { titulo: string; ancho: number; formato?: string; envolver?: boolean }[],
): number {
  hoja.getCell('A1').value = titulo
  hoja.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } }
  notas.forEach((n, i) => {
    const c = hoja.getCell(`A${i + 2}`)
    c.value = n
    c.font = i === notas.length - 1 ? { color: { argb: GRIS } } : {}
  })

  const fila = notas.length + 3
  columnas.forEach((col, i) => {
    const columna = hoja.getColumn(i + 1)
    columna.width = col.ancho
    if (col.formato) columna.numFmt = col.formato
    if (col.envolver) columna.alignment = { wrapText: true, vertical: 'top' }
  })
  const encabezado = hoja.getRow(fila)
  encabezado.values = columnas.map(c => c.titulo)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.height = 32
  encabezado.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  hoja.views = [{ state: 'frozen', ySplit: fila, xSplit: 1 }]
  return fila
}

function cerrarHoja(hoja: ExcelJS.Worksheet, fila: number, columnas: number, filas: number) {
  if (filas > 0) {
    hoja.autoFilter = { from: { row: fila, column: 1 }, to: { row: fila + filas, column: columnas } }
  }
}

function lineaTotal(hoja: ExcelJS.Worksheet, valores: (string | number | null)[]) {
  const total = hoja.addRow(valores)
  total.font = { bold: true }
  total.eachCell(c => { c.border = { top: { style: 'thin' } } })
}

// ── Base de vacaciones ──────────────────────────────────────────────────────

export function libroBase(
  personas: SaldoEmpleado[], tomados: DiaTomado[], filtro: string, meta: MetaReporte,
): ExcelJS.Workbook {
  const hoy = hoyMexico()
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Plataforma CrediFlexi'
  libro.created = meta.generado

  const porPersona = new Map<string, DiaTomado[]>()
  for (const t of tomados) porPersona.set(t.empleado_id, [...(porPersona.get(t.empleado_id) ?? []), t])
  const fechasDe = (id: string, tipo: DiaTomado['tipo']) =>
    (porPersona.get(id) ?? [])
      .filter(t => t.tipo === tipo)
      .sort((a, b) => (a.fecha_inicio ?? '').localeCompare(b.fecha_inicio ?? ''))
      .map(t => t.fecha_inicio
        ? `${rangoTexto(t.fecha_inicio, t.fecha_fin)} (${plural(Number(t.dias), 'día', 'días')})`
        : (t.fechas_texto ?? '').replace(/\s*\n\s*/g, '; '))
      .filter(Boolean)
      .join('\n')

  const columnas = [
    { titulo: 'Empleado', ancho: 34 },
    { titulo: 'Puesto', ancho: 30 },
    { titulo: 'Área', ancho: 16 },
    { titulo: 'No. de empleado', ancho: 11 },
    { titulo: 'Correo', ancho: 32 },
    { titulo: 'Jefe directo', ancho: 32 },
    { titulo: 'Fecha de ingreso', ancho: 12, formato: FECHA },
    { titulo: 'Antigüedad', ancho: 16 },
    { titulo: 'Años cumplidos', ancho: 9 },
    { titulo: 'Periodo actual', ancho: 24 },
    { titulo: 'Días que corresponden', ancho: 12 },
    { titulo: 'Tomados del periodo', ancho: 11 },
    { titulo: 'Restantes del periodo', ancho: 11 },
    { titulo: 'Días por tomar (todos los periodos)', ancho: 13 },
    { titulo: 'En trámite', ancho: 9 },
    { titulo: 'Fechas de vacaciones', ancho: 42, envolver: true },
    { titulo: 'Días flotantes del año', ancho: 10 },
    { titulo: 'Fechas de días flotantes', ancho: 28, envolver: true },
    { titulo: 'Próximo aniversario', ancho: 12, formato: FECHA },
    { titulo: 'Días que gana', ancho: 9 },
    { titulo: 'Estatus', ancho: 10 },
  ]

  const hoja = libro.addWorksheet('Base de vacaciones')
  const fila = prepararHoja(hoja, 'CrediFlexi — Base de vacaciones', [
    `Calculado al ${fechaLarga(hoy)}: antigüedad y saldos con la fecha real.`,
    `Filtro: ${filtro} (${plural(personas.length, 'persona', 'personas')}).`,
    `Generado por ${meta.generadoPor} el ${momentoFirma(meta.generado.toISOString())} h.`,
  ], columnas)

  for (const e of personas) {
    const actual = e.periodos[e.periodos.length - 1]
    hoja.addRow([
      e.nombre, e.puesto, e.area, e.numero_empleado, e.email, e.jefe_nombre,
      dia(e.fecha_ingreso), antiguedad(e.fecha_ingreso, hoy), e.anios,
      actual ? `${fechaCorta(actual.desde)} – ${fechaCorta(actual.hasta)}` : 'Sin derecho aún',
      actual?.derecho ?? null, actual ? Number(actual.tomados) : null, actual ? Number(actual.restantes) : null,
      Number(e.restantes_total), Number(e.dias_en_tramite ?? 0),
      fechasDe(e.id, 'vacaciones'),
      Number(e.flotantes_anio), fechasDe(e.id, 'flotante'),
      dia(e.proximo_aniversario), e.dias_proximo, e.activo ? 'Activo' : 'Inactivo',
    ])
  }
  const suma = (f: (e: SaldoEmpleado) => number) => personas.reduce((a, e) => a + f(e), 0)
  lineaTotal(hoja, [
    `Total (${plural(personas.length, 'persona', 'personas')})`, null, null, null, null, null, null, null, null, null,
    null, null, null,
    suma(e => Math.max(Number(e.restantes_total), 0)), suma(e => Number(e.dias_en_tramite ?? 0)),
    null, suma(e => Number(e.flotantes_anio)),
  ])
  cerrarHoja(hoja, fila, columnas.length, personas.length)

  // Una fila por persona y año de servicio: el detalle de "Días por tomar".
  const colPeriodos = [
    { titulo: 'Empleado', ancho: 34 },
    { titulo: 'Año de servicio', ancho: 10 },
    { titulo: 'Desde', ancho: 12, formato: FECHA },
    { titulo: 'Hasta', ancho: 12, formato: FECHA },
    { titulo: 'Días que corresponden', ancho: 12 },
    { titulo: 'Tomados', ancho: 10 },
    { titulo: 'Restantes', ancho: 10 },
  ]
  const periodos = libro.addWorksheet('Periodos')
  const filaP = prepararHoja(periodos, 'Periodos por año de servicio', [
    'El periodo N es el derecho que se gana en el N-ésimo aniversario (Art. 76 LFT).',
    `Generado por ${meta.generadoPor} el ${momentoFirma(meta.generado.toISOString())} h.`,
  ], colPeriodos)
  let n = 0
  for (const e of personas) {
    for (const p of e.periodos) {
      periodos.addRow([e.nombre, p.periodo, dia(p.desde), dia(p.hasta), p.derecho, Number(p.tomados), Number(p.restantes)])
      n++
    }
  }
  cerrarHoja(periodos, filaP, colPeriodos.length, n)

  return libro
}

// ── Solicitudes y días tomados en un rango ──────────────────────────────────

export function libroPeriodo(r: ReportePeriodo, desde: string, hasta: string, meta: MetaReporte): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Plataforma CrediFlexi'
  libro.created = meta.generado
  const rango = `Del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`
  const generado = `Generado por ${meta.generadoPor} el ${momentoFirma(meta.generado.toISOString())} h.`

  // ── Resumen ──
  const resumen = libro.addWorksheet('Resumen')
  resumen.getColumn(1).width = 42
  resumen.getColumn(2).width = 14
  resumen.getCell('A1').value = 'CrediFlexi — Solicitudes y días tomados'
  resumen.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } }
  resumen.getCell('A2').value = `${rango}: lo que cae, aunque sea en parte, dentro del rango.`
  resumen.getCell('A3').value = generado
  resumen.getCell('A3').font = { color: { argb: GRIS } }

  const porEstado = (e: EstadoSolicitud) => r.solicitudes.filter(s => s.estado === e).length
  const diasDe = (tipo: 'vacaciones' | 'flotante') =>
    r.dias_tomados.filter(t => t.tipo === tipo).reduce((a, t) => a + Number(t.dias), 0)
  const filas: [string, number][] = [
    ['Solicitudes en el rango', r.solicitudes.length],
    ['   Aprobadas', porEstado('aprobada')],
    ['   Esperan al jefe', porEstado('pendiente_jefe')],
    ['   Esperan Vo. Bo. de RH', porEstado('pendiente_rh')],
    ['   Rechazadas', porEstado('rechazada')],
    ['   Canceladas', porEstado('cancelada')],
    ['Días de vacaciones tomados', diasDe('vacaciones')],
    ['Días flotantes tomados', diasDe('flotante')],
    ['Personas con días tomados', new Set(r.dias_tomados.map(t => t.empleado)).size],
  ]
  filas.forEach(([etiqueta, valor], i) => {
    const fila = resumen.getRow(i + 5)
    fila.values = [etiqueta, valor]
    if (!etiqueta.startsWith(' ')) fila.font = { bold: true }
  })
  if (r.importados_sin_fecha > 0) {
    const nota = resumen.getCell(`A${filas.length + 6}`)
    nota.value = `${plural(r.importados_sin_fecha, 'registro importado', 'registros importados')} del Excel no tiene fecha legible y no entra en el rango: está en el reporte de la base.`
    nota.font = { italic: true, color: { argb: GRIS } }
  }

  // ── Solicitudes ──
  const colSol = [
    { titulo: 'Folio', ancho: 7 },
    { titulo: 'Tipo', ancho: 13 },
    { titulo: 'Empleado', ancho: 34 },
    { titulo: 'Puesto', ancho: 28 },
    { titulo: 'Área', ancho: 14 },
    { titulo: 'Jefe directo', ancho: 32 },
    { titulo: 'Del', ancho: 12, formato: FECHA },
    { titulo: 'Al', ancho: 12, formato: FECHA },
    { titulo: 'Días', ancho: 7 },
    { titulo: 'Regresa', ancho: 12, formato: FECHA },
    { titulo: 'Estado', ancho: 20 },
    { titulo: 'Nota de la persona', ancho: 32, envolver: true },
    { titulo: 'Solicitada', ancho: 16, formato: FECHA_HORA },
    { titulo: 'Autorizó / rechazó (jefe)', ancho: 28 },
    { titulo: 'Fecha del jefe', ancho: 16, formato: FECHA_HORA },
    { titulo: 'Comentario del jefe', ancho: 28, envolver: true },
    { titulo: 'Vo. Bo. de', ancho: 28 },
    { titulo: 'Fecha del Vo. Bo.', ancho: 16, formato: FECHA_HORA },
    { titulo: 'Comentario de RH', ancho: 28, envolver: true },
    { titulo: 'Cancelada', ancho: 16, formato: FECHA_HORA },
  ]
  const hojaSol = libro.addWorksheet('Solicitudes')
  const filaSol = prepararHoja(hojaSol, 'Solicitudes', [rango, generado], colSol)
  for (const s of r.solicitudes) {
    hojaSol.addRow([
      s.folio, s.tipo === 'vacaciones' ? 'Vacaciones' : 'Día flotante', s.empleado, s.puesto, s.area, s.jefe,
      dia(s.fecha_inicio), dia(s.fecha_fin), Number(s.dias), dia(s.fecha_regreso), ESTADO_REPORTE[s.estado],
      s.observaciones, fechaHoraMx(s.created_at), s.jefe_por, fechaHoraMx(s.jefe_at), s.jefe_comentario,
      s.rh_por, fechaHoraMx(s.rh_at), s.rh_comentario, fechaHoraMx(s.cancelada_at),
    ])
  }
  cerrarHoja(hojaSol, filaSol, colSol.length, r.solicitudes.length)

  // ── Días tomados ──
  const colDias = [
    { titulo: 'Folio', ancho: 7 },
    { titulo: 'Tipo', ancho: 13 },
    { titulo: 'Empleado', ancho: 34 },
    { titulo: 'Puesto', ancho: 28 },
    { titulo: 'Área', ancho: 14 },
    { titulo: 'Año de servicio', ancho: 9 },
    { titulo: 'Del', ancho: 12, formato: FECHA },
    { titulo: 'Al', ancho: 12, formato: FECHA },
    { titulo: 'Días', ancho: 7 },
    { titulo: 'Regresa', ancho: 12, formato: FECHA },
    { titulo: 'Origen', ancho: 26 },
    { titulo: 'Solicitud', ancho: 9 },
    { titulo: 'Registró', ancho: 28 },
    { titulo: 'Registrado', ancho: 16, formato: FECHA_HORA },
    { titulo: 'Observaciones', ancho: 32, envolver: true },
  ]
  const hojaDias = libro.addWorksheet('Días tomados')
  const filaDias = prepararHoja(hojaDias, 'Días tomados', [rango, generado], colDias)
  for (const t of r.dias_tomados) {
    hojaDias.addRow([
      t.folio, t.tipo === 'vacaciones' ? 'Vacaciones' : 'Día flotante', t.empleado, t.puesto, t.area, t.periodo,
      dia(t.fecha_inicio), dia(t.fecha_fin), Number(t.dias), dia(t.fecha_regreso), ORIGEN_REPORTE[t.origen],
      t.folio_solicitud, t.registrado_por, fechaHoraMx(t.created_at), t.observaciones,
    ])
  }
  lineaTotal(hojaDias, [
    'Total', null, null, null, null, null, null, null, r.dias_tomados.reduce((a, t) => a + Number(t.dias), 0),
  ])
  cerrarHoja(hojaDias, filaDias, colDias.length, r.dias_tomados.length)

  return libro
}
