-- Operadores con acceso_score: editar/eliminar cualquier acreditado y sus referencias
-- (sin ser admin; la UI de usuarios/catálogo sigue bloqueada por rol)

drop policy if exists "acreditados_update" on acreditados;
create policy "acreditados_update"
  on acreditados for update
  using (has_score_access());

drop policy if exists "acreditados_delete" on acreditados;
create policy "acreditados_delete"
  on acreditados for delete
  to authenticated
  using (has_score_access());

drop policy if exists "referencias_delete" on acreditado_referencias;
create policy "referencias_delete"
  on acreditado_referencias for delete
  to authenticated
  using (
    has_score_access()
    and exists (
      select 1 from acreditados a
      where a.id = acreditado_id
    )
  );
