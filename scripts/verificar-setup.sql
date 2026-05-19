-- =============================================================================
-- Verificación de setup — mea-tickets / Supabase
-- Ejecutar en SQL Editor (un solo Run). Revisa la columna "estado".
-- =============================================================================

-- Ajusta si quieres validar otros correos:
--   operadora Score: yrendon@financieracrediflexi.com
--   admin absoluto:  tu correo @financieracrediflexi.com

-- ─── 1) Perfiles clave ───────────────────────────────────────────────────────
select
  'perfil_yrendon' as chequeo,
  email,
  rol::text,
  acceso_score,
  activo,
  (area_id is not null) as onboarding_ok,
  case
    when email = 'yrendon@financieracrediflexi.com'
         and rol = 'usuario'
         and acceso_score = true
         and activo = true
         and area_id is not null
      then 'OK'
    when email = 'yrendon@financieracrediflexi.com'
      then 'REVISAR (rol=usuario, acceso_score=true, activo, area_id)'
    else 'N/A'
  end as estado
from profiles
where email = 'yrendon@financieracrediflexi.com';

select
  'perfiles_acceso_score' as chequeo,
  count(*) filter (where acceso_score = true) as con_score,
  count(*) filter (where acceso_score = true and rol = 'admin') as admin_con_score,
  count(*) filter (where acceso_score = true and rol <> 'admin') as operadores_score,
  case
    when count(*) filter (where acceso_score = true and email = 'yrendon@financieracrediflexi.com') >= 1
    then 'OK (yrendon con score)'
    else 'REVISAR: activar acceso_score en yrendon'
  end as estado
from profiles;

-- ─── 2) Funciones y RPC ──────────────────────────────────────────────────────
select
  'funciones' as chequeo,
  p.proname as nombre,
  case when p.oid is not null then 'OK' else 'FALTA' end as estado
from (values
  ('has_score_access'),
  ('complete_onboarding'),
  ('guardar_evaluacion_promotor'),
  ('validate_response_order'),
  ('handle_ticket_closure'),
  ('is_admin')
) as esperado(nombre)
left join pg_proc p on p.proname = esperado.nombre
  and p.pronamespace = 'public'::regnamespace;

-- ─── 3) Enum rechazo ─────────────────────────────────────────────────────────
select
  'enum_rechazo' as chequeo,
  e.enumlabel,
  'OK' as estado
from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'response_type'
  and e.enumlabel = 'rechazo_responsable';

-- ─── 4) Columnas tickets / catálogo / perfiles ───────────────────────────────
select
  'columnas' as chequeo,
  c.table_name,
  c.column_name,
  'OK' as estado
from information_schema.columns c
where (c.table_schema, c.table_name, c.column_name) in (
  ('public', 'profiles', 'acceso_score'),
  ('public', 'problem_catalog', 'campos'),
  ('public', 'tickets', 'datos')
)
order by c.table_name, c.column_name;

-- Debe devolver 3 filas. Si faltan, corre migraciones 04 y scoring.

-- ─── 5) Vista tickets_with_status ────────────────────────────────────────────
select
  'vista_tickets' as chequeo,
  exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'tickets_with_status'
  ) as existe,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets_with_status'
      and column_name = 'datos'
  ) as tiene_columna_datos,
  case
    when exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'tickets_with_status')
    then 'OK'
    else 'FALTA: migración 03/07'
  end as estado;

-- ─── 6) Políticas RLS Score (migración 08) ───────────────────────────────────
-- En Postgres/Supabase la expresión RLS se lee con pg_get_expr, no "qual".
select
  'rls_acreditados_update' as chequeo,
  pol.polname,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  case
    when coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_score_access%'
     and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%capturado_por_id%'
      then 'OK (operador score en todos)'
    else 'REVISAR: ejecutar 20260514000008_score_operator_rls.sql'
  end as estado
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
where cls.relname = 'acreditados'
  and pol.polname = 'acreditados_update';

select
  'rls_acreditados_delete' as chequeo,
  pol.polname,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  case
    when coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_score_access%'
     and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%capturado_por_id%'
      then 'OK'
    else 'REVISAR: ejecutar migración 08'
  end as estado
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
where cls.relname = 'acreditados'
  and pol.polname = 'acreditados_delete';

select
  'rls_referencias_delete' as chequeo,
  pol.polname,
  case when pol.polname is not null then 'OK' else 'FALTA' end as estado
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
where cls.relname = 'acreditado_referencias'
  and pol.polname = 'referencias_delete';

-- ─── 7) RLS activo en tablas principales ─────────────────────────────────────
select
  'rls_habilitado' as chequeo,
  c.relname as tabla,
  c.relrowsecurity as rls_on,
  case when c.relrowsecurity then 'OK' else 'REVISAR' end as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles', 'tickets', 'ticket_responses', 'acreditados',
    'acreditado_referencias', 'acreditado_historial'
  )
order by c.relname;

-- ─── 8) Datos de módulos (conteos) ───────────────────────────────────────────
select 'conteos' as chequeo, 'acreditados' as tabla, count(*)::bigint as total from acreditados
union all
select 'conteos', 'tickets', count(*) from tickets
union all
select 'conteos', 'profiles', count(*) from profiles
union all
select 'conteos', 'areas_activas', count(*) from areas where activo = true;

-- ─── 9) Simulación has_score_access para Yrendon ─────────────────────────────
select
  'simulacion_yrendon' as chequeo,
  p.email,
  p.rol::text,
  p.acceso_score,
  (p.rol = 'admin' or p.acceso_score = true) as tendria_score_access,
  case
    when p.rol = 'usuario' and p.acceso_score = true then 'OK operadora Score'
    when p.rol = 'admin' then 'OK pero es admin (ve más en app)'
    else 'REVISAR perfil'
  end as estado
from profiles p
where p.email = 'yrendon@financieracrediflexi.com';

-- ─── 10) Diagnóstico item por item (lee estado de cada fila) ─────────────────
select * from (
  select 1 as ord, 'perfil_yrendon' as item,
    exists (
      select 1 from profiles
      where email = 'yrendon@financieracrediflexi.com'
        and rol = 'usuario' and acceso_score = true and activo = true
    ) as ok,
    'UPDATE profiles: rol=usuario, acceso_score=true (y que haya entrado con Google)' as si_falla
  union all
  select 2, 'onboarding_yrendon',
    exists (
      select 1 from profiles
      where email = 'yrendon@financieracrediflexi.com' and area_id is not null
    ),
    'Que complete onboarding en la app (nombre + area)'
  union all
  select 3, 'rpc_evaluacion_promotor',
    exists (select 1 from pg_proc where proname = 'guardar_evaluacion_promotor'),
    'Correr migracion 20260514000005_scoring_rls_fixes.sql'
  union all
  select 4, 'columna_tickets_datos',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'datos'
    ),
    'Correr migracion 20260514000004_dynamic_fields.sql'
  union all
  select 5, 'enum_rechazo',
    exists (
      select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'response_type' and e.enumlabel = 'rechazo_responsable'
    ),
    'Correr migracion 20260514000002_rechazo_enum.sql'
  union all
  select 6, 'rls_migracion_08',
    exists (
      select 1 from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
      where cls.relname = 'acreditados' and pol.polname = 'acreditados_update'
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_score_access%'
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%capturado_por_id%'
    ),
    'Correr migracion 20260514000008_score_operator_rls.sql'
) checks
order by ord;

-- ─── 11) RESUMEN (todo_ok = true solo si los 6 items anteriores son ok) ───────
select
  'RESUMEN' as chequeo,
  bool_and(ok) as todo_ok,
  case
    when bool_and(ok) then 'LISTO para Yrendon + app desplegada'
    else 'Revisa la tabla anterior: filas con ok = false'
  end as mensaje
from (
  select exists (
      select 1 from profiles
      where email = 'yrendon@financieracrediflexi.com'
        and rol = 'usuario' and acceso_score = true and activo = true
    ) as ok
  union all
  select exists (
      select 1 from profiles
      where email = 'yrendon@financieracrediflexi.com' and area_id is not null
    )
  union all
  select exists (select 1 from pg_proc where proname = 'guardar_evaluacion_promotor')
  union all
  select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'tickets' and column_name = 'datos'
    )
  union all
  select exists (
      select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typname = 'response_type' and e.enumlabel = 'rechazo_responsable'
    )
  union all
  select exists (
      select 1 from pg_policy pol
      join pg_class cls on cls.oid = pol.polrelid
      where cls.relname = 'acreditados' and pol.polname = 'acreditados_update'
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%has_score_access%'
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%capturado_por_id%'
    )
) t;
