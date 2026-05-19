-- Permitir eliminar acreditados (mismas reglas que editar: capturador o admin)
drop policy if exists "acreditados_delete" on acreditados;

create policy "acreditados_delete"
  on acreditados for delete
  to authenticated
  using (
    has_score_access()
    and (capturado_por_id = auth.uid() or is_admin(auth.uid()))
  );
