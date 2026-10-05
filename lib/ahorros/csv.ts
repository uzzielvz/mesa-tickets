/**
 * Lectura del CSV de ahorros de Data Science (`pagos_con_pago_semanal_cliente.csv`).
 *
 * Corre en el NAVEGADOR: el archivo completo pesa ~29 MB y el límite de cuerpo
 * de una función de Vercel es 4.5 MB. Se lee aquí, se valida completo y se
 * manda por lotes a `aho_cargar_lote` (AHO-003). Por eso no lleva 'use client'
 * ni importa nada de servidor: es puro y lo pueden usar los dos lados.
 *
 * Los números viajan como TEXTO hasta Postgres (regla 1: valores planos). Un
 * rendimiento trae hasta 20 decimales; pasarlo por un `number` de JS lo
 * redondearía antes de guardarlo.
 */

/** Una fila lista para `aho_cargar_lote`. Las llaves son las columnas del RPC. */
export interface FilaAhorro {
  pago_id: string
  key_grupo: string
  grupo_id: string
  ciclo: string
  cliente_id: string
  key_cliente: string
  semana: number
  pago: string | null
  garantia: string | null
  confirmada: boolean | null
  usuario_captura: string | null
  pago_semanal: string | null
  cantidad_prestada: string | null
  inicio_ciclo: string | null
  garantia_min: string | null
  base_ahorro: string | null
  fecha_pago: string | null
  falta_pago: boolean
  falta_ahorro: boolean
  tasa: string | null
  rend_10: string
  rend_11: string
  rend_12: string
  rend_13: string
  rend_14: string
  rend_15: string
  rend_16: string
}

export type LecturaCsv =
  | {
      ok: true
      filas: FilaAhorro[]
      rechazadas: number
      /** KEY_Grupo distintos, ordenados. */
      grupos: string[]
      clientes: number
      /** Cosas raras que no impiden cargar. Se guardan con la carga. */
      avisos: string[]
    }
  | { ok: false; errores: string[] }

const RENDIMIENTOS = [10, 11, 12, 13, 14, 15, 16] as const

/**
 * Columnas que el visor necesita, con el nombre tal como viene en el archivo.
 * El resto (Fecha_captura, Promotor_edito, num_pago…) se ignora: el propio CSV
 * las duplica o vienen casi vacías.
 */
const REQUERIDAS = [
  'Pago_ID', 'Cliente_ID', 'Grupo_ID', 'Ciclo', 'Semana',
  'Pago', 'Garantia', 'Confirmada', 'Usuario_captura',
  'KEY_Grupo', 'KEY_Cliente',
  'pago_semanal', 'Cantidad_prestada', 'Inicio ciclo', 'garantia_min', 'base_ahorro',
  'fecha_pago', 'falta_pago', 'falta_ahorro', 'tasa_usada',
  ...RENDIMIENTOS.map(n => `rendimiento_hasta_pago${n}`),
] as const

/** "Inicio ciclo", "inicio_ciclo" e "INICIO CICLO" son la misma columna. */
const normalizarNombre = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]+/g, '_')

const NUMERO = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/
const SOLO_DIGITOS = /^\d+$/

/** Divide una línea respetando comillas, por si alguien re-guarda el CSV desde Excel. */
function partir(linea: string, sep: string): string[] {
  if (!linea.includes('"')) return linea.split(sep)
  const out: string[] = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (entreComillas) {
      if (ch === '"') {
        if (linea[i + 1] === '"') { actual += '"'; i++ } else entreComillas = false
      } else actual += ch
    } else if (ch === '"') entreComillas = true
    else if (ch === sep) { out.push(actual); actual = '' }
    else actual += ch
  }
  out.push(actual)
  return out
}

function fechaValida(v: string): string | null | undefined {
  if (v === '') return null
  const m = FECHA_ISO.exec(v)
  if (!m) return undefined
  const [, a, me, d] = m
  const f = new Date(Date.UTC(+a, +me - 1, +d))
  if (f.getUTCFullYear() !== +a || f.getUTCMonth() !== +me - 1 || f.getUTCDate() !== +d) return undefined
  return `${a}-${me}-${d}`
}

/** `undefined` = no se pudo leer. `null` = vacío. */
function numero(v: string): string | null | undefined {
  if (v === '') return null
  return NUMERO.test(v) ? v : undefined
}

function booleano(v: string): boolean | null | undefined {
  const s = v.trim().toLowerCase()
  if (s === '') return null
  if (s === 'true') return true
  if (s === 'false') return false
  return undefined
}

/** Hasta tres ejemplos, para que un aviso se pueda buscar en el archivo. */
const ejemplos = (xs: string[]) =>
  xs.length === 0 ? '' : ` (ej. ${xs.slice(0, 3).join(', ')}${xs.length > 3 ? '…' : ''})`

const fmt = (n: number) => n.toLocaleString('es-MX')

export function leerCsvAhorros(texto: string): LecturaCsv {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/)
  while (lineas.length > 0 && lineas[lineas.length - 1].trim() === '') lineas.pop()

  if (lineas.length < 2) {
    return { ok: false, errores: ['El archivo está vacío o solo trae el encabezado.'] }
  }

  // El CSV de Felix usa `;`. Si alguien lo re-guarda en otro equipo puede salir
  // con `,` o tabulador; se detecta por el encabezado, que no trae datos.
  const cabecera = lineas[0]
  const sep = cabecera.includes(';') ? ';' : cabecera.includes('\t') ? '\t' : ','
  const nombres = partir(cabecera, sep).map(normalizarNombre)
  const idx = new Map<string, number>()
  nombres.forEach((n, i) => { if (!idx.has(n)) idx.set(n, i) })

  const faltantes = REQUERIDAS.filter(r => !idx.has(normalizarNombre(r)))
  if (faltantes.length > 0) {
    return {
      ok: false,
      errores: [
        'Este archivo no parece el CSV de ahorros: le faltan columnas.',
        `Faltan: ${faltantes.join(', ')}.`,
        `Separador detectado: "${sep === '\t' ? 'tabulador' : sep}".`,
      ],
    }
  }

  const col = (nombre: (typeof REQUERIDAS)[number]) => idx.get(normalizarNombre(nombre))!
  const C = Object.fromEntries(REQUERIDAS.map(r => [r, col(r)])) as Record<(typeof REQUERIDAS)[number], number>

  const porPago = new Map<string, FilaAhorro>()
  const motivos: string[] = []
  let rechazadas = 0
  let repetidas = 0

  const negativas: string[] = []
  const atipicos: string[] = []
  const confirmadaRara = new Map<string, number>()

  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i]
    if (linea.trim() === '') continue
    const v = partir(linea, sep).map(x => x.trim())
    const rechazar = (motivo: string) => {
      rechazadas++
      if (motivos.length < 5) motivos.push(`línea ${i + 1}: ${motivo}`)
    }

    if (v.length < nombres.length) { rechazar('trae menos columnas que el encabezado'); continue }

    // ── Llaves ──
    // Se reconstruyen desde sus partes con los ceros a la izquierda. Si Excel
    // se comió los ceros de Grupo_ID ("8" en vez de "000008"), aquí se reponen;
    // si las llaves del archivo no cuadran con sus partes, la fila no entra.
    const [cli, gru, cic, sem] = [v[C.Cliente_ID], v[C.Grupo_ID], v[C.Ciclo], v[C.Semana]]
    if (![cli, gru, cic, sem].every(x => SOLO_DIGITOS.test(x))) {
      rechazar('Cliente_ID, Grupo_ID, Ciclo o Semana no son números')
      continue
    }
    const semana = parseInt(sem, 10)
    if (semana < 1 || semana > 52) { rechazar(`semana fuera de rango (${sem})`); continue }

    const cliente_id = cli.padStart(6, '0')
    const grupo_id = gru.padStart(6, '0')
    const ciclo = cic.padStart(2, '0')
    const key_grupo = `${grupo_id}_C${ciclo}`
    const key_cliente = `${cliente_id}_${key_grupo}`
    const pago_id = `${cliente_id}_${grupo_id}_${ciclo}_${semana}`

    if (v[C.KEY_Grupo] !== key_grupo || v[C.KEY_Cliente] !== key_cliente || v[C.Pago_ID] !== pago_id) {
      rechazar(`las llaves no cuadran con sus partes (${v[C.Pago_ID] || 'sin Pago_ID'})`)
      continue
    }

    // ── Números y fechas ──
    const nums = {
      pago: numero(v[C.Pago]),
      garantia: numero(v[C.Garantia]),
      pago_semanal: numero(v[C.pago_semanal]),
      cantidad_prestada: numero(v[C.Cantidad_prestada]),
      garantia_min: numero(v[C.garantia_min]),
      base_ahorro: numero(v[C.base_ahorro]),
      tasa: numero(v[C.tasa_usada]),
    }
    const malos = Object.entries(nums).filter(([, x]) => x === undefined).map(([k]) => k)
    const rend = RENDIMIENTOS.map(n => numero(v[C[`rendimiento_hasta_pago${n}`]]))
    if (rend.some(x => x === undefined)) malos.push('rendimientos')
    const inicio = fechaValida(v[C['Inicio ciclo']])
    const fpago = fechaValida(v[C.fecha_pago])
    if (inicio === undefined) malos.push('Inicio ciclo')
    if (fpago === undefined) malos.push('fecha_pago')
    if (malos.length > 0) { rechazar(`no se pudo leer: ${malos.join(', ')} (${pago_id})`); continue }

    const confirmada = booleano(v[C.Confirmada])
    if (confirmada === undefined) {
      const raro = v[C.Confirmada]
      confirmadaRara.set(raro, (confirmadaRara.get(raro) ?? 0) + 1)
    }

    const g = nums.garantia ? Number(nums.garantia) : 0
    if (g < 0) negativas.push(pago_id)
    const p = nums.pago ? Number(nums.pago) : 0
    const ps = nums.pago_semanal ? Number(nums.pago_semanal) : 0
    if (ps > 0 && p > ps * 10) atipicos.push(pago_id)

    if (porPago.has(pago_id)) repetidas++
    porPago.set(pago_id, {
      pago_id, key_grupo, grupo_id, ciclo, cliente_id, key_cliente, semana,
      pago: nums.pago!, garantia: nums.garantia!,
      confirmada: confirmada ?? null,
      usuario_captura: v[C.Usuario_captura] || null,
      pago_semanal: nums.pago_semanal!, cantidad_prestada: nums.cantidad_prestada!,
      inicio_ciclo: inicio!, garantia_min: nums.garantia_min!, base_ahorro: nums.base_ahorro!,
      fecha_pago: fpago!,
      falta_pago: v[C.falta_pago] === '1',
      falta_ahorro: v[C.falta_ahorro] === '1',
      tasa: nums.tasa!,
      rend_10: rend[0] ?? '0', rend_11: rend[1] ?? '0', rend_12: rend[2] ?? '0',
      rend_13: rend[3] ?? '0', rend_14: rend[4] ?? '0', rend_15: rend[5] ?? '0',
      rend_16: rend[6] ?? '0',
    })
  }

  const filas = Array.from(porPago.values())
  if (filas.length === 0) {
    return {
      ok: false,
      errores: ['Ninguna fila se pudo leer.', ...motivos],
    }
  }

  // Grupo-ciclo sin datos del crédito: existen en el archivo pero vacíos
  // (`falta_pago` = 1 en todas sus filas). Un asesor que los busque verá un
  // ciclo sin información; conviene que Felix lo sepa antes.
  const sinCredito = new Map<string, boolean>()
  for (const f of filas) sinCredito.set(f.key_grupo, (sinCredito.get(f.key_grupo) ?? true) && f.falta_pago)
  const vacios = Array.from(sinCredito.entries()).filter(([, v]) => v).map(([k]) => k)

  const avisos: string[] = []
  if (rechazadas > 0) {
    avisos.push(`${fmt(rechazadas)} filas no se cargan porque no se pudieron leer. ${motivos.join(' · ')}`)
  }
  if (repetidas > 0) {
    avisos.push(`${fmt(repetidas)} pagos venían repetidos en el archivo; se tomó la última aparición de cada uno.`)
  }
  if (negativas.length > 0) {
    avisos.push(`${fmt(negativas.length)} filas con garantía negativa${ejemplos(negativas)}. Se cargan tal como vienen.`)
  }
  if (atipicos.length > 0) {
    avisos.push(`${fmt(atipicos.length)} pagos de más de 10 veces el pago semanal${ejemplos(atipicos)}. Se cargan tal como vienen.`)
  }
  if (confirmadaRara.size > 0) {
    const detalle = Array.from(confirmadaRara.entries()).map(([k, n]) => `"${k}" ×${n}`).join(', ')
    avisos.push(`"Confirmada" trae valores que no son verdadero/falso: ${detalle}. Se guardan como vacíos.`)
  }
  if (vacios.length > 0) {
    avisos.push(`${fmt(vacios.length)} grupo-ciclo no traen datos del crédito${ejemplos(vacios)}. Se pueden buscar, pero salen sin información.`)
  }

  const grupos = Array.from(new Set(filas.map(f => f.key_grupo))).sort()
  const clientes = new Set(filas.map(f => f.key_cliente)).size

  return { ok: true, filas, rechazadas, grupos, clientes, avisos }
}

/**
 * Lo que el asesor escribe en el buscador. Acepta "439" + "1", y también la
 * llave completa "000439_C01" pegada en el campo de grupo.
 */
export function leerBusqueda(grupo?: string, ciclo?: string): { grupo: string; ciclo: string } | null {
  const g = (grupo ?? '').trim()
  const c = (ciclo ?? '').trim()
  const llave = /^(\d{1,6})\s*_?\s*C\s*(\d{1,3})$/i.exec(g)
  if (llave) return { grupo: llave[1], ciclo: c || llave[2] }
  if (!g) return null
  return { grupo: g, ciclo: c }
}
