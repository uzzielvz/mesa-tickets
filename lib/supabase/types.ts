// Tipos generados manualmente — reemplazar con `supabase gen types` cuando el schema esté en producción

export type UserRole = 'admin' | 'responsable' | 'usuario'
export type ResponseType = 'mensaje' | 'terminado_responsable' | 'terminado_usuario'
export type TicketStatus = 'abierto' | 'contestado' | 'terminado' | 'cerrado'

// Tipo para la vista tickets_with_status
export interface TicketWithStatus {
  id: string
  numero: number
  problem_catalog_id: string
  levantado_por_id: string
  responsable_id: string
  grupo: string | null
  cliente: string | null
  ciclo_cliente: string | null
  created_at: string
  closed_at: string | null
  status: TicketStatus
  area_nombre: string
  problema_nombre: string
  levantado_por_nombre: string
  responsable_nombre: string
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
          acceso_score: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      areas: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: Omit<Database['public']['Tables']['areas']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['areas']['Insert']>
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
        }
        Insert: Omit<Database['public']['Tables']['problem_catalog']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['problem_catalog']['Insert']>
      }
      tickets: {
        Row: {
          id: string
          numero: number
          problem_catalog_id: string
          levantado_por_id: string
          responsable_id: string
          grupo: string | null
          cliente: string | null
          ciclo_cliente: string | null
          created_at: string
          closed_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'numero' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>
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
        Insert: Omit<Database['public']['Tables']['ticket_responses']['Row'], 'id' | 'created_at'>
        Update: never
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
        Insert: Omit<Database['public']['Tables']['ticket_attachments']['Row'], 'id' | 'created_at'>
        Update: never
      }
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
        Insert: Omit<Database['public']['Tables']['acreditados']['Row'], 'id' | 'numero' | 'created_at' | 'updated_at' | 'contador_ediciones'>
        Update: Partial<Database['public']['Tables']['acreditados']['Insert']>
      }
      acreditado_referencias: {
        Row: {
          id: string
          acreditado_id: string
          nombre_referencia: string | null
          calidad: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['acreditado_referencias']['Row'], 'id' | 'created_at'>
        Update: never
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
        Insert: Omit<Database['public']['Tables']['acreditado_historial']['Row'], 'id' | 'created_at'>
        Update: never
      }
    Views: {
      tickets_with_status: {
        Row: Database['public']['Tables']['tickets']['Row'] & {
          status: TicketStatus
          area_nombre: string
          problema_nombre: string
          levantado_por_nombre: string
          responsable_nombre: string
          ultima_respuesta_at: string | null
        }
      }
    }
    Functions: {
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}
