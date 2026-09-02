import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { abrirLibro, encabezadoDe, NOMBRE_REPORTE } from '@/lib/inversiones/excel'
import { procesarCarga, marcarCarga } from '@/lib/inversiones/procesar'

// exceljs es Node puro (zip + streams): no corre en el runtime edge.
export const runtime = 'nodejs'

const MAX_MB = 25
const MAX_BYTES = MAX_MB * 1024 * 1024
const BUCKET = 'inversiones'
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Carga de un reporte de inversiones. En I1 el archivo se guarda y se registra,
 * pero sus hechos NO se ingieren: la carga queda en `pendiente` hasta que I2
 * (calendario) e I4 (tablero) traigan el parseo.
 *
 * El tipo de reporte se decide por el CONTENIDO del archivo, nunca por su
 * nombre: el nombre lo genera el script de Felix y puede cambiar sin avisar.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_carga')
    .eq('id', user.id)
    .single()

  const puede = profile?.rol === 'admin' ||
    (profile as { acceso_inversiones_carga?: boolean } | null)?.acceso_inversiones_carga === true
  if (!puede) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const archivo = formData.get('archivo') as File | null
  if (!archivo) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx' }, { status: 400 })
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: `El archivo supera ${MAX_MB} MB` }, { status: 400 })
  }

  // ── Leer el encabezado antes de guardar nada ──────────────────────────────
  // Si el archivo no es uno de los dos reportes, no tiene caso ocupar Storage
  // con él ni dejar una fila huérfana en la bitácora.
  const bytes = await archivo.arrayBuffer()

  // El libro se abre UNA vez y se reusa para el encabezado y para los hechos.
  // El Tablero pesa 340 KB en 13 hojas; parsearlo dos veces por carga no tiene
  // ninguna razón de ser.
  let wb
  try {
    wb = await abrirLibro(bytes)
  } catch (e) {
    return NextResponse.json({
      error: 'No se reconoce este archivo',
      errores: [
        'El archivo no se pudo abrir como .xlsx. ¿Está completo?',
        `Detalle técnico: ${e instanceof Error ? e.message : String(e)}`,
      ],
    }, { status: 422 })
  }

  const lectura = encabezadoDe(wb)

  if (!lectura.ok) {
    return NextResponse.json({
      error: 'No se reconoce este archivo',
      errores: lectura.errores,
    }, { status: 422 })
  }

  const enc = lectura.encabezado
  const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')

  // El prefijo del path lleva el tipo de reporte porque las políticas de Storage
  // separan audiencias con él: quien solo ve pagos no puede bajar el tablero.
  // Ver la migración inv_003.
  const id = randomUUID()
  const storagePath = `${enc.tipo}/${enc.periodoInicio.slice(0, 7)}/${id}.xlsx`

  const avisos = [...enc.avisos]

  // Resubir el mismo archivo no es un error —puede ser intencional— pero sí algo
  // que conviene decir en voz alta, porque casi siempre es un descuido.
  const { data: gemelo } = await supabase
    .from('inv_cargas')
    .select('created_at')
    .eq('hash_archivo', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (gemelo) {
    avisos.push(
      `Este archivo es idéntico a uno subido el ${
        new Date(gemelo.created_at as string).toLocaleDateString('es-MX', {
          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        })
      }. Se guardó de todos modos.`,
    )
  }

  const { error: errStorage } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: MIME_XLSX })

  if (errStorage) {
    return NextResponse.json(
      { error: `No se pudo guardar el archivo: ${errStorage.message}` },
      { status: 500 },
    )
  }

  const { data: carga, error: errCarga } = await supabase
    .from('inv_cargas')
    .insert({
      id,
      tipo_reporte: enc.tipo,
      periodo_inicio: enc.periodoInicio,
      periodo_fin: enc.periodoFin,
      nombre_archivo: archivo.name,
      storage_path: storagePath,
      hash_archivo: hash,
      tamano_bytes: archivo.size,
      estado: 'pendiente',
      notas_metodologicas: enc.notas,
      hojas_degradadas: enc.hojasDegradadas,
      avisos,
      subido_por: user.id,
    })
    .select('id, created_at')
    .single()

  // Si la fila no entró, el archivo en Storage queda huérfano y sin forma de
  // llegar a él. Se retira para no dejar basura invisible.
  if (errCarga || !carga) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json(
      { error: `No se pudo registrar la carga: ${errCarga?.message ?? 'error desconocido'}` },
      { status: 500 },
    )
  }

  // ── Ingesta de los hechos ─────────────────────────────────────────────────
  // Va DESPUÉS de guardar el archivo y registrar la carga, no antes: si el
  // parseo falla, el original ya está a salvo en Storage y la carga se puede
  // reprocesar cuando se corrija el parser. Al revés se perdería el archivo.
  const resultado = await procesarCarga(supabase, carga.id, enc.tipo, wb)
  const resumen = resultado.ok ? resultado.resumen : null
  await marcarCarga(supabase, carga.id, resultado, avisos)

  return NextResponse.json({
    ok: true,
    cargaId: carga.id,
    tipo: enc.tipo,
    reporte: NOMBRE_REPORTE[enc.tipo],
    periodoInicio: enc.periodoInicio,
    periodoFin: enc.periodoFin,
    hojas: enc.hojas,
    notas: Object.keys(enc.notas).length,
    hojasDegradadas: enc.hojasDegradadas,
    avisos: resultado.ok ? [...avisos, ...resultado.avisos] : avisos,
    // Que el parseo falle no invalida la carga: el archivo quedó guardado y se
    // puede descargar. Se reporta como problema, no como error de la subida.
    procesado: resultado.ok,
    erroresProceso: resultado.ok ? [] : resultado.errores,
    resumen,
    tamano: archivo.size,
  })
}
