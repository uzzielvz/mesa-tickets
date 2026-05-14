-- ================================================================
-- CAMPOS DINÁMICOS por tipo de problema
-- ================================================================
--
-- Reemplaza el sistema de banderas fijas (requiere_grupo/cliente/ciclo)
-- por un esquema flexible:
--   - problem_catalog.campos jsonb: array ordenado de definiciones
--     [{ key, label, type, required, placeholder?, options? }]
--   - tickets.datos jsonb: respuestas del usuario { key: value }
--
-- Compatibilidad:
--   - Las columnas tickets.grupo/cliente/ciclo_cliente y los flags
--     requiere_* se mantienen para no romper tickets viejos.
--   - Backfill: para cada problema con flags activos se genera el JSON
--     equivalente con keys reservadas 'grupo', 'cliente', 'ciclo_cliente'
--     para que la UI rinda igual sin esfuerzo.

alter table problem_catalog
  add column if not exists campos jsonb not null default '[]'::jsonb;

alter table tickets
  add column if not exists datos jsonb not null default '{}'::jsonb;

-- Backfill: solo si campos está vacío y hay alguna bandera activa
update problem_catalog pc
set campos = (
  select coalesce(jsonb_agg(campo order by ord), '[]'::jsonb)
  from (
    select 1 as ord, jsonb_build_object(
      'key', 'grupo',
      'label', 'Grupo',
      'type', 'text',
      'required', true,
      'placeholder', 'Nombre del grupo'
    ) as campo
    where pc.requiere_grupo
    union all
    select 2, jsonb_build_object(
      'key', 'cliente',
      'label', 'Cliente',
      'type', 'text',
      'required', true,
      'placeholder', 'Nombre del cliente'
    )
    where pc.requiere_cliente
    union all
    select 3, jsonb_build_object(
      'key', 'ciclo_cliente',
      'label', 'Ciclo del cliente',
      'type', 'text',
      'required', true,
      'placeholder', 'Ej: Ciclo 12'
    )
    where pc.requiere_ciclo
  ) sub
)
where campos = '[]'::jsonb;
