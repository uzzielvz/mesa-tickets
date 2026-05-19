/**
 * Script de importación — base_clientes.xlsx → Supabase
 * Uso:
 *   node scripts/import-base-clientes.mjs --dry-run   (preview)
 *   node scripts/import-base-clientes.mjs --sql        (genera SQL para pegar en Supabase)
 *
 * Prerequisito: npm install xlsx
 */

import XLSX from 'xlsx'
// ─── Configuración ─────────────────────────────────────────────────────────────


const EXCEL_PATH = 'C:/Users/uzzie/Downloads/base_clientes.xlsx'

const DRY_RUN = process.argv.includes('--dry-run')
const SQL_MODE = process.argv.includes('--sql')
const SQL_PROMOTOR = process.argv.includes('--sql-promotor')

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Convierte serial de fecha Excel → "YYYY-MM-DD" */
function excelDateToISO(serial) {
  if (!serial || typeof serial === 'string') return serial
  const date = new Date((serial - 25569) * 86400 * 1000)
  return date.toISOString().split('T')[0]
}

/** Convierte string a boolean con distintos formatos */
function toBoolean(val) {
  if (typeof val === 'boolean') return val
  const s = String(val ?? '').trim().toLowerCase()
  return s === 'sí' || s === 'si' || s === 'true' || s === '1' || s === 'yes'
}

/** Normaliza calidad de referencia (plural → singular) */
function normalizarCalidad(val) {
  const map = {
    excelentes: 'Excelente',
    excelente: 'Excelente',
    buenas: 'Buena',
    buena: 'Buena',
    regulares: 'Regular',
    regular: 'Regular',
    'no contestó': 'No contestó',
    'no contesto': 'No contestó',
  }
  return map[String(val ?? '').toLowerCase().trim()] ?? String(val ?? '').trim()
}

/** Normaliza estado civil */
function normalizarEstadoCivil(val) {
  const map = {
    'unión libre': 'Union libre',
    'union libre': 'Union libre',
    casado: 'Casado',
    casada: 'Casado',
    soltero: 'Soltero',
    soltera: 'Soltero',
    viudo: 'Viudo',
    viuda: 'Viudo',
    divorciado: 'Divorciado',
    divorciada: 'Divorciado',
  }
  const norm = String(val ?? '').trim()
  return map[norm.toLowerCase()] ?? norm
}

// ─── Scoring (replica de lib/scoring/modelo.ts) ─────────────────────────────────

function calcularEdad(fechaNac) {
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function promedioReferencias(refs) {
  if (!refs || refs.length === 0) return 0
  const factores = { Excelente: 1.0, Buena: 0.6, Regular: 0.4, 'No contestó': 0 }
  const suma = refs.reduce((acc, r) => acc + (factores[r.calidad] ?? 0), 0)
  return suma / refs.length
}

function calcularScore(datos, refs) {
  const refFactor = promedioReferencias(refs)
  let puntaje = 0

  function agregar(factor, maximo) {
    puntaje += Math.round(factor * maximo * 100) / 100
  }

  const edad = calcularEdad(datos.fecha_nacimiento)
  const factorEdad =
    edad >= 36 && edad <= 50 ? 1.0 :
    edad >= 51 && edad <= 70 ? 0.8 :
    edad >= 26 && edad <= 35 ? 0.6 :
    edad >= 21 && edad <= 25 ? 0.4 : 0
  agregar(factorEdad, 7)

  const factorResidencia =
    datos.tiempo_residencia > 5 ? 1.0 :
    datos.tiempo_residencia >= 3 ? 0.8 :
    datos.tiempo_residencia >= 1 ? 0.6 : 0
  agregar(factorResidencia, 5)

  const factorNegocio =
    datos.antiguedad_negocio > 5 ? 1.0 :
    datos.antiguedad_negocio >= 3 ? 0.8 :
    datos.antiguedad_negocio >= 1 ? 0.6 : 0
  agregar(factorNegocio, 8)

  const factorCasa =
    datos.casa_habitacion === 'Propia' ? 1.0 :
    datos.casa_habitacion === 'Familiar' ? 0.6 :
    datos.casa_habitacion === 'Rentada' ? 0.2 : 0
  agregar(factorCasa, 8)

  const factorEstado =
    datos.estado_civil === 'Casado' ? 1.0 :
    datos.estado_civil === 'Union libre' ? 0.8 :
    datos.estado_civil === 'Viudo' ? 0.7 :
    datos.estado_civil === 'Soltero' ? 0.6 :
    datos.estado_civil === 'Divorciado' ? 0.4 : 0
  agregar(factorEstado, 8)

  const factorDep =
    datos.dependientes >= 1 && datos.dependientes <= 2 ? 1.0 :
    datos.dependientes >= 3 && datos.dependientes <= 5 ? 0.8 :
    datos.dependientes === 0 ? 0.6 : 0
  agregar(factorDep, 5)

  const factorDestino =
    datos.destino_credito === 'Capital de trabajo' ? 1.0 :
    datos.destino_credito === 'Activo fijo' ? 0.8 :
    datos.destino_credito === 'Bienes y servicios de consumo' ? 0.6 : 0
  agregar(factorDestino, 6)

  const factorAuto = datos.automovil_propio ? 1.0 : 0.4
  agregar(factorAuto, 8)

  const factorBanco = datos.cuenta_banco > 1 ? 1.0 : 0.6
  agregar(factorBanco, 4)

  const factorRefs =
    refFactor >= 0.8 ? 1.0 :
    refFactor >= 0.5 ? 0.6 : 0.4
  agregar(factorRefs, 5)

  const factorBuro =
    datos.buro_credito === 'Excelente' ? 1.0 :
    datos.buro_credito === 'Buena' ? 0.6 :
    datos.buro_credito === 'Regular' ? 0.2 : 0
  agregar(factorBuro, 8)

  const factorGarantia =
    datos.tipo_garantia === 'Equipo de transporte' ? 1.0 :
    datos.tipo_garantia === 'Ninguna' ? 0.8 :
    datos.tipo_garantia === 'Avales' ? 0.4 : 0
  agregar(factorGarantia, 5)

  const factorTipoNeg =
    datos.tipo_negocio === 'Fijo' ? 1.0 :
    datos.tipo_negocio === 'Semifijo' ? 0.7 : 0
  agregar(factorTipoNeg, 5)

  const factorGenero = datos.genero === 'Masculino' ? 1.0 : 0.8
  agregar(factorGenero, 5)

  const factorTel =
    datos.antiguedad_telefono > 3 ? 1.0 :
    datos.antiguedad_telefono >= 1 ? 0.7 : 0.3
  agregar(factorTel, 8)

  const factorDomicilio = datos.negocio_domicilio ? 1.0 : 0.6
  agregar(factorDomicilio, 5)

  return Math.round(puntaje * 100) / 100
}

function clasificar(puntaje) {
  if (puntaje >= 80) return 'A'
  if (puntaje >= 70) return 'B'
  if (puntaje >= 50) return 'C'
  return 'D'
}

// ─── Mapeo de columna Excel → campo DB ─────────────────────────────────────────

/**
 * Busca un valor en la fila usando múltiples posibles nombres de columna.
 * Retorna el primer match encontrado.
 */
function get(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
  }
  return undefined
}

function mapRow(row) {
  const id = get(row, 'id', 'ID', 'Id')
  const cicloRaw = get(row, 'ciclo', 'Ciclo', 'CICLO')
  const nombre = get(row, 'nombre_acreditado', 'nombre_completo', 'Nombre', 'nombre', 'NOMBRE', 'Nombre completo')
  const fechaNac = get(row, 'fecha_nacimiento', 'Fecha de nacimiento', 'fecha nacimiento', 'FECHA_NACIMIENTO')
  const tiempoRes = get(row, 'tiempo_residencia', 'Años en residencia', 'años_residencia', 'tiempo residencia')
  const antNeg = get(row, 'antiguedad_negocio', 'Años en el negocio', 'años_negocio', 'antiguedad negocio', 'antigüedad_negocio')
  const dep = get(row, 'dependientes_economicos', 'dependientes', 'Dependientes', 'DEPENDIENTES')
  const antTel = get(row, 'antiguedad_numero_telefono', 'antiguedad_telefono', 'Años con mismo teléfono', 'años_telefono')
  const ctaBanco = get(row, 'cuenta_banco', 'Años con cuenta banco', 'años_banco', 'cuenta banco')
  const casa = get(row, 'casa_habitacion_propia', 'casa_habitacion', 'Casa habitación', 'Casa habitacion')
  const estadoCivil = get(row, 'estado_civil', 'Estado civil', 'Estado Civil')
  const negDom = get(row, 'negocio_mismo_domicilio', 'negocio_domicilio', 'Negocio en domicilio', 'negocio domicilio')
  const destino = get(row, 'destino_credito', 'Destino del crédito', 'Destino crédito', 'destino credito')
  const auto = get(row, 'automovil_propio', 'Automóvil propio', 'automovil propio', 'auto')
  const buro = get(row, 'circulo_credito', 'buro_credito', 'Buró de crédito', 'Buro de credito', 'buro credito')
  const garantia = get(row, 'tipo_garantia', 'Tipo de garantía', 'tipo garantia')
  const tipoNeg = get(row, 'tipo_negocio', 'Tipo de negocio', 'tipo negocio')
  const genero = get(row, 'genero', 'Género', 'Genero', 'GENERO')
  const refCalidad = get(row, 'referencias_personales', 'Referencias', 'referencias', 'calidad_referencia')
  const califPromotor = get(row, 'clasificacion_promotor', 'calificacion_promotor')
  const justificacion = get(row, 'justificacion', 'justificacion_promotor')

  const clave = String(id).padStart(6, '0')
  const ciclo = String(cicloRaw).padStart(2, '0')
  const fechaISO = typeof fechaNac === 'number' ? excelDateToISO(fechaNac) : String(fechaNac ?? '')

  return {
    clave,
    ciclo,
    nombre_completo: String(nombre ?? '').trim(),
    fecha_nacimiento: fechaISO,
    tiempo_residencia: Number(tiempoRes ?? 0),
    antiguedad_negocio: Number(antNeg ?? 0),
    dependientes: Number(dep ?? 0),
    antiguedad_telefono: Number(antTel ?? 0),
    cuenta_banco: Number(ctaBanco ?? 0),
    casa_habitacion: String(casa ?? '').trim(),
    estado_civil: normalizarEstadoCivil(estadoCivil),
    negocio_domicilio: toBoolean(negDom),
    destino_credito: String(destino ?? '').trim(),
    automovil_propio: toBoolean(auto),
    buro_credito: String(buro ?? '').trim(),
    tipo_garantia: String(garantia ?? '').trim(),
    tipo_negocio: String(tipoNeg ?? '').trim(),
    genero: String(genero ?? '').trim(),
    referencia_calidad: normalizarCalidad(refCalidad),
    calificacion_promotor: califPromotor ? String(califPromotor).trim() : null,
    justificacion_promotor: justificacion ? String(justificacion).trim() : null,
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Importación base_clientes.xlsx ${DRY_RUN ? '[DRY RUN]' : ''} ===\n`)

  // 1. Leer Excel
  let workbook
  try {
    workbook = XLSX.readFile(EXCEL_PATH)
  } catch (e) {
    console.error(`No se pudo abrir el archivo: ${EXCEL_PATH}`)
    console.error(e.message)
    process.exit(1)
  }

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })

  console.log(`Hoja: "${sheetName}" — ${rows.length} registros encontrados`)
  if (rows.length === 0) {
    console.error('El archivo no tiene datos.')
    process.exit(1)
  }

  // Mostrar columnas detectadas
  console.log('\nColumnas detectadas:', Object.keys(rows[0]).join(', '))
  console.log()

  // 2. Mapear filas (saltarse filas sin id)
  const mapped = rows.filter(row => row['id'] != null && String(row['id']).trim() !== '').map((row, i) => {
    try {
      return mapRow(row)
    } catch (e) {
      console.error(`Error en fila ${i + 1}:`, e.message)
      return null
    }
  }).filter(Boolean)

  // 3. Preview
  console.log('Primeros 3 registros mapeados:')
  mapped.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.clave} — ${r.nombre_completo} — Ciclo ${r.ciclo} — ${r.fecha_nacimiento}`)
    console.log(`       casa=${r.casa_habitacion}, civil=${r.estado_civil}, auto=${r.automovil_propio}, negDom=${r.negocio_domicilio}`)
    console.log(`       ref=${r.referencia_calidad}`)
  })
  console.log()

  if (DRY_RUN) {
    console.log('[DRY RUN] No se insertó nada. Usa --sql para generar el SQL.')
    process.exit(0)
  }

  // 4. Modo SQL promotor (solo UPDATEs)
  if (SQL_PROMOTOR) {
    function esc2(val) {
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'boolean') return val ? 'true' : 'false'
      if (typeof val === 'number') return String(val)
      return `'${String(val).replace(/'/g, "''")}'`
    }

    const lines = []
    for (const r of mapped) {
      if (!r.calificacion_promotor) continue
      lines.push(`UPDATE acreditados SET`)
      lines.push(`  calificacion_promotor = ${esc2(r.calificacion_promotor)},`)
      lines.push(`  justificacion_promotor = ${esc2(r.justificacion_promotor)},`)
      lines.push(`  promotor_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)`)
      lines.push(`  WHERE clave = ${esc2(r.clave)};`)
      lines.push('')
    }

    const sql = lines.join('\n')
    const outPath = 'scripts/update-promotor.sql'
    const { writeFileSync } = await import('fs')
    writeFileSync(outPath, sql, 'utf8')
    console.log(`\nSQL generado: ${outPath}`)
    console.log('Pégalo en Supabase → SQL Editor → Run')
    process.exit(0)
  }

  // 5. Modo SQL
  if (!SQL_MODE) {
    console.log('Usa --dry-run para preview o --sql para generar el SQL.')
    process.exit(0)
  }

  function esc(val) {
    if (val === null || val === undefined) return 'NULL'
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    if (typeof val === 'number') return String(val)
    return `'${String(val).replace(/'/g, "''")}'`
  }

  const lines = []
  lines.push('DO $$')
  lines.push('DECLARE v_id uuid;')
  lines.push('BEGIN')

  for (const r of mapped) {
    const { referencia_calidad, ...campos } = r
    const refs = [{ calidad: referencia_calidad }]
    const puntaje = calcularScore(campos, refs)
    const clasificacion = clasificar(puntaje)

    lines.push(``)
    lines.push(`  -- ${r.clave} ${r.nombre_completo}`)
    lines.push(`  INSERT INTO acreditados (clave, ciclo, nombre_completo, fecha_nacimiento, tiempo_residencia, antiguedad_negocio, dependientes, antiguedad_telefono, cuenta_banco, casa_habitacion, estado_civil, negocio_domicilio, destino_credito, automovil_propio, buro_credito, tipo_garantia, tipo_negocio, genero, puntaje_total, clasificacion_modelo, capturado_por_id)`)
    lines.push(`  VALUES (${esc(campos.clave)}, ${esc(campos.ciclo)}, ${esc(campos.nombre_completo)}, ${esc(campos.fecha_nacimiento)}, ${esc(campos.tiempo_residencia)}, ${esc(campos.antiguedad_negocio)}, ${esc(campos.dependientes)}, ${esc(campos.antiguedad_telefono)}, ${esc(campos.cuenta_banco)}, ${esc(campos.casa_habitacion)}, ${esc(campos.estado_civil)}, ${esc(campos.negocio_domicilio)}, ${esc(campos.destino_credito)}, ${esc(campos.automovil_propio)}, ${esc(campos.buro_credito)}, ${esc(campos.tipo_garantia)}, ${esc(campos.tipo_negocio)}, ${esc(campos.genero)}, ${esc(puntaje)}, ${esc(clasificacion)}, (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1))`)
    lines.push(`  RETURNING id INTO v_id;`)
    lines.push(`  INSERT INTO acreditado_referencias (acreditado_id, calidad) VALUES (v_id, ${esc(referencia_calidad)});`)
  }

  lines.push('')
  lines.push('END $$;')

  const sql = lines.join('\n')
  const outPath = 'scripts/import.sql'
  const { writeFileSync } = await import('fs')
  writeFileSync(outPath, sql, 'utf8')
  console.log(`\nSQL generado: ${outPath}`)
  console.log('Pégalo en Supabase → SQL Editor → Run (estando logueado)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
