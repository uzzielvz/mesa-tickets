/**
 * Los campos del formato GYC (VAC012026 / DF012026) calculados UNA vez, para
 * que la página, el PDF y la verificación digan exactamente lo mismo. Puro:
 * sin React ni Supabase.
 */

import { fechaLarga, nombreClave, partesFecha } from './calendario'
import { CIUDAD, EMPRESA, type DatosFormato, type SaldoEmpleado } from './tipos'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mesa-tickets.vercel.app'
const ZONA = 'America/Mexico_City'

export interface FirmaFormato {
  rol: string
  /** Lo que va impreso bajo la línea. */
  nombre: string | null
  /** Firmada en la plataforma: quién y cuándo. Null = se firma en papel. */
  electronica: { quien: string; cuando: string } | null
}

export interface CamposFormato {
  titulo: string
  esVacaciones: boolean
  folio: number
  /** Los días vienen de una solicitud firmada en la plataforma. */
  electronico: boolean
  folioSolicitud: number | null
  codigo: string | null
  urlVerificacion: string | null
  empresa: string
  area: string | null
  numeroEmpleado: string | null
  nombre: string
  ingreso: string
  aniosServicio: number
  diasCorresponden: string | null
  diasDisfrutar: string
  diasPendientes: string | null
  periodo: string
  inicio: { dia: number; mes: string; anio: number }
  fin: { dia: number; mes: string; anio: number }
  regreso: string | null
  observaciones: string | null
  ciudad: string
  elaborado: { dia: number; mes: string; anio: number }
  firmas: FirmaFormato[]
}

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })

/** Años cumplidos entre dos fechas ISO. */
function aniosEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}

/** "13 nov 2026, 10:42" en hora de la Ciudad de México. */
export function momentoFirma(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA,
  })
}

/** "A1B2-C3D4-…": el código en grupos de 4, más fácil de dictar o comparar. */
export function codigoLegible(codigo: string): string {
  return codigo.toUpperCase().match(/.{1,4}/g)?.join('-') ?? codigo
}

export function urlVerificacion(codigo: string): string {
  return `${SITE_URL}/verificar/${codigo}`
}

/**
 * El nombre para dibujarlo como firma: si la cuenta lo trae TODO EN MAYÚSCULAS
 * (como la base de Gente y Cultura), se pasa a nombre propio; una firma en
 * mayúsculas no parece firma.
 */
export function nombreParaFirma(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio !== limpio.toUpperCase()) return limpio
  return limpio.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

export function camposFormato(d: DatosFormato): CamposFormato {
  const m = d.movimiento
  const e: SaldoEmpleado = d.empleado
  const sol = d.solicitud
  const electronico = sol !== null
  const esVacaciones = m.tipo === 'vacaciones'

  const periodo = esVacaciones ? e.periodos.find(p => p.periodo === m.periodo) : undefined
  const pendientes = periodo ? periodo.derecho - Number(d.tomados_hasta_aqui) : null
  const inicio = m.fecha_inicio!
  const elaborado = partesFecha(
    new Date(sol?.rh_at ?? m.created_at).toLocaleDateString('en-CA', { timeZone: ZONA }),
  )

  const firma = (quien: string | null | undefined, cuando: string | null | undefined, respaldo: string | null) =>
    electronico && cuando ? { quien: nombreParaFirma(quien ?? respaldo ?? ''), cuando } : null

  return {
    titulo: esVacaciones ? 'VACACIONES GYC-VAC012026' : 'DÍAS FLOTANTES GYC-DF012026',
    esVacaciones,
    folio: m.folio,
    electronico,
    folioSolicitud: sol?.folio ?? null,
    codigo: sol?.codigo_verificacion ?? null,
    urlVerificacion: sol?.codigo_verificacion ? urlVerificacion(sol.codigo_verificacion) : null,
    empresa: EMPRESA,
    area: e.area,
    numeroEmpleado: e.numero_empleado,
    nombre: e.nombre,
    ingreso: fechaLarga(e.fecha_ingreso),
    aniosServicio: aniosEntre(e.fecha_ingreso, inicio),
    diasCorresponden: periodo ? String(periodo.derecho) : null,
    diasDisfrutar: fmt(Number(m.dias)),
    diasPendientes: pendientes !== null ? fmt(pendientes) : null,
    periodo: periodo
      ? `del año ${periodo.desde.slice(0, 4)} al año ${periodo.hasta.slice(0, 4)}`
      : `año ${partesFecha(inicio).anio}`,
    inicio: partesFecha(inicio),
    fin: partesFecha(m.fecha_fin ?? inicio),
    regreso: m.fecha_regreso ? fechaLarga(m.fecha_regreso) : null,
    observaciones: m.observaciones,
    ciudad: CIUDAD,
    elaborado,
    firmas: [
      {
        rol: 'Firma de Conformidad del Empleado',
        nombre: e.nombre,
        electronica: firma(sol?.solicitada_por, sol?.created_at, e.nombre),
      },
      {
        rol: 'Firma de Autorización del Jefe directo',
        nombre: e.jefe_nombre,
        electronica: firma(sol?.jefe_por, sol?.jefe_at, e.jefe_nombre),
      },
      {
        rol: esVacaciones ? 'Vo. Bo. Recursos Humanos' : 'Vo. Bo. Coordinador Gente y Cultura',
        nombre: electronico ? sol!.rh_por : d.registrado_por,
        electronica: firma(sol?.rh_por, sol?.rh_at, null),
      },
    ],
  }
}

/** Nombre del archivo: "GYC-VAC012026_folio-12_VALDEZ-ORDONEZ-UZZIEL.pdf". */
export function nombreArchivoFormato(c: CamposFormato): string {
  const clave = c.esVacaciones ? 'GYC-VAC012026' : 'GYC-DF012026'
  const persona = nombreClave(c.nombre).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${clave}_folio-${c.folio}_${persona}.pdf`
}
