// Tipos de dominio / UI escritos a mano.
// Los tipos espejo de la base de datos viven en `./database.types.ts` (autogenerados con `npm run db:types`).
// Cuando un tipo de aquí sea redundante con uno de la DB, refactorizar para derivar del generado.

export type UserRole = 'admin' | 'responsable' | 'usuario'
export type ResponseType = 'mensaje' | 'terminado_responsable' | 'terminado_usuario' | 'rechazo_responsable'
// Estado explícito del ticket (columna `tickets.estado`, enum `ticket_estado`).
// Sustituye al estatus que se derivaba de la paridad de las respuestas: ya no
// existe 'contestado' y 'terminado' se llama ahora 'resuelto'.
export type TicketStatus =
  | 'abierto'      // en la cola o recién tomado
  | 'en_revision'  // alguien lo está atendiendo
  | 'programado'   // validado, entra en la siguiente tanda
  | 'resuelto'     // el responsable terminó, falta confirmación
  | 'cerrado'
  | 'rechazado'

export type ProblemFieldType = 'text' | 'textarea' | 'number' | 'select' | 'date'

// Metadata de catálogo (TKT-023)
export type TicketPrioridad = 'alta' | 'media' | 'baja'
export type TicketModalidad = 'remoto' | 'presencial' | 'ambas'

// ── Reclutamiento (enums rec_*) ──
export type RecEtapa =
  | 'postulado' | 'en_revision' | 'viable' | 'entrevistas_agendadas'
  | 'comite' | 'final_dg' | 'oferta' | 'contratado' | 'descartado'
export type RecFuente = 'occ' | 'computrabajo' | 'linkedin' | 'factorial' | 'manual'
export type RecRevisionCv = 'viable' | 'parcial' | 'no_viable'
export type RecMotivoDescarte =
  | 'no_perfil' | 'expectativa_salarial' | 'ubicacion'
  | 'experiencia_insuficiente' | 'no_contesto' | 'declino' | 'otro'
export type RecViabilidad = 'si' | 'no' | 'filtro_dg'
export type RecEntrevistaEstado = 'programada' | 'realizada' | 'no_show' | 'cancelada'
export type RecPlantillaCodigo =
  | 'confirmacion_postulacion' | 'agendamiento_fase2' | 'notificacion_entrevistador'
  | 'pase_fase3' | 'descarte' | 'oferta' | 'informativa'
  | 'agenda_entrevistadores' | 'bienvenida_contratacion' | 'altas_nuevos_ingresos'

// Ajustes del módulo (tabla key/value rec_ajustes, REC-067).
// `dg` → { email, nombre, duracion_min }; `alta_destinatarios` → los 7 roles;
// `factorial` → { sync_activa }.
export type RecAjusteClave = 'dg' | 'alta_destinatarios' | 'factorial'
export type RecAjusteValor = Record<string, string | number | boolean>

// Entrevistador de la cascada Fase 2 (se guarda como jsonb en la sesión).
export interface RecEntrevistador {
  nombre: string
  email: string
}

export interface ProblemField {
  key: string
  label: string
  type: ProblemFieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export type TicketDatos = Record<string, string>

// Tipo para la vista tickets_with_status
export interface TicketWithStatus {
  id: string
  numero: number
  problem_catalog_id: string
  area_id: string
  levantado_por_id: string
  /** NULL mientras el ticket sigue en la cola del área, sin tomar. */
  responsable_id: string | null
  grupo: string | null
  cliente: string | null
  ciclo_cliente: string | null
  datos: TicketDatos
  created_at: string
  closed_at: string | null
  estado: TicketStatus
  status: TicketStatus
  area_nombre: string
  problema_nombre: string
  prioridad: TicketPrioridad
  sla_min: number | null
  modalidad: TicketModalidad
  /** Nombre del botón de pausa de este tipo. NULL = sin pausa. */
  etiqueta_pausa: string | null
  levantado_por_nombre: string
  /** NULL si nadie lo ha tomado. */
  responsable_nombre: string | null
  ultima_respuesta_at: string | null
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          nombre_completo: string
          rol: UserRole
          area_id: string | null
          activo: boolean
          acceso_tickets: boolean
          acceso_score: boolean
          acceso_cartera: boolean
          acceso_reclutamiento: boolean
          /** Tablero directivo de actividades (ACT-001). */
          acceso_actividades: boolean
          /** Sube los reportes de inversiones. No implica poder verlos (INV-001). */
          acceso_inversiones_carga: boolean
          /** Ve el Calendario de Pagos a Fondeadores — Tesorería (INV-001). */
          acceso_inversiones_pagos: boolean
          /** Ve el Tablero Ejecutivo de Cartera — Dirección (INV-001). */
          acceso_inversiones_desempeno: boolean
          /** Ve las colas de TODAS las áreas en la mesa (TKT-043). */
          supervisa_tickets: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          nombre_completo: string
          rol: UserRole
          area_id?: string | null
          activo?: boolean
          acceso_tickets?: boolean
          acceso_score?: boolean
          acceso_cartera?: boolean
          acceso_reclutamiento?: boolean
          acceso_actividades?: boolean
          acceso_inversiones_carga?: boolean
          acceso_inversiones_pagos?: boolean
          acceso_inversiones_desempeno?: boolean
          supervisa_tickets?: boolean
        }
        Update: {
          id?: string
          email?: string
          nombre_completo?: string
          rol?: UserRole
          area_id?: string | null
          activo?: boolean
          acceso_tickets?: boolean
          acceso_score?: boolean
          acceso_cartera?: boolean
          acceso_reclutamiento?: boolean
          acceso_actividades?: boolean
          acceso_inversiones_carga?: boolean
          acceso_inversiones_pagos?: boolean
          acceso_inversiones_desempeno?: boolean
          supervisa_tickets?: boolean
        }
        Relationships: []
      }
      areas: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          nombre: string
          activo?: boolean
        }
        Update: {
          nombre?: string
          activo?: boolean
        }
        Relationships: []
      }
      problem_catalog: {
        Row: {
          id: string
          area_id: string
          nombre: string
          leyenda: string
          responsable_default_id: string | null
          requiere_grupo: boolean
          requiere_cliente: boolean
          requiere_ciclo: boolean
          requiere_evidencia: boolean
          activo: boolean
          campos: ProblemField[]
          prioridad: TicketPrioridad
          sla_min: number | null
          modalidad: TicketModalidad
          /** Botón de pausa de este tipo (TKT-044). NULL = sin pausa. */
          etiqueta_pausa: string | null
        }
        Insert: {
          area_id: string
          nombre: string
          leyenda: string
          responsable_default_id?: string | null
          requiere_grupo?: boolean
          requiere_cliente?: boolean
          requiere_ciclo?: boolean
          requiere_evidencia?: boolean
          activo?: boolean
          campos?: ProblemField[]
          prioridad?: TicketPrioridad
          sla_min?: number | null
          modalidad?: TicketModalidad
          etiqueta_pausa?: string | null
        }
        Update: {
          area_id?: string
          nombre?: string
          leyenda?: string
          responsable_default_id?: string | null
          requiere_grupo?: boolean
          requiere_cliente?: boolean
          requiere_ciclo?: boolean
          requiere_evidencia?: boolean
          activo?: boolean
          campos?: ProblemField[]
          prioridad?: TicketPrioridad
          sla_min?: number | null
          modalidad?: TicketModalidad
          etiqueta_pausa?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          id: string
          numero: number
          problem_catalog_id: string
          area_id: string
          levantado_por_id: string
          responsable_id: string | null
          grupo: string | null
          cliente: string | null
          ciclo_cliente: string | null
          created_at: string
          closed_at: string | null
          datos: TicketDatos
          estado: TicketStatus
        }
        Insert: {
          problem_catalog_id: string
          /** Opcional: un trigger lo rellena desde el catálogo si no viene. */
          area_id?: string
          levantado_por_id: string
          /** Omitir para que el ticket nazca en la cola del área, sin dueño. */
          responsable_id?: string | null
          grupo?: string | null
          cliente?: string | null
          ciclo_cliente?: string | null
          closed_at?: string | null
          datos?: TicketDatos
          estado?: TicketStatus
        }
        Update: {
          problem_catalog_id?: string
          area_id?: string
          levantado_por_id?: string
          responsable_id?: string | null
          grupo?: string | null
          cliente?: string | null
          ciclo_cliente?: string | null
          closed_at?: string | null
          datos?: TicketDatos
          estado?: TicketStatus
        }
        Relationships: []
      }
      ticket_responses: {
        Row: {
          id: string
          ticket_id: string
          orden: number
          autor_id: string
          contenido: string
          tipo: ResponseType
          created_at: string
        }
        Insert: {
          ticket_id: string
          orden: number
          autor_id: string
          contenido: string
          tipo: ResponseType
        }
        Update: never
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          id: string
          ticket_id: string
          response_id: string | null
          storage_path: string
          nombre_original: string
          mime_type: string
          size_bytes: number
          uploaded_by_id: string
          created_at: string
        }
        Insert: {
          ticket_id: string
          response_id?: string | null
          storage_path: string
          nombre_original: string
          mime_type: string
          size_bytes: number
          uploaded_by_id: string
        }
        Update: never
        Relationships: []
      }
      // Bitácora del ticket (TKT-038). Solo escriben los triggers.
      ticket_historial: {
        Row: {
          id: string
          ticket_id: string
          actor_id: string | null
          evento: 'creado' | 'tomado' | 'devuelto' | 'reasignado' | 'cambio_estado'
          de_estado: TicketStatus | null
          a_estado: TicketStatus | null
          de_responsable_id: string | null
          a_responsable_id: string | null
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      acreditados: {
        Row: {
          id: string
          numero: number
          clave: string
          nombre_completo: string
          ciclo: string
          fecha_nacimiento: string
          tiempo_residencia: number
          antiguedad_negocio: number
          dependientes: number
          antiguedad_telefono: number
          cuenta_banco: number
          casa_habitacion: string
          estado_civil: string
          negocio_domicilio: boolean
          destino_credito: string
          automovil_propio: boolean
          buro_credito: string
          tipo_garantia: string
          tipo_negocio: string
          genero: string
          puntaje_total: number | null
          clasificacion_modelo: string | null
          calificacion_promotor: string | null
          justificacion_promotor: string | null
          promotor_id: string | null
          capturado_por_id: string
          created_at: string
          updated_at: string
          contador_ediciones: number
        }
        Insert: {
          clave: string
          nombre_completo: string
          ciclo: string
          fecha_nacimiento: string
          tiempo_residencia: number
          antiguedad_negocio: number
          dependientes: number
          antiguedad_telefono: number
          cuenta_banco: number
          casa_habitacion: string
          estado_civil: string
          negocio_domicilio: boolean
          destino_credito: string
          automovil_propio: boolean
          buro_credito: string
          tipo_garantia: string
          tipo_negocio: string
          genero: string
          puntaje_total?: number | null
          clasificacion_modelo?: string | null
          calificacion_promotor?: string | null
          justificacion_promotor?: string | null
          promotor_id?: string | null
          capturado_por_id: string
        }
        Update: {
          clave?: string
          nombre_completo?: string
          ciclo?: string
          fecha_nacimiento?: string
          tiempo_residencia?: number
          antiguedad_negocio?: number
          dependientes?: number
          antiguedad_telefono?: number
          cuenta_banco?: number
          casa_habitacion?: string
          estado_civil?: string
          negocio_domicilio?: boolean
          destino_credito?: string
          automovil_propio?: boolean
          buro_credito?: string
          tipo_garantia?: string
          tipo_negocio?: string
          genero?: string
          puntaje_total?: number | null
          clasificacion_modelo?: string | null
          calificacion_promotor?: string | null
          justificacion_promotor?: string | null
          promotor_id?: string | null
          contador_ediciones?: number
        }
        Relationships: []
      }
      acreditado_referencias: {
        Row: {
          id: string
          acreditado_id: string
          nombre_referencia: string | null
          calidad: string
          created_at: string
        }
        Insert: {
          acreditado_id: string
          nombre_referencia?: string | null
          calidad: string
        }
        Update: never
        Relationships: []
      }
      acreditado_historial: {
        Row: {
          id: string
          acreditado_id: string
          editado_por_id: string
          campo: string
          valor_antes: string | null
          valor_despues: string | null
          created_at: string
        }
        Insert: {
          acreditado_id: string
          editado_por_id: string
          campo: string
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Update: never
        Relationships: []
      }
      rec_vacantes: {
        Row: {
          id: string
          titulo: string
          area: string | null
          descripcion: string | null
          estado: 'abierta' | 'cerrada'
          creada_por_id: string | null
          created_at: string
        }
        Insert: {
          titulo: string
          area?: string | null
          descripcion?: string | null
          estado?: 'abierta' | 'cerrada'
          creada_por_id?: string | null
        }
        Update: {
          titulo?: string
          area?: string | null
          descripcion?: string | null
          estado?: 'abierta' | 'cerrada'
          creada_por_id?: string | null
        }
        Relationships: []
      }
      rec_candidatos: {
        Row: {
          id: string
          vacante_id: string
          nombre: string
          email: string | null
          telefono: string | null
          fuente: RecFuente | null
          etapa: RecEtapa
          revision_cv: RecRevisionCv | null
          viabilidad: RecViabilidad | null
          motivo_descarte: RecMotivoDescarte | null
          cv_storage_path: string | null
          notas: string | null
          notas_comite: string | null
          fecha_ingreso: string | null
          final_dg_at: string | null
          final_dg_meet_url: string | null
          factorial_employee_id: string | null
          etapa_actualizada_at: string | null
          etapa_actualizada_por: string | null
          created_at: string
        }
        Insert: {
          vacante_id: string
          nombre: string
          email?: string | null
          telefono?: string | null
          fuente?: RecFuente | null
          etapa?: RecEtapa
          revision_cv?: RecRevisionCv | null
          viabilidad?: RecViabilidad | null
          motivo_descarte?: RecMotivoDescarte | null
          cv_storage_path?: string | null
          notas?: string | null
          notas_comite?: string | null
          fecha_ingreso?: string | null
          final_dg_at?: string | null
          final_dg_meet_url?: string | null
          factorial_employee_id?: string | null
          etapa_actualizada_at?: string | null
          etapa_actualizada_por?: string | null
        }
        Update: {
          vacante_id?: string
          nombre?: string
          email?: string | null
          telefono?: string | null
          fuente?: RecFuente | null
          etapa?: RecEtapa
          revision_cv?: RecRevisionCv | null
          viabilidad?: RecViabilidad | null
          motivo_descarte?: RecMotivoDescarte | null
          cv_storage_path?: string | null
          notas?: string | null
          notas_comite?: string | null
          fecha_ingreso?: string | null
          final_dg_at?: string | null
          final_dg_meet_url?: string | null
          factorial_employee_id?: string | null
          etapa_actualizada_at?: string | null
          etapa_actualizada_por?: string | null
        }
        Relationships: []
      }
      rec_candidato_historial: {
        Row: {
          id: string
          candidato_id: string
          etapa_anterior: RecEtapa | null
          etapa_nueva: RecEtapa
          motivo_descarte: RecMotivoDescarte | null
          notas: string | null
          actor_id: string | null
          created_at: string
        }
        Insert: {
          candidato_id: string
          etapa_anterior?: RecEtapa | null
          etapa_nueva: RecEtapa
          motivo_descarte?: RecMotivoDescarte | null
          notas?: string | null
          actor_id?: string | null
        }
        Update: {
          etapa_anterior?: RecEtapa | null
          etapa_nueva?: RecEtapa
          motivo_descarte?: RecMotivoDescarte | null
          notas?: string | null
          actor_id?: string | null
        }
        Relationships: []
      }
      rec_alta_config: {
        Row: {
          candidato_id: string
          equipo: string[]
          sistemas: string[]
          otros_texto: string | null
          induccion_fecha: string | null
          induccion_meet_url: string | null
          destinatarios: Record<string, string>
          actualizado_at: string
          created_at: string
        }
        Insert: {
          candidato_id: string
          equipo?: string[]
          sistemas?: string[]
          otros_texto?: string | null
          induccion_fecha?: string | null
          induccion_meet_url?: string | null
          destinatarios?: Record<string, string>
          actualizado_at?: string
        }
        Update: {
          equipo?: string[]
          sistemas?: string[]
          otros_texto?: string | null
          induccion_fecha?: string | null
          induccion_meet_url?: string | null
          destinatarios?: Record<string, string>
          actualizado_at?: string
        }
        Relationships: []
      }
      rec_sesiones_entrevistas: {
        Row: {
          id: string
          vacante_id: string
          fase: number
          fecha: string | null
          descripcion: string | null
          creada_por_id: string | null
          hora_inicio: string | null
          duracion_bloque_min: number
          pausa_despues_de: number | null
          pausa_minutos: number | null
          entrevistadores: RecEntrevistador[] | null
          created_at: string
        }
        Insert: {
          vacante_id: string
          fase?: number
          fecha?: string | null
          descripcion?: string | null
          creada_por_id?: string | null
          hora_inicio?: string | null
          duracion_bloque_min?: number
          pausa_despues_de?: number | null
          pausa_minutos?: number | null
          entrevistadores?: RecEntrevistador[] | null
        }
        Update: {
          vacante_id?: string
          fase?: number
          fecha?: string | null
          descripcion?: string | null
          creada_por_id?: string | null
          hora_inicio?: string | null
          duracion_bloque_min?: number
          pausa_despues_de?: number | null
          pausa_minutos?: number | null
          entrevistadores?: RecEntrevistador[] | null
        }
        Relationships: []
      }
      rec_entrevistas: {
        Row: {
          id: string
          sesion_id: string
          candidato_id: string
          fecha_hora: string | null
          estado: RecEntrevistaEstado
          gcal_event_id: string | null
          meet_url: string | null
          created_at: string
        }
        Insert: {
          sesion_id: string
          candidato_id: string
          fecha_hora?: string | null
          estado?: RecEntrevistaEstado
          gcal_event_id?: string | null
          meet_url?: string | null
        }
        Update: {
          sesion_id?: string
          candidato_id?: string
          fecha_hora?: string | null
          estado?: RecEntrevistaEstado
          gcal_event_id?: string | null
          meet_url?: string | null
        }
        Relationships: []
      }
      rec_evaluaciones: {
        Row: {
          id: string
          entrevista_id: string
          entrevistador_id: string | null
          entrevistador_email: string | null
          entrevistador_nombre: string | null
          puntaje: number | null
          comentarios: string | null
          recomendacion: RecViabilidad | null
          enviada_at: string | null
          created_at: string
        }
        Insert: {
          entrevista_id: string
          entrevistador_id?: string | null
          entrevistador_email?: string | null
          entrevistador_nombre?: string | null
          puntaje?: number | null
          comentarios?: string | null
          recomendacion?: RecViabilidad | null
          enviada_at?: string | null
        }
        Update: {
          puntaje?: number | null
          comentarios?: string | null
          recomendacion?: RecViabilidad | null
          enviada_at?: string | null
        }
        Relationships: []
      }
      rec_magic_links: {
        Row: {
          id: string
          sesion_id: string
          entrevistador_id: string | null
          entrevistador_email: string | null
          entrevistador_nombre: string | null
          token: string
          expira_at: string | null
          usado_at: string | null
          created_at: string
        }
        Insert: {
          sesion_id: string
          entrevistador_id?: string | null
          entrevistador_email?: string | null
          entrevistador_nombre?: string | null
          token: string
          expira_at?: string | null
          usado_at?: string | null
        }
        Update: {
          expira_at?: string | null
          usado_at?: string | null
        }
        Relationships: []
      }
      rec_plantillas_correo: {
        Row: {
          id: string
          codigo: RecPlantillaCodigo
          asunto: string
          cuerpo: string
          activa: boolean
          cc_emails: string[]
        }
        Insert: {
          codigo: RecPlantillaCodigo
          asunto: string
          cuerpo: string
          activa?: boolean
          cc_emails?: string[]
        }
        Update: {
          codigo?: RecPlantillaCodigo
          asunto?: string
          cuerpo?: string
          activa?: boolean
          cc_emails?: string[]
        }
        Relationships: []
      }
      rec_correos_enviados: {
        Row: {
          id: string
          candidato_id: string | null
          plantilla_codigo: RecPlantillaCodigo | null
          to_email: string
          enviado_at: string
          estado: 'enviado' | 'error'
          error: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
        }
        Insert: {
          candidato_id?: string | null
          plantilla_codigo?: RecPlantillaCodigo | null
          to_email: string
          enviado_at?: string
          estado?: 'enviado' | 'error'
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
        }
        Update: {
          estado?: 'enviado' | 'error'
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
        }
        Relationships: []
      }
      rec_credenciales_google: {
        Row: {
          id: string
          profile_id: string
          refresh_token: string
          scope: string | null
          /** 'reclutamiento' | 'tickets' | 'ambos' (comodín) — TKT-046. */
          uso: string
          /** Dirección de la cuenta que autorizó (TKT-047). */
          email: string | null
          actualizado_at: string
        }
        Insert: {
          profile_id: string
          refresh_token: string
          scope?: string | null
          uso?: string
          email?: string | null
          actualizado_at?: string
        }
        Update: {
          refresh_token?: string
          scope?: string | null
          uso?: string
          email?: string | null
          actualizado_at?: string
        }
        Relationships: []
      }
      rec_ajustes: {
        Row: {
          clave: RecAjusteClave
          valor: RecAjusteValor
          actualizado_at: string
          actualizado_por: string | null
        }
        Insert: {
          clave: RecAjusteClave
          valor: RecAjusteValor
          actualizado_at?: string
          actualizado_por?: string | null
        }
        Update: {
          valor?: RecAjusteValor
          actualizado_at?: string
          actualizado_por?: string | null
        }
        Relationships: []
      }
      // Bitácora de exportaciones a CSV (REC-024). Append-only: no hay Update.
      rec_exportaciones: {
        Row: {
          id: string
          recurso: 'candidatos' | 'correos'
          filtros: Record<string, string | null>
          filas: number
          exportado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recurso: 'candidatos' | 'correos'
          filtros?: Record<string, string | null>
          filas?: number
          exportado_por?: string | null
          created_at?: string
        }
        Update: never
        Relationships: []
      }

      // ── Módulo Actividades (ACT-001) ──────────────────────────────────────
      act_cargas: {
        Row: {
          id: string
          nombre_archivo: string
          storage_path: string | null
          periodos: string[]
          registros: number
          estado: 'procesando' | 'procesado' | 'error'
          error_detalle: string | null
          subido_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre_archivo: string
          storage_path?: string | null
          periodos?: string[]
          registros?: number
          estado?: 'procesando' | 'procesado' | 'error'
          error_detalle?: string | null
          subido_por?: string | null
        }
        Update: {
          estado?: 'procesando' | 'procesado' | 'error'
          error_detalle?: string | null
          periodos?: string[]
          registros?: number
        }
        Relationships: []
      }
      act_registros: {
        Row: {
          id: number
          carga_id: string | null
          id_registro: string
          fecha: string
          periodo: string
          no_empleado: string
          nombre: string
          id_puesto: string | null
          puesto: string | null
          area: string | null
          gerencia: string | null
          direccion: string | null
          nivel_jerarquico: string | null
          id_actividad: string | null
          actividad: string | null
          id_categoria: string | null
          categoria: string | null
          minutos: number
          /** Columna generada: minutos / 60. No se escribe. */
          horas: number
          hubo_algo_relevante: boolean
          id_motivo: string | null
          motivo: string | null
          tipo_motivo: string | null
          comentario: string | null
        }
        Insert: Omit<Database['public']['Tables']['act_registros']['Row'], 'id' | 'horas'> & {
          id?: number
        }
        Update: Partial<Omit<Database['public']['Tables']['act_registros']['Row'], 'id' | 'horas'>>
        Relationships: []
      }
      act_empleados: {
        Row: {
          no_empleado: string
          nombre: string
          correo: string | null
          id_puesto: string | null
          activo: boolean
          actualizado_at: string
        }
        Insert: {
          no_empleado: string
          nombre: string
          correo?: string | null
          id_puesto?: string | null
          activo?: boolean
          actualizado_at?: string
        }
        Update: {
          nombre?: string
          correo?: string | null
          id_puesto?: string | null
          activo?: boolean
          actualizado_at?: string
        }
        Relationships: []
      }
      act_puestos: {
        Row: {
          id_puesto: string
          puesto: string
          area: string | null
          activo: boolean
          actualizado_at: string
        }
        Insert: {
          id_puesto: string
          puesto: string
          area?: string | null
          activo?: boolean
          actualizado_at?: string
        }
        Update: {
          puesto?: string
          area?: string | null
          activo?: boolean
          actualizado_at?: string
        }
        Relationships: []
      }
      /**
       * INV-001 — bitácora de cargas de los reportes de inversiones.
       * Append-only: cada carga se conserva. "Vigente" es la más reciente por
       * (tipo_reporte, periodo_inicio).
       */
      inv_cargas: {
        Row: {
          id: string
          tipo_reporte: 'calendario' | 'tablero'
          periodo_inicio: string
          periodo_fin: string
          nombre_archivo: string
          storage_path: string
          hash_archivo: string | null
          tamano_bytes: number | null
          estado: 'pendiente' | 'procesado' | 'error'
          error_detalle: string | null
          /** {hoja: texto} — la metodología que el archivo declara en sus primeras filas. */
          notas_metodologicas: Record<string, string>
          /** Hojas que llegaron con la marca SIN_DATOS. */
          hojas_degradadas: string[]
          /** Avisos de ingesta que no impiden guardar (p. ej. corte en el futuro). */
          avisos: string[]
          filas: number
          subido_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tipo_reporte: 'calendario' | 'tablero'
          periodo_inicio: string
          periodo_fin: string
          nombre_archivo: string
          storage_path: string
          hash_archivo?: string | null
          tamano_bytes?: number | null
          estado?: 'pendiente' | 'procesado' | 'error'
          error_detalle?: string | null
          notas_metodologicas?: Record<string, string>
          hojas_degradadas?: string[]
          avisos?: string[]
          filas?: number
          subido_por?: string | null
        }
        Update: {
          estado?: 'pendiente' | 'procesado' | 'error'
          error_detalle?: string | null
          notas_metodologicas?: Record<string, string>
          hojas_degradadas?: string[]
          avisos?: string[]
          filas?: number
        }
        Relationships: []
      }
      /**
       * Hechos del Calendario (INV-004). Una fila por pago programado, tal como
       * viene de la hoja `BASE MM`.
       *
       * Ojo con dos columnas que se llaman casi igual: `tipo_pago` es 'C'
       * (devolución de capital) o 'R' (rendimiento); `periodicidad` es 'Mensual'
       * o 'Al plazo'. En el archivo son TIPO_PAGO y TIPOPAGO.
       */
      inv_pagos: {
        Row: {
          id: string
          carga_id: string
          fila: number
          indice_origen: number | null
          clave: string
          monto: number
          inversionista: string | null
          fecha_pago: string | null
          dia: number | null
          tipo_pago: string | null
          universo: string | null
          forma_pago: string | null
          periodicidad: string | null
          tipo_rendimiento: string | null
          seccion: string
          nombre_cl: string | null
          banco: string | null
          clabe: string | null
          gerente_inversion: string | null
          gerente_ejecutivo: string | null
          ejecutivo: string | null
          fuente_catalogo: string | null
          /** Derivada de `seccion`: el rendimiento se capitaliza, no sale de caja. */
          capitaliza: boolean
          created_at: string
        }
        Insert: {
          id?: string
          carga_id: string
          fila: number
          indice_origen?: number | null
          clave: string
          monto?: number
          inversionista?: string | null
          fecha_pago?: string | null
          dia?: number | null
          tipo_pago?: string | null
          universo?: string | null
          forma_pago?: string | null
          periodicidad?: string | null
          tipo_rendimiento?: string | null
          seccion: string
          nombre_cl?: string | null
          banco?: string | null
          clabe?: string | null
          gerente_inversion?: string | null
          gerente_ejecutivo?: string | null
          ejecutivo?: string | null
          fuente_catalogo?: string | null
        }
        Update: never
        Relationships: []
      }
      inv_pagos_validaciones: {
        Row: {
          id: string
          carga_id: string
          fila: number
          universo: string | null
          clave: string | null
          inversionista: string | null
          observacion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          carga_id: string
          fila: number
          universo?: string | null
          clave?: string | null
          inversionista?: string | null
          observacion?: string | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: {
      // rec_candidatos + requisitos derivados (REC-068). Solo lectura.
      rec_candidato_requisitos: {
        Row: Database['public']['Tables']['rec_candidatos']['Row'] & {
          entrevistas_total: number
          evaluaciones_esperadas: number
          evaluaciones_registradas: number
          tiene_alta_config: boolean
        }
        Relationships: []
      }
      tickets_with_status: {
        Row: {
          id: string
          numero: number
          problem_catalog_id: string
          area_id: string
          levantado_por_id: string
          responsable_id: string | null
          grupo: string | null
          cliente: string | null
          ciclo_cliente: string | null
          datos: TicketDatos
          created_at: string
          closed_at: string | null
          estado: TicketStatus
          status: TicketStatus
          area_nombre: string
          problema_nombre: string
          prioridad: TicketPrioridad
          sla_min: number | null
          modalidad: TicketModalidad
          etiqueta_pausa: string | null
          levantado_por_nombre: string
          responsable_nombre: string | null
          ultima_respuesta_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      // ACT-003: KPIs y cortes del tablero de actividades. Devuelve json; el
      // contrato completo vive junto a la pantalla que lo consume.
      act_resumen: {
        Args: {
          p_periodo?: string | null
          p_direccion?: string | null
          p_gerencia?: string | null
          p_puesto?: string | null
          p_empleado?: string | null
          p_categoria?: string | null
        }
        Returns: unknown
      }
      act_detalle: {
        Args: {
          p_periodo?: string | null
          p_direccion?: string | null
          p_gerencia?: string | null
          p_puesto?: string | null
          p_empleado?: string | null
          p_categoria?: string | null
        }
        Returns: unknown
      }
      act_friccion: {
        Args: {
          p_periodo?: string | null
          p_direccion?: string | null
          p_gerencia?: string | null
          p_puesto?: string | null
          p_empleado?: string | null
          p_categoria?: string | null
          p_tipo?: string | null
        }
        Returns: unknown
      }
      has_actividades_access: {
        Args: Record<string, never>
        Returns: boolean
      }
      has_reclutamiento_access: {
        Args: Record<string, never>
        Returns: boolean
      }
      es_de_area: {
        Args: { p_area_id: string }
        Returns: boolean
      }
      // TKT-031: self-assign de un ticket de la cola del área.
      tkt_tomar_ticket: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      // TKT-032: cambio de estado controlado (valida transición y permisos).
      tkt_cambiar_estado: {
        Args: {
          p_ticket_id: string
          p_estado: TicketStatus
          p_motivo?: string | null
        }
        Returns: undefined
      }
      // TKT-002: null = devolver a la cola; uuid = pasar a alguien del área.
      tkt_reasignar_ticket: {
        Args: {
          p_ticket_id: string
          p_nuevo_responsable?: string | null
        }
        Returns: undefined
      }
      // El remitente de tickets NO está aquí: vive en variables de entorno
      // para que ningún usuario pueda cambiarlo (TKT-048).
      rec_credencial_google: {
        Args: Record<string, never>
        Returns: string | null
      }
      rec_transicion_etapa: {
        Args: {
          p_candidato_id: string
          p_etapa_destino: RecEtapa
          p_motivo_descarte?: RecMotivoDescarte | null
          p_notas?: string | null
        }
        Returns: undefined
      }
      rec_sesion_por_token: {
        Args: { p_token: string }
        Returns: unknown
      }
      rec_submit_evaluacion: {
        Args: {
          p_token: string
          p_entrevista_id: string
          p_recomendacion: RecViabilidad
          p_comentarios?: string | null
          p_puntaje?: number | null
        }
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: { [_ in never]: never }
  }
}
