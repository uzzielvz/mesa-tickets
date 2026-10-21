/**
 * Contrato del RPC `vac_saldos` (VAC-003) y de los movimientos. Sin 'use
 * client': lo usan páginas de servidor, el formato impreso y los formularios.
 */

export interface PeriodoVacaciones {
  /** Año de servicio: el "CICLO" de la base de Excel. */
  periodo: number
  /** Del aniversario N-1 al N: el "Período a disfrutar" del formato. */
  desde: string
  hasta: string
  derecho: number
  tomados: number
  /** Lo que queda por tomar. Un periodo vencido ya no cuenta lo que no se tomó (VAC-010). */
  restantes: number
  /** Último día para tomar estos días; null si las vacaciones no vencen. */
  vence: string | null
  vencido: boolean
  /** Días que se perdieron porque el periodo venció sin tomarlos. */
  vencidos: number
}

export interface SaldoEmpleado {
  id: string
  nombre: string
  puesto: string | null
  area: string | null
  numero_empleado: string | null
  fecha_ingreso: string
  email: string | null
  jefe_id: string | null
  jefe_nombre: string | null
  activo: boolean
  en_ciclo1: boolean
  en_ciclo2: boolean
  /** Años de servicio cumplidos hoy (hora de México). */
  anios: number
  dias_trabajados: number
  proximo_aniversario: string
  dias_proximo: number
  periodos: PeriodoVacaciones[]
  restantes_total: number
  /** VAC-010: días que vencieron sin tomarse, y el siguiente vencimiento con saldo. */
  dias_vencidos: number
  proximo_vencimiento: string | null
  dias_por_vencer: number
  flotantes_anio: number
  /** Flotantes del año en solicitudes sin resolver, y el tope (null = sin tope). */
  flotantes_en_tramite: number
  flotantes_limite: number | null
  /** Días de vacaciones en solicitudes que todavía no se resuelven (VAC-004). */
  dias_en_tramite: number
}

/** Reglas de Gente y Cultura (VAC-010). Vacías = nada vence y los flotantes no tienen tope. */
export interface ReglasVacaciones {
  meses_vigencia: number | null
  vigencia_desde: string | null
  flotantes_por_anio: number | null
}

// ── Fase 2: solicitudes (VAC-004) ────────────────────────────────────────────

export type EstadoSolicitud = 'pendiente_jefe' | 'pendiente_rh' | 'aprobada' | 'rechazada' | 'cancelada'

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente_jefe: 'Espera a tu jefe',
  pendiente_rh: 'Espera Vo. Bo. de RH',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

/** Fondo y tinta por estado. Semántico, aparte del acento de la marca. */
export const TONO_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente_jefe: 'bg-[#FFF8E1] text-[#8A6100]',
  pendiente_rh: 'bg-[#E7EEF9] text-[#1A3B70]',
  aprobada: 'bg-[#E8F5E9] text-[#2E7D32]',
  rechazada: 'bg-[#FFEBEE] text-[#C62828]',
  cancelada: 'bg-[#F0F0EE] text-[#6B6B66]',
}

export interface MiContexto {
  empleado_id: string | null
  es_jefe: boolean
  pendientes_jefe: number
}

export interface MiSolicitud {
  id: string
  folio: number
  tipo: 'vacaciones' | 'flotante'
  fecha_inicio: string
  fecha_fin: string
  dias: number
  fecha_regreso: string | null
  observaciones: string | null
  estado: EstadoSolicitud
  created_at: string
  jefe_nombre: string | null
  jefe_at: string | null
  jefe_comentario: string | null
  rh_at: string | null
  rh_comentario: string | null
  /** Cuando está aprobada: el registro que abre su constancia (VAC-005). */
  movimiento_id: string | null
}

export interface MisVacaciones {
  empleado: SaldoEmpleado | null
  solicitudes?: MiSolicitud[]
  movimientos?: {
    tipo: 'vacaciones' | 'flotante'
    periodo: number | null
    dias: number
    fecha_inicio: string | null
    fecha_fin: string | null
    fechas_texto: string | null
    origen: 'importado' | 'registro_rh' | 'solicitud'
    created_at: string
  }[]
}

export interface SolicitudParaJefe {
  id: string
  folio: number
  tipo: 'vacaciones' | 'flotante'
  empleado: string
  puesto: string | null
  fecha_inicio: string
  fecha_fin: string
  dias: number
  fecha_regreso: string | null
  observaciones: string | null
  created_at: string
  disponibles: number
}

export interface BandejaJefe {
  es_jefe: boolean
  pendientes: SolicitudParaJefe[]
  resueltas: {
    id: string
    folio: number
    tipo: 'vacaciones' | 'flotante'
    empleado: string
    fecha_inicio: string
    fecha_fin: string
    dias: number
    estado: EstadoSolicitud
    jefe_at: string
    jefe_comentario: string | null
  }[]
  equipo: {
    id: string
    nombre: string
    puesto: string | null
    anios: number
    restantes: number
    proximo_aniversario: string
  }[]
}

export interface BandejaRh {
  por_vobo: {
    id: string
    folio: number
    tipo: 'vacaciones' | 'flotante'
    empleado_id: string
    empleado: string
    fecha_inicio: string
    fecha_fin: string
    dias: number
    jefe: string | null
    jefe_at: string | null
    jefe_comentario: string | null
    observaciones: string | null
    disponibles: number
  }[]
  esperando_jefe: {
    id: string
    folio: number
    empleado: string
    jefe: string | null
    fecha_inicio: string
    dias: number
    dias_esperando: number
    dias_para_inicio: number
  }[]
}

export interface Movimiento {
  id: string
  folio: number
  empleado_id: string
  tipo: 'vacaciones' | 'flotante'
  periodo: number | null
  dias: number
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_regreso: string | null
  fechas_texto: string | null
  observaciones: string | null
  origen: 'importado' | 'registro_rh' | 'solicitud'
  registrado_por: string | null
  created_at: string
  anulado_at: string | null
  /** La solicitud aprobada de la que nació, si nació de una (VAC-004). */
  solicitud_id: string | null
}

/** Datos fijos del formato GYC. */
export const EMPRESA = 'CREDIFLEXI'
export const CIUDAD = 'TOLUCA'

/**
 * El periodo al que se cargan días nuevos por defecto: el más viejo que todavía
 * tiene saldo. Es lo que hace la base de Excel (Nohemí terminó el ciclo 1 y
 * siguió con el 2).
 */
export function periodoSugerido(periodos: PeriodoVacaciones[]): number | null {
  return periodos.find(p => p.restantes > 0)?.periodo ?? periodos[periodos.length - 1]?.periodo ?? null
}

// ── Constancia, verificación y reportes (VAC-008) ───────────────────────────

/** Lo que regresa `vac_formato`: los datos del formato GYC o de su constancia. */
export interface DatosFormato {
  movimiento: Movimiento
  empleado: SaldoEmpleado
  tomados_hasta_aqui: number
  registrado_por: string | null
  /** Si los días vienen de una solicitud: las tres firmas electrónicas y el código del QR. */
  solicitud: {
    folio: number
    estado: EstadoSolicitud
    codigo_verificacion: string
    created_at: string
    solicitada_por: string | null
    jefe_at: string | null
    jefe_por: string | null
    rh_at: string | null
    rh_por: string | null
  } | null
}

/** Lo que regresa `vac_verificar`: lo que confirma la página pública del QR. */
export interface Verificacion {
  folio: number
  tipo: 'vacaciones' | 'flotante'
  empleado: string
  puesto: string | null
  fecha_inicio: string
  fecha_fin: string
  dias: number
  fecha_regreso: string | null
  estado: 'aprobada' | 'cancelada'
  cancelada_at: string | null
  firmas: { rol: string; nombre: string | null; at: string | null }[]
}

/** Lo que regresa `vac_reporte_periodo`. */
export interface ReportePeriodo {
  solicitudes: {
    folio: number
    tipo: 'vacaciones' | 'flotante'
    empleado: string
    puesto: string | null
    area: string | null
    jefe: string | null
    fecha_inicio: string
    fecha_fin: string
    dias: number
    fecha_regreso: string | null
    estado: EstadoSolicitud
    observaciones: string | null
    created_at: string
    jefe_at: string | null
    jefe_por: string | null
    jefe_comentario: string | null
    rh_at: string | null
    rh_por: string | null
    rh_comentario: string | null
    cancelada_at: string | null
  }[]
  dias_tomados: {
    folio: number
    tipo: 'vacaciones' | 'flotante'
    empleado: string
    puesto: string | null
    area: string | null
    periodo: number | null
    dias: number
    fecha_inicio: string
    fecha_fin: string | null
    fecha_regreso: string | null
    origen: 'importado' | 'registro_rh' | 'solicitud'
    observaciones: string | null
    created_at: string
    registrado_por: string | null
    folio_solicitud: number | null
  }[]
  importados_sin_fecha: number
}

/** El filtro de la lista de personal, igual en la pantalla y en el Excel. */
export type VerPersonal = 'todos' | 'pendientes' | 'inactivos'

export function leerVer(v: string | undefined | null): VerPersonal {
  return v === 'inactivos' ? 'inactivos' : v === 'pendientes' ? 'pendientes' : 'todos'
}
