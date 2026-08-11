-- ================================================================
-- TKT-045b — Agendar el cierre automático
--
-- Migración SEPARADA a propósito: si `pg_cron` no está disponible en
-- el plan, esta falla sola y la lógica de TKT-045 queda igual de
-- aplicada. En ese caso el fallback es llamar la función desde un cron
-- externo (Vercel Cron o cron-job.org, que ya se usa para Render).
--
-- Corre a las 3:00 (hora del servidor, UTC): fuera de horario laboral,
-- para que nadie vea un ticket cerrarse mientras lo mira.
-- ================================================================

create extension if not exists pg_cron;

-- `unschedule` primero para que la migración sea reejecutable.
do $$
begin
  perform cron.unschedule('tkt_autocierre');
exception when others then null;
end $$;

select cron.schedule(
  'tkt_autocierre',
  '0 3 * * *',
  $$select tkt_cerrar_resueltos_vencidos(3)$$
);
