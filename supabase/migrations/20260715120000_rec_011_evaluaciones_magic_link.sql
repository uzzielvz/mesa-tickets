-- REC-046 — S5 Evaluaciones vía magic link.
--
-- Los entrevistadores (Benny/Maritere/Sergio) NO son profiles: en S4 quedaron
-- modelados como jsonb [{nombre, email}] en rec_sesiones_entrevistas.entrevistadores.
-- Por eso S5 identifica al entrevistador POR EMAIL, no por profiles.id.
--   - rec_magic_links / rec_evaluaciones: entrevistador_id pasa a nullable y se
--     agregan entrevistador_email + entrevistador_nombre; los uniques se rehacen
--     por email.
--
-- El acceso público del entrevistador (ruta /evaluar/[token]) es EXCLUSIVAMENTE
-- vía dos RPC security definer; las tablas rec_* siguen admin-only por RLS.

-- ── 1) rec_magic_links: identificación por email ────────────────────────────
alter table rec_magic_links
  alter column entrevistador_id drop not null,
  add column if not exists entrevistador_email  text,
  add column if not exists entrevistador_nombre text;

alter table rec_magic_links
  drop constraint if exists rec_magic_links_sesion_id_entrevistador_id_key;

alter table rec_magic_links
  add constraint rec_magic_links_sesion_email_key unique (sesion_id, entrevistador_email);

-- ── 2) rec_evaluaciones: identificación por email ───────────────────────────
alter table rec_evaluaciones
  alter column entrevistador_id drop not null,
  add column if not exists entrevistador_email  text,
  add column if not exists entrevistador_nombre text;

alter table rec_evaluaciones
  drop constraint if exists rec_evaluaciones_entrevista_id_entrevistador_id_key;

alter table rec_evaluaciones
  add constraint rec_evaluaciones_entrevista_email_key unique (entrevista_id, entrevistador_email);

-- ── 3) Plantilla del correo con la liga personal del entrevistador ──────────
insert into rec_plantillas_correo (codigo, asunto, cuerpo) values
(
  'notificacion_entrevistador',
  'Tus evaluaciones — {{vacante}} / {{fecha}}',
  $tpl$Estimado(a) {{nombre_entrevistador}},
Buen día.

Ya puedes registrar tus evaluaciones de los candidatos de la posición de "{{vacante}}" agendados para el {{fecha}}.

Entra a tu liga personal para calificar a cada candidato (Viable / No viable / Filtro DG) y dejar tus comentarios:

{{magic_link}}

La liga es personal y estará disponible durante los próximos 7 días. Puedes entrar las veces que necesites y editar tus respuestas antes de que cierre.

Saludos cordiales
Reclutamiento Crediflexi$tpl$
)
on conflict (codigo) do update set
  asunto = excluded.asunto,
  cuerpo = excluded.cuerpo;

-- ── 4) RPC pública: datos de la sesión a partir del token ───────────────────
-- Devuelve {valido:false, motivo} o {valido:true, entrevistador_nombre, vacante,
-- fecha, candidatos:[{entrevista_id, nombre, horario, evaluacion|null}]}.
-- La evaluacion incluida es SOLO la del entrevistador dueño del token.
create or replace function rec_sesion_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link    rec_magic_links;
  v_sesion  rec_sesiones_entrevistas;
  v_vacante text;
  v_result  jsonb;
begin
  select * into v_link from rec_magic_links where token = p_token;
  if v_link.id is null then
    return jsonb_build_object('valido', false, 'motivo', 'invalido');
  end if;
  if v_link.expira_at is not null and now() > v_link.expira_at then
    return jsonb_build_object('valido', false, 'motivo', 'expirado');
  end if;

  select * into v_sesion from rec_sesiones_entrevistas where id = v_link.sesion_id;
  select titulo into v_vacante from rec_vacantes where id = v_sesion.vacante_id;

  select jsonb_build_object(
    'valido', true,
    'entrevistador_nombre', v_link.entrevistador_nombre,
    'vacante', v_vacante,
    'fecha', v_sesion.fecha,
    'candidatos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entrevista_id', e.id,
          'nombre', c.nombre,
          'horario',
            to_char(e.fecha_hora at time zone 'America/Mexico_City', 'HH24:MI')
            || '–' ||
            to_char((e.fecha_hora + interval '60 minutes') at time zone 'America/Mexico_City', 'HH24:MI'),
          'evaluacion', case when ev.id is null then null else jsonb_build_object(
            'recomendacion', ev.recomendacion,
            'comentarios',   ev.comentarios,
            'puntaje',       ev.puntaje
          ) end
        ) order by e.fecha_hora
      )
      from rec_entrevistas e
      join rec_candidatos c on c.id = e.candidato_id
      left join rec_evaluaciones ev
        on ev.entrevista_id = e.id
       and ev.entrevistador_email = v_link.entrevistador_email
      where e.sesion_id = v_link.sesion_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ── 5) RPC pública: registrar/actualizar una evaluación ─────────────────────
-- Valida el token vigente Y que la entrevista pertenezca a la sesión del token.
-- Upsert por (entrevista_id, entrevistador_email). Multi-uso: refresca usado_at.
create or replace function rec_submit_evaluacion(
  p_token         text,
  p_entrevista_id uuid,
  p_recomendacion rec_viabilidad,
  p_comentarios   text default null,
  p_puntaje       smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link rec_magic_links;
begin
  select * into v_link from rec_magic_links where token = p_token;
  if v_link.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalido');
  end if;
  if v_link.expira_at is not null and now() > v_link.expira_at then
    return jsonb_build_object('ok', false, 'error', 'expirado');
  end if;
  if p_recomendacion is null then
    return jsonb_build_object('ok', false, 'error', 'recomendacion_requerida');
  end if;
  if not exists (
    select 1 from rec_entrevistas
    where id = p_entrevista_id and sesion_id = v_link.sesion_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'entrevista_invalida');
  end if;

  insert into rec_evaluaciones (
    entrevista_id, entrevistador_email, entrevistador_nombre,
    recomendacion, comentarios, puntaje, enviada_at
  ) values (
    p_entrevista_id, v_link.entrevistador_email, v_link.entrevistador_nombre,
    p_recomendacion, nullif(trim(coalesce(p_comentarios, '')), ''), p_puntaje, now()
  )
  on conflict (entrevista_id, entrevistador_email) do update set
    recomendacion = excluded.recomendacion,
    comentarios   = excluded.comentarios,
    puntaje       = excluded.puntaje,
    enviada_at    = now();

  update rec_magic_links set usado_at = now() where id = v_link.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 6) Superficie pública: solo estas dos RPC, nada más ─────────────────────
revoke all on function rec_sesion_por_token(text) from public;
revoke all on function rec_submit_evaluacion(text, uuid, rec_viabilidad, text, smallint) from public;
grant execute on function rec_sesion_por_token(text) to anon, authenticated;
grant execute on function rec_submit_evaluacion(text, uuid, rec_viabilidad, text, smallint) to anon, authenticated;
