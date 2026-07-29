-- REC-061 — S7: configuración de alta por candidato (etapa 'oferta') + plantilla
-- del correo interno "Altas Nuevos Ingresos".
-- (a) Tabla rec_alta_config 1:1 con rec_candidatos: equipo, sistemas, inducción y
--     destinatarios internos que se prellenan y se editan al momento.
-- (b) RLS admin/reclutamiento (mismo patrón que el resto de tablas rec_*).
-- (c) Seed de la plantilla altas_nuevos_ingresos. Las líneas de tarea por rol se
--     arman en la app según lo marcado (placeholder {{tareas}}); los datos básicos
--     del candidato salen de sus placeholders. La "tabla completa" de datos
--     personales se enriquece cuando S8 los capture (gancho en el render).

-- ── a) Configuración de alta por candidato ──────────────────────────────────
create table rec_alta_config (
  candidato_id       uuid primary key references rec_candidatos(id) on delete cascade,
  equipo             jsonb not null default '[]'::jsonb,  -- ['celular','laptop','desktop']
  sistemas           jsonb not null default '[]'::jsonb,  -- ['yunius','hubspot','otros']
  otros_texto        text,                                -- detalle cuando sistemas incluye 'otros'
  induccion_fecha    date,
  induccion_meet_url text,
  destinatarios      jsonb not null default '{}'::jsonb,  -- { rh_firmas, correos, induccion, alta_yunius, alta_hubspot, jefe_directo, cc_adicional }
  actualizado_at     timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- ── b) RLS ──────────────────────────────────────────────────────────────────
alter table rec_alta_config enable row level security;

create policy "rec_alta_config_all" on rec_alta_config
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

-- ── c) Plantilla del correo interno de altas ────────────────────────────────
insert into rec_plantillas_correo (codigo, asunto, cuerpo, cc_emails) values
(
  'altas_nuevos_ingresos',
  'Altas nuevos ingresos — {{nombre_candidato}} ({{puesto}})',
  $tpl$Estimados,
Buen día.

Les compartimos los datos del nuevo ingreso para que realicen las altas y tareas que correspondan a cada área:

* Nombre: {{nombre_candidato}}
* Puesto: {{puesto}}
* Plaza / zona: {{plaza}}
* Jefe directo: {{jefe_directo}}
* Fecha de inicio: {{fecha_ingreso}}
* Equipo asignado: {{equipo}}
* Sistemas: {{sistemas}}

Tareas por área:
{{tareas}}

Quedamos atentos a cualquier duda.

Saludos cordiales
Reclutamiento Crediflexi$tpl$,
  '[]'::jsonb
)
on conflict (codigo) do update set
  asunto    = excluded.asunto,
  cuerpo    = excluded.cuerpo,
  cc_emails = excluded.cc_emails;
