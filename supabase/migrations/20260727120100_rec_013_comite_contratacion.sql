-- REC-054 — S6: comité + contratación.
-- (a) rec_candidatos: notas del comité y fecha de ingreso del contratado.
-- (b) rec_plantillas_correo: CC configurable por plantilla.
-- (c) Seed de la plantilla de bienvenida (copy base: correo real de Héctor
--     2026-07-07 "Bienvenido / Documentos para contratación").
-- (d) rec_sesion_por_token: la duración del bloque por candidato deja de ser
--     60 min fijos y pasa a N entrevistadores × 20 min (entrevistadores dinámicos).

-- ── a) Columnas nuevas en rec_candidatos ────────────────────────────────────
alter table rec_candidatos
  add column if not exists notas_comite  text,
  add column if not exists fecha_ingreso date;

-- ── b) CC configurable por plantilla ────────────────────────────────────────
alter table rec_plantillas_correo
  add column if not exists cc_emails jsonb not null default '[]'::jsonb;

-- ── c) Plantilla de bienvenida al contratar ─────────────────────────────────
insert into rec_plantillas_correo (codigo, asunto, cuerpo, cc_emails) values
(
  'bienvenida_contratacion',
  'Bienvenido(a) {{nombre_candidato}} / Documentos para contratación',
  $tpl$Estimado(a) {{nombre_candidato}},
Buen día.

Por este conducto te reiteramos nuestro agradecimiento por tu incorporación a Crediflexi. Tu fecha de ingreso será el {{fecha_ingreso}}. Estamos seguros de que haremos un gran equipo a tu lado, ¡bienvenido(a)!

Para nosotros es importante contar con un expediente físico con los documentos que firmes y digital con los documentos que a continuación te solicitamos.

Por ahora pedimos tu ayuda para el envío de los siguientes documentos:
* Acta de Nacimiento
* Identificación Oficial / INE
* CURP
* Constancia de Situación Fiscal / SAT
* Número de Afiliación IMSS
* Comprobante de Domicilio
* Estado de Cuenta Bancario
* Constancia Laboral (último empleo)
* Constancia de Estudios
* Layout Datos Personales (adjunto formato — debes llenarlo)

Estos documentos deberás enviarlos por este conducto a más tardar el {{fecha_limite_docs}}. Copiamos en este correo a nuestro coordinador de Gente y Cultura, quien se encargará de elaborar tu expediente.

Adicionalmente te solicitamos dos fotografías, bajo los lineamientos y ejemplos que adjuntamos al presente correo.

Finalmente, te pedimos llenar el siguiente cuestionario de Gente y Cultura (busca conocerte mejor para saber a quién y cómo celebrar; puedes omitir las preguntas que consideres):
https://docs.google.com/forms/d/e/1FAIpQLSdT1NmDt6kjurtK89U7fJFGZSY0npwVq-tU_ary-nhKvAHHeQ/viewform

Quedamos atentos a tus documentos.

Saludos cordiales
Reclutamiento Crediflexi$tpl$,
  '["irvin.velazco@financieracrediflexi.com", "cynthia.aguilar@financieracrediflexi.com", "jesus.montellano@financieracrediflexi.com"]'::jsonb
)
on conflict (codigo) do update set
  asunto    = excluded.asunto,
  cuerpo    = excluded.cuerpo,
  cc_emails = excluded.cc_emails;

-- ── d) Horario dinámico en rec_sesion_por_token ─────────────────────────────
-- El bloque por candidato dura N entrevistadores × 20 min (antes: 60 fijos).
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
  v_dur_min integer;
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
  v_dur_min := greatest(jsonb_array_length(coalesce(v_sesion.entrevistadores, '[]'::jsonb)), 1) * 20;

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
            to_char((e.fecha_hora + make_interval(mins => v_dur_min)) at time zone 'America/Mexico_City', 'HH24:MI'),
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
