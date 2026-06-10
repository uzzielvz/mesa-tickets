/**
 * Datos SINTÉTICOS para el modo demo del asistente (AI_ASSISTANT_MOCK=true).
 *
 * Permiten demostrar el agente con el tier gratuito de Gemini sin exponer
 * ningún dato real de cartera (el tier gratuito entrena con los datos).
 * Las formas imitan los contratos de los RPCs reales. Números inventados
 * pero coherentes entre sí (sumas aproximadas).
 */

export const MOCK_FECHAS = ['2026-06-05', '2026-05-29', '2026-05-22']

const PAR_BUCKETS = [
  { bucket: '0',         label: 'Sin mora',  dias_min: 0,   dias_max: 0,    creditos: 130, saldo: 3_150_000, pct_saldo: 53.94 },
  { bucket: '7',         label: '1-7',       dias_min: 1,   dias_max: 7,    creditos: 28,  saldo: 410_000,   pct_saldo: 7.02 },
  { bucket: '15',        label: '8-15',      dias_min: 8,   dias_max: 15,   creditos: 18,  saldo: 295_000,   pct_saldo: 5.05 },
  { bucket: '30',        label: '16-30',     dias_min: 16,  dias_max: 30,   creditos: 14,  saldo: 228_000,   pct_saldo: 3.90 },
  { bucket: '60',        label: '31-60',     dias_min: 31,  dias_max: 60,   creditos: 19,  saldo: 470_000,   pct_saldo: 8.05 },
  { bucket: '90',        label: '61-90',     dias_min: 61,  dias_max: 90,   creditos: 12,  saldo: 392_000,   pct_saldo: 6.71 },
  { bucket: 'Mayor_90',  label: '91-180',    dias_min: 91,  dias_max: 180,  creditos: 15,  saldo: 510_000,   pct_saldo: 8.73 },
  { bucket: 'Mayor_180', label: 'Más de 180', dias_min: 181, dias_max: null, creditos: 12,  saldo: 385_000,   pct_saldo: 6.59 },
]

export function mockResumen(fecha_corte: string) {
  return {
    demo: 'DATOS SINTÉTICOS DE DEMOSTRACIÓN',
    fecha_corte,
    filtros_aplicados: { coordinacion: null, codigo_recuperador: null, ciclo: null },
    totales: {
      creditos: 248,
      cartera_total: 5_840_000,
      creditos_en_mora: 118,
      cartera_en_mora: 2_690_000,
      pct_mora: 46.06,
    },
    par: PAR_BUCKETS,
    indicadores: { pct_par_30: 30.08, pct_par_90: 15.32 },
  }
}

export function mockPorCoordinacion(fecha_corte: string) {
  return {
    demo: 'DATOS SINTÉTICOS DE DEMOSTRACIÓN',
    fecha_corte,
    coordinaciones: [
      { coordinacion: 'Valle de Bravo', creditos: 42, cartera_total: 980_000,   pct_mora: 58.4, pct_par_30: 42.1, pct_par_90: 21.6 },
      { coordinacion: 'Tejupilco',      creditos: 38, cartera_total: 860_000,   pct_mora: 51.2, pct_par_30: 35.7, pct_par_90: 17.9 },
      { coordinacion: 'Toluca',         creditos: 55, cartera_total: 1_320_000, pct_mora: 44.8, pct_par_30: 28.3, pct_par_90: 13.2 },
      { coordinacion: 'Atlacomulco',    creditos: 48, cartera_total: 1_180_000, pct_mora: 41.5, pct_par_30: 26.9, pct_par_90: 12.8 },
      { coordinacion: 'Metepec',        creditos: 65, cartera_total: 1_500_000, pct_mora: 38.9, pct_par_30: 22.4, pct_par_90: 10.1 },
    ],
  }
}

export function mockPorRecuperador(fecha_corte: string, coordinacion?: string | null) {
  const recuperadores = [
    { codigo: '000018', nombre: 'HERNÁNDEZ SILVA JORGE',  coordinacion: 'Valle de Bravo', creditos: 21, cartera_total: 520_000, pct_mora: 71.3, pct_par_30: 55.2, pct_par_90: 31.0 },
    { codigo: '000042', nombre: 'RAMÍREZ LÓPEZ MARÍA',    coordinacion: 'Tejupilco',      creditos: 25, cartera_total: 560_000, pct_mora: 54.6, pct_par_30: 38.4, pct_par_90: 19.5 },
    { codigo: '000027', nombre: 'GONZÁLEZ PÉREZ LUIS',    coordinacion: 'Toluca',         creditos: 31, cartera_total: 740_000, pct_mora: 46.2, pct_par_30: 30.1, pct_par_90: 14.7 },
    { codigo: '000035', nombre: 'TORRES MENDOZA ANA',     coordinacion: 'Atlacomulco',    creditos: 27, cartera_total: 690_000, pct_mora: 39.8, pct_par_30: 24.6, pct_par_90: 11.3 },
    { codigo: 'CALL01', nombre: 'CALL CENTER',            coordinacion: 'Metepec',        creditos: 88, cartera_total: 2_010_000, pct_mora: 31.2, pct_par_30: 12.8, pct_par_90: 5.4 },
  ]
  return {
    demo: 'DATOS SINTÉTICOS DE DEMOSTRACIÓN',
    fecha_corte,
    coordinacion: coordinacion ?? null,
    recuperadores: coordinacion
      ? recuperadores.filter(r => r.coordinacion.toLowerCase() === coordinacion.toLowerCase())
      : recuperadores,
  }
}

export function mockMora(fecha_corte: string, coordinacion?: string | null, dias_min = 1) {
  const filas = [
    { codigo_acreditado: '004512', ciclo: '03', coordinacion: 'Valle de Bravo', codigo_recuperador: '000018', nombre_recuperador: 'HERNÁNDEZ SILVA JORGE', dias_mora: 487, bucket: 'Mayor_180', saldo_total: 38_500, saldo_vencido: 38_500, pagos_vencidos: 32, dias_desde_ultimo_pago: 490, alerta: '1' },
    { codigo_acreditado: '003877', ciclo: '02', coordinacion: 'Tejupilco',      codigo_recuperador: '000042', nombre_recuperador: 'RAMÍREZ LÓPEZ MARÍA',   dias_mora: 312, bucket: 'Mayor_180', saldo_total: 29_800, saldo_vencido: 27_400, pagos_vencidos: 22, dias_desde_ultimo_pago: 318, alerta: '1' },
    { codigo_acreditado: '005103', ciclo: '01', coordinacion: 'Toluca',         codigo_recuperador: '000027', nombre_recuperador: 'GONZÁLEZ PÉREZ LUIS',   dias_mora: 164, bucket: 'Mayor_90',  saldo_total: 22_300, saldo_vencido: 15_900, pagos_vencidos: 12, dias_desde_ultimo_pago: 170, alerta: '1' },
    { codigo_acreditado: '004988', ciclo: '04', coordinacion: 'Valle de Bravo', codigo_recuperador: '000018', nombre_recuperador: 'HERNÁNDEZ SILVA JORGE', dias_mora: 95,  bucket: 'Mayor_90',  saldo_total: 18_700, saldo_vencido: 9_200,  pagos_vencidos: 7,  dias_desde_ultimo_pago: 98,  alerta: '1' },
    { codigo_acreditado: '005241', ciclo: '02', coordinacion: 'Atlacomulco',    codigo_recuperador: '000035', nombre_recuperador: 'TORRES MENDOZA ANA',    dias_mora: 62,  bucket: '90',        saldo_total: 15_400, saldo_vencido: 5_800,  pagos_vencidos: 5,  dias_desde_ultimo_pago: 65,  alerta: '1' },
    { codigo_acreditado: '005377', ciclo: '01', coordinacion: 'Metepec',        codigo_recuperador: 'CALL01', nombre_recuperador: 'CALL CENTER',           dias_mora: 28,  bucket: '30',        saldo_total: 12_100, saldo_vencido: 2_300,  pagos_vencidos: 2,  dias_desde_ultimo_pago: 30,  alerta: '0' },
    { codigo_acreditado: '005412', ciclo: '03', coordinacion: 'Toluca',         codigo_recuperador: '000027', nombre_recuperador: 'GONZÁLEZ PÉREZ LUIS',   dias_mora: 13,  bucket: '15',        saldo_total: 9_800,  saldo_vencido: 940,    pagos_vencidos: 1,  dias_desde_ultimo_pago: 15,  alerta: '0' },
    { codigo_acreditado: '005456', ciclo: '02', coordinacion: 'Metepec',        codigo_recuperador: 'CALL01', nombre_recuperador: 'CALL CENTER',           dias_mora: 5,   bucket: '7',         saldo_total: 7_600,  saldo_vencido: 380,    pagos_vencidos: 1,  dias_desde_ultimo_pago: 6,   alerta: '0' },
  ]

  const filtradas = filas.filter(
    f =>
      f.dias_mora >= dias_min &&
      (!coordinacion || f.coordinacion.toLowerCase() === coordinacion.toLowerCase())
  )

  return {
    demo: 'DATOS SINTÉTICOS DE DEMOSTRACIÓN',
    fecha_corte,
    coordinacion: coordinacion ?? null,
    dias_min,
    total_morosos: 118,
    saldo_vencido_total: filtradas.reduce((s, f) => s + f.saldo_vencido, 0),
    filas_incluidas: filtradas.length,
    nota: 'Datos sintéticos de demostración; el detalle real vive en /cartera/mora.',
    creditos: filtradas,
  }
}

export function mockCohort(fecha_corte: string, frontera: string) {
  return {
    demo: 'DATOS SINTÉTICOS DE DEMOSTRACIÓN',
    fecha_corte,
    frontera,
    antes: {
      creditos: 186,
      cartera_total: 4_310_000,
      pct_mora: 51.3,
      indicadores: { pct_par_30: 34.6, pct_par_90: 18.1 },
    },
    desde: {
      creditos: 62,
      cartera_total: 1_530_000,
      pct_mora: 31.4,
      indicadores: { pct_par_30: 17.2, pct_par_90: 7.4 },
    },
    sin_fecha: 0,
  }
}
