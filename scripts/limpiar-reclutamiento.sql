-- ============================================================================
-- Limpieza de datos operativos de Reclutamiento — arrancar la v1 en limpio
--
-- CÓMO SE USA: Supabase → SQL Editor. Pégalo por PASOS, no de corrido.
-- El PASO 0 no borra nada: te dice qué hay antes de destruirlo. Míralo primero.
--
-- ⚠️ ESTO NO SE PUEDE DESHACER. Supabase no tiene papelera.
--
-- ⚠️ NO LO CORRAS ANTES DE LA JUNTA si vas a enseñar la app: te deja el
--    pipeline vacío y no hay nada que demostrar.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 0 — Mirar antes de borrar. Corre solo esto primero.
-- ────────────────────────────────────────────────────────────────────────────

select 'vacantes'            as tabla, count(*) from rec_vacantes
union all select 'candidatos',            count(*) from rec_candidatos
union all select 'sesiones de entrevista', count(*) from rec_sesiones_entrevistas
union all select 'entrevistas',           count(*) from rec_entrevistas
union all select 'evaluaciones',          count(*) from rec_evaluaciones
union all select 'magic links',           count(*) from rec_magic_links
union all select 'historial de etapas',   count(*) from rec_candidato_historial
union all select 'config de alta',        count(*) from rec_alta_config
union all select 'correos enviados',      count(*) from rec_correos_enviados
order by 1;

-- Y sobre todo: ¿hay algún candidato REAL aquí, de alguna prueba de julio?
-- Si esta lista te sorprende, PARA y revisa antes de seguir.
select nombre, email, etapa, created_at
from rec_candidatos
order by created_at desc;


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 1 — Borrar los datos operativos.
--
-- Una sola sentencia: rec_vacantes cascadea a candidatos → sesiones →
-- entrevistas → evaluaciones → magic links → historial → config de alta.
-- ────────────────────────────────────────────────────────────────────────────

begin;

delete from rec_vacantes;

-- Revisa los conteos aquí. Si algo no cuadra: rollback; en vez de commit;
select 'vacantes' as tabla, count(*) from rec_vacantes
union all select 'candidatos',   count(*) from rec_candidatos
union all select 'entrevistas',  count(*) from rec_entrevistas
union all select 'evaluaciones', count(*) from rec_evaluaciones
union all select 'magic links',  count(*) from rec_magic_links;

commit;


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 2 (OPCIONAL) — La bitácora de correos.
--
-- No se borra en el paso 1 a propósito: `rec_correos_enviados.candidato_id`
-- es ON DELETE SET NULL, así que el registro de qué se envió SOBREVIVE aunque
-- el candidato desaparezca. Es el rastro de auditoría, y está diseñado así.
--
-- Bórrala solo si quieres que la pantalla "Correos enviados" arranque vacía.
-- Si vas a enseñarla en la junta como evidencia de que los correos salen,
-- NO CORRAS ESTO — ahí está tu prueba.
-- ────────────────────────────────────────────────────────────────────────────

-- delete from rec_correos_enviados;


-- ────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTE SCRIPT NO TOCA — Y NO DEBES BORRAR
--
--   rec_ajustes             Director General, los 7 destinatarios de altas y
--                           el interruptor de Factorial. Borrarlo deja el
--                           módulo sin configuración y bloquea el pase a DG.
--
--   rec_plantillas_correo   Los 6 correos. Borrarlos = reescribir los textos
--                           antes de poder agendar o contratar.
--
--   rec_credenciales_google La conexión con Google. Borrarla obliga a rehacer
--                           el OAuth y a volver a elegir la cuenta correcta.
--
-- Los tres son configuración, no datos. Un "empezar limpio" que se los lleve
-- no deja la plataforma limpia: la deja rota.
-- ────────────────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────────────────
-- APARTE — Los CV en Storage
--
-- Los CV viven en el bucket `reclutamiento` y NO se borran con el SQL de
-- arriba: quedan como archivos huérfanos. Se limpian desde
-- Supabase → Storage → reclutamiento.
--
-- ⚠️ NO BORRES LA CARPETA `plantillas/`. Ahí están los dos adjuntos fijos del
--    correo de bienvenida (layout de datos personales y lineamientos de
--    fotografías). Sin ellos, el correo sale sin adjuntos y en silencio.
-- ────────────────────────────────────────────────────────────────────────────
