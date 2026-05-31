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
          acceso_score: boolean
          area_id: string | null
          email: string
          nombre_completo: string | null
          rol: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          acceso_score?: boolean
          area_id?: string | null
          email: string
          nombre_completo?: string | null
          rol?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
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
          nombre: string
          requiere_ciclo: boolean
          requiere_cliente: boolean
          requiere_evidencia: boolean
          requiere_grupo: boolean
          responsable_default_id: string | null
        }
        Insert: {
          activo?: boolean
          area_id: string
          campos?: Json
          id?: string
          leyenda: string
          nombre: string
          requiere_ciclo?: boolean
          requiere_cliente?: boolean
          requiere_evidencia?: boolean
          requiere_grupo?: boolean
          responsable_default_id?: string | null
        }
        Update: {
          activo?: boolean
          area_id?: string
          campos?: Json
          id?: string
          leyenda?: string
          nombre?: string
          requiere_ciclo?: boolean
          requiere_cliente?: boolean
          requiere_evidencia?: boolean
          requiere_grupo?: boolean
          responsable_default_id?: string | null
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
          acceso_score: boolean | null
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
          acceso_score?: boolean | null
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
          acceso_score?: boolean | null
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
          numero: number | null
          problem_catalog_id: string | null
          problema_nombre: string | null
          responsable_id: string | null
          responsable_nombre: string | null
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
      cartera_filtros: { Args: { p_fecha_corte: string }; Returns: Json }
      cartera_resumen: {
        Args: {
          p_ciclo?: string
          p_codigo_recuperador?: string
          p_coordinacion?: string
          p_fecha_corte: string
        }
        Returns: Json
      }
      complete_onboarding: {
        Args: { p_area_id: string; p_nombre: string }
        Returns: undefined
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
      has_score_access: { Args: never; Returns: boolean }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      next_response_order: { Args: { p_ticket_id: string }; Returns: number }
    }
    Enums: {
      response_type:
        | "mensaje"
        | "terminado_responsable"
        | "terminado_usuario"
        | "rechazo_responsable"
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
      response_type: [
        "mensaje",
        "terminado_responsable",
        "terminado_usuario",
        "rechazo_responsable",
      ],
      user_role: ["admin", "responsable", "usuario"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.102.0 (currently installed v2.101.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
