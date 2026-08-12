-- ================================================================
-- TKT-049 — Data Science: prioridad alta y 4 horas de atención
--
-- Los tipos de Data Science tenían prioridad media y SLA `null`
-- (variable). Con SLA nulo el reloj nunca corre: no aparecían en el
-- filtro "Vencidos" ni en la cifra de la cola, así que el área no se
-- estaba midiendo. Ahora tienen un compromiso real de 4 horas.
--
-- `alta` es el máximo del enum (no existe "urgente").
-- ================================================================

update problem_catalog
set prioridad = 'alta',
    sla_min = 240
where area_id = (select id from areas where nombre = 'Data Science');
