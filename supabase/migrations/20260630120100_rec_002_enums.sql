-- REC-002 — Enums del módulo Reclutamiento (prefijo rec_).
-- Ver PLAN.md §8.2.

-- Etapa del candidato en el pipeline. 'descartado' es terminal desde cualquier etapa.
create type rec_etapa as enum (
  'postulado',
  'en_revision',
  'viable',
  'entrevistas_agendadas',
  'comite',
  'final_dg',
  'oferta',
  'contratado',
  'descartado'
);

-- Fuente/plataforma de la que llegó el candidato.
create type rec_fuente as enum (
  'occ',
  'computrabajo',
  'linkedin',
  'factorial',
  'manual'
);

-- Resultado de la revisión inicial del CV.
create type rec_revision_cv as enum (
  'viable',
  'parcial',
  'no_viable'
);

-- Motivo de descarte (tags).
create type rec_motivo_descarte as enum (
  'no_perfil',
  'expectativa_salarial',
  'ubicacion',
  'experiencia_insuficiente',
  'no_contesto',
  'declino',
  'otro'
);

-- Voto de viabilidad de un entrevistador / del comité.
-- 'filtro_dg' = no votaría sí, pero quiere que el DG lo vea.
create type rec_viabilidad as enum (
  'si',
  'no',
  'filtro_dg'
);

-- Estado de una cita de entrevista.
create type rec_entrevista_estado as enum (
  'programada',
  'realizada',
  'no_show',
  'cancelada'
);

-- Código de plantilla de correo. '{{magic_link}}' es exclusivo de notificacion_entrevistador.
create type rec_plantilla_codigo as enum (
  'confirmacion_postulacion',
  'agendamiento_fase2',
  'notificacion_entrevistador',
  'pase_fase3',
  'descarte',
  'oferta',
  'informativa'
);
