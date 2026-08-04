export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acreditado_historial: {
        Row: {
          acreditado_id: string
          campo: string
          created_at: string | null
          editado_por_id: string
          id: string
          valor_antes: string | null
          valor_despues: string | null
        }
        Insert: {
          acreditado_id: string
          campo: string
          created_at?: string | null
          editado_por_id: string
          id?: string
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Update: {
          acreditado_id?: string
          campo?: string
          created_at?: string | null
          editado_por_id?: string
          id?: string
          valor_antes?: string | null
          valor_despues?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acreditado_historial_acreditado_id_fkey"
            columns: ["acreditado_id"]
            isOneToOne: false
            referencedRelation: "acreditados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acreditado_historial_editado_por_id_fkey"
            columns: ["editado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      acreditado_referencias: {
        Row: {
          acreditado_id: string
          calidad: string
          created_at: string | null
          id: string
          nombre_referencia: string | null
        }
        Insert: {
          acreditado_id: string
          calidad: string
          created_at?: string | null
          id?: string
          nombre_referencia?: string | null
        }
        Update: {
          acreditado_id?: string
          calidad?: string
          created_at?: string | null
          id?: string
          nombre_referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acreditado_referencias_acreditado_id_fkey"
            columns: ["acreditado_id"]
            isOneToOne: false
            referencedRelation: "acreditados"
            referencedColumns: ["id"]
          },
        ]
      }
      acreditados: {
        Row: {
          antiguedad_negocio: number
          antiguedad_telefono: number
          automovil_propio: boolean
          buro_credito: string
          calificacion_promotor: string | null
          capturado_por_id: string
          casa_habitacion: string
          ciclo: string
          clasificacion_modelo: string | null
          clave: string
          contador_ediciones: number | null
          created_at: string | null
          cuenta_banco: number
          dependientes: number
          destino_credito: string
          estado_civil: string
          fecha_nacimiento: string
          genero: string
          id: string
          justificacion_promotor: string | null
          negocio_domicilio: boolean
          nombre_completo: string
          numero: number
          promotor_id: string | null
          puntaje_total: number | null
          tiempo_residencia: number
          tipo_garantia: string
          tipo_negocio: string
          updated_at: string | null
        }
        Insert: {
          antiguedad_negocio: number
          antiguedad_telefono: number
          automovil_propio: boolean
          buro_credito: string
          calificacion_promotor?: string | null
          capturado_por_id: string
          casa_habitacion: string
          ciclo: string
          clasificacion_modelo?: string | null
          clave: string
          contador_ediciones?: number | null
          created_at?: string | null
          cuenta_banco: number
          dependientes: number
          destino_credito: string
          estado_civil: string
          fecha_nacimiento: string
          genero: string
          id?: string
          justificacion_promotor?: string | null
          negocio_domicilio: boolean
          nombre_completo: string
          numero?: number
          promotor_id?: string | null
          puntaje_total?: number | null
          tiempo_residencia: number
          tipo_garantia: string
          tipo_negocio: string
          updated_at?: string | null
        }
        Update: {
          antiguedad_negocio?: number
          antiguedad_telefono?: number
          automovil_propio?: boolean
          buro_credito?: string
          calificacion_promotor?: string | null
          capturado_por_id?: string
          casa_habitacion?: string
          ciclo?: string
          clasificacion_modelo?: string | null
          clave?: string
          contador_ediciones?: number | null
          created_at?: string | null
          cuenta_banco?: number
          dependientes?: number
          destino_credito?: string
          estado_civil?: string
          fecha_nacimiento?: string
          genero?: string
          id?: string
          justificacion_promotor?: string | null
          negocio_domicilio?: boolean
          nombre_completo?: string
          numero?: number
          promotor_id?: string | null
          puntaje_total?: number | null
          tiempo_residencia?: number
          tipo_garantia?: string
          tipo_negocio?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acreditados_capturado_por_id_fkey"
            columns: ["capturado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acreditados_promotor_id_fkey"
            columns: ["promotor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      cartera_uploads: {
        Row: {
          created_at: string | null
          drive_file_id: string | null
          error_detalle: string | null
          estado: string
          fecha_corte: string
          id: string
          nombre_archivo: string
          procesado_at: string | null
          procesado_por: string | null
          rows_inserted: number | null
          storage_path: string | null
          subido_por: string | null
        }
        Insert: {
          created_at?: string | null
          drive_file_id?: string | null
          error_detalle?: string | null
          estado?: string
          fecha_corte: string
          id?: string
          nombre_archivo: string
          procesado_at?: string | null
          procesado_por?: string | null
          rows_inserted?: number | null
          storage_path?: string | null
          subido_por?: string | null
        }
        Update: {
          created_at?: string | null
          drive_file_id?: string | null
          error_detalle?: string | null
          estado?: string
          fecha_corte?: string
          id?: string
          nombre_archivo?: string
          procesado_at?: string | null
          procesado_por?: string | null
          rows_inserted?: number | null
          storage_path?: string | null
          subido_por?: string | null
        }
        Relationships: []
      }
      loan_amortizacion_individual: {
        Row: {
          categoria: string | null
          ciclo: string
          codigo_acreditado: string
          codigo_ciclo: string | null
          dias_mora: number | null
          dias_mora_acumulados: number | null
          es_futura_al_corte: boolean | null
          es_no_aplica_liquidacion: boolean | null
          estatus: string | null
          fecha_completitud: string | null
          fecha_corte: string
          fecha_fin: string | null
          fecha_inicio: string | null
          fecha_limite_pago: string | null
          fuente_fecha_liquidacion: string | null
          id: number
          incremento: string | null
          monto_faltante: number | null
          monto_recibido: number | null
          numero_amortizacion: number | null
          pago_periodico: number | null
          upload_id: string | null
        }
        Insert: {
          categoria?: string | null
          ciclo: string
          codigo_acreditado: string
          codigo_ciclo?: string | null
          dias_mora?: number | null
          dias_mora_acumulados?: number | null
          es_futura_al_corte?: boolean | null
          es_no_aplica_liquidacion?: boolean | null
          estatus?: string | null
          fecha_completitud?: string | null
          fecha_corte: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_limite_pago?: string | null
          fuente_fecha_liquidacion?: string | null
          id?: number
          incremento?: string | null
          monto_faltante?: number | null
          monto_recibido?: number | null
          numero_amortizacion?: number | null
          pago_periodico?: number | null
          upload_id?: string | null
        }
        Update: {
          categoria?: string | null
          ciclo?: string
          codigo_acreditado?: string
          codigo_ciclo?: string | null
          dias_mora?: number | null
          dias_mora_acumulados?: number | null
          es_futura_al_corte?: boolean | null
          es_no_aplica_liquidacion?: boolean | null
          estatus?: string | null
          fecha_completitud?: string | null
          fecha_corte?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_limite_pago?: string | null
          fuente_fecha_liquidacion?: string | null
          id?: number
          incremento?: string | null
          monto_faltante?: number | null
          monto_recibido?: number | null
          numero_amortizacion?: number | null
          pago_periodico?: number | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_amortizacion_individual_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "cartera_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      login_presets: {
        Row: {
          acceso_reclutamiento: boolean
          acceso_score: boolean
          area_id: string | null
          email: string
          nombre_completo: string | null
          rol: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          acceso_reclutamiento?: boolean
          acceso_score?: boolean
          area_id?: string | null
          email: string
          nombre_completo?: string | null
          rol?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          acceso_reclutamiento?: boolean
          acceso_score?: boolean
          area_id?: string | null
          email?: string
          nombre_completo?: string | null
          rol?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "login_presets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_catalog: {
        Row: {
          activo: boolean
          area_id: string
          campos: Json
          id: string
          leyenda: string
          modalidad: Database["public"]["Enums"]["ticket_modalidad"]
          nombre: string
          prioridad: Database["public"]["Enums"]["ticket_prioridad"]
          requiere_ciclo: boolean
          requiere_cliente: boolean
          requiere_evidencia: boolean
          requiere_grupo: boolean
          responsable_default_id: string | null
          sla_min: number | null
        }
        Insert: {
          activo?: boolean
          area_id: string
          campos?: Json
          id?: string
          leyenda: string
          modalidad?: Database["public"]["Enums"]["ticket_modalidad"]
          nombre: string
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
          requiere_ciclo?: boolean
          requiere_cliente?: boolean
          requiere_evidencia?: boolean
          requiere_grupo?: boolean
          responsable_default_id?: string | null
          sla_min?: number | null
        }
        Update: {
          activo?: boolean
          area_id?: string
          campos?: Json
          id?: string
          leyenda?: string
          modalidad?: Database["public"]["Enums"]["ticket_modalidad"]
          nombre?: string
          prioridad?: Database["public"]["Enums"]["ticket_prioridad"]
          requiere_ciclo?: boolean
          requiere_cliente?: boolean
          requiere_evidencia?: boolean
          requiere_grupo?: boolean
          responsable_default_id?: string | null
          sla_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_catalog_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_catalog_responsable_default_id_fkey"
            columns: ["responsable_default_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acceso_cartera: boolean
          acceso_reclutamiento: boolean
          acceso_score: boolean | null
          acceso_tickets: boolean
          activo: boolean
          area_id: string | null
          created_at: string
          email: string
          id: string
          nombre_completo: string
          rol: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          acceso_cartera?: boolean
          acceso_reclutamiento?: boolean
          acceso_score?: boolean | null
          acceso_tickets?: boolean
          activo?: boolean
          area_id?: string | null
          created_at?: string
          email: string
          id: string
          nombre_completo: string
          rol?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          acceso_cartera?: boolean
          acceso_reclutamiento?: boolean
          acceso_score?: boolean | null
          acceso_tickets?: boolean
          activo?: boolean
          area_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre_completo?: string
          rol?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_ajustes: {
        Row: {
          actualizado_at: string
          actualizado_por: string | null
          clave: string
          valor: Json
        }
        Insert: {
          actualizado_at?: string
          actualizado_por?: string | null
          clave: string
          valor: Json
        }
        Update: {
          actualizado_at?: string
          actualizado_por?: string | null
          clave?: string
          valor?: Json
        }
        Relationships: []
      }
      rec_alta_config: {
        Row: {
          actualizado_at: string
          candidato_id: string
          created_at: string
          destinatarios: Json
          equipo: Json
          induccion_fecha: string | null
          induccion_meet_url: string | null
          otros_texto: string | null
          sistemas: Json
        }
        Insert: {
          actualizado_at?: string
          candidato_id: string
          created_at?: string
          destinatarios?: Json
          equipo?: Json
          induccion_fecha?: string | null
          induccion_meet_url?: string | null
          otros_texto?: string | null
          sistemas?: Json
        }
        Update: {
          actualizado_at?: string
          candidato_id?: string
          created_at?: string
          destinatarios?: Json
          equipo?: Json
          induccion_fecha?: string | null
          induccion_meet_url?: string | null
          otros_texto?: string | null
          sistemas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rec_alta_config_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: true
            referencedRelation: "rec_candidato_requisitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_alta_config_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: true
            referencedRelation: "rec_candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_candidato_historial: {
        Row: {
          actor_id: string | null
          candidato_id: string
          created_at: string
          etapa_anterior: Database["public"]["Enums"]["rec_etapa"] | null
          etapa_nueva: Database["public"]["Enums"]["rec_etapa"]
          id: string
          motivo_descarte:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          notas: string | null
        }
        Insert: {
          actor_id?: string | null
          candidato_id: string
          created_at?: string
          etapa_anterior?: Database["public"]["Enums"]["rec_etapa"] | null
          etapa_nueva: Database["public"]["Enums"]["rec_etapa"]
          id?: string
          motivo_descarte?:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          notas?: string | null
        }
        Update: {
          actor_id?: string | null
          candidato_id?: string
          created_at?: string
          etapa_anterior?: Database["public"]["Enums"]["rec_etapa"] | null
          etapa_nueva?: Database["public"]["Enums"]["rec_etapa"]
          id?: string
          motivo_descarte?:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_candidato_historial_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_candidato_historial_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidato_requisitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_candidato_historial_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_candidatos: {
        Row: {
          created_at: string
          cv_storage_path: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["rec_etapa"]
          etapa_actualizada_at: string | null
          etapa_actualizada_por: string | null
          factorial_employee_id: string | null
          fecha_ingreso: string | null
          final_dg_at: string | null
          final_dg_meet_url: string | null
          fuente: Database["public"]["Enums"]["rec_fuente"] | null
          id: string
          motivo_descarte:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          nombre: string
          notas: string | null
          notas_comite: string | null
          revision_cv: Database["public"]["Enums"]["rec_revision_cv"] | null
          telefono: string | null
          vacante_id: string
          viabilidad: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Insert: {
          created_at?: string
          cv_storage_path?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["rec_etapa"]
          etapa_actualizada_at?: string | null
          etapa_actualizada_por?: string | null
          factorial_employee_id?: string | null
          fecha_ingreso?: string | null
          final_dg_at?: string | null
          final_dg_meet_url?: string | null
          fuente?: Database["public"]["Enums"]["rec_fuente"] | null
          id?: string
          motivo_descarte?:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          nombre: string
          notas?: string | null
          notas_comite?: string | null
          revision_cv?: Database["public"]["Enums"]["rec_revision_cv"] | null
          telefono?: string | null
          vacante_id: string
          viabilidad?: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Update: {
          created_at?: string
          cv_storage_path?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["rec_etapa"]
          etapa_actualizada_at?: string | null
          etapa_actualizada_por?: string | null
          factorial_employee_id?: string | null
          fecha_ingreso?: string | null
          final_dg_at?: string | null
          final_dg_meet_url?: string | null
          fuente?: Database["public"]["Enums"]["rec_fuente"] | null
          id?: string
          motivo_descarte?:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          nombre?: string
          notas?: string | null
          notas_comite?: string | null
          revision_cv?: Database["public"]["Enums"]["rec_revision_cv"] | null
          telefono?: string | null
          vacante_id?: string
          viabilidad?: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_candidatos_etapa_actualizada_por_fkey"
            columns: ["etapa_actualizada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_candidatos_vacante_id_fkey"
            columns: ["vacante_id"]
            isOneToOne: false
            referencedRelation: "rec_vacantes"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_correos_enviados: {
        Row: {
          candidato_id: string | null
          enviado_at: string
          error: string | null
          estado: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          plantilla_codigo:
            | Database["public"]["Enums"]["rec_plantilla_codigo"]
            | null
          to_email: string
        }
        Insert: {
          candidato_id?: string | null
          enviado_at?: string
          error?: string | null
          estado?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          plantilla_codigo?:
            | Database["public"]["Enums"]["rec_plantilla_codigo"]
            | null
          to_email: string
        }
        Update: {
          candidato_id?: string | null
          enviado_at?: string
          error?: string | null
          estado?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          plantilla_codigo?:
            | Database["public"]["Enums"]["rec_plantilla_codigo"]
            | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "rec_correos_enviados_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidato_requisitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_correos_enviados_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_credenciales_google: {
        Row: {
          actualizado_at: string
          id: string
          profile_id: string
          refresh_token: string
          scope: string | null
        }
        Insert: {
          actualizado_at?: string
          id?: string
          profile_id: string
          refresh_token: string
          scope?: string | null
        }
        Update: {
          actualizado_at?: string
          id?: string
          profile_id?: string
          refresh_token?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_credenciales_google_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_entrevistas: {
        Row: {
          candidato_id: string
          created_at: string
          estado: Database["public"]["Enums"]["rec_entrevista_estado"]
          fecha_hora: string | null
          gcal_event_id: string | null
          id: string
          meet_url: string | null
          sesion_id: string
        }
        Insert: {
          candidato_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["rec_entrevista_estado"]
          fecha_hora?: string | null
          gcal_event_id?: string | null
          id?: string
          meet_url?: string | null
          sesion_id: string
        }
        Update: {
          candidato_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["rec_entrevista_estado"]
          fecha_hora?: string | null
          gcal_event_id?: string | null
          id?: string
          meet_url?: string | null
          sesion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rec_entrevistas_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidato_requisitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_entrevistas_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "rec_candidatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_entrevistas_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "rec_sesiones_entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_evaluaciones: {
        Row: {
          comentarios: string | null
          created_at: string
          entrevista_id: string
          entrevistador_email: string | null
          entrevistador_id: string | null
          entrevistador_nombre: string | null
          enviada_at: string | null
          id: string
          puntaje: number | null
          recomendacion: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Insert: {
          comentarios?: string | null
          created_at?: string
          entrevista_id: string
          entrevistador_email?: string | null
          entrevistador_id?: string | null
          entrevistador_nombre?: string | null
          enviada_at?: string | null
          id?: string
          puntaje?: number | null
          recomendacion?: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Update: {
          comentarios?: string | null
          created_at?: string
          entrevista_id?: string
          entrevistador_email?: string | null
          entrevistador_id?: string | null
          entrevistador_nombre?: string | null
          enviada_at?: string | null
          id?: string
          puntaje?: number | null
          recomendacion?: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_evaluaciones_entrevista_id_fkey"
            columns: ["entrevista_id"]
            isOneToOne: false
            referencedRelation: "rec_entrevistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_evaluaciones_entrevistador_id_fkey"
            columns: ["entrevistador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_magic_links: {
        Row: {
          created_at: string
          entrevistador_email: string | null
          entrevistador_id: string | null
          entrevistador_nombre: string | null
          expira_at: string | null
          id: string
          sesion_id: string
          token: string
          usado_at: string | null
        }
        Insert: {
          created_at?: string
          entrevistador_email?: string | null
          entrevistador_id?: string | null
          entrevistador_nombre?: string | null
          expira_at?: string | null
          id?: string
          sesion_id: string
          token: string
          usado_at?: string | null
        }
        Update: {
          created_at?: string
          entrevistador_email?: string | null
          entrevistador_id?: string | null
          entrevistador_nombre?: string | null
          expira_at?: string | null
          id?: string
          sesion_id?: string
          token?: string
          usado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_magic_links_entrevistador_id_fkey"
            columns: ["entrevistador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_magic_links_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "rec_sesiones_entrevistas"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_plantillas_correo: {
        Row: {
          activa: boolean
          asunto: string
          cc_emails: Json
          codigo: Database["public"]["Enums"]["rec_plantilla_codigo"]
          cuerpo: string
          id: string
        }
        Insert: {
          activa?: boolean
          asunto: string
          cc_emails?: Json
          codigo: Database["public"]["Enums"]["rec_plantilla_codigo"]
          cuerpo: string
          id?: string
        }
        Update: {
          activa?: boolean
          asunto?: string
          cc_emails?: Json
          codigo?: Database["public"]["Enums"]["rec_plantilla_codigo"]
          cuerpo?: string
          id?: string
        }
        Relationships: []
      }
      rec_sesiones_entrevistas: {
        Row: {
          creada_por_id: string | null
          created_at: string
          descripcion: string | null
          duracion_bloque_min: number
          entrevistadores: Json | null
          fase: number
          fecha: string | null
          hora_inicio: string | null
          id: string
          pausa_despues_de: number | null
          pausa_minutos: number | null
          vacante_id: string
        }
        Insert: {
          creada_por_id?: string | null
          created_at?: string
          descripcion?: string | null
          duracion_bloque_min?: number
          entrevistadores?: Json | null
          fase?: number
          fecha?: string | null
          hora_inicio?: string | null
          id?: string
          pausa_despues_de?: number | null
          pausa_minutos?: number | null
          vacante_id: string
        }
        Update: {
          creada_por_id?: string | null
          created_at?: string
          descripcion?: string | null
          duracion_bloque_min?: number
          entrevistadores?: Json | null
          fase?: number
          fecha?: string | null
          hora_inicio?: string | null
          id?: string
          pausa_despues_de?: number | null
          pausa_minutos?: number | null
          vacante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rec_sesiones_entrevistas_vacante_id_fkey"
            columns: ["vacante_id"]
            isOneToOne: false
            referencedRelation: "rec_vacantes"
            referencedColumns: ["id"]
          },
        ]
      }
      rec_vacantes: {
        Row: {
          area: string | null
          creada_por_id: string | null
          created_at: string
          descripcion: string | null
          estado: string
          id: string
          titulo: string
        }
        Insert: {
          area?: string | null
          creada_por_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          titulo: string
        }
        Update: {
          area?: string | null
          creada_por_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      stg_yunius_cartera_individual: {
        Row: {
          actividad_economica_pld: string | null
          alerta: string | null
          calle: string | null
          cantidad_entregada: number | null
          cantidad_prestada: number | null
          castigado_cartera: boolean | null
          ciclo: string
          cod_actividad_pld: string | null
          cod_producto: string | null
          codigo_acreditado: string
          codigo_promotor: string | null
          codigo_recuperador: string | null
          colonia: string | null
          combinado: number | null
          comision_a_pagar: number | null
          concepto_deposito: string | null
          coordinacion: string | null
          criticidad: string | null
          cuotas_sin_pagar: number | null
          descripcion_garantia_1: string | null
          descripcion_garantia_2: string | null
          dias_desde_ultimo_pago: number | null
          dias_mora: number | null
          entidad_federativa: string | null
          fecha_corte: string
          fecha_fin_ciclo: string | null
          fecha_inicio_ciclo: string | null
          fecha_ultimo_pago: string | null
          forma_de_entrega: string | null
          frecuencia: string | null
          garantia_1: string | null
          garantia_2: string | null
          geolocalizacion: string | null
          id: number
          interes_moratorio: number | null
          medio_comunic_1: string | null
          medio_comunic_2: string | null
          medio_comunic_3: string | null
          monto_ultimo_pago: number | null
          municipio: string | null
          nom_personal_castiga_cartera: string | null
          nom_producto: string | null
          nom_region: string | null
          nombre_acreditado: string | null
          nombre_conyuge: string | null
          nombre_promotor: string | null
          nombre_recuperador: string | null
          nombre_ref1: string | null
          nombre_ref2: string | null
          nombre_ref3: string | null
          pagos_vencidos: number | null
          par_bucket: string | null
          parcialidad: number | null
          parcialidad_comision: number | null
          pct_mora: number | null
          periodicidad: string | null
          periodos_vencidos: number | null
          plazo_credito: number | null
          saldo_adelantado: number | null
          saldo_capital: number | null
          saldo_capital_vencido: number | null
          saldo_comision_vencida: number | null
          saldo_interes_vencido: number | null
          saldo_recargos: number | null
          saldo_riesgo_capital: number | null
          saldo_riesgo_total: number | null
          saldo_total: number | null
          saldo_vencido: number | null
          situacion_credito: string | null
          telefono_conyuge: string | null
          telefono_ref1: string | null
          telefono_ref2: string | null
          telefono_ref3: string | null
          tipo_garantia_1: string | null
          tipo_garantia_2: string | null
          upload_id: string | null
        }
        Insert: {
          actividad_economica_pld?: string | null
          alerta?: string | null
          calle?: string | null
          cantidad_entregada?: number | null
          cantidad_prestada?: number | null
          castigado_cartera?: boolean | null
          ciclo: string
          cod_actividad_pld?: string | null
          cod_producto?: string | null
          codigo_acreditado: string
          codigo_promotor?: string | null
          codigo_recuperador?: string | null
          colonia?: string | null
          combinado?: number | null
          comision_a_pagar?: number | null
          concepto_deposito?: string | null
          coordinacion?: string | null
          criticidad?: string | null
          cuotas_sin_pagar?: number | null
          descripcion_garantia_1?: string | null
          descripcion_garantia_2?: string | null
          dias_desde_ultimo_pago?: number | null
          dias_mora?: number | null
          entidad_federativa?: string | null
          fecha_corte: string
          fecha_fin_ciclo?: string | null
          fecha_inicio_ciclo?: string | null
          fecha_ultimo_pago?: string | null
          forma_de_entrega?: string | null
          frecuencia?: string | null
          garantia_1?: string | null
          garantia_2?: string | null
          geolocalizacion?: string | null
          id?: number
          interes_moratorio?: number | null
          medio_comunic_1?: string | null
          medio_comunic_2?: string | null
          medio_comunic_3?: string | null
          monto_ultimo_pago?: number | null
          municipio?: string | null
          nom_personal_castiga_cartera?: string | null
          nom_producto?: string | null
          nom_region?: string | null
          nombre_acreditado?: string | null
          nombre_conyuge?: string | null
          nombre_promotor?: string | null
          nombre_recuperador?: string | null
          nombre_ref1?: string | null
          nombre_ref2?: string | null
          nombre_ref3?: string | null
          pagos_vencidos?: number | null
          par_bucket?: string | null
          parcialidad?: number | null
          parcialidad_comision?: number | null
          pct_mora?: number | null
          periodicidad?: string | null
          periodos_vencidos?: number | null
          plazo_credito?: number | null
          saldo_adelantado?: number | null
          saldo_capital?: number | null
          saldo_capital_vencido?: number | null
          saldo_comision_vencida?: number | null
          saldo_interes_vencido?: number | null
          saldo_recargos?: number | null
          saldo_riesgo_capital?: number | null
          saldo_riesgo_total?: number | null
          saldo_total?: number | null
          saldo_vencido?: number | null
          situacion_credito?: string | null
          telefono_conyuge?: string | null
          telefono_ref1?: string | null
          telefono_ref2?: string | null
          telefono_ref3?: string | null
          tipo_garantia_1?: string | null
          tipo_garantia_2?: string | null
          upload_id?: string | null
        }
        Update: {
          actividad_economica_pld?: string | null
          alerta?: string | null
          calle?: string | null
          cantidad_entregada?: number | null
          cantidad_prestada?: number | null
          castigado_cartera?: boolean | null
          ciclo?: string
          cod_actividad_pld?: string | null
          cod_producto?: string | null
          codigo_acreditado?: string
          codigo_promotor?: string | null
          codigo_recuperador?: string | null
          colonia?: string | null
          combinado?: number | null
          comision_a_pagar?: number | null
          concepto_deposito?: string | null
          coordinacion?: string | null
          criticidad?: string | null
          cuotas_sin_pagar?: number | null
          descripcion_garantia_1?: string | null
          descripcion_garantia_2?: string | null
          dias_desde_ultimo_pago?: number | null
          dias_mora?: number | null
          entidad_federativa?: string | null
          fecha_corte?: string
          fecha_fin_ciclo?: string | null
          fecha_inicio_ciclo?: string | null
          fecha_ultimo_pago?: string | null
          forma_de_entrega?: string | null
          frecuencia?: string | null
          garantia_1?: string | null
          garantia_2?: string | null
          geolocalizacion?: string | null
          id?: number
          interes_moratorio?: number | null
          medio_comunic_1?: string | null
          medio_comunic_2?: string | null
          medio_comunic_3?: string | null
          monto_ultimo_pago?: number | null
          municipio?: string | null
          nom_personal_castiga_cartera?: string | null
          nom_producto?: string | null
          nom_region?: string | null
          nombre_acreditado?: string | null
          nombre_conyuge?: string | null
          nombre_promotor?: string | null
          nombre_recuperador?: string | null
          nombre_ref1?: string | null
          nombre_ref2?: string | null
          nombre_ref3?: string | null
          pagos_vencidos?: number | null
          par_bucket?: string | null
          parcialidad?: number | null
          parcialidad_comision?: number | null
          pct_mora?: number | null
          periodicidad?: string | null
          periodos_vencidos?: number | null
          plazo_credito?: number | null
          saldo_adelantado?: number | null
          saldo_capital?: number | null
          saldo_capital_vencido?: number | null
          saldo_comision_vencida?: number | null
          saldo_interes_vencido?: number | null
          saldo_recargos?: number | null
          saldo_riesgo_capital?: number | null
          saldo_riesgo_total?: number | null
          saldo_total?: number | null
          saldo_vencido?: number | null
          situacion_credito?: string | null
          telefono_conyuge?: string | null
          telefono_ref1?: string | null
          telefono_ref2?: string | null
          telefono_ref3?: string | null
          tipo_garantia_1?: string | null
          tipo_garantia_2?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stg_yunius_cartera_individual_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "cartera_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          nombre_original: string
          response_id: string | null
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          nombre_original: string
          response_id?: string | null
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          nombre_original?: string
          response_id?: string | null
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploaded_by_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "ticket_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_responses: {
        Row: {
          autor_id: string
          contenido: string
          created_at: string
          id: string
          orden: number
          ticket_id: string
          tipo: Database["public"]["Enums"]["response_type"]
        }
        Insert: {
          autor_id: string
          contenido: string
          created_at?: string
          id?: string
          orden: number
          ticket_id: string
          tipo?: Database["public"]["Enums"]["response_type"]
        }
        Update: {
          autor_id?: string
          contenido?: string
          created_at?: string
          id?: string
          orden?: number
          ticket_id?: string
          tipo?: Database["public"]["Enums"]["response_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ticket_responses_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          ciclo_cliente: string | null
          cliente: string | null
          closed_at: string | null
          created_at: string
          datos: Json
          grupo: string | null
          id: string
          levantado_por_id: string
          numero: number
          problem_catalog_id: string
          responsable_id: string
        }
        Insert: {
          ciclo_cliente?: string | null
          cliente?: string | null
          closed_at?: string | null
          created_at?: string
          datos?: Json
          grupo?: string | null
          id?: string
          levantado_por_id: string
          numero?: number
          problem_catalog_id: string
          responsable_id: string
        }
        Update: {
          ciclo_cliente?: string | null
          cliente?: string | null
          closed_at?: string | null
          created_at?: string
          datos?: Json
          grupo?: string | null
          id?: string
          levantado_por_id?: string
          numero?: number
          problem_catalog_id?: string
          responsable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_levantado_por_id_fkey"
            columns: ["levantado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_problem_catalog_id_fkey"
            columns: ["problem_catalog_id"]
            isOneToOne: false
            referencedRelation: "problem_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rec_candidato_requisitos: {
        Row: {
          created_at: string | null
          cv_storage_path: string | null
          email: string | null
          entrevistas_total: number | null
          etapa: Database["public"]["Enums"]["rec_etapa"] | null
          etapa_actualizada_at: string | null
          etapa_actualizada_por: string | null
          evaluaciones_esperadas: number | null
          evaluaciones_registradas: number | null
          fecha_ingreso: string | null
          final_dg_at: string | null
          final_dg_meet_url: string | null
          fuente: Database["public"]["Enums"]["rec_fuente"] | null
          id: string | null
          motivo_descarte:
            | Database["public"]["Enums"]["rec_motivo_descarte"]
            | null
          nombre: string | null
          notas: string | null
          notas_comite: string | null
          revision_cv: Database["public"]["Enums"]["rec_revision_cv"] | null
          telefono: string | null
          tiene_alta_config: boolean | null
          vacante_id: string | null
          viabilidad: Database["public"]["Enums"]["rec_viabilidad"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rec_candidatos_etapa_actualizada_por_fkey"
            columns: ["etapa_actualizada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rec_candidatos_vacante_id_fkey"
            columns: ["vacante_id"]
            isOneToOne: false
            referencedRelation: "rec_vacantes"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_with_status: {
        Row: {
          area_nombre: string | null
          ciclo_cliente: string | null
          cliente: string | null
          closed_at: string | null
          created_at: string | null
          datos: Json | null
          grupo: string | null
          id: string | null
          levantado_por_id: string | null
          levantado_por_nombre: string | null
          modalidad: Database["public"]["Enums"]["ticket_modalidad"] | null
          numero: number | null
          prioridad: Database["public"]["Enums"]["ticket_prioridad"] | null
          problem_catalog_id: string | null
          problema_nombre: string | null
          responsable_id: string | null
          responsable_nombre: string | null
          sla_min: number | null
          status: string | null
          ultima_respuesta_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_levantado_por_id_fkey"
            columns: ["levantado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_problem_catalog_id_fkey"
            columns: ["problem_catalog_id"]
            isOneToOne: false
            referencedRelation: "problem_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cartera_cohort: {
        Args: { p_fecha_corte: string; p_frontera?: string }
        Returns: Json
      }
      cartera_filtros: { Args: { p_fecha_corte: string }; Returns: Json }
      cartera_mora_operativa: {
        Args: {
          p_coordinacion?: string
          p_dias_min?: number
          p_fecha_corte: string
        }
        Returns: Json
      }
      cartera_por_coordinacion: {
        Args: { p_fecha_corte: string }
        Returns: Json
      }
      cartera_por_recuperador: {
        Args: { p_coordinacion?: string; p_fecha_corte: string }
        Returns: Json
      }
      cartera_resumen: {
        Args: {
          p_ciclo?: string
          p_codigo_recuperador?: string
          p_coordinacion?: string
          p_fecha_corte: string
        }
        Returns: Json
      }
      guardar_evaluacion_promotor: {
        Args: {
          p_acreditado_id: string
          p_calificacion: string
          p_justificacion: string
        }
        Returns: undefined
      }
      has_cartera_access: { Args: never; Returns: boolean }
      has_reclutamiento_access: { Args: never; Returns: boolean }
      has_score_access: { Args: never; Returns: boolean }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      next_response_order: { Args: { p_ticket_id: string }; Returns: number }
      rec_sesion_por_token: { Args: { p_token: string }; Returns: Json }
      rec_submit_evaluacion: {
        Args: {
          p_comentarios?: string
          p_entrevista_id: string
          p_puntaje?: number
          p_recomendacion: Database["public"]["Enums"]["rec_viabilidad"]
          p_token: string
        }
        Returns: Json
      }
      rec_transicion_etapa: {
        Args: {
          p_candidato_id: string
          p_etapa_destino: Database["public"]["Enums"]["rec_etapa"]
          p_motivo_descarte?: Database["public"]["Enums"]["rec_motivo_descarte"]
          p_notas?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      rec_entrevista_estado:
        | "programada"
        | "realizada"
        | "no_show"
        | "cancelada"
      rec_etapa:
        | "postulado"
        | "en_revision"
        | "viable"
        | "entrevistas_agendadas"
        | "comite"
        | "final_dg"
        | "oferta"
        | "contratado"
        | "descartado"
      rec_fuente: "occ" | "computrabajo" | "linkedin" | "factorial" | "manual"
      rec_motivo_descarte:
        | "no_perfil"
        | "expectativa_salarial"
        | "ubicacion"
        | "experiencia_insuficiente"
        | "no_contesto"
        | "declino"
        | "otro"
      rec_plantilla_codigo:
        | "confirmacion_postulacion"
        | "agendamiento_fase2"
        | "notificacion_entrevistador"
        | "pase_fase3"
        | "descarte"
        | "oferta"
        | "informativa"
        | "agenda_entrevistadores"
        | "bienvenida_contratacion"
        | "altas_nuevos_ingresos"
      rec_revision_cv: "viable" | "parcial" | "no_viable"
      rec_viabilidad: "si" | "no" | "filtro_dg"
      response_type:
        | "mensaje"
        | "terminado_responsable"
        | "terminado_usuario"
        | "rechazo_responsable"
      ticket_modalidad: "remoto" | "presencial" | "ambas"
      ticket_prioridad: "alta" | "media" | "baja"
      user_role: "admin" | "responsable" | "usuario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      rec_entrevista_estado: [
        "programada",
        "realizada",
        "no_show",
        "cancelada",
      ],
      rec_etapa: [
        "postulado",
        "en_revision",
        "viable",
        "entrevistas_agendadas",
        "comite",
        "final_dg",
        "oferta",
        "contratado",
        "descartado",
      ],
      rec_fuente: ["occ", "computrabajo", "linkedin", "factorial", "manual"],
      rec_motivo_descarte: [
        "no_perfil",
        "expectativa_salarial",
        "ubicacion",
        "experiencia_insuficiente",
        "no_contesto",
        "declino",
        "otro",
      ],
      rec_plantilla_codigo: [
        "confirmacion_postulacion",
        "agendamiento_fase2",
        "notificacion_entrevistador",
        "pase_fase3",
        "descarte",
        "oferta",
        "informativa",
        "agenda_entrevistadores",
        "bienvenida_contratacion",
        "altas_nuevos_ingresos",
      ],
      rec_revision_cv: ["viable", "parcial", "no_viable"],
      rec_viabilidad: ["si", "no", "filtro_dg"],
      response_type: [
        "mensaje",
        "terminado_responsable",
        "terminado_usuario",
        "rechazo_responsable",
      ],
      ticket_modalidad: ["remoto", "presencial", "ambas"],
      ticket_prioridad: ["alta", "media", "baja"],
      user_role: ["admin", "responsable", "usuario"],
    },
  },
} as const
