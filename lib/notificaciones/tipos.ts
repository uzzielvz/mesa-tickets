/**
 * Contrato de los avisos (NTF-001): la tabla `notificaciones` y los RPCs de
 * correo. Sin 'use client': lo usan la campana, la página y las rutas.
 */

export type ModuloAviso = 'vacaciones' | 'auditor'

export interface Aviso {
  id: string
  modulo: ModuloAviso
  tipo: string
  titulo: string
  cuerpo: string | null
  /** Ruta interna a la que lleva el aviso. */
  liga: string | null
  created_at: string
  leida_at: string | null
}

/** Columnas que leen la campana y la página. */
export const COLUMNAS_AVISO = 'id, modulo, tipo, titulo, cuerpo, liga, created_at, leida_at'

export const ETIQUETA_MODULO: Record<ModuloAviso, string> = {
  vacaciones: 'Vacaciones',
  auditor: 'Auditor',
}

/** Lo que regresan `ntf_correos_por_enviar` y `ntf_correos_sistema`. */
export interface CorreoPendiente {
  id: string
  para: string
  titulo: string
  cuerpo: string | null
  liga: string | null
}

/** Lo que reciben `ntf_correo_resultado` y `ntf_resultado_sistema`. */
export interface ResultadoCorreo {
  id: string
  ok: boolean
  error?: string
}
