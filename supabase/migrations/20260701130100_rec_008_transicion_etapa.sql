-- REC-019 — RPC rec_transicion_etapa: mueve un candidato de etapa validando
-- el DAG de transiciones y registrando la bitácora.
--
-- DAG de transiciones legales (forward, un paso a la vez):
--   postulado            -> en_revision
--   en_revision          -> viable
--   viable               -> entrevistas_agendadas
--   entrevistas_agendadas-> comite
--   comite               -> final_dg
--   final_dg             -> oferta
--   oferta               -> contratado
-- Terminal:
--   <cualquier etapa no terminal> -> descartado   (requiere motivo_descarte)
-- No se permite saltar etapas (p. ej. postulado -> contratado), ni retroceder,
-- ni salir de un estado terminal (contratado / descartado).
--
-- TODO (S4): la transición a 'entrevistas_agendadas' hoy es manual y sin efectos
-- secundarios. En S4 (agendamiento masivo) esa transición deberá disparar la
-- creación de eventos de Calendar (Meet) y el envío de correos.

create or replace function rec_transicion_etapa(
  p_candidato_id    uuid,
  p_etapa_destino   rec_etapa,
  p_motivo_descarte rec_motivo_descarte default null,
  p_notas           text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual  rec_etapa;
  v_valida  boolean := false;
begin
  if auth.uid() is null then
    raise exception 'no_auth';
  end if;

  if not (has_reclutamiento_access() or is_admin(auth.uid())) then
    raise exception 'sin_acceso';
  end if;

  select etapa into v_actual from rec_candidatos where id = p_candidato_id;
  if v_actual is null then
    raise exception 'no_existe';
  end if;

  if p_etapa_destino = v_actual then
    raise exception 'misma_etapa';
  end if;

  if p_etapa_destino = 'descartado' then
    -- Descarte terminal desde cualquier etapa no terminal.
    v_valida := v_actual not in ('contratado', 'descartado');
    if p_motivo_descarte is null then
      raise exception 'motivo_requerido';
    end if;
  else
    v_valida := (v_actual, p_etapa_destino) in (
      ('postulado', 'en_revision'),
      ('en_revision', 'viable'),
      ('viable', 'entrevistas_agendadas'),
      ('entrevistas_agendadas', 'comite'),
      ('comite', 'final_dg'),
      ('final_dg', 'oferta'),
      ('oferta', 'contratado')
    );
  end if;

  if not v_valida then
    raise exception 'transicion_invalida';
  end if;

  update rec_candidatos
  set
    etapa                 = p_etapa_destino,
    motivo_descarte       = case when p_etapa_destino = 'descartado' then p_motivo_descarte else null end,
    etapa_actualizada_at  = now(),
    etapa_actualizada_por = auth.uid()
  where id = p_candidato_id;

  insert into rec_candidato_historial (
    candidato_id, etapa_anterior, etapa_nueva, motivo_descarte, notas, actor_id
  ) values (
    p_candidato_id, v_actual, p_etapa_destino,
    case when p_etapa_destino = 'descartado' then p_motivo_descarte else null end,
    nullif(trim(coalesce(p_notas, '')), ''),
    auth.uid()
  );
end;
$$;

grant execute on function rec_transicion_etapa(uuid, rec_etapa, rec_motivo_descarte, text) to authenticated;
