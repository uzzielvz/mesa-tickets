-- REC-067 — S7.5: ajustes del módulo de Reclutamiento editables desde la app.
-- Hasta ahora el correo del Director General y los 7 destinatarios internos del
-- correo de altas vivían como constantes en lib/schemas/reclutamiento.ts: no se
-- podían cambiar sin desplegar, y probar el flujo implicaba mandarle correos
-- reales a media empresa.
--
-- Diseño: una sola tabla key/value. Son dos objetos de configuración global, sin
-- relaciones ni consultas por campo; tablas separadas costarían el doble de
-- migraciones y tipos a cambio de nada. Los CC por plantilla NO se duplican aquí:
-- rec_plantillas_correo.cc_emails ya existe y ya se consume, solo le faltaba UI.
--
-- RLS: lectura y escritura con acceso_reclutamiento o admin (mismo patrón que el
-- resto de tablas rec_*). El operador real del módulo tiene el flag pero no es
-- admin; con escritura admin-only no podría cambiar un correo. La auditoría queda
-- en actualizado_por / actualizado_at.

create table rec_ajustes (
  clave          text primary key,
  valor          jsonb not null,
  actualizado_at timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

comment on table rec_ajustes is
  'Configuración del módulo de Reclutamiento (key/value). Claves: dg, alta_destinatarios.';

alter table rec_ajustes enable row level security;

create policy "rec_ajustes_all" on rec_ajustes
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

-- Seed con los valores que hoy están quemados en el código.
-- `do nothing` a propósito: si el usuario ya configuró algo, esta migración no lo pisa.
insert into rec_ajustes (clave, valor) values
(
  'dg',
  jsonb_build_object(
    'email', 'jvargas@financieracrediflexi.com',
    'nombre', 'Javier Vargas',
    'duracion_min', 30
  )
),
(
  'alta_destinatarios',
  jsonb_build_object(
    'rh_firmas',    'brendoli.durante@financieracrediflexi.com',
    'correos',      'julio.melquiades@financieracrediflexi.com',
    'induccion',    'jesus.montellano@financieracrediflexi.com',
    'alta_yunius',  'dtorres@financieracrediflexi.com',
    'alta_hubspot', 'rolando.davila@financieracrediflexi.com',
    'jefe_directo', '',
    'cc_adicional', 'ncastaneda@financieracrediflexi.com'
  )
)
on conflict (clave) do nothing;
