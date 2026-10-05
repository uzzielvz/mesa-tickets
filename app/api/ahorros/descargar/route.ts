import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { leerCorte, sinCeros, momento, type BusquedaAhorros } from '@/lib/ahorros/tipos'

// exceljs es Node puro: no corre en el runtime edge.
export const runtime = 'nodejs'

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PESOS = '"$"#,##0.00'

/**
 * El Excel del grupo-ciclo, armado con lo MISMO que devuelve `aho_buscar`.
 * Valores planos, sin fórmulas (pedido de Felix) y sin hojas ocultas: la
 * plantilla actual lleva la base completa de clientes escondida en el archivo
 * que se manda; este solo lleva el grupo que se pidió.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(request.url)
  const corte = leerCorte(url.searchParams.get('n') ?? undefined)

  const { data, error } = await supabase.rpc('aho_buscar', {
    p_grupo: url.searchParams.get('grupo') ?? '',
    p_ciclo: url.searchParams.get('ciclo') ?? '',
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 })
  }

  const datos = data as unknown as BusquedaAhorros | null
  if (!datos?.encontrado || datos.sin_datos_credito) {
    return NextResponse.json({ error: 'No hay información de ese grupo y ciclo' }, { status: 404 })
  }

  const libro = new ExcelJS.Workbook()
  libro.creator = 'CrediFlexi'
  const hoja = libro.addWorksheet('Estado de ahorro', { views: [{ state: 'frozen', ySplit: 6 }] })
  hoja.columns = [
    { width: 14 }, { width: 16 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 22 }, { width: 18 },
  ]

  hoja.getCell('A1').value = 'CrediFlexi — Estado de ahorro'
  hoja.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F1B3D' } }
  hoja.getCell('A2').value = `Grupo ${sinCeros(datos.grupo_id)} · Ciclo ${sinCeros(datos.ciclo)} (${datos.key_grupo})`
  hoja.getCell('A2').font = { bold: true }
  hoja.getCell('A3').value = `Rendimiento calculado hasta el pago ${corte}`
  hoja.getCell('A4').value = `Cifras de Data Science, actualizadas el ${momento(datos.actualizado_at)}`
  hoja.getCell('A4').font = { color: { argb: 'FF6B6B6B' } }

  const encabezado = hoja.getRow(6)
  encabezado.values = [
    'ID cliente', 'Monto prestado', 'Base de ahorro', 'Pago semanal',
    'Ahorro acumulado', `Rendimiento al pago ${corte}`, 'Semanas con ahorro',
  ]
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1B3D' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  encabezado.height = 30

  for (const c of datos.clientes) {
    hoja.addRow([
      c.cliente_id, c.cantidad_prestada, c.base_ahorro, c.pago_semanal,
      c.ahorro, c.rend[`${corte}`], `${c.semanas_con_ahorro} de ${c.semanas.length}`,
    ])
  }
  const total = hoja.addRow([
    'Total', datos.resumen.prestado, datos.resumen.base, null,
    datos.resumen.ahorro, datos.resumen.rend[`${corte}`], null,
  ])
  total.font = { bold: true }
  total.eachCell(c => { c.border = { top: { style: 'thin' } } })

  for (const col of [2, 3, 4, 5, 6]) hoja.getColumn(col).numFmt = PESOS

  const nota = hoja.addRow([])
  nota.getCell(1).value =
    'El rendimiento corresponde a las garantías semanales. No incluye el rendimiento sobre la base de ahorro.'
  nota.getCell(1).font = { italic: true, color: { argb: 'FF6B6B6B' } }

  // ── Detalle semanal ──
  const detalle = libro.addWorksheet('Detalle semanal', { views: [{ state: 'frozen', ySplit: 1 }] })
  detalle.columns = [
    { header: 'ID cliente', width: 14 },
    { header: 'Semana', width: 9 },
    { header: 'Fecha de pago', width: 14 },
    { header: 'Pago', width: 14, style: { numFmt: PESOS } },
    { header: 'Ahorro (garantía)', width: 18, style: { numFmt: PESOS } },
    { header: 'Confirmada', width: 12 },
  ]
  detalle.getRow(1).font = { bold: true }
  for (const c of datos.clientes) {
    for (const s of c.semanas) {
      detalle.addRow([
        c.cliente_id, s.semana,
        s.fecha_pago ? new Date(`${s.fecha_pago}T12:00:00Z`) : null,
        s.pago, s.garantia,
        s.confirmada === null ? '' : s.confirmada ? 'Sí' : 'No',
      ])
    }
  }
  detalle.getColumn(3).numFmt = 'dd/mm/yyyy'

  const buffer = await libro.xlsx.writeBuffer()

  // Si el registro de uso falla, la descarga no se niega.
  await supabase.rpc('aho_registrar_evento', { p_tipo: 'descarga', p_key_grupo: datos.key_grupo })

  const nombre = `ahorros_grupo_${sinCeros(datos.grupo_id)}_ciclo_${sinCeros(datos.ciclo)}.xlsx`
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': MIME_XLSX,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}
