-- ================================================================
-- SCORING — correcciones RLS y evaluación del promotor
-- ================================================================

-- 1. Permitir borrar referencias al editar (solo capturador o admin)
drop policy if exists "referencias_delete" on acreditado_referencias;

create policy "referencias_delete"
  on acreditado_referencias for delete
  to authenticated
  using (
    has_score_access()
    and exists (
      select 1 from acreditados a
      where a.id = acreditado_id
        and (a.capturado_por_id = auth.uid() or is_admin(auth.uid()))
    )
  );

-- 2. RPC: cualquier usuario con acceso_score puede evaluar (sin ser capturador)
create or replace function guardar_evaluacion_promotor(
  p_acreditado_id uuid,
  p_calificacion char(1),
  p_justificacion text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no_auth';
  end if;

  if not has_score_access() then
    raise exception 'sin_acceso';
  end if;

  if p_calificacion not in ('A', 'B', 'C', 'D') then
    raise exception 'calificacion_invalida';
  end if;

  if length(trim(coalesce(p_justificacion, ''))) < 10 then
    raise exception 'justificacion_invalida';
  end if;

  if not exists (select 1 from acreditados where id = p_acreditado_id) then
    raise exception 'no_existe';
  end if;

  update acreditados
  set
    calificacion_promotor = p_calificacion,
    justificacion_promotor = trim(p_justificacion),
    promotor_id = auth.uid()
  where id = p_acreditado_id;
end;
$$;

grant execute on function guardar_evaluacion_promotor(uuid, char, text) to authenticated;

-- 3. Índice único en clave (evita duplicados en captura)
create unique index if not exists acreditados_clave_unique on acreditados (clave);
