-- REC-068 — S7.5: vista con los requisitos derivados de cada candidato.
-- El kanban dinámico necesita saber, por candidato, si ya tiene entrevistas, cuántas
-- evaluaciones se esperan y cuántas llegaron, y si ya hay configuración de alta.
-- Calcularlo en la app son 4 round-trips + agrupado en memoria repetidos en tres
-- páginas; aquí es una sola consulta.
--
-- `security_invoker = on` NO es opcional: sin él la vista corre con los privilegios
-- del owner y se salta el RLS de rec_candidatos. Requiere PG15+ (Supabase actual).
--
-- Corrige de paso un conteo mal hecho en el perfil del candidato: el total de
-- evaluaciones esperadas NO es el número de entrevistas. agendarSesion crea UNA
-- entrevista por candidato y N evaluaciones (una por entrevistador de la sesión),
-- así que el total correcto es jsonb_array_length(sesion.entrevistadores).

create view rec_candidato_requisitos with (security_invoker = on) as
select
  c.*,
  coalesce(x.entrevistas_total, 0)        as entrevistas_total,
  coalesce(x.evaluaciones_esperadas, 0)   as evaluaciones_esperadas,
  coalesce(x.evaluaciones_registradas, 0) as evaluaciones_registradas,
  (ac.candidato_id is not null)           as tiene_alta_config
from rec_candidatos c
left join lateral (
  select
    count(*)::int as entrevistas_total,
    -- Una evaluación esperada por entrevistador de la sesión de cada entrevista.
    coalesce(sum(coalesce(jsonb_array_length(s.entrevistadores), 0)), 0)::int
      as evaluaciones_esperadas,
    coalesce(sum(ev.registradas), 0)::int as evaluaciones_registradas
  from rec_entrevistas e
  join rec_sesiones_entrevistas s on s.id = e.sesion_id
  left join lateral (
    select count(*)::int as registradas
    from rec_evaluaciones ev2
    where ev2.entrevista_id = e.id and ev2.recomendacion is not null
  ) ev on true
  where e.candidato_id = c.id
) x on true
left join rec_alta_config ac on ac.candidato_id = c.id;

comment on view rec_candidato_requisitos is
  'rec_candidatos + requisitos derivados (entrevistas, evaluaciones esperadas/registradas, alta config). security_invoker: respeta el RLS de las tablas base.';
