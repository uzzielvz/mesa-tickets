-- ================================================================
-- TKT-045 — Cierre automático de tickets resueltos sin confirmar
--
-- Problema: si el solicitante nunca confirma, el ticket se queda en
-- `resuelto` para siempre. Se acumula un limbo de tickets que el área
-- ya atendió pero que las métricas nunca cuentan como cerrados, y la
-- cola deja de reflejar la realidad.
--
-- Regla: 3 días naturales en `resuelto` sin que nadie diga nada → se
-- cierra solo. Solo aplica a `resuelto`; un ticket en pausa
-- (`programado`) NO se toca, porque ahí la espera es legítima.
--
-- El cierre queda en la bitácora con actor NULL, que la UI muestra
-- como "Sistema" — se distingue de un cierre humano.
-- ================================================================

create or replace function tkt_cerrar_resueltos_vencidos(p_dias int default 3)
returns int
language plpgsql security definer
as $$
declare
  v_cerrados int;
begin
  with vencidos as (
    select t.id
    from tickets t
    where t.estado = 'resuelto'
      -- Desde la última señal de vida en el ticket: si alguien escribió
      -- ayer, no se cierra hoy aunque se marcara resuelto hace una semana.
      and coalesce(
            (select max(r.created_at) from ticket_responses r where r.ticket_id = t.id),
            t.created_at
          ) < now() - make_interval(days => p_dias)
  )
  update tickets t
  set estado = 'cerrado',
      closed_at = now()
  from vencidos v
  where t.id = v.id;

  get diagnostics v_cerrados = row_count;
  return v_cerrados;
end;
$$;

comment on function tkt_cerrar_resueltos_vencidos(int) is
  'Cierra los tickets en `resuelto` sin actividad en N días (default 3). Devuelve cuántos cerró. Idempotente: correrla dos veces no hace daño.';

-- Nadie la llama desde el cliente: la dispara el agendador.
revoke execute on function tkt_cerrar_resueltos_vencidos(int) from public;
revoke execute on function tkt_cerrar_resueltos_vencidos(int) from authenticated;
