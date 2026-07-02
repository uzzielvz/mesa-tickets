-- Tickets deja de ser universal: acceso explícito por flag, mismo patrón que
-- score/cartera/reclutamiento. Sin backfill a propósito (decisión 2026-07-02):
-- la mesa de tickets aún no se usa, todos arrancan en false y el admin otorga.
alter table public.profiles
  add column if not exists acceso_tickets boolean not null default false;

-- Se elimina el auto-onboarding (el usuario ya no elige su propia área):
-- el área y los accesos los asigna un admin desde /admin/usuarios.
-- Se droppea el RPC para que tampoco quede invocable vía API.
drop function if exists public.complete_onboarding(text, uuid);
