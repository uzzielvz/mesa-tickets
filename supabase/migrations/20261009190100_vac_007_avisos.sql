-- VAC-007 — Vacaciones avisa en cada paso (NTF-001) y la alarma diaria.
--
-- Quién se entera de qué (panel = campana; correo = además por correo):
--   · Solicitud nueva ............ jefe (panel + correo); sin jefe, Gente y Cultura
--   · El jefe autoriza ........... persona (panel) y Gente y Cultura (panel + correo)
--   · El jefe rechaza ............ persona (panel + correo, con el motivo)
--   · Gente y Cultura aprueba .... persona (panel + correo) y jefe (panel)
--   · Gente y Cultura rechaza .... persona (panel + correo) y jefe (panel)
--   · La persona cancela ......... quien la tenía pendiente (panel)
--   · Gente y Cultura anula ...... persona (panel + correo) y jefe (panel)
--   · 2 días hábiles sin respuesta del jefe: recordatorio diario al jefe
--     (panel + correo), solo en días hábiles.
-- Criterio: correo solo cuando alguien tiene que actuar o le llega el
-- resultado. "Gente y Cultura" = quien tiene la bandera `acceso_vacaciones_rh`
-- (los admin no).
--
-- Las funciones de vac_004/vac_006 se redefinen IGUALES más una línea que
-- llama a `vac_avisar`. Los textos viven todos en `vac_avisar`.

-- ── Textos ───────────────────────────────────────────────────────────────────
-- "13 de noviembre"; con el año solo si no es el año en curso.
create or replace function public.vac_fecha_texto(p date)
returns text
language sql
stable
set search_path = public, pg_catalog
as $$
  select extract(day from p)::int || ' de '
      || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                'septiembre', 'octubre', 'noviembre', 'diciembre'])[extract(month from p)::int]
      || case when extract(year from p) <> extract(year from (now() at time zone 'America/Mexico_City'))
              then ' de ' || extract(year from p)::int
              else '' end
$$;

-- "el 27 de noviembre" · "del 13 al 17 de noviembre" · "del 30 de noviembre al 4 de diciembre"
create or replace function public.vac_rango_texto(p_inicio date, p_fin date)
returns text
language sql
stable
set search_path = public, pg_catalog
as $$
  select case
    when p_fin is null or p_fin = p_inicio then 'el ' || vac_fecha_texto(p_inicio)
    when date_trunc('month', p_inicio) = date_trunc('month', p_fin)
      then 'del ' || extract(day from p_inicio)::int || ' al ' || vac_fecha_texto(p_fin)
    else 'del ' || vac_fecha_texto(p_inicio) || ' al ' || vac_fecha_texto(p_fin)
  end
$$;

-- "2 días de vacaciones" · "1 día flotante"
create or replace function public.vac_dias_texto(p_tipo text, p_dias numeric)
returns text
language sql
immutable
as $$
  select trim_scale(p_dias)::text || case
    when p_tipo = 'flotante' then case when p_dias = 1 then ' día flotante' else ' días flotantes' end
    else case when p_dias = 1 then ' día de vacaciones' else ' días de vacaciones' end
  end
$$;

create or replace function public.vac_mayuscula(p text)
returns text
language sql
immutable
as $$
  select upper(left(p, 1)) || substr(p, 2)
$$;

-- El nombre como lo escribe su cuenta ("Uzziel Valdez"); si no tiene cuenta,
-- el de la base ("Valdez Ordoñez Uzziel").
create or replace function public.vac_nombre_aviso(p_cuenta uuid, p_empleado uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select initcap(lower(coalesce(
    nullif(trim((select nombre_completo from profiles where id = p_cuenta)), ''),
    (select nombre from vac_empleados where id = p_empleado),
    'alguien'
  )))
$$;

-- Gente y Cultura: quien tiene la bandera. Los admin no reciben estos avisos.
create or replace function public.vac_correos_rh()
returns setof text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select distinct lower(trim(email)) from profiles
  where acceso_vacaciones_rh = true and email is not null
$$;

revoke all on function public.vac_nombre_aviso(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vac_correos_rh() from public, anon, authenticated;

-- ── Los avisos de una solicitud ──────────────────────────────────────────────
-- p_extra: en 'cancelada', el estado en que estaba; en 'recordatorio', los
-- días hábiles que lleva esperando.
create or replace function public.vac_avisar(p_solicitud uuid, p_evento text, p_extra text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s           vac_solicitudes%rowtype;
  v_hoy       date := (now() at time zone 'America/Mexico_City')::date;
  v_persona   text;
  v_jefe_mail text;
  v_quien     text;
  v_jefe      text;
  v_dias      text;
  v_rango     text;
  v_rango_cap text;
  v_regresa   text := '';
  v_nota      text := '';
  v_rh        text;
begin
  select * into s from vac_solicitudes where id = p_solicitud;
  if not found then
    return;
  end if;

  select email into v_persona from vac_empleados where id = s.empleado_id;
  select email into v_jefe_mail from vac_empleados where id = s.jefe_id;

  v_quien := vac_nombre_aviso(s.solicitada_por, s.empleado_id);
  v_jefe  := vac_nombre_aviso(s.jefe_por, s.jefe_id);
  v_dias  := vac_dias_texto(s.tipo, s.dias);
  v_rango := vac_rango_texto(s.fecha_inicio, s.fecha_fin);
  v_rango_cap := vac_mayuscula(v_rango);
  if s.fecha_regreso is not null then
    v_regresa := '; regresa el ' || vac_fecha_texto(s.fecha_regreso);
  end if;
  if s.observaciones is not null then
    v_nota := ' Nota: “' || s.observaciones || '”.';
  end if;

  if p_evento = 'solicitada' then
    if s.jefe_id is not null then
      perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_solicitud',
        v_quien || ' pidió ' || v_dias,
        v_rango_cap || v_regresa || '. Te toca autorizarla o rechazarla.' || v_nota,
        '/vacaciones/equipo', s.id, true);
    else
      for v_rh in select * from vac_correos_rh() loop
        perform ntf_crear(v_rh, 'vacaciones', 'vac_solicitud',
          v_quien || ' pidió ' || v_dias,
          v_rango_cap || v_regresa || '. No tiene jefe asignado: te toca darle el Vo. Bo.' || v_nota,
          '/vacaciones', s.id, true);
      end loop;
    end if;

  elsif p_evento = 'autorizada_jefe' then
    perform ntf_crear(v_persona, 'vacaciones', 'vac_autorizada_jefe',
      v_jefe || ' autorizó tu solicitud',
      v_rango_cap || '. Falta el Vo. Bo. de Gente y Cultura.',
      '/vacaciones/mias', s.id, false);
    for v_rh in select * from vac_correos_rh() loop
      perform ntf_crear(v_rh, 'vacaciones', 'vac_por_vobo',
        'Espera tu Vo. Bo.: ' || v_quien || ', ' || v_dias,
        v_rango_cap || v_regresa || '. La autorizó ' || v_jefe || '.'
          || coalesce(' Comentario: “' || s.jefe_comentario || '”.', ''),
        '/vacaciones', s.id, true);
    end loop;

  elsif p_evento = 'rechazada_jefe' then
    perform ntf_crear(v_persona, 'vacaciones', 'vac_rechazada',
      v_jefe || ' rechazó tu solicitud',
      v_rango_cap || '. Motivo: “' || coalesce(s.jefe_comentario, 'sin motivo') || '”. Puedes pedir otras fechas.',
      '/vacaciones/mias', s.id, true);

  elsif p_evento = 'aprobada' then
    perform ntf_crear(v_persona, 'vacaciones', 'vac_aprobada',
      'Aprobada: ' || v_dias || ' ' || v_rango,
      'Gente y Cultura dio el Vo. Bo.'
        || coalesce(' Regresas el ' || vac_fecha_texto(s.fecha_regreso) || '.', '')
        || ' Tu constancia firmada ya está en Mis vacaciones.',
      '/vacaciones/mias', s.id, true);
    perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_aprobada',
      'Gente y Cultura aprobó la solicitud de ' || v_quien,
      vac_mayuscula(v_dias) || ' ' || v_rango || v_regresa || '.',
      '/vacaciones/equipo', s.id, false);

  elsif p_evento = 'rechazada_rh' then
    perform ntf_crear(v_persona, 'vacaciones', 'vac_rechazada',
      'Gente y Cultura rechazó tu solicitud',
      v_rango_cap || '. Motivo: “' || coalesce(s.rh_comentario, 'sin motivo') || '”. Puedes pedir otras fechas.',
      '/vacaciones/mias', s.id, true);
    perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_rechazada',
      'Gente y Cultura rechazó la solicitud de ' || v_quien,
      v_rango_cap || '. Motivo: “' || coalesce(s.rh_comentario, 'sin motivo') || '”.',
      '/vacaciones/equipo', s.id, false);

  elsif p_evento = 'cancelada' then
    if p_extra = 'pendiente_jefe' then
      perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_cancelada',
        v_quien || ' canceló su solicitud',
        v_rango_cap || '. Ya no tienes que autorizarla.',
        '/vacaciones/equipo', s.id, false);
    elsif p_extra = 'pendiente_rh' then
      for v_rh in select * from vac_correos_rh() loop
        perform ntf_crear(v_rh, 'vacaciones', 'vac_cancelada',
          v_quien || ' canceló su solicitud',
          v_rango_cap || '. Ya no necesita tu Vo. Bo.',
          '/vacaciones', s.id, false);
      end loop;
    end if;

  elsif p_evento = 'anulada' then
    perform ntf_crear(v_persona, 'vacaciones', 'vac_anulada',
      'Se anuló tu solicitud aprobada',
      v_rango_cap || '. Gente y Cultura anuló esos días: la solicitud quedó cancelada y ya no cuentan como tomados.',
      '/vacaciones/mias', s.id, true);
    perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_anulada',
      'Se anuló la solicitud de ' || v_quien,
      v_rango_cap || '. Gente y Cultura anuló esos días.',
      '/vacaciones/equipo', s.id, false);

  elsif p_evento = 'recordatorio' then
    perform ntf_crear(v_jefe_mail, 'vacaciones', 'vac_recordatorio',
      'Recordatorio: ' || v_quien || ' espera tu respuesta',
      'Pidió ' || v_dias || ' ' || v_rango || '. Lleva ' || coalesce(p_extra, '2') || ' días hábiles esperando; '
        || case
             when s.fecha_inicio > v_hoy + 1 then 'empieza en ' || (s.fecha_inicio - v_hoy) || ' días.'
             when s.fecha_inicio = v_hoy + 1 then 'empieza mañana.'
             when s.fecha_inicio = v_hoy then 'empieza hoy.'
             else 'ya empezó.'
           end,
      '/vacaciones/equipo', s.id, true);
  end if;
end;
$$;

revoke all on function public.vac_avisar(uuid, text, text) from public, anon, authenticated;

-- ── Las funciones del flujo, con su aviso ───────────────────────────────────
-- vac_solicitar: igual que en vac_004, más el aviso al jefe.
create or replace function public.vac_solicitar(
  p_tipo          text,
  p_inicio        date,
  p_fin           date,
  p_observaciones text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy       date := (now() at time zone 'America/Mexico_City')::date;
  v_yo        uuid := vac_mi_empleado();
  v_jefe      uuid;
  v_dias      int;
  v_saldo     json;
  v_disp      numeric;
  v_id        uuid;
  v_folio     bigint;
begin
  if v_yo is null then
    raise exception 'Tu correo no está en la base de vacaciones. Pídele a Gente y Cultura que te registre.';
  end if;
  if p_tipo not in ('vacaciones', 'flotante') then
    raise exception 'Tipo de solicitud inválido';
  end if;
  if p_inicio is null or p_fin is null or p_fin < p_inicio then
    raise exception 'Revisa las fechas: el último día no puede ser antes del primero';
  end if;
  if p_inicio < v_hoy then
    raise exception 'Las vacaciones se solicitan con anticipación: la fecha de inicio ya pasó';
  end if;
  if p_fin > p_inicio + 60 then
    raise exception 'El periodo es demasiado largo para una sola solicitud';
  end if;

  v_dias := vac_dias_habiles(p_inicio, p_fin);
  if v_dias <= 0 then
    raise exception 'Esas fechas no tienen días hábiles (son fin de semana o festivos)';
  end if;

  if p_tipo = 'vacaciones' then
    v_saldo := vac_saldos_interno(v_yo) -> 0;
    if (v_saldo ->> 'anios')::int < 1 then
      raise exception 'Todavía no cumples un año de servicio. Tus primeros días llegan el %', v_saldo ->> 'proximo_aniversario';
    end if;
    v_disp := (v_saldo ->> 'restantes_total')::numeric - (v_saldo ->> 'dias_en_tramite')::numeric;
    if v_dias > v_disp then
      raise exception 'Pides % días hábiles y tienes % disponibles', v_dias, trim_scale(greatest(v_disp, 0));
    end if;
  end if;

  if exists (
    select 1 from vac_solicitudes s
    where s.empleado_id = v_yo and s.estado in ('pendiente_jefe', 'pendiente_rh', 'aprobada')
      and daterange(s.fecha_inicio, s.fecha_fin, '[]') && daterange(p_inicio, p_fin, '[]')
  ) or exists (
    select 1 from vac_movimientos m
    where m.empleado_id = v_yo and m.anulado_at is null
      and m.fecha_inicio is not null
      and daterange(m.fecha_inicio, coalesce(m.fecha_fin, m.fecha_inicio), '[]') && daterange(p_inicio, p_fin, '[]')
  ) then
    raise exception 'Ya tienes días solicitados o registrados en esas fechas';
  end if;

  select jefe_id into v_jefe from vac_empleados where id = v_yo;

  insert into vac_solicitudes (
    empleado_id, tipo, fecha_inicio, fecha_fin, dias, fecha_regreso, observaciones,
    estado, jefe_id, solicitada_por
  ) values (
    v_yo, p_tipo, p_inicio, p_fin, v_dias, vac_fecha_regreso(p_fin),
    nullif(trim(coalesce(p_observaciones, '')), ''),
    case when v_jefe is null then 'pendiente_rh' else 'pendiente_jefe' end,
    v_jefe, auth.uid()
  )
  returning id, folio into v_id, v_folio;

  perform vac_avisar(v_id, 'solicitada');

  return json_build_object('id', v_id, 'folio', v_folio, 'dias', v_dias,
                           'estado', case when v_jefe is null then 'pendiente_rh' else 'pendiente_jefe' end);
end;
$$;

-- vac_cancelar_solicitud: igual que en vac_004, más el aviso a quien la tenía pendiente.
create or replace function public.vac_cancelar_solicitud(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo    uuid := vac_mi_empleado();
  v_antes text;
begin
  select estado into v_antes
  from vac_solicitudes
  where id = p_id and empleado_id = v_yo
  for update;

  update vac_solicitudes
     set estado = 'cancelada', cancelada_at = now()
   where id = p_id and empleado_id = v_yo
     and estado in ('pendiente_jefe', 'pendiente_rh');
  if not found then
    raise exception 'Esa solicitud ya no se puede cancelar';
  end if;

  perform vac_avisar(p_id, 'cancelada', v_antes);
end;
$$;

-- vac_resolver_jefe: igual que en vac_004, más el aviso.
create or replace function public.vac_resolver_jefe(p_id uuid, p_autoriza boolean, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    raise exception 'No estás en la base de vacaciones' using errcode = '42501';
  end if;
  if not p_autoriza and nullif(trim(coalesce(p_comentario, '')), '') is null then
    raise exception 'Escribe el motivo del rechazo: la persona lo va a leer';
  end if;

  update vac_solicitudes
     set estado = case when p_autoriza then 'pendiente_rh' else 'rechazada' end,
         jefe_at = now(), jefe_por = auth.uid(),
         jefe_comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id and jefe_id = v_yo and estado = 'pendiente_jefe';
  if not found then
    raise exception 'Esa solicitud no te toca o ya se resolvió';
  end if;

  perform vac_avisar(p_id, case when p_autoriza then 'autorizada_jefe' else 'rechazada_jefe' end);
end;
$$;

-- vac_resolver_rh: igual que en vac_006, más el aviso.
create or replace function public.vac_resolver_rh(p_id uuid, p_aprueba boolean, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s   vac_solicitudes%rowtype;
  a   record;
  v_n int := 0;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;

  select * into s from vac_solicitudes where id = p_id for update;
  if not found or s.estado <> 'pendiente_rh' then
    raise exception 'Esa solicitud no está esperando el Vo. Bo. de RH';
  end if;
  if s.empleado_id = vac_mi_empleado() then
    raise exception 'No puedes dar el Vo. Bo. a tu propia solicitud: la resuelve otra persona de Gente y Cultura'
      using errcode = '42501';
  end if;

  if not p_aprueba then
    if nullif(trim(coalesce(p_comentario, '')), '') is null then
      raise exception 'Escribe el motivo del rechazo: la persona lo va a leer';
    end if;
    update vac_solicitudes
       set estado = 'rechazada', rh_at = now(), rh_por = auth.uid(), rh_comentario = trim(p_comentario)
     where id = p_id;
    perform vac_avisar(p_id, 'rechazada_rh');
    return json_build_object('estado', 'rechazada', 'movimientos', 0);
  end if;

  if s.tipo = 'vacaciones' then
    for a in select * from vac_asignar_periodos(s.empleado_id, s.dias) loop
      insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                   observaciones, origen, registrado_por, solicitud_id)
      values (s.empleado_id, 'vacaciones', a.periodo, a.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
              s.observaciones, 'solicitud', auth.uid(), s.id);
      v_n := v_n + 1;
    end loop;
  else
    insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                 observaciones, origen, registrado_por, solicitud_id)
    values (s.empleado_id, 'flotante', null, s.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
            s.observaciones, 'solicitud', auth.uid(), s.id);
    v_n := 1;
  end if;

  update vac_solicitudes
     set estado = 'aprobada', rh_at = now(), rh_por = auth.uid(),
         rh_comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id;

  perform vac_avisar(p_id, 'aprobada');

  return json_build_object('estado', 'aprobada', 'movimientos', v_n);
end;
$$;

-- El trigger de vac_006: anular todos los días de una aprobada la cancela, y ahora avisa.
create or replace function public.vac_tr_movimiento_anulado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.solicitud_id is not null and new.anulado_at is not null and old.anulado_at is null
     and not exists (
       select 1 from vac_movimientos
       where solicitud_id = new.solicitud_id and anulado_at is null
     ) then
    update vac_solicitudes
       set estado = 'cancelada', cancelada_at = now()
     where id = new.solicitud_id and estado = 'aprobada';
    if found then
      perform vac_avisar(new.solicitud_id, 'anulada');
    end if;
  end if;
  return new;
end;
$$;

-- ── La alarma ────────────────────────────────────────────────────────────────
-- Cada día hábil: al jefe que lleva 2 días hábiles o más sin contestar, un
-- recordatorio por solicitud. Idempotente: si corre dos veces el mismo día no
-- duplica. Los correos los manda el cron de Vercel (/api/notificaciones/cron).
create or replace function public.vac_recordatorios()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  s     record;
  v_n   int := 0;
begin
  if extract(isodow from v_hoy) >= 6 or exists (select 1 from vac_festivos where fecha = v_hoy) then
    return 0;
  end if;

  for s in
    select so.id,
           vac_dias_habiles(((so.created_at at time zone 'America/Mexico_City')::date) + 1, v_hoy) as esperando
    from vac_solicitudes so
    where so.estado = 'pendiente_jefe' and so.jefe_id is not null
  loop
    continue when s.esperando < 2;
    continue when exists (
      select 1 from notificaciones n
      where n.ref_id = s.id and n.tipo = 'vac_recordatorio'
        and (n.created_at at time zone 'America/Mexico_City')::date = v_hoy
    );
    perform vac_avisar(s.id, 'recordatorio', s.esperando::text);
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.vac_recordatorios() from public, anon, authenticated;

-- 15:00 UTC = 9:00 en la Ciudad de México (sin horario de verano desde 2022).
-- El cron de Vercel manda los correos una hora después.
do $$
begin
  perform cron.unschedule('vac_recordatorios');
exception when others then null;
end $$;

select cron.schedule('vac_recordatorios', '0 15 * * 1-5', $$select vac_recordatorios()$$);
