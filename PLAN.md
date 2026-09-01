# PLAN — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Plan de trabajo activo organizado por módulo.
> Se actualiza tras cada sesión.
> Para el contexto completo del repo ver `RESEARCH-CONSOLIDADO.md`.
> Última actualización: 2026-08-31 (**Inversiones I1 entregado** §9.3 · **Reclutamiento REC-024**, exportación a CSV, §8.15).

---

## 0. Foco actual — punto de partida (2026-08-24)

> **Esta sección manda sobre el resto del documento.** Si algo de §1–§8 contradice lo de aquí, gana esto.

**Decisión (2026-08-11, vigente):** el trabajo se concentra en **Mesa de Tickets**. Cartera, Score y Factorial quedan **en pausa** — sin desarrollo nuevo. Siguen desplegados y funcionando; lo que se detiene es construir sobre ellos.

> **Enmienda (2026-08-18):** se abrió una **segunda vía activa, Actividades** (§2.6), a petición directa: portar a la plataforma un tablero de Power BI sobre el uso del tiempo del equipo. No cancela el foco en tickets — la cola de abajo sigue vigente y sin avanzar.

> **Enmienda (2026-08-24):** **Reclutamiento sale de la pausa y entra en lanzamiento** (§0 bis). No es desarrollo nuevo: el código estaba completo desde el 31 de julio. Lo que se hizo fue el **paquete de entrega** que le faltaba — documentación, manual, runbook, guion de validación, presentación y anuncio. La vía de tickets no avanzó.

> **Enmienda (2026-08-29):** se abre una **tercera vía, Inversiones** (§9), a petición directa: custodiar y consultar los dos reportes que Felix genera a diario desde Yunius. Research completo en `RESEARCH §14`, plan en **§9**, **sin código todavía**. Alcance del v1 cerrado el mismo día: repositorio + vistas de Tesorería + Tablero Ejecutivo, los dos reportes, **sin chat de IA**. La cola de tickets de abajo sigue vigente y sin avanzar.

### Vía activa — Mesa de Tickets

**Estado.** El 2026-08-10 el módulo cerró su salto de **individual a de equipo** (cola por área, estados explícitos, reasignación, bitácora, notificaciones, guía contextual, alta sin elegir área) — §2.2 fase *Tickets-Equipo*, `RESEARCH §5.1.7`. El **11 y 12 de agosto** siguió una segunda tanda que el documento no registró en su momento: supervisión de la mesa, flujo simplificado por tipo, autocierre y el arreglo del remitente de correo (**TKT-043..049**) — §2.2 fase *Tickets-Supervisión y flujo*.

> **⚠ Zona sin registro: del 2026-08-12 al 2026-08-18.**
>
> El último commit de tickets es del **12 de agosto** (`70b717b`, TKT-049) y esta puesta al día es del **18**. En medio no hay commits, `sessions.md` no se versiona y el reloj de sesión estaba vacío, así que **no hay forma de saber qué se hizo o se probó en esos seis días**. Todo lo que la tabla de abajo marca como pendiente puede estar ya resuelto sin registro: confirmarlo antes de trabajar sobre ello.
>
> **Cerrado el 2026-08-18 (punto 2):** `supabase migration list` confirma que **las 8 migraciones del 11-12 sí están en remoto**, incluida `20260811170100_tkt_autocierre_cron.sql` — o sea que `pg_cron` estaba disponible y el job quedó agendado. Falta comprobar que *corra*, no que exista.

**Lo que sigue, en orden:**

| # | Qué | Por qué primero |
|---|---|---|
| 1 | **Los correos no salen — pendiente #1** | El remitente ya es de la plataforma (`TICKETS_GOOGLE_REFRESH_TOKEN` + `TICKETS_SENDER_EMAIL`, fuera de la BD para que ningún usuario lo cambie — TKT-047/048), pero **al 2026-08-12 no se había visto llegar ningún correo**. Diagnóstico listo: `GET /api/tickets/probar-correo` (solo admin) revisa variables → token → cuenta real → envío de prueba, y dice cuál de los cuatro falla. El token se regenera con `scripts/google-token-plataforma.mjs`, que imprime las dos variables listas para pegar. Ojo: las variables nuevas **exigen redespliegue** en Vercel. |
| 2 | ~~Confirmar que las 8 migraciones del 11-12 están en remoto~~ → **comprobar que el autocierre *corre*** | ✅ **2026-08-18**: las 8 están aplicadas, incluida la de `pg_cron`. Lo que queda es verificar que el job dispare de verdad (forzar con `tkt_cerrar_resueltos_vencidos(0)` o revisar `cron.job_run_details`). Si no corriera, el plan B sigue siendo un cron externo. ⚠️ **`npm run db:status` / `db:push` están rotos**: `bin/supabase.exe` es un shim que busca un binario `supabase-go` que no está en `bin/`. Salida: `npx supabase@2.115.0 <cmd>`. |
| 3 | **Smoke end-to-end con clicks** | Guion listo en `docs/mocktest-mesa-tickets.md` (7 bloques, ~35 min, contra producción, dos cuentas). Nada de lo entregado el 10-12 de agosto se probó contra datos reales; sus tres cubetas de hallazgos siguen vacías. |
| 4 | **Revisar `area_id` y `supervisa_tickets` en `/admin/usuarios`** | La RLS deja que **todo el que tenga un área vea todos los tickets de esa área**, y desde TKT-043 quien tenga el flag de supervisión **ve todas las colas**. Correcto para una mesa, pero exige la lista limpia. |
| 5 | **Métricas sobre la bitácora** | % de cumplimiento de SLA, tiempo de primera respuesta, tiempo real por estado, carga por técnico. Los datos se acumulan desde el 2026-08-10; antes no hay con qué reconstruirlos. |
| 6 | **T-P4 — seguridad de escritura** | `profiles_select using (true)` y las mutaciones de crear/responder que aún salen del navegador (SEC-001, RLS-001/002/004/005). |
| 7 | **TKT-008 notas internas · paginación · pantalla `/admin/tickets`** | Los gaps que quedan del benchmark. **TKT-007 quedó a medias**: TKT-043 dio la *capacidad* (el supervisor lee y toma de cualquier cola, y `/tickets/area` tiene selector de área), falta la pantalla de administración como tal. |

**Pendientes de catálogo** (detalle en `docs/catalogo-tickets.md`, la fuente de verdad de los 11 tipos vivos): confirmar campos y evidencia de los dos tipos creados desde la UI (*Aclaración de mora*, *Falla en el sistema*); definir si **Tesorería** quiere un SLA real (hoy variable = nunca vence, nunca aparece en la cifra de vencidos); confirmar que las tres pausas de "siguiente corte" comparten cadencia; limpiar `responsable_default_id`, que sigue en el catálogo pero ya no se usa desde que el ticket nace en la cola.

**Deuda menor viva:** plantillas de correo y frases frecuentes de tickets viven en el código (las de Reclutamiento sí se editan desde Ajustes); el SLA no acumula pausas — con `ticket_historial` ya hay con qué calcularlo bien.

### Vía en lanzamiento — Reclutamiento v1 *(2026-08-24)*

**Estado.** El módulo está completo de `postulado` a `contratado` desde S9.5 (2026-07-31). Lo que faltaba no era código sino **entrega**: nadie sabía usarlo, no había manual, y **nunca se ejercitó de punta a punta** — ninguno de sus 6 correos se ha visto llegar en un flujo real.

El **2026-08-24** se produjo el paquete de lanzamiento completo en `docs/reclutamiento/` (índice en su `README.md`):

| Documento | Para quién |
|---|---|
| `manual-usuario.md` | Quien opera el módulo (RH) |
| `documentacion-funcional.md` | Referencia del sistema: pipeline, cascada, correos, permisos, arquitectura, **límites de la v1** |
| `runbook-operacion.md` | Quien lo mantiene: modos de falla, best-effort vs bloqueante, kill switch, riesgos abiertos |
| `prevuelo-lanzamiento.md` | Validación previa, 7 bloques, con criterio de go/no-go |
| `presentacion-lanzamiento.html` | Deck de 20 slides (ejecutivo + operativo + alcance) |
| `anuncio-lanzamiento.md` | Tres textos de anuncio, por audiencia |

**Decisiones de lanzamiento:**
- **Factorial HR se queda apagado en v1** (`sync_activa = false`). Nunca se validó contra producción; el primer candidato real no debe ser la prueba. Procedimiento para encenderla en el runbook §6.
- **El anuncio va después del pre-vuelo**, no antes. Criterio de GO: los 6 correos en verde en la bitácora + el magic link abriendo sin sesión.

**Lo que sigue, en orden:**

| # | Qué | Notas |
|---|---|---|
| 1 | **Correr el pre-vuelo** (`docs/reclutamiento/prevuelo-lanzamiento.md`) | Exige sesión de navegador y dos cuentas de correo. Su Bloque 0 cierra los tres riesgos de configuración. |
| 2 | **Arreglar lo que salga en 🔴** | Si aparece un defecto real, se atiende antes de anunciar |
| 3 | **Anunciar** (`anuncio-lanzamiento.md`) | Los tres textos, en especial el #2 a las áreas que empiezan a recibir el aviso automático de altas |
| 4 | **Validar y encender Factorial** | Alta de prueba contra producción → borrarla → activar el interruptor |
| 5 | **S10 — onboarding del candidato** (§8.12) | Sustituye el layout xlsx + Google Form. Ya está planeado a detalle |

**Riesgos vivos:**
- ~~**Peligro al pausar:** 3 empleados reales en el CC de `bienvenida_contratacion`~~ → **resuelto como riesgo, no como bug**: el formulario de contratación muestra el CC y deja editarlo antes de enviar, y el pre-vuelo (paso 0.7) obliga a confirmar la lista. Los 5 destinatarios reales del correo de altas y el correo del DG (`rec_020`) tienen el mismo tratamiento en el paso 0.3.
- **Retención de datos de candidatos** (§8.7, punto 4): el módulo guarda CV, teléfono y correo de personas no contratadas, sin política de purga, en una entidad regulada. **Sin dueño asignado.** Documentado en el runbook §7 (R-1) para que no se lance en silencio.
- **Sin regeneración de magic links vencidos** (runbook §7, R-2) — límite conocido de la v1.

### Vías en pausa — cómo quedaron congeladas

**Factorial HR** — entregado (S9), **apagado a propósito**: `rec_ajustes.factorial.sync_activa = false`. Así se queda. Para reanudar: encender el interruptor y validar alta + idempotencia (`factorial_employee_id`) contra producción.

**Cartera** — paridad con el legacy alcanzada (ETL, 5 RPCs, 5 dashboards, asistente Gemini). Pendientes al reanudar: `loan_amortizacion_individual` sigue vacía (bloquea drill-down y liquidación anticipada) y faltan los endpoints GET (CART-015). Operativo del usuario: el wake-up de cron-job.org contra Render Free.

**Score** — estable, sin pendientes urgentes (DB-001/002 robustez).

**Condición para reanudar cualquiera:** que la vía de tickets llegue al punto 4 de su lista, o que un pendiente de la vía pausada se vuelva urgente por el negocio.

---

## 1. Definición de v1.0

> **Nota de alcance (2026-08-04):** esta definición se escribió cuando el repo era *tickets + cartera*. Desde entonces **Reclutamiento** creció hasta ser el módulo más grande y con más automatización externa (Google Workspace + Factorial HR), así que se incorpora explícitamente. La plataforma dejó de ser "una mesa de tickets con un dashboard": es el **sistema operativo interno de CrediFlexi** — cada módulo sustituye un proceso que hoy vive en Excel, WhatsApp o correo.

**Cuándo damos por cerrada la versión actual:**

1. **Cartera Individual con paridad funcional vs el legacy**: ETL completo (todas las columnas), microservicio desplegado con auth, capa de consulta lista, y al menos 4 dashboards (resumen ejecutivo, coord × PAR, recuperador, mora operativa).
2. **RLS endurecida** en tickets: `ticket_attachments.insert` valida participación, bucket Storage `ticket-attachments` con políticas versionadas.
3. **Feedback de errores visible** en creación de tickets y adjuntos iniciales mostrados en el hilo. *(✅ hecho 2026-05-25.)*
4. **Tipos Supabase regenerados** (`supabase gen types`) incluyendo cartera y RPCs.
5. **Smoke E2E** mínimo (login + crear ticket + crear acreditado + cargar cartera) corriendo en local.
6. **Reclutamiento operable de punta a punta sin retranscripción**: el pipeline `postulado → contratado` completo desde el kanban (✅ S1–S9), **más** (a) smoke test end-to-end ejecutado con correos de prueba y verificado en `rec_correos_enviados`, y (b) el alta en Factorial validada contra producción con el interruptor encendido. Hoy ambos están pendientes — el código existe, la validación con datos reales no.
7. **Mesa de tickets con dueño real del trabajo**: cola por área y estados explícitos (T-P1/T-P2). *(✅ 2026-08-10 — el ticket nace en la cola de su área, se toma con un clic y avanza por estados que controla el responsable.)*

**Lo que NO entra en v1.0** (queda para v1.1+):
- Chat IA en cartera.
- Drill-down de crédito + Liquidación anticipada real (requiere `loan_amortizacion_individual` poblada).
- Hojas externas del legacy (`Cobranza`, `Asignación`, `Recuperación`).
- Notificaciones email (Resend).
- Dominio custom.
- Tests E2E completos.
- `supabase db push` automatizado en CI *(ya hay flujo local, falta GitHub Action)*.
- Migración total de mutaciones de tickets a Server Actions (se hace gradual post v1.0).

---

## 2. Fases por módulo

### 2.1 Módulo Cartera *(eje estratégico)*

**Objetivo**: reemplazar progresivamente la información que entrega el legacy (`automatizador-crediflexi`) con dashboards interactivos en la plataforma. El legacy NO se toca; queda como referente.

#### Fase Cartera-0 — Especificación del contrato de datos *(gating absoluto)*

> Sin entender exactamente qué columnas trae el input y qué entrega el output, cualquier ETL es a ciegas. Esta fase cierra el contrato antes de tocar código.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C0-1 | CART-000 | ✅ **2026-05-28** — Análisis profundo del **input** (63 cols × 343 filas sample). `docs/cartera/input-analysis.md`. | — |
| C0-2 | CART-000b | ✅ **2026-05-28** — Análisis profundo del **output** (FINAL TARGET vs nuevo). `docs/cartera/output-analysis.md`. | — |
| C0-3 | CART-000c | ✅ **2026-05-28** — **Matriz de mapeo definitiva** input ↔ schema ↔ output + checklist de aceptación. `docs/cartera/mapping-matrix.md`. | C0-1, C0-2 |
| C0-4 | CART-000d | ✅ **2026-05-28** — Migración `20260528190511_cart_000d_cols_faltantes.sql`: agrega 11 cols faltantes a `stg_yunius_cartera_individual` (`situacion_credito`, `medio_comunic_2/3`, `tipo/desc/garantia_2`, `calle`, `colonia`, `nom_personal_castiga_cartera`, `frecuencia`, `parcialidad_comision`) y extiende `loan_amortizacion_individual` con `fuente_fecha_liquidacion`, `es_no_aplica_liquidacion`, `codigo_ciclo` (+ índice). `concepto_deposito` ya existía. | C0-3 |
| C0-5 | — | ✅ **2026-05-28** — `RESEARCH §5.4.9` con hallazgos + plan de cierre en 5 pasos. | C0-3 |

#### Fase Cartera-1 — Cerrar el pipeline ETL (1 semana)

> Implementar el contrato cerrado en Cartera-0.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C1-1 | CART-001 | ✅ **2026-05-30** — PR #1 squash-mergeado a `master` (commit `7d7d626`). Refactor `df_a_registros()` con `EXCEL_TO_SCHEMA` (54 cols) + `DERIVED_TO_SCHEMA` (7) verificado en smoke local (215 filas, 11 cols nuevas pobladas). Filtro `CODIGOS_RECUPERADOR_EXCLUIR` pospuesto a C1-4. Brief `docs/handoff/CART-001-refactor-etl.md` v1.1. | C0-4 |
| C1-2 | CART-002 | Asegurar que `fecha_inicio_ciclo` se llena (habilita segmentación cohort por mes). Crítico si la demo incluye cohort. | C1-1 |
| C1-3 | CART-005 | Validar `fecha_corte` contra el contenido del Excel al procesar. **No crítico para demo.** | C1-1 |
| C1-4 | CART-006 | Módulo nuevo `cartera_export.py` que regenera el `.xlsx` FINAL TARGET (12 hojas, excluye `Recuperación`/`Cobranza`/`amortizaciones_test` en v1) + endpoint `GET /cartera/export/{fecha_corte}`. Crítico solo si la demo muestra descarga Excel. | C1-1 |
| C1-5 | OPS-001 | ✅ **2026-05-30** — Microservicio LIVE en `https://crediflexi-services.onrender.com` (Render Free, region oregon, autoDeploy). PR #2 mergeado a master (5 commits, sin firma Claude). Smoke E2E productivo OK: 215 filas insertadas vía Vercel → Render → Supabase (`fecha_corte=2026-05-30`). Pendiente: cron-job.org wake-up cada 10 min para evitar cold start. Brief `docs/handoff/OPS-001-deploy-microservicio.md` v1.0. | C1-1 |
| C1-6 | SEC-002 | ✅ **2026-06-17** — Auth entre `/api/cartera/procesar` y microservicio vía **token compartido** (`INTERNAL_API_TOKEN`, mismo valor en Vercel y Render). Next.js manda `Authorization: Bearer <token>`; el micro valida con `secrets.compare_digest` y responde 401 si no coincide (fail-closed: sin token configurado rechaza todo). Se descartó HMAC por sobre-ingeniería para tráfico server-to-server interno sobre HTTPS. | C1-5 |
| C1-7 | TYP-001 | ✅ **2026-05-28** — Tipos espejo generados en `lib/supabase/database.types.ts` (1112 líneas). Script `npm run db:types` para regenerar. `types.ts` (manual, dominio/UI) intacto. | C0-4 |
| C1-8 | CART-016 ✅ 2026-06-17 | **2026-06-17** — Alinear `EXCEL_TO_SCHEMA` con el insumo **real** de Yunius (verificado ejecutando `transformar()`+`df_a_registros()` contra `docs/etl/bruto.xlsx`, 63 cols × 187 filas → 160 registros post-fraude): (a) la columna viene **fusionada** `"Parcialidad + Parcialidad comisión"` → mapear a `parcialidad`, dejar `parcialidad_comision` en NULL (se elimina la suma separada) — poblada 160/160; (b) el encabezado real es `"$ Último pago"` (con `Ú` mayúscula y `$`), no `"Monto último pago"` → `monto_ultimo_pago`; el lookup es exact-match así que la mayúscula importa — poblado 133/160 (27 NULL = créditos sin pago aún); (c) robustez en `cargar_excel` (detectar fila de encabezado por ancla "Código acreditado", tolera fila de título). `Suma` no existe en el insumo (scratch del output) → sin cambio. `Link de Geolocalización` y `Próximo Pago` son columnas del **output**, no del insumo → se difieren al export (CART-006); `Próximo Pago` además requiere una 2ª fuente (Reporte de Cobranza). | C1-1 |

#### Fase Cartera-2 — Capa de consulta (3-5 días)

> RPCs y vistas que alimentan los dashboards. Empuja la agregación al servidor.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C2-1 | CART-010 | ✅ **2026-05-30** — RPC `cartera_resumen(p_fecha_corte date) returns json`. Migraciones `20260531031407_cart_010_resumen_rpc.sql` + `20260531033054_cart_010b_resumen_saldo_total.sql`. Devuelve `totales` (5 campos), `par` (8 buckets), `indicadores` (PAR>30/>90). Métrica = `saldo_total` (estándar industria). Security definer + grant a authenticated + check `rol=admin OR acceso_cartera=true`. Validado con 215 filas (fecha_corte 2026-05-30): pct_par_30=34.52, pct_par_90=15.95, pct_mora=51.20. | C1-1 |
| C2-2 | CART-011 | ✅ **2026-06-02** — RPC `cartera_por_coordinacion(p_fecha_corte date) returns json`. Migración `20260602135452_cart_011_por_coordinacion_rpc.sql`. Array de coordinaciones con totales + indicadores (pct_mora, PAR>30/90) + 8 buckets PAR c/u. Ordenado por `pct_par_30 desc`. Validado: 5 coords (Valle de Bravo peor 43.76% PAR>30, Metepec mejor 27.39%), suma 215 créditos / 5.1M cartera. | C1-1 |
| C2-3 | CART-012 | ✅ **2026-06-02** — RPC `cartera_por_recuperador(p_fecha_corte date, p_coordinacion text default null)`. Migración `20260602142131_cart_012_por_recuperador_rpc.sql`. Array de recuperadores (codigo+nombre+coordinacion) con totales + PAR>30/90 + 8 buckets. Filtro opcional por coordinación. Ordenado por `pct_par_30 desc`. Validado: 7 recuperadores (000020 Campos Sánchez 100% PAR>90 crítico; CALL CENTER 104 créditos / 8.97% PAR>30), suma 215 / 5.1M. Nota: "mi cartera" role-based pendiente (profiles sin codigo_recuperador). | C1-1 |
| C2-4 | CART-013 | ✅ **2026-06-02** — RPC `cartera_mora_operativa(p_fecha_corte date, p_coordinacion text default null, p_dias_min int default 1)`. Migración `20260602144732_cart_013_mora_operativa_rpc.sql`. Devuelve filas individuales de morosos (acreditado, recuperador, días, bucket, saldos vencidos, alerta, contacto). Filtros por coordinación y días mín. Ordenado por días desc. Validado: 120 morosos (top GARCIA REYES GUADALUPE, 529 días). Cols de seguimiento Call Center/Campo NO en BD aún (mock en UI). | C1-1 |
| C2-5 | CART-014 | ✅ **2026-06-02** — RPC `cartera_cohort(p_fecha_corte date, p_frontera date default '2026-04-01')`. Migración `20260602152000_cart_014_cohort_rpc.sql`. Parte la cartera en 2 cohortes por `fecha_inicio_ciclo` (`antes`/`desde` la frontera), cada una con totales + PAR (8 buckets) + PAR>30/90 (mismo contrato que `cartera_resumen`). Reporta `sin_fecha` para que cuadre el total. Validado: 215 créditos, `sin_fecha=0` (fecha_inicio_ciclo 100% poblado, rango 2023-08 a 2025-11). Nota: esta muestra no tiene ciclos 2026, por eso la frontera default deja una cohorte vacía → frontera configurable en UI. | C1-1 |
| C2-6 | CART-015 | Endpoints GET `/api/cartera/{resumen,coordinacion,recuperador,mora,cohort}` que llamen los RPCs | C2-1..C2-5 |

#### Fase Cartera-3 — Dashboards (paridad con legacy) (1-2 semanas)

> Orden por valor demo / esfuerzo. Cada dashboard consume un RPC de Fase 2.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| ✅ C3-1 | DASH-001 | `/cartera` — snapshot ejecutivo: cards (total cartera, total mora, % PAR>30, % PAR>90), tabla distribución PAR, selectores (fecha, coord, recuperador, ciclo) | C2-1 |
| ✅ C3-2 | DASH-002 | **2026-06-02** — `/cartera/coordinacion`: tabla de riesgo por coordinación (créditos, cartera, %mora, PAR>30/90 con semáforo) + tabla distribución coord × 8 buckets con heatmap por % de fila. Selector de fecha reutilizable. Item "Coordinación" agregado al sidebar. | C2-2 |
| ✅ C3-3 | DASH-003 | **2026-06-02** — `/cartera/recuperador`: tabla riesgo por recuperador (codigo+nombre+coordinación, %mora, PAR>30/90 semáforo) + distribución recuperador × 8 buckets heatmap. Filtro opcional por coordinación (`recuperador-filters.tsx`). Item "Recuperador" en sidebar. "Mi cartera" role-based diferido (falta mapeo profile→recuperador). | C2-3 |
| ✅ C3-4 | DASH-004 | **2026-06-02** — `/cartera/mora`: bandeja operativa de cobranza. Tabla client interactiva (búsqueda por acreditado/código/recuperador, orden por días/saldo/nombre) con datos reales de los 120 morosos. Filtros fecha+coordinación+días mín (`mora-filters.tsx`). **Columnas de gestión (Estatus llamada, Acuerdo, Monto, Nota) MOCKEADAS**: editables con estado local, sin persistir, con banner "modo demostración". Item "Bandeja de mora" en sidebar. Pendiente: tabla `cartera_seguimiento` + persistencia (siguiente feature, supera al Excel). | C2-4 |
| ✅ C3-5 | DASH-005 | **2026-06-02** — `/cartera/cohort`: comparativo de 2 cohortes lado a lado (etiquetas "Antes del 1-abr" / "Desde el 1-abr", solo nombres — el corte real es la fecha frontera, equivalente a hojas `Marzo`/`Abril` del legacy). Cada panel: indicadores (%mora, PAR>30/90) + distribución PAR 8 buckets con barras. Selector de fecha de corte + **selector de fecha frontera** (`frontera-selector.tsx`, default 1-abr-2026, editable con botón "Default"). Item "Cohortes" en sidebar. | C2-5 |

#### Fase Cartera-4 — Superación del Excel (post-paridad)

> Lo que el Excel NO ofrece y la plataforma sí debe ofrecer.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C4-1 | CART-003 | Integrar fuente externa de amortizaciones → poblar `loan_amortizacion_individual` | — (TBD usuario) |
| C4-2 | DASH-010 | Drill-down de crédito (clic → ver calendario de cuotas, mora, fechas) | C4-1 |
| C4-3 | DASH-011 | Liquidación anticipada real (cálculo desde amortizaciones, no VLOOKUP) | C4-1 |
| C4-4 | DASH-012 | Comparativa multi-corte (mismo recuperador entre dos fechas) | C2-1 |
| C4-5 | DASH-013 | Exportación Excel/CSV bajo demanda (replica formato legacy si se requiere) | C3-* |
| C4-6 | PRO-004 | ✅ **2026-06-04** — Demo determinística de `/cartera/chat` entregada (KB embebida, sin LLM). Evolución a agente real → §2.5 (AI-*). | C3-* |

### 2.2 Módulo Tickets

> **2026-06-06 — Decisión de alcance**: la "demo" es en realidad un **go-live a producción** con 3 tipos de ticket reales (PII de clientes). Después se agregan más tipos/funciones incrementalmente. Volumen inicial ~17/semana (12 FICHA + 2 CRÉDITO + 3 MORA), crece con el tiempo. Búsqueda/paginación/SLA NO urgen aún.

#### Fase Tickets-Producción *(go-live · 3 tipos reales)* — BLOQUEANTE

> Los 3 flujos comparten patrón: **Comercial reporta → Tesorería/Data Science valida → resuelto o rechazado**, con un caso "se carga en el segundo corte". Dos cambios estructurales + endurecer seguridad antes de meter PII real.

| # | Ticket | Descripción | Tipo | Bloqueado por |
|---|--------|-------------|------|---------------|
| T-P1 | TKT-020 | **Modelo de cola por área** — ✅ **2026-08-10** (mig. `20260810120000`, TKT-031/033/035). El ticket pertenece a un **área** (`tickets.area_id`, backfill + trigger) y `responsable_id` es **nullable** hasta que alguien del área lo toma vía RPC `tkt_tomar_ticket`. Nueva pantalla `/tickets/area` (Sin tomar / En curso, ordenada por urgencia) + ítem del sidebar con contador de sin-tomar. RLS: `es_de_area()` amplía el select de tickets/respuestas/adjuntos. Al levantar, el ticket **nace sin responsable**. Reasignación manual entre personas sigue pendiente (TKT-002). | Estructural | ✅ 2026-08-10 |
| T-P2 | TKT-021 | **Estados explícitos** — ✅ **2026-08-10** (mig. `20260810120100`, TKT-032/034/036/037). Enum `ticket_estado`: **Abierto → En revisión → Programado → Resuelto/Rechazado → Cerrado**, columna `tickets.estado` con backfill desde la lógica derivada (ningún ticket vivo cambió de estatus al desplegar). RPC `tkt_cambiar_estado` valida transiciones; los tipos de respuesta existentes sincronizan estado por trigger. **Se acabó la paridad** → TKT-001 resuelto. El SLA corre en `abierto`/`en_revision` y se pausa en `programado` (pausas no acumulables — llevar tiempo acumulado exigiría bitácora de estados). La vista pasa a `left join profiles` (con responsable NULL el join interno ocultaba los tickets de la cola). | Estructural | ✅ 2026-08-10 |
| T-P3 | TKT-022 | ✅ **superado por los hechos**. Nació como "seed de los 3 tipos" (Tesorería + Data Science). Hoy el catálogo vivo son **11 tipos en 4 áreas** — Sistemas (6), Tesorería (2), Data Science (2) y **Call Center** (1, área que no existía cuando se escribió esta fila) — con campos dinámicos, prioridad, SLA, modalidad y etiqueta de pausa. 9 vienen de migraciones; 2 se dieron de alta desde `/admin/catalogo` y su configuración fina está por confirmar. **Fuente de verdad: `docs/catalogo-tickets.md`** (+ PDF de una página para compartir). | Datos | ✅ |
| T-P4 | RLS-001/002/004/005 + SEC-001 | **Seguridad full antes de PII real** (ver Fase Tickets-Seguridad/Arquitectura abajo). Con datos reales de clientes pasa de "nice to have" a **bloqueante de go-live**: cerrar `profiles_select` (RLS-002), validar participación en adjuntos lectura+escritura/Storage (RLS-001/005), bloquear respuestas en tickets cerrados (RLS-004), migrar mutaciones a Server Actions con Zod servidor (SEC-001). | Seguridad | — |

#### Fase Tickets-Demo *(esta semana)*

| # | Ticket | Estado | Notas |
|---|--------|--------|-------|
| T-D1 | UI-001 | ✅ 2026-05-25 | Toast de error en creación |
| T-D2 | UI-002 | ✅ 2026-05-25 | Adjuntos iniciales visibles |
| T-D3 | — | 🔲 | Smoke local: login → crear → responder → cerrar |
| T-D4 | UI-003 | 🔲 | Copy de error en login (`?error=auth`) |
| T-D5 | UI-004 | 🔲 | `app/error.tsx` global para no mostrar pantalla blanca |

#### Fase Tickets-Seguridad

| # | Ticket | Descripción |
|---|--------|-------------|
| T-S1 | RLS-001 | Policy `attachments_insert` con EXISTS sobre participación |
| T-S2 | RLS-005 | Migración versionada de políticas Storage `ticket-attachments` |
| T-S3 | RLS-002 | Restringir `profiles_select` (vista pública o admin only) |
| T-S4 | RLS-004 | Trigger rechaza INSERT en `ticket_responses` si `closed_at IS NOT NULL` |

#### Fase Tickets-Arquitectura

| # | Ticket | Descripción |
|---|--------|-------------|
| T-A1 | SEC-001 | Migrar `crearTicket` y `responderTicket` a Server Actions con Zod servidor. **Elevado a bloqueante de go-live (2026-06-06)** por PII real — ver T-P4. |

#### Fase Tickets-Catálogo Sistemas/TI *(plan 2026-07-28 · expansión incremental de tipos)*

> **Contexto**: el go-live arrancó con 3 tipos (Tesorería / Data Science). Ahora se suma el catálogo del área **Sistemas/TI** (6 incidencias reales de la mesa de TI). Trae 3 atributos por tipo que hoy el modelo NO guarda: **prioridad fija**, **SLA (min)** y **modalidad** (Remoto/Presencial/Ambas). Esto aterriza a nivel de catálogo los gaps **TKT-004** (prioridad) y **TKT-005** (SLA), pero **acotado**: el `sla_min` se guarda solo como **referencia** (tiempo estimado visible); sin alertas de vencimiento/escalación todavía (eso sigue pendiente en TKT-005, coherente con "SLA no urge aún" de §2.2).
>
> **Modelo**: se mantiene el actual (`responsable_default_id` **por persona**, no cola por área). Cuando se implemente T-P1/TKT-020 (cola por área), este catálogo migra junto con los otros tipos.

Las 6 incidencias (columna "¿Qué engloba?" → campo `select` guiado dentro de cada tipo):

| Tipo | Prioridad | SLA | Modalidad |
|------|-----------|-----|-----------|
| Soporte a equipo de cómputo | Media | 30 min | Ambas |
| Problemas de red | Alta | 30 min | Ambas |
| Impresoras y escáneres | Media | 30 min | Ambas |
| Usuarios y accesos | Media | 20 min | Remoto |
| Cámaras y alarmas (Hikvision) | Alta | 60 min | Presencial |
| Solicitud de servicio de TI | Baja | Variable | Ambas |

| # | Ticket | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| T-C1 | TKT-023 | **Metadata de catálogo**: columnas `prioridad` (enum `alta`/`media`/`baja`), `sla_min` (int, `null`=variable) y `modalidad` (enum `remoto`/`presencial`/`ambas`) en `problem_catalog`; expuestas en la vista `tickets_with_status`. Aterriza TKT-004 y parte de TKT-005 (prioridad = orden visual; SLA solo referencia). Mig. `20260728130000_tkt_catalogo_metadata.sql` + tipos en `lib/supabase/types.ts`. | Estructural | ✅ 2026-07-28 (aplicada a remoto) |
| T-C2 | TKT-024 | **Seed Sistemas/TI**: reusa área `Sistemas` + 6 incidencias con `campos` (`select` "¿Qué necesitas?" con las viñetas del "¿Qué engloba?" + `ubicacion` incluida solo en tipos presencial/ambas), `prioridad`/`sla_min`/`modalidad`. Ruteo a `uzziel.valdez@financieracrediflexi.com`. Mig. idempotente `20260728130100_tkt_catalogo_sistemas_ti.sql` (patrón de `20260612160500`). | Datos | ✅ 2026-07-28 (aplicada a remoto) |
| T-C3 | TKT-025 | **Editor de catálogo** (`components/admin/catalogo-admin.tsx`): inputs de prioridad, SLA (min) y modalidad al crear/editar tipos. | UI | ✅ 2026-07-28 |
| T-C4 | TKT-026 | **Form de creación** (`components/tickets/ticket-form.tsx`): badge de prioridad (color) + SLA estimado + chip de modalidad al elegir tipo. `ubicacion` resuelto vía seed (campo incluido por tipo según modalidad), no lógica condicional en el form. | UI | ✅ 2026-07-28 |
| T-C5 | TKT-027 | *(opcional · usabilidad)* Selector de área con **tarjetas + ícono** en `/tickets/nuevo`, en vez del `<select>` plano. | UI | ✅ 2026-08-01 (`b57d855`) |

> **Decisiones (2026-07-28)**: área = reusar **`Sistemas`** (misma área). Responsable default = **`uzziel.valdez@financieracrediflexi.com`** (rol `usuario` en presets; recibe tickets igual — considerar subirlo a `responsable`). Si aún no ha hecho su primer login, el seed deja `responsable_default_id` en `null` (se configura luego en `/admin/catalogo`). `ubicacion` = **texto libre** (no `select` de sucursales) por ahora.
>
> **Estado (2026-08-04)**: las 2 migraciones **ya están aplicadas a remoto** (verificado con `supabase migration list`: los 64 archivos locales tienen par remoto). Los 3 tipos previos (Tesorería/DS) quedaron con defaults `prioridad=media`, `modalidad=ambas`, `sla_min=null`; ajustar su prioridad real en `/admin/catalogo` si se desea.

#### Fase Tickets-Operación Sistemas/TI *(2026-08-01 · la metadata deja de ser decorativa)*

> **Contexto**: TKT-023/024 metieron `prioridad`/`sla_min`/`modalidad` a la BD y los mostraron **al levantar** el ticket, pero ninguna pantalla de seguimiento los leía: los listados y el detalle seguían igual que antes. Un responsable de Sistemas no tenía cómo saber qué atender primero. Este bloque cierra ese hueco **sin tocar la BD** (decisión de alcance del 2026-08-01, para no arriesgar en día de presentación).

| # | Ticket | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| T-O1 | TKT-028 | **Módulo de SLA** `lib/tickets/sla.ts` (puro: sin React ni Supabase, para que listados, detalle y métricas futuras usen el mismo cálculo). `por_vencer` = último 25% del SLA. *(Semántica revisada el 2026-08-10 con los estados explícitos — ver T-P2.)* | UI/lógica | ✅ 2026-08-01 (`ef72018`) |
| T-O2 | TKT-029 | **Listados operables** (`ticket-list.tsx` pasa a client component): chip de prioridad, columna "Atención" con el SLA coloreado, filtros `Activos/Vencidos/Cerrados/Todos` con conteo y buscador sobre número/asunto/área/personas. Se elimina la columna Responsable (duplicaba el dato ya visible bajo el asunto). `ahora: number` se pasa **como prop desde el servidor** para que SSR e hidratación coincidan. | UI | ✅ 2026-08-01 (`ef72018`) |
| T-O3 | TKT-027b | **Levantar ticket con tarjetas**: áreas como chips y tipos de problema como tarjetas que muestran prioridad/tiempo/modalidad **antes** de elegir, colapsando a la tarjeta elegida con un "Cambiar". Sustituye los dos `<select>` encadenados. | UI | ✅ 2026-08-01 (`b57d855`) |
| T-O4 | TKT-030 | **Fix — los adjuntos del hilo no se podían abrir**. El bucket `ticket-attachments` es privado y `ticket-thread.tsx` los pintaba como `<span>` de texto: la evidencia que subía el solicitante (la captura del error, el artefacto más importante de un ticket de Sistemas) era inaccesible. Ahora el detalle firma todas las rutas en una sola llamada `createSignedUrls(paths, 60 * 10)` y el hilo las renderiza como `<a target="_blank">`, con fallback gris si la firma falla. | Bug | ✅ 2026-08-01 (`80fec4d`) |

> **Fuera de alcance (consciente) el 2026-08-01**: cola por área y "Tomar ticket" (T-P1/TKT-020) requerían migración de RLS. **Se entregaron el 2026-08-10** — ver la fase siguiente.

#### Fase Tickets-Equipo *(2026-08-10 · de "app donde registro" a "sistema que persigue el trabajo")*

> **Contexto**: la mesa funcionaba para una persona que abre la app. No para un **equipo**. El ticket nacía con dueño fijo de por vida, el estatus se deducía de la paridad de respuestas y nadie se enteraba de nada si no entraba a mirar. Esta fase cierra las tres cosas y con ellas los gaps estructurales más viejos del módulo.

| # | Ticket | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| T-E1 | TKT-031/033/035 | **Cola por área** (T-P1). Ver la fila T-P1 arriba. | Estructural | ✅ 2026-08-10 |
| T-E2 | TKT-032/034/036/037 | **Estados explícitos** (T-P2). Ver la fila T-P2 arriba. | Estructural | ✅ 2026-08-10 |
| T-E3 | TKT-002 | **Soltar y reasignar**. RPC `tkt_reasignar_ticket`: sin destinatario devuelve el ticket a la cola (`en_revision` → `abierto`; **`programado` se conserva** — la validación no se pierde por cambiar de manos), con destinatario lo pasa a alguien del área. Solo el responsable actual o admin mueven, y el destino debe pertenecer al área: pasarlo fuera lo dejaría en una cola que esa persona no ve. Mig. `20260810140000`. | Estructural | ✅ 2026-08-10 (`3fb9b86`) |
| T-E4 | TKT-038 | **Bitácora** `ticket_historial` + **dos triggers sobre `tickets`** (INSERT → `creado`; UPDATE → `tomado`/`devuelto`/`reasignado`/`cambio_estado`, derivando el evento de qué columna cambió). Se eligió trigger sobre instrumentar las RPCs para capturar **todo** camino de escritura, incluidos los cierres que disparan las respuestas. **Sin política de insert**: solo los triggers (security definer) escriben, un cliente no puede fabricar historia. UI plegable en el detalle. Mig. `20260810150000`. | Estructural | ✅ 2026-08-10 (`59d7238`) |
| T-E5 | TKT-039 | **Notificaciones por correo** (cierra TKT-003). 9 avisos: ticket nuevo → área, tomado → solicitante, respuesta → contraparte, resuelto/rechazado/cerrado/programado → quien corresponda, devuelto → área, reasignado → nuevo responsable. Reusa `lib/google` (Gmail probado en producción por Reclutamiento), **no** se construyó motor nuevo. **Todo best-effort**: un Gmail caído nunca bloquea crear, tomar o mover. Mig. `20260810150100` + `lib/tickets/correos.ts`. | Funcional | ✅ 2026-08-10 (`941c863`) · **sin verificar envío real** |
| T-E6 | TKT-040 | **Guía contextual** `lib/tickets/guia.ts` (puro, patrón `candidato-guia`): el detalle explica a cada quien qué significa el estado y qué sigue, según sea solicitante, responsable o tercero. | UI | ✅ 2026-08-10 (`ea905f3`) |
| T-E7 | TKT-041 | **Resumen del área** encima de la cola: sin tomar / vencidos / en curso / cerrados hoy. "Vencidos" en rojo **solo cuando existe** — en verde permanente sería ruido, en rojo permanente, alarma. | UI | ✅ 2026-08-10 (`5113ed7`) |
| T-E8 | TKT-042 | **Levantar sin adivinar el área** (cierra TKT-006 del todo). Desaparece el paso "¿Qué área te puede ayudar?": la gente piensa en síntomas, no en organigramas, y el área siempre fue **consecuencia** del tipo (el trigger de TKT-031 la deriva). Buscador insensible a acentos sobre nombre/leyenda/área/**opciones de los selects** (ahí viven frases como "instalar impresora"), tarjetas agrupadas por área con **ejemplos concretos** tomados del catálogo, y **atajos frecuentes** en el lenguaje del usuario ("No tengo acceso a Yunius…") anclados por fragmento de nombre para que renombrar un tipo nunca deje un link muerto. | UI | ✅ 2026-08-10 (`1224558`, `352ec34`, `d5ff9a2`) |

> ~~**Riesgo abierto de T-E5**: la RPC `tkt_credencial_google` expone el `refresh_token` a cualquier autenticado…~~ **Cerrado el 2026-08-11 por TKT-048**, que hizo `drop` de la función: el remitente de la mesa ya no vive en la base de datos sino en variables de entorno del servidor, así que no hay RPC que llamar ni token que exponer. Ver la fase siguiente.
>
> **Deuda conocida**: (a) los correos **nunca se han enviado de verdad** — la ruta es la misma que Reclutamiento usa a diario, pero falta verlo llegar; (b) las plantillas de tickets viven en el código, a diferencia de las de Reclutamiento — si el patrón funciona, se mueven a BD con un editor como el de `/reclutamiento/ajustes`; (c) las frases frecuentes también están en código; (d) el SLA **no acumula pausas** (un ticket reabierto vuelve a contar contra su hora original) — con la bitácora de T-E4 ya hay con qué calcularlo bien.

#### Fase Tickets-Supervisión y flujo *(2026-08-11/12 · lo que la operación pidió al mirarlo de cerca)*

> **Contexto**: con la mesa ya funcionando como equipo aparecieron los huecos que solo se ven operando. Faltaba quién mira **todas** las colas; el flujo era idéntico para los 11 tipos aunque a la mitad no le aplicara; los tickets resueltos que nadie confirmaba se quedaban en el limbo; y los correos **salían de la cuenta equivocada** porque dos módulos se peleaban la misma credencial.
>
> **Esta fase se documentó tarde** (2026-08-18). Se entregó el 11 y 12 de agosto, pero el cierre de día del 11 solo alcanzó a registrar el pendiente de correos, así que ni los tickets ni las 8 migraciones quedaron en el plan. Lo que sigue se reconstruyó leyendo el SQL y el código.

| # | Ticket | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| T-F1 | TKT-043 | **Supervisor de la mesa**. Flag `profiles.supervisa_tickets` + función `supervisa_mesa()`; el `select` de tickets, respuestas, adjuntos e historial lo admite, y `tkt_tomar_ticket` también — un supervisor que ve una cola atascada tiene que poder destrabarla. **Se eligió flag y no un valor nuevo del enum `rol`**: es el patrón que el repo ya usa para capacidades (`acceso_*`), y meter un "superadmin" crearía dos nociones de admin compitiendo con `is_admin()`, que vive en media docena de políticas. `/tickets/area` gana selector de área y `/admin/usuarios` su toggle. **Cierra a medias TKT-007**: da la capacidad, no la pantalla. Mig. `20260811120000`. | Estructural | ✅ 2026-08-11 (`e195bff`) |
| T-F2 | TKT-044 | **Flujo simple por tipo de problema**. Hallazgo que simplificó el diseño: *Programado*, *Esperando refacción* y *Esperando al usuario* **son la misma cosa** — el reloj se detiene porque la pelota dejó de ser del técnico; solo cambia el nombre. Así que no hacen falta estados nuevos, basta `problem_catalog.etiqueta_pausa` sobre el `programado` que ya existía. `NULL` = sin pausa (Tomar → Resolver, dos clics): así quedaron 5 de los 6 tipos de Sistemas. **Criterio**: un estado solo se justifica si alguien toma una decisión distinta al verlo. Además, **los tipos presenciales cierran directo** — si el técnico fue y lo arregló, pedirle al usuario que entre a confirmar es burocracia; va en el trigger `handle_ticket_closure` y no en la UI para que aplique venga por donde venga. Mig. `20260811150000`. | Estructural | ✅ 2026-08-11 (`477a0a5`, `7923eda`) |
| T-F3 | TKT-045 | **Autocierre de resueltos sin confirmar**. Un `resuelto` que nadie confirma se quedaba ahí para siempre: limbo de tickets ya atendidos que las métricas nunca cuentan como cerrados. Regla: **3 días sin actividad → se cierra solo**, medido desde la última señal de vida del hilo, no desde que se marcó resuelto. Los `programado` **no se tocan** (ahí la espera es legítima). Queda en la bitácora con actor `NULL`, que la UI muestra como "Sistema". Función `tkt_cerrar_resueltos_vencidos(dias)`, sin `execute` para `authenticated`. Mig. `20260811170000` + `…170100` (job de `pg_cron` a las 3:00 UTC, **en migración aparte a propósito** para que si el plan no trae `pg_cron` falle sola sin arrastrar la lógica). | Funcional | ✅ 2026-08-11 (`543eea8`) · **verificar que el cron quedó agendado** |
| T-F4 | TKT-046 | **Una cuenta emisora por módulo**. Bug de diseño heredado: Reclutamiento y Tickets elegían credencial con `order by actualizado_at desc limit 1`, así que **conectar una cuenta para tickets le cambiaba en silencio el remitente a los correos de candidatos**. Se agrega `rec_credenciales_google.uso` (`reclutamiento`/`tickets`/`ambos`) con índice único parcial; `ambos` es el default para no romper lo ya conectado. Mig. `20260811190000`. | Bug | ✅ 2026-08-11 (`59fde1e`) |
| T-F5 | TKT-047 | **El remitente de tickets es del sistema, no de una persona**. En Reclutamiento tiene sentido que el operador conecte su cuenta; en la mesa no: las notificaciones son de la plataforma y deben salir siempre de la misma dirección. Se guarda `rec_credenciales_google.email` para validar la cuenta y firmar el header `From`. Mig. `20260811210000`. | Estructural | ✅ 2026-08-11 (`06c0260`) |
| T-F6 | TKT-048 | **El remitente sale de la base de datos**. Mientras fue una fila, cualquiera con permisos podía reconectar y cambiarlo — **y pasó**: una conexión hecha con la sesión de Google abierta reemplazó la cuenta de plataforma por una personal, en silencio. *Un dato que se puede editar no es una garantía.* La cuenta emisora pasa a `TICKETS_GOOGLE_REFRESH_TOKEN` + `TICKETS_SENDER_EMAIL`: no hay pantalla que la toque, ni RLS que relajar, ni "última cuenta conectada" que gane. Se hace `drop` de `tkt_credencial_google()`. Helper `scripts/google-token-plataforma.mjs` para generar el token. Mig. `20260811230000`. | Estructural | ✅ 2026-08-11 (`d4d2d7b`) |
| T-F7 | — | **Endpoint de diagnóstico** `GET /api/tickets/probar-correo` (solo admin). El envío es best-effort y falla en silencio: sin esto, "no llegó el correo" puede ser falta de configuración, token inválido, rechazo de Gmail o simplemente que no había destinatarios, **y todas se ven igual desde afuera**. Revisa los cuatro pasos en orden y se detiene en el que falla. | Operación | ✅ 2026-08-11 (`a8f4bcd`) |
| T-F8 | TKT-049 | **Data Science: prioridad alta y 4 horas**. Sus tipos tenían prioridad media y `sla_min = null`; **con SLA nulo el reloj nunca corre**, así que no aparecían en el filtro "Vencidos" ni en la cifra de la cola: el área no se estaba midiendo. Mig. `20260812120000`. **Tesorería sigue en variable** — mismo problema, decisión pendiente. | Datos | ✅ 2026-08-12 (`70b717b`) |

> **Documentación de catálogo (2026-08-11/12):** se produjo `docs/catalogo-tickets.md` — trazabilidad de los 11 tipos vivos con prioridad, SLA, modalidad, flujo, campos dinámicos y obligatoriedad — más un PDF de una página para compartir, y `docs/mocktest-mesa-tickets.md` / `docs/guion-demo-mesa-tickets.md`. Son documentos operativos: cuando el catálogo cambie desde `/admin/catalogo`, el `.md` se desfasa sin que nada avise.

### 2.3 Módulo Score

#### Fase Score-Robustez

| # | Ticket | Descripción |
|---|--------|-------------|
| S-R1 | DB-001 | RPC atómica `upsert_acreditado` (acreditado + referencias) |
| S-R2 | DB-002 | Misma RPC para `actualizarAcreditado` |
| S-R3 | RLS-003 | Validar capturador en `acreditado_referencias/historial` INSERT |
| S-R4 | SEC-003 | Trigger DB recalcula `puntaje_total` (evita manipulación API) |
| S-R5 | DB-004 | Mapear errores RPC en `guardarEvaluacion` (no_auth, calificacion_invalida) |
| S-R6 | DB-003 | Comparar refs antes de incrementar `contador_ediciones` |

### 2.4 Transversal (plataforma)

#### Fase Plataforma-Auth

| # | Ticket | Estado | Descripción |
|---|--------|--------|-------------|
| P-A1 | TKT-AUTH-001 | ✅ **2026-07-02** | **Tickets deja de ser universal + stand-by corporativo.** Nueva bandera `acceso_tickets` (default `false`), guard de módulo en `/tickets`. Usuarios sin ningún acceso → `/stand-by` con mensaje ("tu área y accesos los asigna administración"). Se elimina onboarding self-service (`complete_onboarding`); admin asigna área y accesos desde `/admin/usuarios`. Allowlist de correos externos vía `NEXT_PUBLIC_AUTH_EMAILS_EXTRA`. |

#### Fase Plataforma-Tipos

| # | Ticket | Descripción |
|---|--------|-------------|
| P-T1 | TYP-001 | `supabase gen types typescript` automatizado (cartera + RPCs + enum rechazo) |

#### Fase Plataforma-UX

| # | Ticket | Descripción |
|---|--------|-------------|
| P-U1 | UI-004 | `app/error.tsx` global + por sección (tickets, score, cartera) |
| P-U2 | UI-005 | Paginación en lista de acreditados |

#### Fase Plataforma-Operación

| # | Ticket | Estado | Descripción |
|---|--------|--------|-------------|
| P-O1a | OPS-002a | ✅ **2026-05-28** | Supabase CLI local + `supabase link` + baseline 22 migraciones existentes + scripts npm (`db:push`, `db:status`, `db:new`, `db:diff`). |
| P-O1b | OPS-002b | 🔲 *(post-v1.0)* | GitHub Action que corre `supabase db push` en cada merge a `main` (requiere `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` en repo secrets). |
| P-O2 | OPS-003 | 🔲 | `.env.example` en raíz (incluyendo `SUPABASE_DB_PASSWORD`). |
| P-O3 | API-001 | 🔲 *(post-v1.0)* | `/api/cartera/procesar` fire-and-forget (no espera al microservicio). |

#### Fase Plataforma-Tests *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| P-D1 | DEB-001 | Vitest + Playwright + smoke E2E (login, crear ticket, crear acreditado, cargar cartera) |

#### Fase Plataforma-Producto *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| P-P1 | PRO-005 | Notificaciones Resend (nuevo ticket / nueva respuesta / cierre) |
| P-P2 | PRO-006 | Dominio custom `tickets.financieracrediflexi.com` |

### 2.5 Módulo Asistente IA *(agente — track paralelo)*

> La demo determinística de `/cartera/chat` (PRO-004, KB embebida sin LLM) se entregó el 2026-06-04. Esta sección la evoluciona a **agente real con tools sobre datos vivos**. Decisiones de stack/PII del 2026-06-09 en §4. Sin infra nueva: todo vive en el route handler de Next.js en Vercel.

#### Fase IA-A — Agente con tools sobre RPCs existentes *(en curso)*

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-A1 | AI-001 | Migrar `/api/ai/assistant` de respuesta determinística a **LLM real (Gemini API de pago)** vía Vercel AI SDK: `streamText` + `useChat`, system prompt dinámico (rol + accesos del usuario + los 13 chunks de la KB embebidos completos — sin RAG vectorial, caben en contexto). | — |
| IA-A2 | AI-002 | **Tools sobre los 5 RPCs existentes**: `getResumen`, `getPorCoordinacion`, `getPorRecuperador`, `getMora`, `getCohort`. Server-side con el cliente Supabase de la sesión del usuario (los checks `rol=admin OR acceso_cartera` de los RPCs aplican solos). `getMora` **seudonimizada**: código de acreditado + saldos + días, sin nombres ni teléfonos. | AI-001 |
| IA-A3 | AI-003 | Guardrails + pulido: nunca inventar cifras (números solo vía tools, citados con su `fecha_corte`), actualizar copy del banner (deja de ser "demo embebida"), `GOOGLE_GENERATIVE_AI_API_KEY` documentada en `.env.example` y cargada en Vercel. | AI-001 |
| IA-A4 | AI-004 | ✅ **2026-06-15** — **Asistente como widget flotante** en layout de cartera: FAB + panel que reusa `AssistantChat`; `/cartera/chat` redirige a `/cartera`; item del sidebar retirado. **Pantalla completa**: botón expandir/contraer en header del panel (`Maximize2`/`Minimize2`), `Esc` sale de fullscreen (segundo `Esc` cierra), `body` sin scroll al expandir. | AI-001 |

#### Fase IA-B — Memoria + RAG ligero

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-B1 | AI-010 | Tabla `assistant_conversations` (historial persistente + logging de preguntas reales para mejorar la KB). | AI-001 |
| IA-B2 | AI-011 | pgvector en Supabase + tool `buscarDocumentacion` sobre los `.md` de `docs/` (solo cuando la KB ya no quepa en contexto). | AI-001 |

#### Fase IA-C — Acciones y escalado

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-C1 | AI-020 | Tool `crearBorradorTicket` integrada al catálogo de tickets. | Fase Tickets-Producción |
| IA-C2 | AI-021 | "Preguntar sobre este dashboard" (contexto por página) + comparativas multi-corte. | IA-B* |
| IA-C3 | AI-022 | Detalle completo de mora en la tool (nombres/teléfonos) tras visto bueno de cumplimiento; evaluar migración a **Vertex AI** con ZDR/region pinning (swap de provider de una línea con AI SDK). | OK cumplimiento |

### 2.6 Módulo Actividades *(tablero directivo de uso del tiempo — alta 2026-08-18)*

> **Origen**: un Excel (`tablas_uziel.xlsx`, 3 hojas) y un tablero de Power BI construido sobre él, entregado como `.pbix`. El encargo fue portarlo a la plataforma "y ponerlo bonito y más ordenado".
>
> **El hallazgo que hizo viable el port**: el modelo del `.pbix` tiene **una sola tabla** (`MART_DIRECTIVO`), que es la hoja de hechos ya desnormalizada — los catálogos de empleados y puestos ni participaban del reporte. Todo lo que hacía DAX son sumas, conteos distintos y divisiones sobre una tabla plana. Es decir: **SQL lo hace mejor**, y el módulo cabe en el mismo patrón que los 5 dashboards de cartera (Server Component + RPC que devuelve el JSON agregado + filtros por `searchParams`).

#### Fase Actividades-1 — Del Excel al tablero *(entregada 2026-08-18)*

| # | Ticket | Descripción | Tipo | Estado |
|---|--------|-------------|------|--------|
| A-1 | ACT-001 | **Esquema**: `act_registros` (hechos), `act_cargas` (bitácora de subidas), `act_empleados` / `act_puestos` (catálogos) + bandera `profiles.acceso_actividades`. Las **horas son columna generada** de los minutos: el Excel trae ambas y guardarlas por separado invita a que dejen de coincidir. La estructura organizacional se guarda **desnormalizada** a propósito, para que un cambio de puesto no reescriba el historial. Los catálogos se conservan aunque el tablero no los use: son lo único que permite responder *quién no registró nada este periodo*, dato que la hoja de hechos no puede dar. Mig. `20260818130000`. | Estructural | ✅ |
| A-2 | ACT-002 | **RLS**: `has_actividades_access()` = admin o la bandera. Mismo patrón que cartera/reclutamiento, sin inventar una tercera forma de decir lo mismo. Por ahora **quien ve también puede cargar** (el único que sube el archivo es dirección); si eso cambia, se parte el predicado con una segunda bandera. Mig. `20260818130100`. | Seguridad | ✅ |
| A-3 | ACT-003 | **RPC `act_resumen`** — las 8 medidas DAX traducidas a SQL, más cortes por dirección, gerencia, categoría, nivel jerárquico y el cruce gerencia × categoría. Mig. `20260818130200`. | Datos | ✅ |
| A-4 | ACT-004 | **RPCs `act_detalle` y `act_friccion`** — "quién hace qué" y "dónde duele". Misma firma de filtros para que el estado viva en la URL. Mig. `20260818130300`. | Datos | ✅ |
| A-5 | — | **Ingesta**: parser puro `lib/actividades/excel.ts` (exceljs) + `POST /api/actividades/cargar`. Valida el archivo **entero antes de tocar la base**: si el Excel viene mal no se borra nada. Recargar un periodo lo **reemplaza**, no lo duplica; los periodos que el archivo no menciona no se tocan. | Funcional | ✅ · **la ruta HTTP no se ha ejercitado con sesión real** |
| A-6 | — | **Pantallas**: `/actividades` (estructura), `/actividades/personas`, `/actividades/friccion`, `/actividades/cargar`. Fila de filtros compartida cuyo estado vive en `searchParams` — un tablero filtrado se puede mandar por link, cosa que el Power BI no permite. | UI | ✅ |
| A-7 | — | **Accesos**: toggle en `/admin/usuarios`, sección en el sidebar, guarda de módulo que redirige a quien no traiga la bandera. | Seguridad | ✅ |

**Las 8 medidas, verificadas una por una contra el `.pbix` abierto** (2026-08-18) antes de traducirlas. Ancla: 452.50 h sin filtros / 239.33 h en agosto.

| Medida | Definición confirmada |
|---|---|
| Horas Totales | `sum(horas)` |
| Colaboradores · Gerencias | `count(distinct …)` |
| % Tiempo Relevante | horas con nota ÷ **horas totales** (sobre horas, no sobre número de registros) |
| % Tiempo Fricción | horas `tipo_motivo='FRICCION'` ÷ **horas totales** (no ÷ horas relevantes) |
| % Participación | horas de la fila ÷ total visible |
| % Tiempo Seleccionado | horas filtradas ÷ horas del periodo sin filtrar |
| Crecimiento Horas | `(actual − anterior) ÷ anterior` contra el periodo previo **con datos** |

**Dos defectos del original que NO se replicaron, a propósito:**

1. Sin periodo seleccionado el `.pbix` mostraba **1.12 de crecimiento**: comparaba julio+agosto contra junio+julio, y junio no existe. Un +112% inventado con cara de dato. Aquí el periodo siempre tiene valor y sin periodo previo el KPI devuelve `null`, que la UI pinta "—".
2. La matriz mostraba **"% Participación = 1.00" en las ocho direcciones** porque el DAX dividía las horas de la dirección entre sí mismas. Una columna entera que no decía nada. Ahora una dirección con 91.75 de 452.50 h se lee 20.3%.

**Color validado con herramienta, no elegido a ojo**: verde/rojo para positivo/fricción se descartó por dar **ΔE 4.2 en deuteranopia** (indistinguibles); quedó azul `#1C5CAB` ↔ naranja `#D9531F`, que pasa las cinco comprobaciones. Los colores crudos de marca **no sirven como relleno de datos** (el navy `#0F1B3D` cae fuera de la banda de luminosidad y lee gris; el naranja `#F58220` no llega a 3:1 contra blanco) → se usan pasos ajustados de esos matices. Las 12 categorías van a **heatmap secuencial de un matiz**, no a 12 colores.

#### Fase Actividades-2 — Lo que sigue

| # | Qué | Por qué |
|---|---|---|
| A-8 | **Ejercitar `/actividades/cargar` con sesión real** | Es el único tramo de la cadena sin correr de punta a punta. Los 120 registros de prueba se insertaron por SQL directo, no por la ruta HTTP. Recargar es idempotente, así que probarlo no arriesga nada. |
| A-9 | **Dar la bandera a dirección** | `acceso_actividades` nace en `false`; hoy solo lo ven los admin. |
| A-10 | **Datos reales** | Los 120 registros cargados son **dummy** (`DUM0001…`, dos fechas, 30 de 80 empleados). Sirven para ver la forma, no para concluir nada. |
| A-11 | *(diferido)* Carga desde una carpeta de Drive | Se evaluó y se pospuso: la pantalla de subida da validación inmediata y no exige scopes nuevos de Google. Drive sería otra puerta al mismo modelo de datos, sin cambiarlo. |
| A-12 | *(idea de fondo)* Captura dentro de la plataforma | El destino natural es que la gente registre su tiempo aquí y el Excel desaparezca — el mismo movimiento que hizo la mesa de tickets contra WhatsApp. Es un módulo entero, no un tablero. |

---

## 3. Backlog Priorizado (orden de ejecución sugerido)

> **Histórico.** Esta sección es la ruta crítica de mayo-junio 2026 (demo ejecutiva de Cartera); se conserva como registro de cómo se ejecutó. **La cola de trabajo vigente está en §0.**

### 3.1 Ruta crítica para demo ejecutiva (~7 días desde 2026-05-28)

| Día | Acción | Owner | Notas |
|---|---|---|---|
| 1 | ✅ Smoke test CART-001 local + squash-merge PR #1 | Usuario | Hecho 2026-05-30. Commit `7d7d626`. |
| 1 | ✅ OPS-001 implementado + PR #2 mergeado | Agente | Hecho 2026-05-30. 5 commits atómicos. |
| 1 | ✅ Cuenta Render + Blueprint + secrets + primer deploy | Usuario | Hecho 2026-05-30. URL: `crediflexi-services.onrender.com`. |
| 1 | ✅ Smoke E2E Vercel → Render → Supabase | Usuario | Hecho 2026-05-30. 215 filas, fecha_corte 2026-05-30. |
| 2 | 🟡 Cron-job.org wake-up cada 10 min en /health | Usuario | Evita cold start (30-60s) durante la demo. |
| 2-5 | C2-1 CART-010 (RPC resumen) + C3-1 DASH-001 (snapshot ejecutivo) | Coordinador / agentes | Primer dashboard visible. |
| 4-6 | C1-2 CART-002 (cohort) + C3-2/C3-3 (coord, recuperador) | Agentes | Solo si la demo cubre estos cortes. |
| 6 | C1-4 CART-006 (export Excel) | Implementador | Solo si la demo muestra descarga. |
| 7 | Pulido + ensayo demo + Excel de respaldo cargado | Usuario | Plan B por si Render se cae. |

### 3.2 Backlog general (post-demo o si hay slack)

1. **T-D4/T-D5 + P-U1** — Cierre pendientes Fase Demo (login copy + error.tsx global).
2. **T-S1 + T-S2** — RLS adjuntos y Storage (riesgo de seguridad real).
3. **C2-4 + C3-4** — Mora operativa.
4. **C2-5 + C3-5** — Cohort mensual.
5. **T-S3 + T-S4** — Resto RLS tickets.
6. **C1-6 SEC-002** — HMAC microservicio (post-aprobación).
7. **C1-3 CART-005** — Validar `fecha_corte` contra Excel.
8. **S-R*** — Robustez Score.
9. **C4-* + post-v1.0**.

---

## 4. Decisiones Tomadas

### Asistente IA (2026-06-09)

- **Provider = Gemini, tier de pago** (la empresa opera con Google Workspace). Billing activo desde el día 1: el tier gratuito de AI Studio usa prompts/respuestas para entrenar modelos (con revisores humanos) — **prohibido** con datos de la empresa. El tier de pago procesa bajo el Data Processing Addendum, sin entrenamiento, logs breves solo anti-abuso.
- **Orquestación = Vercel AI SDK** (`ai` + `@ai-sdk/google`; `@ai-sdk/react` ya estaba instalado). Migración futura a Vertex AI (`@ai-sdk/google-vertex`) con zero data retention y region pinning si cumplimiento o data residency lo exigen — es swap de provider de una línea.
- **Alcance Fase A** = LLM + streaming + tools que envuelven los 5 RPCs de cartera existentes. Sin RAG vectorial ni persistencia (la KB de 13 chunks cabe completa en el system prompt).
- **PII (decisión 2026-06-09)**: la tool de mora va **seudonimizada** (código de acreditado, saldos, días de mora; sin nombres ni teléfonos) hasta tener visto bueno de cumplimiento (LFPDPPP, aviso de privacidad, secreto financiero). Los RPCs agregados (resumen/coordinación/recuperador/cohort) no exponen PII.
- **Guardrail central**: el agente nunca inventa cifras — todo número sale de una tool y se cita con su `fecha_corte`.
- **Infra**: cero servicios nuevos. Vive en `/api/ai/assistant` (Next.js en Vercel, `maxDuration: 60`). El microservicio Render no participa.

### Tickets — go-live a producción (2026-06-06)

- **La "demo" es un go-live real**: se lanzan 3 tipos de ticket a producción con PII de clientes (FICHA NO REFLEJADA, CRÉDITO FALTANTE, ERROR EN MORA), luego se agregan más incrementalmente. Audiencia: Dupont (dir. crédito) + gerente de sistemas. Objetivo declarado: **uso diario real**, que además luzca en la demo.
- **Asignación = cola por área, NO asignación manual del gerente** (al inicio). El ticket cae en la cola del área (Tesorería / Data Science) y cualquiera del área lo "toma". Razón: con ~17/semana la cola se autorregula; la asignación manual agrega un cuello de botella humano. Reasignación del gerente = botón posterior, no día 1.
- **Estados explícitos** controlados por el responsable (Abierto → En revisión → Programado → Resuelto / Rechazado), reemplazan el estado derivado por paridad. "Programado" = "se carga en el siguiente corte/tanda".
- **"Se carga en la siguiente" SIN fecha/hora** por ahora (los cortes no tienen horario fijo). Se agrega fecha estimada cuando los cortes se calendaricen.
- **Seguridad full = bloqueante de go-live** (no post-v1.0) por PII real: RLS-001/002/004/005 + SEC-001.
- **Limpieza solo del módulo de Tickets** para producción. Score ya está perfecto (no se toca).

### Cartera (2026-05-27 / 2026-05-28)

- **El legacy (`automatizador-crediflexi`) NO se toca**. Sigue funcionando independiente mientras la plataforma desarrolla su reemplazo. Es referente, no objetivo de cambio.
- **Paridad antes que superación**: dashboards primero replican la información del Excel; luego se agregan vistas que el Excel no ofrece (multi-corte, drill-down, etc.).
- **Hojas mensuales del legacy = segmentación cohort por `Inicio ciclo`** (no por fecha de corte). Plataforma lo implementa con filtro dinámico, no con hojas fijas hardcodeadas.
- **Amortizaciones** se llenarán vía script externo del usuario (formato y disparador TBD). No bloquean MVP de dashboards; habilitan Fase Cartera-4 (drill-down + liquidación real).
- **Orden de dashboards**: snapshot ejecutivo → coord × PAR → recuperador → mora operativa → drill-down/liquidación. Justificación: mayor valor visible / menor esfuerzo / consumo más amplio primero.
- **No reemplazar Excel con Excel**: la plataforma entrega dashboards interactivos. Si se necesita Excel descargable, es exportación derivable on-demand (DASH-013, post-v1.0).
- **2026-05-28** — `CODIGOS_RECUPERADOR_EXCLUIR = ["000124"]` ya **no filtra al persistir**; persistimos todo y solo filtramos al generar la hoja `X_Recuperador` del export.
- **2026-05-28** — Pivotes (`X_Coordinación`/`X_Recuperador`) se generan como **tablas estáticas** con `pandas.pivot_table` + `xlsxwriter`, no como PivotTables nativos de Excel (mejor portabilidad).
- **2026-05-28** — `Saldo_Riesgo_total` y `Combinado` (cols duplicadas en el FINAL) se mantienen como copias literales de `Saldo riesgo total` en el export, calculadas al vuelo (no se persisten en staging).

### Arquitectura microservicio

- **2026-05-24** — Cartera se procesa en microservicio Python **separado** (`crediflexi-services`), no embebido en Next.js. Razón: pandas + openpyxl pesan demasiado para serverless.
- **2026-05-24** — FastAPI sobre Flask. Razón: auto-docs, tipos, async nativo.
- **2026-05-24** — Repos separados (no monorepo). Razón: deploys y ciclos de vida independientes.
- **2026-05-24** — El microservicio usa Supabase `service_role_key` para bulk insert (bypassa RLS). RLS aplica para lectura desde Next.js.
- **2026-05-24** — Estado de carga se persiste en `cartera_uploads.estado`. Frontend hace polling 3s. Auto-cleanup 10 min.
- **2026-05-28** — **Demo ejecutiva en ~7 días**: se prioriza deploy serio del microservicio (no ngrok) para mostrar todo el flujo desde el dominio Vercel productivo.
- **2026-05-28** — Plataforma de deploy = **Render** (Free tier inicial; upgrade a Standard $7/mes solo si cold start arruina UX post-aprobación). Build = **Docker** (no nixpacks — más control y portabilidad). Wake-up via cron externo (cron-job.org) cada 10 min para evitar cold start.
- **2026-05-28** — Brief operativo del deploy en `docs/handoff/OPS-001-deploy-microservicio.md` v1.0.
- **2026-06-17** — Auth del endpoint `/cartera/procesar` con **token compartido** (`INTERNAL_API_TOKEN`), no HMAC. Razón: tráfico interno server-to-server sobre HTTPS; HMAC (firma de body + timestamp) era sobre-ingeniería para este caso. Comparación en tiempo constante y fail-closed en el micro (SEC-002).

### Datos

- **2026-05-20** — `cartera_uploads` (ledger) y `stg_yunius_cartera_individual` (dato crudo) separadas. Permite re-procesar sin perder histórico.
- **2026-06-17** — **Fecha de corte automática**: ya no la elige el usuario. El sistema la fija al **día anterior** (en horario `America/Mexico_City`), porque el reporte de Yunius refleja el cierre del día previo. Migración `20260617120000_cart_015_trazabilidad_procesado.sql`.
- **2026-06-17** — **Trazabilidad de procesamiento**: `cartera_uploads` gana `procesado_por` + `procesado_at`. La UI de carga muestra "Subido por" y "Procesado por" (nombres resueltos desde `profiles`).
- **2026-05-24** — Storage bucket `cartera` con políticas RLS por `acceso_cartera` o `rol=admin`.
- **2026-05-28** — Migraciones se aplican con **Supabase CLI** (`npm run db:push`). Las 22 migraciones existentes quedaron baseline-marcadas. Workflow oficial documentado en RESEARCH §11.

### Convenciones

- **Commits atómicos** por cambio lógico. No commits gigantes.
- **Sin coautoría Claude** en commits (per user preference en `memory/feedback_commits.md`).
- **Comentarios en español, código en inglés** (variables, funciones).
- **Spanish UI copy** (todo lo visible al usuario).
- **Server Components por default**, Client Components solo para interactividad.

---

## 5. Próximos Pasos

> **Movido a §0** el 2026-08-11, cuando el trabajo se enfocó en Mesa de Tickets. Mantener aquí una segunda lista de prioridades es exactamente cómo este documento se desfasó antes: dos listas que se contradicen y ninguna confiable.
>
> **La cola de trabajo viva vive en §0.** Aquí solo quedan los pendientes operativos que dependen del usuario y no de una vía de desarrollo:

1. **`TICKETS_GOOGLE_REFRESH_TOKEN` + `TICKETS_SENDER_EMAIL` en Vercel (Production) y redesplegar.** Es el pendiente #1 de §0 y no lo puede hacer el código: las variables nuevas **no aplican a un deploy ya construido**. Generar el token con `node scripts/google-token-plataforma.mjs`, que imprime las dos líneas listas para pegar; verificar después con `GET /api/tickets/probar-correo`.
2. **Cron-job.org wake-up** — GET `https://crediflexi-services.onrender.com/health` cada 10 min, para evitar el cold start de Render Free (Cartera).
3. **Vaciar el bucket `ticket-attachments`** vía Storage API: quedaron huérfanos tras los `delete from tickets` de las migraciones de limpieza.
4. **Hábito, no ticket:** `npm run db:types` después de cada `db push`. Nada importa `database.types.ts`, así que cuando se desfasa nada truena para avisar.
5. **`.env.example` está incompleto** (OPS-003 sigue abierto, aunque el archivo exista): no documenta `TICKETS_GOOGLE_REFRESH_TOKEN`, `TICKETS_SENDER_EMAIL`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_RECLUTAMIENTO_CLIENT_ID/SECRET`, `FACTORIAL_API_KEY`, `NEXT_PUBLIC_AUTH_EMAILS_EXTRA` ni `SUPABASE_DB_PASSWORD`. Justo las que hacen falta al redesplegar.

---

## 6. Convenciones de Trabajo

### IDs de tickets

Prefijos consistentes en `RESEARCH-CONSOLIDADO.md` §6/§7 y aquí:

- `SEC-` Seguridad / arquitectura
- `RLS-` Row Level Security específico
- `AUTH-` Autenticación / autorización
- `UI-` Interfaz / UX
- `API-` Route handlers / endpoints
- `DB-` Datos / Server Actions / consistencia
- `TYP-` Tipos TypeScript
- `PERF-` Performance
- `OPS-` Operación / deploy / CI
- `DEB-` Tests / debugging
- `PRO-` Producto / features nuevas
- `CART-` Cartera — datos / ETL / API
- `DASH-` Cartera — dashboards / UI
- `AI-` Asistente IA / agente
- `TKT-` Tickets — funcionalidad / ciclo de vida
- `REC-` Reclutamiento — datos / agendamiento / integraciones Google

### Migraciones

- Crear con: `npm run db:new <descripcion>` (genera archivo `YYYYMMDDHHMMSS_descripcion.sql`)
- Aplicar con: `npm run db:push` (idempotente, solo aplica las pendientes)
- Estado: `npm run db:status` (muestra local vs remote)
- Idempotentes cuando sea posible (`if not exists`, `or replace`)
- Una preocupación por archivo

### Commits

- Atómicos, un cambio lógico por commit
- Mensaje: `tipo(scope): descripción corta`
  - Tipos: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`, `test`
  - Scope: `tickets`, `score`, `cartera`, `admin`, `auth`, `rls`, `infra`, `db`
- Sin coautoría Claude

### Workflow

1. Antes de empezar tarea grande: revisar `RESEARCH-CONSOLIDADO.md` y `PLAN.md`.
2. Antes de tocar código: leer los archivos afectados completos.
3. Commits atómicos durante el avance.
4. Al cerrar tarea: actualizar `PLAN.md` (mover ticket de Backlog a "Completados" o marcar con ✅) y, si aplica, actualizar `RESEARCH-CONSOLIDADO.md`.

---

## 7. Completados recientes

- **2026-08-12** — TKT-049: Data Science pasa a prioridad alta y SLA de 4 h. Con `sla_min = null` el reloj nunca corría, así que el área no aparecía en "Vencidos" ni en la cifra de la cola: no se estaba midiendo. Tesorería sigue en variable (decisión pendiente). Documentación del catálogo completo (`docs/catalogo-tickets.md` + PDF de una página).
- **2026-08-11** — Fase **Tickets-Supervisión y flujo** (TKT-043..049, 8 migraciones): supervisor de la mesa por flag, pausa con nombre por tipo de problema (y cierre directo de los presenciales), autocierre de resueltos a los 3 días vía `pg_cron`, una cuenta emisora por módulo, remitente de tickets fuera de la BD y endpoint de diagnóstico de correo. Detalle en §2.2. **Documentado el 2026-08-18**, no el día que se entregó.
- **2026-08-10** — Fase **Tickets-Equipo** (TKT-031..042): cola por área, estados explícitos, reasignación, bitácora, notificaciones por correo, guía contextual y alta sin elegir área. Cierra TKT-001/002/003.
- **2026-06-16** — Admin: toggle de **acceso a Cartera** en el panel global `/admin/usuarios` (paridad con el de Score, en navy), conservando el panel individual `/admin/cartera`. Nota: el panel admin sigue repartido por módulo (catálogo/áreas en Tickets, métricas de score en Score, accesos cartera en Cartera) + transversales (usuarios/métricas) en el global.
- **2026-06-16** — AI-004 (pulido): **pantalla completa** del widget del asistente (botón expandir/contraer, `Esc` sale de fullscreen y un 2º `Esc` cierra, sin scroll de fondo).
- **2026-06-15** — AI-004: asistente IA como **widget flotante** (FAB + panel que reusa `AssistantChat`) en todas las páginas de cartera; `/cartera/chat` redirige a `/cartera`; item retirado del sidebar. Además: logging de tokens y costo estimado por pregunta del agente.
- **2026-06-15** — Catálogo de tickets a producción: seed de áreas + **presets de login de 73 empleados** (`20260612160000`, `handle_new_user` aplica rol/área/nombre al primer login), catálogo de las **3 incidencias confirmadas en junta** (`20260612160500`: Ficha no reflejada / Crédito faltante → Tesorería, Error en mora → Data Science, con campos dinámicos y responsables default) y **borrado de los 4 tipos de prueba** del seed inicial (`20260615120000`, con guard anti-FK). Todas aplicadas en remoto.
- **2026-06-12** — Limpieza pre go-live: borrados todos los tickets de prueba y reiniciada la numeración (`tickets_numero_seq` → 1) vía migración `20260612154500_tkt_limpieza_tickets_prueba.sql` (aplicada en remoto). El primer ticket real será #1. Pendiente: vaciar el bucket `ticket-attachments` (delete directo de `storage.objects` no permitido por SQL → vía Storage API). No toca `areas`/`problem_catalog`/`profiles`.
- **2026-06-02** — C2-5 CART-014 + C3-5 DASH-005: cohortes por fecha de inicio de ciclo. RPC `cartera_cohort(fecha_corte, frontera)` parte la cartera en dos grupos (`antes`/`desde` la frontera) con el mismo contrato que `cartera_resumen`. Página `/cartera/cohort` con dos paneles comparativos + selector de fecha frontera (default 1-abr-2026, configurable). Hallazgo: la muestra actual no tiene ciclos 2026 (rango 2023-08 a 2025-11), por eso se adelantó la frontera configurable para que la demo muestre ambas cohortes pobladas. `sin_fecha=0` confirma `fecha_inicio_ciclo` 100% poblado.
- **2026-06-02** — C2-4 CART-013 + C3-4 DASH-004: bandeja de mora operativa. RPC `cartera_mora_operativa` (lista de 120 morosos con datos de gestión) + página `/cartera/mora` con tabla interactiva (búsqueda, orden) y columnas de gestión Call Center/Campo **mockeadas** (editables sin persistir, banner modo demo). Decisión: la captura real (tabla `cartera_seguimiento` + escritura) queda como siguiente feature — es la que supera al Excel (histórico de gestión entre cortes).
- **2026-06-02** — C2-3 CART-012 + C3-3 DASH-003: cartera por recuperador. RPC `cartera_por_recuperador(fecha, coordinacion?)` + página `/cartera/recuperador` (tabla indicadores semáforo + distribución heatmap). Filtro opcional por coordinación. Validado: 7 recuperadores, identifica al cobrador crítico (Campos Sánchez 100% PAR>90) vs sano (CALL CENTER 8.97%). "Mi cartera" diferido (profiles sin codigo_recuperador).
- **2026-06-02** — C2-2 CART-011 + C3-2 DASH-002: cartera por coordinación. RPC `cartera_por_coordinacion` (coords ordenadas por riesgo, 8 buckets c/u) + página `/cartera/coordinacion` con tabla de indicadores (semáforo PAR) + tabla distribución heatmap coord × buckets. Selector de fecha reutilizable (`fecha-selector.tsx`). Validado: Valle de Bravo región más riesgosa (44% PAR>30), Metepec la más sana pese a mayor cartera.
- **2026-05-30** — C3-1 DASH-001: `/cartera` snapshot ejecutivo live. Server Component que llama `cartera_filtros` + `cartera_resumen` en paralelo. 6 métricas (cartera total, en mora, %mora, PAR>30, PAR>90, saldo promedio) + tabla distribución PAR 8 buckets con barras de progreso. Filtros URL-state (fecha, coordinación, recuperador, ciclo) en client component con `useTransition`. Empty states + error banner. Build verde (1.12 kB / 97.1 kB First Load).
- **2026-05-30** — C2-1 CART-010: RPC `cartera_resumen(fecha_corte)` aplicada. Devuelve JSON con totales + distribución PAR (8 buckets) + indicadores (PAR>30, PAR>90). Security definer + check de permisos. Métrica = `saldo_total` (decisión técnica: `saldo_riesgo_total` inflaba porcentajes). Validado contra 215 filas. Desbloquea C3-1 (UI dashboard).
- **2026-05-30** — C1-5 OPS-001: microservicio LIVE en `https://crediflexi-services.onrender.com`. Render Free + Docker + autoDeploy. PR #2 mergeado (5 commits, sin firma Claude). Vercel `PYTHON_SERVICE_URL` actualizada. Smoke E2E productivo OK: 215 filas insertadas vía Vercel → Render → Supabase. Demo ya puede correr sobre infra real.
- **2026-05-30** — C1-1 CART-001: PR #1 squash-mergeado a `master` de `crediflexi-services` (commit `7d7d626`). Refactor ETL valida 11 cols nuevas pobladas en smoke local (215 filas, fecha_corte 2026-05-06). Desbloquea OPS-001.
- **2026-05-28** — Brief OPS-001 v1.0 redactado (`docs/handoff/OPS-001-deploy-microservicio.md`). Decisión: Render + Docker. Demo en ~7 días. PLAN reorganizado con ruta crítica día-por-día.
- **2026-05-28** — PR #1 (CART-001) abierto por Implementador en `crediflexi-services`: 5 commits atómicos, 9/9 criterios técnicos del brief cumplidos. Pendiente smoke test local y squash-merge.
- **2026-05-28** — C1-7 TYP-001: `lib/supabase/database.types.ts` generado (1112 líneas, espejo de la DB con todas las cols nuevas). Script `npm run db:types`. `types.ts` manual queda como tipos de dominio/UI.
- **2026-05-28** — C0-4 CART-000d: migración `20260528190511_cart_000d_cols_faltantes.sql` aplicada a Supabase remoto. Schema de cartera cerrado contra FINAL TARGET (11 cols nuevas + 3 en amortización). Desbloquea C1-1 (refactor ETL).
- **2026-05-28** — OPS-002a: Supabase CLI configurado localmente (v2.101.0). `supabase link` + baseline de 22 migraciones + scripts npm. Fin del copy-paste al SQL editor.
- **2026-05-28** — Cartera-0 completa (C0-1, C0-2, C0-3, C0-5). Tres documentos definitivos en `docs/cartera/` + `RESEARCH §5.4.9`. Bug crítico documentado: ETL inserta 3 cols inexistentes en schema.
- **2026-05-27** — RESEARCH-CONSOLIDADO + PLAN refactorizados a estructura modular. Investigación profunda del ecosistema cartera (legacy + microservicio + plataforma). Nuevos IDs CART-/DASH- introducidos.
- **2026-05-25** — UI-001 + UI-002: feedback de error en tickets y adjuntos iniciales visibles.
- **2026-05-24** — Cartera end-to-end funcional (UI + Storage + microservicio + ETL parcial).
- **2026-05-24** — Auto-cleanup de uploads colgados (timeout 10 min).
- **2026-05-20** — Schema cartera + RLS + acceso por perfil.
- **2026-05-14** — Catálogo dinámico, rechazo, onboarding, presets login.
- **2026-04-24** — Módulo Score Crediticio completo.
- **2026-04-21** — Base: tickets, RLS, vistas, triggers.

---

## 8. Módulo Reclutamiento *(S1–S9.5 entregados — 🚀 v1 EN LANZAMIENTO desde 2026-08-24)*

> **En lanzamiento.** El paquete de entrega vive en **`docs/reclutamiento/`** (índice en su `README.md`): manual de usuario, documentación funcional, runbook de operación, guion de pre-vuelo, presentación y textos de anuncio. **Esa carpeta es la fuente de verdad de cómo funciona y cómo se opera el módulo hoy**; esta sección §8 queda como el registro histórico del plan de ejecución y los sprints.
>
> **Estado ordenado en `§0 → Vía en lanzamiento`.** Lo pendiente: correr el pre-vuelo, anunciar, y después validar y encender Factorial (que sigue apagado por interruptor a propósito).

> Detalle de contexto, stakeholders, flujo as-is y pain points en `RESEARCH-CONSOLIDADO.md §13`. Esta sección es el plan de ejecución (modelo de datos, arquitectura, sprints).

### 8.1 Objetivo del MVP

Digitalizar el flujo de entrevistas que hoy lleva el Gerente de RH en Excel/correo manual para vacantes de **Gerente de Inversiones**: desde la postulación del candidato hasta la oferta, con el **agendamiento masivo de entrevistas** (la fase que más duele hoy) como feature estrella. Mismo repo, 4º módulo, gated por flag `acceso_reclutamiento`.

### 8.2 Modelo de datos refinado

**Enums** (prefijo `rec_`):
- `rec_etapa`: `postulado` → `en_revision` → `viable` → `entrevistas_agendadas` → `comite` → `final_dg` → `oferta` → `contratado`; `descartado` (terminal desde cualquier etapa).
- `rec_fuente`: `occ` · `computrabajo` · `linkedin` · `factorial` · `manual`.
- `rec_revision_cv`: `viable` · `parcial` · `no_viable`.
- `rec_motivo_descarte`: `no_perfil` · `expectativa_salarial` · `ubicacion` · `experiencia_insuficiente` · `no_contesto` · `declino` · `otro`.
- `rec_viabilidad`: `si` · `no` · `filtro_dg`.
- `rec_entrevista_estado`: `programada` · `realizada` · `no_show` · `cancelada`.
- `rec_plantilla_codigo`: `confirmacion_postulacion` · `agendamiento_fase2` · `notificacion_entrevistador` · `pase_fase3` · `descarte` · `oferta` · `informativa`. El placeholder `{{magic_link}}` es **exclusivo** de `notificacion_entrevistador` (correo con la liga del entrevistador a su evaluación).

**Tablas** (prefijo `rec_`, todas con RLS desde la 1ª migración):

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `rec_vacantes` | Vacante a cubrir | `id`, `titulo`, `area`, `descripcion`, `estado` (abierta/cerrada), `creada_por_id`, `created_at` |
| `rec_candidatos` | Postulante | `id`, `vacante_id`, `nombre`, `email`, `telefono`, `fuente` (`rec_fuente`), `etapa` (`rec_etapa`), `revision_cv` (`rec_revision_cv`), `viabilidad` (`rec_viabilidad`), `motivo_descarte` (`rec_motivo_descarte`), `cv_storage_path`, `notas`, `created_at` |
| `rec_sesiones_entrevistas` | Bloque de entrevistas de una fase (ej. Fase 2 del día X) | `id`, `vacante_id`, `fase` (smallint), `fecha`, `descripcion`, `creada_por_id` |
| `rec_entrevistas` | Cita candidato × sesión | `id`, `sesion_id`, `candidato_id`, `fecha_hora`, `estado` (`rec_entrevista_estado`), `gcal_event_id` (nullable) |
| `rec_evaluaciones` | Resultado de un entrevistador sobre una entrevista | `id`, `entrevista_id`, `entrevistador_id` (→ `profiles.id`), `puntaje`, `comentarios`, `recomendacion`, `enviada_at` |
| `rec_magic_links` | Token de acceso público del entrevistador a sus evaluaciones de una sesión | `id`, `sesion_id`, `entrevistador_id`, `token` (único), `expira_at`, `usado_at` |
| `rec_plantillas_correo` | Plantillas editables | `id`, `codigo` (`rec_plantilla_codigo`), `asunto`, `cuerpo` (con placeholders), `activa` |
| `rec_correos_enviados` | Bitácora de correos | `id`, `candidato_id`, `plantilla_codigo`, `to_email`, `enviado_at`, `estado`, `error`, `gmail_message_id` (nullable, id que devuelve Gmail API), `gmail_thread_id` (nullable, para enlazar respuestas del candidato en v2) |
| `rec_credenciales_google` | Tokens OAuth Google del reclutador (Calendar + Gmail) | `id`, `profile_id`, `refresh_token` (cifrado), `scope`, `actualizado_at` |

**Decisiones de modelado:**
1. **No se crea `rec_entrevistadores` en el MVP.** Los entrevistadores son colaboradores con `profiles`; `rec_evaluaciones.entrevistador_id` y el orden de entrevistadores referencian `profiles.id` directo. Vista opcional `rec_entrevistadores_v` para listarlos. v2: tabla propia cuando aparezcan entrevistadores externos (sin `auth.users`).
2. **Magic link consolidado por (sesión × entrevistador).** Un token da acceso a todas las evaluaciones de ese entrevistador en la sesión → **1 correo, no 13**. Se descarta un `magic_link_token` redundante por evaluación.

### 8.3 Arquitectura del módulo

- **Páginas internas:** `app/(dashboard)/reclutamiento/` (vacantes, candidatos, pipeline kanban por `rec_etapa`, sesiones/agendamiento, plantillas).
- **Ruta pública del entrevistador:** `app/reclutamiento/evaluar/[token]/` — **fuera de `(dashboard)`** y **excluida del matcher de `middleware.ts`** (el filtro de dominio bloquearía a entrevistadores que entran por magic link). Valida el token contra `rec_magic_links`.
- **Escritura:** Server Actions en `lib/actions/reclutamiento.ts` (patrón Score: `{ ok, error }` + `safeParse` + `revalidatePath`).
- **Validación:** `lib/schemas/reclutamiento.ts` (zod).
- **Componentes:** `components/reclutamiento/`.
- **Google Workspace (Opción A — full):** helper `lib/google/client.ts` (OAuth de usuario + refresh + Calendar + Gmail). **Nueva integración** — hoy no existe Google Workspace en el repo.
  - **Cuenta:** `reclutamiento@financieracrediflexi.com` hace login OAuth **una sola vez** en `/reclutamiento/admin/conectar-google`; el `refresh_token` se guarda cifrado en `rec_credenciales_google`.
  - **Scopes:** `gmail.send`, `gmail.readonly`, `calendar.events`.
  - **Gmail API:** envío de correos (plantillas + magic links). **Calendar API:** crea eventos con **Meet links** al agendar.
- **RPCs `security definer`:** `rec_transicion_etapa`, `rec_generar_entrevistas` (agendamiento masivo), `rec_submit_evaluacion` (vía token público, resuelve `entrevistador_id` desde el token).
- **Sidebar:** sección "Reclutamiento" gated por `rol==='admin' || acceso_reclutamiento`.
- **Storage:** bucket `reclutamiento` (CVs), RLS por vacante/rol.
- **Política RLS (MVP — definitiva):**
  - **Admin (Héctor):** SELECT/INSERT/UPDATE/DELETE en **todas** las tablas `rec_*` y todas las vacantes (sin filtro por dueño).
  - **Nadie más** entra a la app autenticada. El flag `acceso_reclutamiento` existe en el schema (para v2) pero en MVP solo Héctor lo tiene en `true`.
  - **Magic link:** la ruta pública `/reclutamiento/evaluar/[token]` se valida por RPC `security definer` que resuelve `entrevistador_id` desde el token; el entrevistador solo lee/escribe evaluaciones de **la sesión asociada a SU token**.

### 8.4 Roadmap de sprints

> **Orden:** Sprint G (Google) va **antes** del agendamiento masivo (S4) porque el feature estrella no entrega valor sin Google conectado: es el que genera los Meet links y manda los correos. Se consolidó el antiguo S6 (Correos) + S7 (Calendar) en **Sprint G** (comparten OAuth y el mismo `lib/google/client.ts`).

| Sprint | Foco | Tickets |
|---|---|---|
| **S1** ✅ 2026-06-30 | Fundaciones: flag `acceso_reclutamiento`, enums + tablas + RLS, tipos, sidebar | REC-001..REC-008 ✅ |
| **S2** ✅ 2026-07-01 | Vacantes + candidatos (CRUD, carga de CV a Storage, fuente, revisión CV) | REC-009..REC-017 ✅ |
| **S3** ✅ 2026-07-01 | Pipeline: kanban por etapa, transiciones (`rec_transicion_etapa`), descarte con motivo | REC-018..REC-025 ✅ |
| **Sprint G** ✅ 2026-07-07 | **Google Workspace: OAuth (`/api/google/conectar` + `/callback`), Calendar API + Gmail API vía REST, cifrado AES-256-GCM del `refresh_token`, plantillas + bitácora** | REC-026..REC-029 ✅ |
| **S4** ✅ 2026-07-07 | **Agendamiento masivo** (cascada de Meets + correos reales + transición) — server action `agendarSesion` + UI `/reclutamiento/agendar` | REC-030..REC-032 ✅ |
| **S5** ✅ 2026-07-15 | Evaluaciones: magic link por email (token propio, no Auth), ruta pública `/evaluar/[token]`, RPCs `rec_sesion_por_token` + `rec_submit_evaluacion` — ver §8.8 | REC-046..REC-052 ✅ |
| **S6** ✅ 2026-07-27 | Comité + entrevistadores dinámicos + contratación (correo de bienvenida) — ver §8.9 | REC-053..REC-060 ✅ |
| **S7** ✅ 2026-07-29 | Completar pipeline (`final_dg` = entrevista final DG + `pase_fase3`; `oferta` = config de alta) + correo interno "Altas nuevo ingreso" — ver §8.10 | REC-061..REC-066 ✅ |
| **S7.5** ✅ 2026-07-30 | Destinatarios editables (`rec_ajustes` + `/reclutamiento/ajustes`) y pipeline dinámico: motor de etapas, formularios en modal, `?candidato=` en `/agendar` — ver §8.11 | REC-067..REC-081 ✅ |
| **S9** ✅ 2026-07-31 | **Factorial HR**: alta automática del empleado al contratar (SDK oficial + API Key), idempotencia por `factorial_employee_id`, interruptor de sincronización en Ajustes — ver §8.13 | REC-088..REC-092 ✅ |
| **S9.5** ✅ 2026-07-31 | **Ajustes ampliado**: plantillas de correo editables desde la UI (fin de los `update … set cuerpo` por migración) + bitácora `/reclutamiento/correos` + navegación de regreso en el módulo — ver §8.14 | REC-093..REC-096 ✅ |
| **S10** | Onboarding del candidato: captura de datos de contratación vía magic link (sustituye Google Form + layout xlsx); alimenta la tabla del correo interno y el alta en Factorial — ver §8.12 | REC-097..REC-102 |

> ### ⚠ Renumeración de tickets (2026-08-04)
>
> Los commits de Factorial del 2026-07-31 se etiquetaron **REC-067..REC-070**, números que **S7.5 ya tenía ocupados** (REC-067 = migración `rec_020`, REC-070 = `lib/reclutamiento/ajustes.ts`). La migración `rec_023` además se comenta a sí misma como "REC-082", que tampoco corresponde.
>
> **Se respeta S7.5** (sprint cerrado y documentado) y el trabajo de Factorial se reasigna a **REC-088..REC-092**. Tabla de equivalencia para poder rastrear los mensajes de commit viejos:
>
> | Commit | Etiqueta en el mensaje | Número correcto |
> |---|---|---|
> | `9d95f5f` | REC-067 | **REC-088** |
> | `41ccb77` | REC-068 | **REC-089** |
> | `9e7a9ee` | REC-069 | **REC-090** |
> | `3c99f97` | REC-070 | **REC-091** |
> | `84e505b` | *(sin etiqueta; el SQL dice REC-082)* | **REC-092** |
>
> No se reescribe historia de git ni se editan las migraciones ya aplicadas: la equivalencia vive aquí.

**S6 — alcance ampliado (2026-07-27):** además de la vista de comité original, S6 incluye entrevistadores dinámicos (N, no 3 fijos), transición automática a `en_revision` al abrir el perfil, campo de comentarios del comité, registro de la decisión de la DG (Javier) y la automatización del correo de bienvenida al contratar (con adjuntos fijos y CC configurable). Detalle completo en §8.9.

**S3 — DAG de transiciones (entregado 2026-07-01):** la RPC `rec_transicion_etapa` (security definer, valida rol/acceso adentro) mueve un candidato **un paso hacia adelante** y registra cada cambio en `rec_candidato_historial`:

```
postulado → en_revision → viable → entrevistas_agendadas → comite → final_dg → oferta → contratado
<cualquier etapa no terminal> → descartado   (motivo_descarte obligatorio)
```

No se permite saltar etapas, retroceder, ni salir de un estado terminal (`contratado` / `descartado`). El tablero (`/reclutamiento/pipeline`) es filtrable por vacante; cada card ofrece el avance forward y el descarte con motivo inline. **S4 (entregado 2026-07-07):** la transición a `entrevistas_agendadas` ya no es manual — `agendarSesion` la dispara automáticamente al agendar la sesión de Fase 2 (vía la RPC `rec_transicion_etapa`), junto con la creación de los eventos de Calendar con liga de Meet y el envío de los correos por Gmail.

**Sprint G + S4 — Agendamiento en cascada (entregado 2026-07-07):** desde `/reclutamiento/agendar` el usuario elige vacante, candidatos en etapa `viable`, fecha/hora de inicio, pausa opcional y los 3 entrevistadores (editables, default Benny/Maritere/Sergio). El server action `agendarSesion` (`lib/actions/agendamiento.ts`) calcula la cascada (una liga de Meet de 60 min por candidato; los 3 entrevistadores rotan en bloques de 20 min; los arranques se escalonan 20 min), y por cada candidato: crea el evento de Calendar con Meet (`conferenceDataVersion=1`, invita candidato + 3 entrevistadores con `sendUpdates=all`), guarda `gcal_event_id`/`meet_url` en `rec_entrevistas`, envía el correo `agendamiento_fase2` por Gmail, registra en `rec_correos_enviados` y transiciona la etapa. Al final manda un correo `agenda_entrevistadores` con la tabla HTML de la sesión. La integración con Google es **REST directo sin `googleapis`** (`lib/google/client.ts`), y el `refresh_token` se cifra con AES-256-GCM (`lib/google/crypto.ts`, llave en `GOOGLE_TOKEN_ENCRYPTION_KEY`). La cuenta emisora es **reconectable** sin cambiar código (hoy `uzziel.valdez@`; mañana `reclutamiento@`). **REC-033 (2026-07-08):** el correo `agenda_entrevistadores` ahora adjunta el CV de cada candidato agendado (descargado del bucket `reclutamiento`); `enviarCorreo` soporta adjuntos vía MIME `multipart/mixed`.

### 8.5 Fuera del MVP

- Entrevistadores externos (sin `profiles`) → tabla `rec_entrevistadores` v2.
- **Modelo N↔N** (persona × postulación × vacante) → v2 cuando haya volumen real de candidatos repitiendo postulaciones. En MVP `rec_candidatos.vacante_id` es FK directa (1 candidato ↔ 1 vacante).
- Portal de candidatos externos (el middleware/callback cierran todo a `@financieracrediflexi.com`).
- Scoring/IA de CVs, parsing automático de currículums.
- Multi-vacante genérico avanzado (el MVP se centra en Gerente de Inversiones).
- Recordatorios automáticos / cron de no-show.
- Parsing de respuestas entrantes del candidato vía `gmail_thread_id` (ej. confirmaciones de asistencia).

### 8.6 Decisiones tomadas (2026-06-30)

- Derivar entrevistadores de `profiles` (sin tabla propia en MVP).
- Magic link consolidado por (sesión × entrevistador).
- Ruta pública del evaluador fuera de `(dashboard)` y excluida del middleware.
- Patrón de escritura = Server Actions (Score), no client-direct (Tickets).
- **Alcance MVP = Opción A (full Google Workspace):** Gmail + Calendar API con OAuth de `reclutamiento@financieracrediflexi.com`.
- **Sprint G antes de S4** (Google conectado es prerequisito del agendamiento masivo); S6+S7 consolidados en Sprint G.
- **Pipeline 1↔1** candidato ↔ vacante; N↔N a v2.
- **RLS MVP:** admin (Héctor) ve y escribe todo; nadie más entra; entrevistadores solo por magic link a su sesión.
- **Cifrado `refresh_token`:** validar Supabase Vault al inicio del Sprint G; si no está disponible, fallback a `pgcrypto` (`pgp_sym_encrypt`) con llave en `GOOGLE_TOKEN_ENCRYPTION_KEY` (Vercel).

### 8.7 TODOs / preguntas abiertas

1. **Plantillas de correo:** conseguir el copy literal de Héctor para todas las plantillas antes del Sprint G (hoy solo tenemos "Entrevista Final" / `pase_fase3`).
2. **"Filtro por DG":** confirmar con Héctor la regla de transición (¿un voto basta? ¿mayoría? ¿solo cuenta como voto registrado y Héctor decide en comité?).
3. **Entrevistadores:** ¿siempre los mismos 3 en orden fijo Benny → Maritere → Sergio, o configurables por vacante/sesión?
4. **Retención de datos** de candidatos descartados (compliance CNBV / LFPDPPP) — definir política de purga/anonimización.
5. **Workspace OAuth:** validar al inicio del Sprint G si CrediFlexi restringe apps externas en su Workspace; si sí, Manuel debe whitelistear el `client_id` una vez.

> Resueltos (ya no son preguntas abiertas): alcance Gmail+Calendar (= Opción A) · cifrado del `refresh_token` (= Vault si está, `pgcrypto` si no — ver §8.6) · pipeline (= 1↔1, N↔N v2) · RLS (= admin ve todo, nadie más entra). El set de placeholders de plantillas y la caducidad/rotación de magic links se resuelven como parte del trabajo del Sprint G y S5 respectivamente (no son bloqueantes de planeación).

### 8.8 S5 — Evaluaciones vía magic link (entregado 2026-07-15)

> **Entregado 2026-07-15** (REC-046..REC-052). Lo que sigue es el plan de implementación tal como se ejecutó; las notas de cierre están al final de la sección.

> Plan listo para ejecutar (2026-07-15). Tickets REC-046..REC-052, un commit atómico por ticket, en este orden. Convenciones del repo: commits en español `feat(rec): ... (REC-0XX)`, **sin** `Co-Authored-By` ni firma de Claude; Server Actions con patrón `Result<T> = ({ ok: true } & T) | { ok: false; error: string }`; validación con zod `safeParse`; **nunca** commitear `sessions.md` ni `.env*`.

**Contexto que el implementador debe leer antes de tocar código:**
- `supabase/migrations/20260630120200_rec_003_tablas.sql` — ya existen `rec_magic_links` (token único, `expira_at`, `usado_at`, `unique(sesion_id, entrevistador_id)`) y `rec_evaluaciones` (`unique(entrevista_id, entrevistador_id)`, `entrevistador_id → profiles.id` NOT NULL).
- `supabase/migrations/20260630120300_rec_004_rls.sql` — RLS actual (admin-only) de las tablas `rec_*`.
- `supabase/migrations/20260707100100_rec_010_agendamiento.sql` — columnas de sesión (`entrevistadores` jsonb `[{nombre, email}]`) y seed de plantillas.
- `lib/actions/agendamiento.ts` — server action `agendarSesion` (aquí se generan los magic links en REC-048).
- `lib/google/client.ts` — `enviarCorreo` (ya soporta adjuntos; para estos correos NO se adjunta nada).
- `middleware.ts` — hoy solo `/login` y `/auth` son públicas; hay que abrir `/evaluar`.
- `lib/supabase/types.ts`, `lib/schemas/reclutamiento.ts` — patrones de tipos y schemas existentes.

**Decisión de diseño clave (resuelve una inconsistencia del schema):** en S4 los entrevistadores quedaron modelados como jsonb `[{nombre, email}]` en `rec_sesiones_entrevistas.entrevistadores` — NO son `profiles` (Benny/Maritere/Sergio no tienen cuenta en la app). Por lo tanto S5 identifica al entrevistador **por email**, no por `profiles.id`: se relajan `rec_magic_links.entrevistador_id` y `rec_evaluaciones.entrevistador_id` a nullable y se agregan columnas `entrevistador_email` + `entrevistador_nombre` (text). Los uniques pasan a `(sesion_id, entrevistador_email)` y `(entrevista_id, entrevistador_email)`.

**Parámetros de producto (ya decididos, no preguntar):**
- Token: `crypto.randomBytes(32).toString('base64url')`, multi-uso hasta expirar (NO single-use; `usado_at` solo informativo, se actualiza en cada submit).
- Expiración: `fecha` de la sesión + 7 días (`expira_at = (fecha + interval '8 days')::date` a medianoche, o equivalente).
- URL pública: `/evaluar/[token]` (corta, va en correos). Carpeta `app/evaluar/[token]/page.tsx` — FUERA de `(dashboard)`.
- Formulario por candidato: `recomendacion` (`rec_viabilidad`: `si`/`no`/`filtro_dg`) **obligatoria**, `comentarios` (text, opcional), `puntaje` (1–10, opcional). Editable mientras el token no expire (upsert).
- La página pública muestra SOLO: nombre del entrevistador, vacante, fecha, y por candidato nombre + horario + su propio formulario. **Nunca** CVs, emails de candidatos ni evaluaciones de otros entrevistadores.
- Un correo individual por entrevistador (plantilla `notificacion_entrevistador`, placeholder `{{magic_link}}`) — no se mete la liga en el correo de agenda compartido porque las ligas son personales.

**Tickets:**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-046** | Migración `rec_011_evaluaciones_magic_link.sql` | (a) `alter table rec_magic_links`: `entrevistador_id` nullable, add `entrevistador_email text`, `entrevistador_nombre text`; drop constraint `rec_magic_links_sesion_id_entrevistador_id_key`, nuevo `unique (sesion_id, entrevistador_email)`. (b) Igual en `rec_evaluaciones`: `entrevistador_id` nullable, add `entrevistador_email`/`entrevistador_nombre`; drop `rec_evaluaciones_entrevista_id_entrevistador_id_key`, nuevo `unique (entrevista_id, entrevistador_email)`. (c) Seed de plantilla `notificacion_entrevistador` (`on conflict (codigo) do update`): asunto `'Tus evaluaciones — {{vacante}} / {{fecha}}'`, cuerpo corto con `{{nombre_entrevistador}}`, `{{vacante}}`, `{{fecha}}`, liga `{{magic_link}}` y nota de que expira en 7 días. (d) RPC `rec_sesion_por_token(p_token text) returns jsonb` — `security definer set search_path = public`; valida token existente y no expirado (si no: `{"valido": false, "motivo": "invalido"|"expirado"}`); si es válido devuelve `{"valido": true, "entrevistador_nombre", "vacante", "fecha", "candidatos": [{entrevista_id, nombre, horario, evaluacion: {recomendacion, comentarios, puntaje} | null}]}` — candidatos de las `rec_entrevistas` de la sesión del token, ordenados por `fecha_hora`, con la evaluación existente de ESE email si la hay. (e) RPC `rec_submit_evaluacion(p_token text, p_entrevista_id uuid, p_recomendacion rec_viabilidad, p_comentarios text, p_puntaje smallint) returns jsonb` — security definer; valida token vigente Y que `p_entrevista_id` pertenezca a la sesión del token (si no, error); upsert en `rec_evaluaciones` por `(entrevista_id, entrevistador_email)` con `enviada_at = now()`; actualiza `usado_at = now()` en el magic link; devuelve `{"ok": true}` o `{"ok": false, "error": ...}`. (f) `grant execute` de ambas RPCs a `anon` y `authenticated`; `revoke` de todo lo demás. Las tablas siguen admin-only por RLS (el acceso público es EXCLUSIVAMENTE vía estas RPCs). |
| **REC-047** | Tipos TS | `lib/supabase/types.ts`: columnas nuevas de `rec_magic_links`/`rec_evaluaciones` y firmas de las dos RPCs (seguir el patrón de `rec_transicion_etapa`). |
| **REC-048** | Generación + correos en `agendarSesion` | En `lib/actions/agendamiento.ts`, después del correo de agenda (paso 5): por cada entrevistador `e1/e2/e3` → generar token (`crypto.randomBytes(32).toString('base64url')`), insert en `rec_magic_links` (`sesion_id`, `entrevistador_email`, `entrevistador_nombre`, `token`, `expira_at`), construir liga `${baseUrl}/evaluar/${token}` (baseUrl: usar la env pública de URL que ya exista en el repo — buscar `NEXT_PUBLIC_` en `.env.example`/código; si no hay ninguna, crear `NEXT_PUBLIC_APP_URL` y documentarla), y enviar correo individual con plantilla `notificacion_entrevistador` (cargarla junto con las otras dos en el paso 2). Registrar cada envío en `rec_correos_enviados` (`plantilla_codigo: 'notificacion_entrevistador'`, estado enviado/error). Errores aquí NO abortan la acción (mismo patrón de resiliencia del resto). Extender el retorno con `linksGenerados: number` si es útil para la UI. |
| **REC-049** | Ruta pública `/evaluar/[token]` | `middleware.ts`: agregar `pathname.startsWith('/evaluar')` a las rutas públicas (retornar `supabaseResponse` sin exigir user). `app/evaluar/[token]/page.tsx` (server component): llama `rec_sesion_por_token`; si `valido=false` renderiza pantalla amable ("liga inválida" / "liga expirada — pide una nueva a RH") sin filtrar información; si es válido renderiza encabezado (entrevistador, vacante, fecha) + lista de candidatos. Layout mínimo standalone (sin sidebar del dashboard), responsive (se usará desde celular). |
| **REC-050** | Formulario + submit | `lib/schemas/reclutamiento.ts`: schema zod `submitEvaluacionSchema` (`token`, `entrevista_id` uuid, `recomendacion` enum, `comentarios` opcional, `puntaje` 1–10 opcional). Server action `submitEvaluacion` en `lib/actions/reclutamiento.ts` (o archivo nuevo `lib/actions/evaluaciones.ts`): `safeParse` → llama RPC `rec_submit_evaluacion` → `Result`. Componente client `components/reclutamiento/evaluacion-form.tsx`: radio/segmented para `si`/`no`/`filtro_dg` (labels: "Viable" / "No viable" / "Filtro DG"), textarea comentarios, puntaje opcional, botón guardar con estado pending y confirmación visual. Precarga la evaluación existente si la hay. |
| **REC-051** | UX de progreso | En la página: badge "Evaluado ✓" por candidato ya evaluado, contador "N de M evaluados", los formularios siguen editables (re-guardar = actualizar). Orden de candidatos por horario. Estados vacíos correctos. |
| **REC-052** | Verificación + cierre | `npx tsc --noEmit` limpio, `npx next build` verde, `supabase db push` de la migración a remoto, smoke test manual del flujo (agendar → correo con liga → abrir `/evaluar/[token]` → guardar evaluación → editar → verificar fila en `rec_evaluaciones`). Commits atómicos por ticket. **Actualizar docs:** PLAN.md §8.4 (fila S5 → ✅ con fecha y tickets REC-046..052), este §8.8 marcar como entregado, bump de "Última actualización"; RESEARCH-CONSOLIDADO.md §13: agregar nota en 13.0 (o subsección nueva) con las decisiones entregadas de S5 (identificación por email en vez de profiles.id, RPCs security definer como única superficie pública, token multi-uso 7 días) y bump de fecha. Verificar consistencia final de ambos documentos contra lo implementado. |

**Fuera de alcance de S5 (no hacer):** vista de comité (S6), correo `pase_fase3` automático, recordatorios, cancelar/reagendar sesiones, rate limiting de la ruta pública (v2).

**Notas de cierre (2026-07-15):** entregado según plan. La migración `20260715120000_rec_011_evaluaciones_magic_link.sql` relaja `entrevistador_id` a nullable y agrega `entrevistador_email`/`entrevistador_nombre` con uniques por email en `rec_magic_links` y `rec_evaluaciones`; las RPC `rec_sesion_por_token` y `rec_submit_evaluacion` (security definer, grant a `anon`) son la única superficie pública. `agendarSesion` genera un token por entrevistador (`randomBytes(32).base64url`, expira a los 7 días) y envía la liga personal con la plantilla `notificacion_entrevistador`; la URL base se deriva de los headers de la petición (sin env nueva). La ruta `/evaluar/[token]` vive fuera de `(dashboard)` y está excluida del middleware; muestra solo nombre + horario + formulario por candidato (nunca CVs ni datos de otros). Pendiente operativo: `supabase db push` de la migración a remoto y smoke test end-to-end (requiere entorno con deps instaladas — el checkout local tenía node_modules incompleto).

### 8.9 S6 — Comité, entrevistadores dinámicos y contratación (plan 2026-07-27)

> Plan listo para ejecutar. Tickets REC-053..REC-060, un commit atómico por ticket, en este orden. Convenciones del repo: commits en español `feat(rec): ... (REC-0XX)`, **sin** `Co-Authored-By` ni firma de Claude; Server Actions con patrón `Result<T>`; zod `safeParse`; **nunca** commitear `sessions.md` ni `.env*`.

**Contexto que el implementador debe leer antes de tocar código:**
- `lib/actions/agendamiento.ts` — `agendarSesion` hoy asume exactamente 3 entrevistadores (`[e1, e2, e3]`, cascada de bloques de 20 min, tabla de agenda con 3 columnas, magic links por entrevistador).
- `lib/schemas/reclutamiento.ts` — `agendarSesionSchema` + `calcularCascada` + `ENTREVISTADORES_DEFAULT` (hoy Benny/Maritere/Sergio hardcodeados).
- `lib/actions/reclutamiento.ts` — `transicionarCandidato` y patrón de acciones existente; RPC `rec_transicion_etapa` (DAG §8.4).
- `app/(dashboard)/reclutamiento/` — páginas existentes (candidatos, pipeline, agendar) para respetar composición y componentes.
- `supabase/migrations/20260715120000_rec_011_evaluaciones_magic_link.sql` — patrón de RPCs security definer y seeds de plantilla.
- `lib/google/client.ts` — `enviarCorreo` ya soporta adjuntos MIME (`multipart/mixed`, patrón REC-033).

**Decisiones de producto (ya tomadas, no preguntar):**
1. **Entrevistadores dinámicos:** en `/reclutamiento/agendar` se inicia con **un** entrevistador (nombre + email) y un botón **"+"** agrega más filas; captura manual libre, sin catálogo. `ENTREVISTADORES_DEFAULT` deja de ser obligatorio (puede quedar como sugerencia inicial de la primera fila o eliminarse). N ≥ 1.
2. **Cascada generalizada:** cada entrevistador conserva su bloque de **20 min** por candidato → duración del Meet por candidato = `N × 20` min; los arranques se siguen escalonando 20 min (la rotación funciona para cualquier N: en el slot k coinciden los pares i+j=k, nadie se empalma).
3. **`en_revision` automática:** al abrir el admin el perfil/detalle de un candidato en etapa `postulado`, el server component dispara `rec_transicion_etapa` → `en_revision` (nota: "Apertura de perfil"). Idempotente: solo si `etapa === 'postulado'`.
4. **Comité:** página `/reclutamiento/comite` (filtrable por vacante) con los candidatos en etapa `comite`. Por candidato: todas las evaluaciones de los entrevistadores (recomendación + comentarios + puntaje, desde `rec_evaluaciones`), un campo nuevo **`notas_comite`** (text en `rec_candidatos`, capturado en la reunión de comité) y las acciones de decisión.
5. **Decisión de la DG (Javier):** Javier NO tiene login; la pantalla de comité se le muestra en la reunión y **el admin registra ahí mismo** la decisión: "Pasa con DG" (→ `final_dg`) o "Descartar" (motivo obligatorio). Todo queda en `rec_candidato_historial` (ya existente) — sí se documenta.
6. **Contratación:** acción `contratarCandidato` desde el comité/pipeline para candidatos en `final_dg` u `oferta`; captura `fecha_ingreso` y `fecha_limite_docs`, permite editar los CC (prellenados desde la plantilla) y al confirmar: encadena las transiciones del DAG hasta `contratado` y envía el correo **`bienvenida_contratacion`** al candidato con CC.
7. **Correo de bienvenida** (copy base = correo real de Héctor 2026-07-07 "Bienvenido / Documentos para contratación"): lista de documentos (acta de nacimiento, INE, CURP, constancia fiscal SAT, NSS/IMSS, comprobante de domicilio, estado de cuenta bancario, constancia laboral, constancia de estudios, layout de datos personales), liga del Google Form de Gente y Cultura (fija en el cuerpo), y **2 adjuntos fijos**: `FORMATO LAYOUT DATOS.xlsx` + `Lineamientos para fotografias.pdf`. Placeholders: `{{nombre_candidato}}`, `{{fecha_ingreso}}`, `{{fecha_limite_docs}}`.
8. **Adjuntos fijos desde Storage:** bucket `reclutamiento`, carpeta `plantillas/` (`plantillas/layout-datos-personales.xlsx`, `plantillas/lineamientos-fotografias.pdf`). **Paso operativo manual:** subirlos una vez por el dashboard de Supabase (los originales están en las Descargas de Uzziel, 2026-07-27). La acción los descarga y adjunta igual que REC-033.
9. **CC configurable:** columna `cc_emails jsonb` en `rec_plantillas_correo` (default seed: Irvin Mora, Cynthia Aguilar, Jesús Montellano); editable al momento de contratar (prellenado, se puede quitar/agregar).
10. **Automatización post-contratación adicional:** POR DEFINIR — S6 solo deja el gancho (la acción `contratarCandidato` centraliza el "al contratar pasa X"); no construir nada más ahí.

**Tickets:**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-053** | Migración `rec_012_enum_bienvenida.sql` | `alter type rec_plantilla_codigo add value if not exists 'bienvenida_contratacion';` — **sola en su migración** (Postgres no permite usar un valor de enum nuevo en la misma transacción). |
| **REC-054** | Migración `rec_013_comite_contratacion.sql` | (a) `rec_candidatos`: add `notas_comite text`, `fecha_ingreso date`. (b) `rec_plantillas_correo`: add `cc_emails jsonb not null default '[]'`. (c) Seed plantilla `bienvenida_contratacion` (`on conflict (codigo) do update`) con el copy de la decisión 7 y `cc_emails` con los 3 defaults de la decisión 9. |
| **REC-055** | Tipos TS | `lib/supabase/types.ts`: columnas nuevas + valor de enum de plantilla. |
| **REC-056** | Entrevistadores dinámicos (lógica) | `lib/schemas/reclutamiento.ts`: `entrevistadores` pasa de 3 fijos a `z.array(...).min(1)`; `calcularCascada` recibe `numEntrevistadores` (bloque candidato = N×20 min, stagger 20 min). `lib/actions/agendamiento.ts`: reemplazar `[e1,e2,e3]` por loops sobre el array (descripción del evento, attendees, tabla HTML de agenda con N columnas, magic links y correos por N entrevistadores). |
| **REC-057** | Entrevistadores dinámicos (UI) | `/reclutamiento/agendar`: una fila de entrevistador (nombre + email) inicial + botón "+" para agregar y "×" para quitar (mín. 1); preview de cascada refleja N; validación inline de emails. |
| **REC-058** | `en_revision` automática | En el detalle/perfil del candidato: si `etapa === 'postulado'`, disparar `rec_transicion_etapa` → `en_revision` server-side al renderizar (con `revalidatePath`). No romper si la RPC falla. |
| **REC-059** | Comité + contratación | Página `/reclutamiento/comite` (decisiones 4–5) + sidebar. Server actions: `guardarNotasComite`, decisión (→ `final_dg` / descarte) reutilizando `transicionarCandidato`, y `contratarCandidato` (decisión 6: schema zod con `fecha_ingreso`, `fecha_limite_docs`, `cc_emails`; encadena transiciones; render de plantilla; descarga adjuntos de `plantillas/`; `enviarCorreo` con CC + adjuntos; bitácora en `rec_correos_enviados`). |
| **REC-060** | Verificación + cierre | `tsc`/`build` verdes, `supabase db push`, subir los 2 adjuntos al bucket (paso manual documentado), smoke test **con datos de prueba y correos propios — NUNCA los reales** (lección 2026-07-15), actualizar PLAN §8.4/§8.9 y RESEARCH §13, bump de fechas. |

**Fuera de alcance de S6 (no hacer):** resto de la automatización post-contratación (decisión 10), correo `pase_fase3` automático, recordatorios, cancelar/reagendar, portal del candidato, catálogo de entrevistadores.

**Notas de cierre (2026-07-27):** entregado según plan. Migraciones aplicadas a remoto: `rec_012` (enum `bienvenida_contratacion`), `rec_013` (columnas `notas_comite`/`fecha_ingreso` en `rec_candidatos`, `cc_emails jsonb` en `rec_plantillas_correo`, seed de la plantilla y bloque dinámico N×20 en `rec_sesion_por_token`), `rec_014` (plantilla `agendamiento_fase2` con placeholder único `{{rotacion_entrevistadores}}`) y `rec_015` (se agrega el mime type xlsx al bucket `reclutamiento` para poder subir el layout). Entrevistadores dinámicos (N ≥ 1) en schema, cascada, `agendarSesion` (eventos/attendees/tabla/magic links) y UI de `/reclutamiento/agendar`. `en_revision` automática al abrir el perfil de un `postulado`. Nueva página `/reclutamiento/comite` (con item en el sidebar) que muestra las evaluaciones por entrevistador, captura `notas_comite`, registra la decisión de la DG (`final_dg`/descarte reutilizando `transicionarCandidato`) y ejecuta `contratarCandidato` (encadena el DAG hasta `contratado`, actualiza `fecha_ingreso`, envía `bienvenida_contratacion` con CC configurable y los 2 adjuntos fijos, bitácora en `rec_correos_enviados`). `enviarCorreo` ahora soporta header `Cc`. `tsc` limpio para los archivos de S6 (persiste el ruido baseline de `cartera_*` ajeno a rec). **Paso operativo pendiente (manual, requiere sesión autenticada — no hay service-role key en env):** subir por el dashboard de Supabase `FORMATO LAYOUT DATOS.xlsx` → `plantillas/layout-datos-personales.xlsx` y `Lineamientos para fotografias.pdf` → `plantillas/lineamientos-fotografias.pdf` en el bucket `reclutamiento`. Sin ellos, la contratación funciona pero el correo sale sin adjuntos (best-effort). Smoke test end-to-end pendiente de ejecutar solo con datos de prueba y correos propios.

### 8.10 S7 — Completar pipeline + configuración de alta (plan 2026-07-28)

> **Completado ✅ 2026-07-29 (REC-061..066).** Le da propósito real a las etapas `final_dg` y `oferta` (que antes solo se atravesaban) y agrega el correo interno de "Altas nuevo ingreso". Todo admin-side: se entregó sin depender de la captura del candidato (esa es S8).

**Origen:** revisión de Uzziel (2026-07-28). Se detectó que S6 saltaba de `comité` directo a `contratado`, dejando `final_dg` y `oferta` como etapas fantasma. Al revisar los correos reales de Héctor (plantilla `pase_fase3` "Entrevista Final" ya sembrada, y el correo interno "Altas Nuevos Ingresos" del 2026-07-10) se ve que el DAG sí tenía lógica; solo faltaba cablearla.

**DAG con propósito (queda igual, ahora cada paso hace algo):**
`comité → final_dg (entrevista final con la DG) → oferta (configuración de alta) → contratado (dispara bienvenida + altas internas)`

**Decisiones de producto (ya tomadas, no preguntar):**
1. **`final_dg` = entrevista final con la DG (Javier).** Al pasar `comité → final_dg` se manda la plantilla existente `pase_fase3` ("Entrevista Final / {{fecha_hora}}") al candidato. (Confirmar si el destinatario/CC aplica igual que las otras.)
2. **`oferta` = "Configurar alta".** Al llegar a `oferta`, la pantalla muestra un formulario de configuración por candidato:
   - **Equipo** (checkboxes, multi): Celular, Laptop, Desktop.
   - **Sistemas** (checkboxes, multi): Yunius, HubSpot, Otros → *campo de texto libre cuando marca "Otros"*.
   - **Inducción**: fecha + liga de Meet.
   - **Destinatarios internos** (rol fijo por etiqueta, correo editable): RH/firmas y bienvenida *(hoy Brendoli)*, Correos electrónicos *(hoy Julio)*, Inducción *(hoy Jesús Montellano)*, Alta Yunius *(hoy Diana)*, Alta HubSpot *(hoy Rolando)*, Jefe directo, CC adicional *(hoy Nohemi)*.
3. **Destinatarios: default prellenado pero fácil de cambiar.** Los correos por rol se guardan como default (en `rec_plantillas_correo.cc_emails` extendido o una config nueva) y se **prellenan**; el admin los edita al momento si cambia. Requisito explícito: **que sea fácil cambiarlos**.
4. **Correo interno "Altas nuevos ingresos"** (nueva plantilla `altas_nuevos_ingresos`, código de enum en su propia migración): se dispara al pasar `oferta → contratado`, junto con la bienvenida al candidato. Las **líneas de tareas se arman por rol según lo marcado** (si marcó inducción → sale la línea de inducción con fecha/Meet; si marcó HubSpot → la de HubSpot; etc.). Incluye los datos básicos del candidato (nombre, puesto/vacante, zona/plaza, jefe directo, fecha de inicio, equipo, sistemas).
5. **Datos básicos ahora; tabla completa después.** El correo interno se manda con lo que ya se tiene sin depender del onboarding. La "tabla bonita" de datos personales (fecha nac, domicilio, escolaridad…) se **enriquece cuando S10 capture esos datos** (dejar el gancho en el render de la plantilla).

**Tickets (borrador, refinar al arrancar S7):**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-061** ✅ | Migración enum + plantilla | Migración `rec_016` (enum `altas_nuevos_ingresos` solo) + `rec_017` (tabla `rec_alta_config` 1:1 con `rec_candidatos`: equipo/sistemas jsonb, otros_texto, induccion_fecha, induccion_meet_url, destinatarios jsonb; RLS; seed de la plantilla `altas_nuevos_ingresos`). |
| **REC-062** ✅ | Tipos TS + schema | `altaConfigSchema` zod (equipo/sistemas enums, meet url, destinatarios email) + constantes DG (`pasarFinalDgSchema`, `DG_EMAIL`/`DG_NOMBRE`) en `lib/schemas/reclutamiento.ts`; tipos en `lib/supabase/database.types.ts`. |
| **REC-063** ✅ | Entrevista final con la DG en la transición a `final_dg` | "Pasa con DG" abre form fecha/hora → `pasarAFinalDG`: **crea Google Meet** (candidato + Javier Vargas como en las otras meets), mueve a `final_dg`, envía `pase_fase3` al candidato, persiste `final_dg_at`/`final_dg_meet_url` en `rec_candidatos` (migración `rec_018`) para que el admin copie/reenvíe la liga. |
| **REC-064** ✅ | Etapa `oferta` = formulario de config | En `/reclutamiento/comite`, para candidatos en `oferta`: `AltaConfigForm` con equipo/sistemas/inducción/destinatarios (prellenados con `ALTA_DESTINATARIOS_DEFAULT`, editables) → `guardarAltaConfig` (upsert a `rec_alta_config`). |
| **REC-065** ✅ | Correo interno de altas al contratar | `contratarCandidato` al pasar a `contratado`: además de la bienvenida, `enviarCorreoAltas` arma y envía `altas_nuevos_ingresos` (formato real de Héctor, migración `rec_019`) a los destinatarios con las líneas de tarea por rol según lo marcado; CC = cc_adicional + CC de plantilla; bitácora en `rec_correos_enviados`. Best-effort: no bloquea la contratación. |
| **REC-066** ✅ | Verificación + docs | `tsc` y `next build` verdes, `db push` (`rec_019`), actualización de PLAN §8.10 / RESEARCH y bump de fechas. Smoke test de envío queda para prueba manual con correos propios (nunca los reales). |

**Fuera de alcance de S7 (no hacer):** captura de datos por el candidato (S8), la tabla completa de datos personales en el correo interno (viene con S8), generación del xlsx.

**Notas de progreso (2026-07-28):** REC-061..063 entregados y migraciones (`rec_016`/`rec_017`/`rec_018`) aplicadas a remoto. Decisión confirmada en REC-063: la liga se manda a Javier Vargas vía invitación de Calendar (igual que las otras meets) y el admin también puede copiarla desde el panel de comité.

**Cierre S7 (2026-07-29):** REC-064..066 entregados. Uzziel reenvió dos correos reales de "Altas Nuevo Ingreso" de Héctor, que desbloquearon REC-065: se aclaró que **Adriana Alejaldre es el rol `jefe_directo`** (conecta al candidato a la inducción, no es rol nuevo) y que el **modelo de un candidato por correo es correcto** (el segundo ejemplo trae uno solo). Migración `rec_019` reemplaza la plantilla genérica por el formato real; `ALTA_DESTINATARIOS_DEFAULT` se llenó con los correos consistentes (rh_firmas=Brendoli, correos=Julio, induccion=Jesús Montellano, alta_yunius=Diana, alta_hubspot=Rolando, cc_adicional=Nohemi); `correos` y `jefe_directo` varían por caso y se editan en el form. `next build` verde. Pendiente sólo el smoke test manual del envío con correos propios.

### 8.11 S7.5 — Destinatarios editables + pipeline dinámico (plan y cierre 2026-07-30)

> **Completado ✅ 2026-07-30 (REC-067..081).** Sprint correctivo detectado en el smoke test de S7: los correos vivían quemados en el código y el kanban movía tarjetas sin ejecutar nada. Se intercaló entre S7 y el onboarding. *(La renumeración que anunciaba esta nota quedó obsoleta al entregarse Factorial y Ajustes-ampliado antes que el onboarding — ver el aviso de renumeración en §8.4: S9 = REC-088..092, S9.5 = REC-093..096, S10 onboarding = REC-097..102.)*

**Origen:** revisión de Uzziel (2026-07-30). Dos problemas: (1) `DG_EMAIL`, `DG_NOMBRE` y los 7 destinatarios de altas eran constantes en `lib/schemas/reclutamiento.ts` — no se podían cambiar sin desplegar, y probar el flujo implicaba mandarle correos reales a media empresa; (2) el botón "→ siguiente etapa" del kanban solo llamaba a la RPC: cambiaba de columna sin pedir datos ni disparar la acción real, que vivía escondida en `/agendar` y `/comite`.

**Decisiones de producto (ya tomadas, no preguntar):**
1. **Ajustes en BD + override por candidato** (las dos cosas, no una u otra): `/reclutamiento/ajustes` edita DG, los 7 roles de altas y los CC por plantilla; esos valores **prellenan** cada formulario y siguen siendo editables al momento.
2. **`viable → entrevistas_agendadas` redirige a `/reclutamiento/agendar`** con el candidato preseleccionado. No se duplica la cascada de Meets en el kanban.
3. **`/reclutamiento/comite` se queda** como vista comparativa de evaluaciones. Los formularios se extrajeron a componentes compartidos que consumen kanban y comité.

**Decisiones de arquitectura:**
- **`rec_ajustes` (key/value jsonb).** Dos claves: `dg` (`{email, nombre, duracion_min}`) y `alta_destinatarios` (los 7 roles). Son config global sin relaciones: tablas separadas costarían el doble de migraciones y tipos a cambio de nada. Los CC de plantilla **no se duplican** aquí — `rec_plantillas_correo.cc_emails` ya existía y solo le faltaba UI.
- **RLS de escritura = `has_reclutamiento_access() or is_admin()`**, no admin-only: Héctor tiene el flag pero no es admin; con escritura admin-only el único operador real del módulo no podría cambiar un correo. La auditoría queda en `actualizado_por`/`actualizado_at`.
- **Sin correos de fallback.** Si falta la fila, `leerAjustes` devuelve strings vacíos + `faltanAjustes: true` y las acciones fallan con `Result` en español. Nunca se envía a una dirección quemada.
- **Vista `rec_candidato_requisitos` con `security_invoker = on`** (obligatorio; sin él la vista corre como owner y se salta RLS). Una ida a la BD por página en vez de 4 round-trips repetidos en tres páginas.
- **Motor de etapas puro** (`lib/reclutamiento/etapas.ts`): sin React, sin Supabase, sin directivas. Dado el candidato + contexto devuelve `SiguientePaso` (destino, título, acción, `puede`, `bloqueos`, `advertencias`, `progreso`). Consumido por kanban, perfil y comité: el copy y las reglas viven en un solo sitio.
- **La fricción es proporcional al efecto secundario.** Todo lo que manda correo (`comité→final_dg`, `oferta→contratado`) es `formulario` en modal; los pasos `directa` no envían nada. Un click accidental en una tarjeta de 220px no puede disparar un Meet.
- **Bloqueo duro solo con 0 evaluaciones**; con parciales es advertencia confirmable. Un entrevistador que nunca responde no puede congelar el pipeline.

**Tickets:**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-067** ✅ | Migración `rec_020_ajustes` | Tabla `rec_ajustes` + RLS + seed de los correos actuales (`on conflict do nothing`, para no pisar lo que se configure). |
| **REC-068** ✅ | Migración `rec_021_vista_requisitos` | Vista `rec_candidato_requisitos` (`security_invoker = on`) con `evaluaciones_esperadas`/`registradas` y `tiene_alta_config`. |
| **REC-069** ✅ | Tipos TS | `lib/supabase/types.ts`: `Tables.rec_ajustes` + `Views.rec_candidato_requisitos` (es el archivo que importa `lib/supabase/server.ts`, no `database.types.ts`). |
| **REC-070** ✅ | Lector + schemas | `lib/reclutamiento/ajustes.ts` (`leerAjustes(supabase)`, recibe el cliente por parámetro como `enviarCorreoAltas`) + `ajustesDgSchema` / `ajustesDestinatariosSchema` / `ccPlantillaSchema`. |
| **REC-071** ✅ | Server actions | `lib/actions/ajustes.ts`: `guardarAjustesDg`, `guardarDestinatariosAltas`, `guardarCcPlantilla` (patrón `Result` + `safeParse` + `revalidatePath`). |
| **REC-072** ✅ | Página de Ajustes | `/reclutamiento/ajustes` + `ajustes-panel.tsx` + item en el sidebar: Dirección General, destinatarios de altas (7 roles) y CC por plantilla. |
| **REC-073** ✅ | **Mueren los correos quemados** | `pasarAFinalDG` lee ajustes; `DG_EMAIL`/`DG_NOMBRE`/`DURACION_FINAL_DG_MIN`/`ALTA_DESTINATARIOS_DEFAULT` borrados; `comite-panel` recibe `dgNombre` y `destinatariosDefault` por props (era client component importando constantes). |
| **REC-074** ✅ | Motor de etapas | `lib/reclutamiento/etapas.ts`: `siguientePaso()` + `indicacion()` con la tabla de decisión completa. |
| **REC-075** ✅ | Perfil sobre el motor | `candidato-guia.tsx` pierde `guiaDe()` y pasa a ser renderer de `SiguientePaso`; el perfil lee la vista. **Bug corregido:** el total de evaluaciones usaba `entrevistas.length` (siempre 1) en vez de `sum(jsonb_array_length(entrevistadores))` — mostraba "1 de 1" faltando 2 de 3. |
| **REC-076** ✅ | Formularios compartidos | `components/reclutamiento/forms/{estilos,final-dg-form,contratacion-form,alta-config-form}.tsx`, con `variante: 'inline' \| 'modal'`. `comite-panel.tsx` baja de 636 a 376 líneas, diff funcional cero. |
| **REC-077** ✅ | Modal de acción | `etapa-accion-dialog.tsx`: monta el formulario según `paso.accion.form`, o la confirmación "Continuar de todos modos" cuando hay advertencias. |
| **REC-078** ✅ | Pipeline server | `pipeline/page.tsx` lee la vista + ajustes + estado de Google + CC de bienvenida en un solo `Promise.all`. |
| **REC-079** ✅ | Kanban dinámico | Fuera `SIGUIENTE_ETAPA` y el update optimista (con requisitos derivados se desincronizaba → `router.refresh()`). Cada tarjeta muestra progreso + una línea de indicación (rojo bloqueo / ámbar advertencia); el botón `disabled` lleva los motivos en el `title`. Incluye `oferta → contratado`, que el kanban antes omitía. |
| **REC-080** ✅ | Preselección en `/agendar` | `?candidato=` deja el candidato marcado; si no está entre los viables, banner ámbar explicando la etapa real en vez de ignorarlo en silencio. |
| **REC-081** ✅ | Verificación + docs | `tsc` sin errores nuevos, `next build` verde, migraciones `rec_020`/`rec_021` aplicadas a remoto, PLAN §8.4/§8.11 y renumeración de S8/S9. |

**Hallazgo colateral:** `components/ui/*` (scaffolding de shadcn) era **código muerto que rompía el build** — importaba `@/lib/utils` (el helper `cn`), que nunca se creó, y `class-variance-authority`, que nunca se instaló. Para diálogos se usan los primitivos de `@radix-ui/react-dialog` directamente. → **Borrado el 2026-08-18** con `components.json` y las 9 dependencias que solo él usaba.

**Fuera de alcance de S7.5:** drag & drop en el kanban, retroceso de etapas, catálogo de entrevistadores, historial visible de ajustes.

### 8.12 S10 — Onboarding del candidato (captura de datos) (plan 2026-07-28 · renumerado 2026-08-04)

> **Plan, aún sin implementar.** *(Era "S8, REC-082..087"; renumerado a **S10, REC-097..102** cuando S9/S9.5 se entregaron antes — ver el aviso de renumeración en §8.4.)* Sustituye el envío del Google Form + layout xlsx por la captura de los datos de contratación directamente en la plataforma vía magic link. El correo de bienvenida (S6) sigue como fallback hasta que S10 esté listo. Alimenta la "tabla completa" del correo interno de altas (S7) **y el alta en Factorial (S9)**, que hoy se conforma con nombre/apellido/email/teléfono.

**Origen:** ajuste solicitado por Uzziel (2026-07-28). Pain point: hoy el candidato llena un Excel (`FORMATO LAYOUT DATOS.xlsx`) y un Google Form de Gente y Cultura, y alguien retranscribe eso. Capturándolo estructurado se elimina la transcripción y se valida en el punto de captura.

**Decisiones de producto (ya tomadas, no preguntar):**
1. **El xlsx y el Google Form quedan fuera del flujo.** El layout **no** se importa a ningún otro sistema por ahora. Si RH lo pide luego, se agrega un botón "Descargar layout" que arme el Excel desde los datos capturados — **gancho documentado, NO se construye.**
2. **Captura sin login para el candidato:** magic link tras contratar → ruta pública `/onboarding/[token]` (patrón S5: token `randomBytes(32).base64url`, RPC security definer, expira a N días). Se llena desde el celular.
3. **Visibilidad estricta:** datos con PII sensible (CURP, RFC, NSS, cuenta bancaria, CLABE, tarjeta) solo los ven **RH/admin**. RLS admin-only; superficie pública = solo la RPC de captura por token.
4. **Modelo:** tabla `rec_datos_contratacion` 1:1 con `rec_candidatos`. `empresa`/`ubicacion`/`fecha_inicio` se prellenan; `edad` y "nombre completo formato" son derivados.

**Campos del layout (fuente: `FORMATO LAYOUT DATOS.xlsx`, hoja `Layout`):**
- *Sistema:* Empresa (fija `CREDIFLEXI SAPI DE CV`), Ubicación/plaza, Fecha de inicio (= `fecha_ingreso`).
- *Personales:* Nombre(s), Apellido paterno, Apellido materno, Sexo, Estado civil, Fecha de nacimiento, Edad *(derivada)*, Lugar de nacimiento, Nacionalidad, Profesión, ¿Eres Papá o Mamá? (SI/NO), Talla de blusa/camisa (CH/M/G/XG).
- *Fiscales (validar):* RFC (13), CURP (18), IMSS/NSS (11).
- *Domicilio:* Calle, No. exterior, No. interior, Colonia, Delegación/Municipio, Estado, Código postal.
- *Contacto:* Teléfono particular, Teléfono móvil, Correo personal.
- *Bancarios (PII sensible):* Banco, Cuenta bancaria, CLABE (18), No. de tarjeta.

**Tickets (borrador):** migración `rec_datos_contratacion` + magic link/RPC; tipos + `onboardingSchema`; ruta pública `/onboarding/[token]` + submit; vista RH/admin de revisión; enriquecer el correo interno de altas (S7) con la tabla completa; gancho export xlsx (solo documentar).

**Fuera de alcance de S10:** generación real del xlsx, carga de documentos escaneados (INE/acta/comprobante) salvo que se decida, integración con nómina/IMSS, portal con login.

### 8.13 S9 — Integración con Factorial HR (alta automática de empleados) ✅ 2026-07-31

> **Entregado.** *(Plan 2026-07-30, implementado 2026-07-31 — REC-088..092.)* Al pasar un candidato a `contratado`, además del correo interno de altas (S7), se da de alta al empleado automáticamente en **Factorial HR** vía su API pública. Cierra el loop "candidato → empleado" sin retranscripción manual.
>
> **El interruptor arranca APAGADO.** `rec_ajustes.factorial.sync_activa = false` (`rec_023`): la contratación funciona completa (correos incluidos) y el alta en Factorial solo ocurre cuando alguien la enciende a propósito desde `/reclutamiento/ajustes`. Es deliberado — mientras no se valide contra producción, no queremos crear empleados reales por error.

**Origen:** propuesta de Uzziel (2026-07-30). Investigación de la API de Factorial hecha por IA externa con acceso a la doc + confirmación directa del SDK oficial en GitHub (`factorialco/factorial-api-sdks`). El patrón es casi idéntico a la integración Google ya existente (`lib/google/`), por lo que el molde arquitectónico ya está probado en el repo.

**Decisiones de arquitectura (ya tomadas, no re-investigar):**
1. **Auth = API Key (no OAuth2).** Es el camino que Factorial documenta para *"internal company developments"*: la genera un admin en la UI, sin consentimiento por usuario, **sin la caducidad de refresh token de OAuth** (access 1 h / refresh 1 semana → se rompería entre contrataciones esporádicas). El SDK la manda como header **`x-api-key`**. Tradeoff aceptado y registrado como riesgo: la API Key da **acceso total y no se puede acotar por scope** → god-mode; va como secret **solo server-side** en Vercel (`FACTORIAL_API_KEY`), nunca en cliente.
2. **SDK = `@factorialco/api-client` (no REST a mano).** Auto-generado del OpenAPI, **tipado**, `apiKey`/`token`/`baseUrl` de primera clase, paginación por cursor. El SDK tipado elimina el mayor unknown de la doc (el body exacto de `create_with_contract` lo valida TypeScript). Se fija a una versión por fecha de API: `npm install @factorialco/api-client@2026-07-01`. (Excepción consciente a la convención "sin SDK" de Google: aquí el SDK oficial resuelve los huecos "NO DOCUMENTADO" de la doc pública.)
3. ~~**Entorno demo primero.**~~ **Corregido en la implementación:** nunca se consiguió el entorno demo. El spike corrió en **solo lectura contra la cuenta real de CrediFlexi**, que era seguro (solo `GET` de catálogos) y además devolvió los IDs de producción de una vez. `FACTORIAL_BASE_URL` queda como override opcional; el default del SDK (`api.factorialhr.com`) es el que se usa. El resguardo contra escrituras accidentales no es el host, es el **interruptor `sync_activa`**.
4. **Alta en dos pasos.** `client.employees.employees.createWithContract` crea **empleado + contrato básico**. **Salario (en cents) y job_title viven en `ContractVersion`**, no en el body del alta. *Confirmado en el spike:* el alta implementada es solo el primer paso; el follow-up con `client.contracts.contractVersions` **no se construyó** (ver "Fuera de alcance").
5. **Disparo best-effort.** En `contratarCandidato`, tras la contratación y el correo de altas, llamada al alta en Factorial que **no bloquea** la contratación si falla (igual que el correo de altas). Idempotencia por candidato para no duplicar empleados en reintentos.
6. **Catálogos preexisten.** El alta referencia por ID: legal entity (la financiera), `locations/locations`, `teams`, `job_catalog`. Setup **único y manual** en Factorial; luego se leen los IDs vía el SDK.

**Arquitectura entregada:**
- **`lib/factorial/client.ts`** (74 líneas) — wrapper del SDK. Expone `crearEmpleadoConContrato(alta)`; los IDs de catálogo son constantes con override por env (`FACTORIAL_COMPANY_ID` `355437`, `FACTORIAL_LEGAL_ENTITY_ID` `380827`, `FACTORIAL_LOCATION_ID` `488730` — obtenidos en el spike). Lanza si falta `FACTORIAL_API_KEY`, si Factorial responde `error`, o si no devuelve id. Tolera que el SDK envuelva el recurso en `{ data }` o lo devuelva directo.
- Secret `FACTORIAL_API_KEY` en Vercel (server-side). No hay OAuth flow ni tabla de credenciales (a diferencia de Google): es una env var estática.
- **No se creó** `rec_factorial_alta` ni se extendió `rec_alta_config`. El alta se conforma con lo que ya existe en `rec_candidatos` (nombre/apellidos, email, teléfono, `fecha_ingreso`). Capturar salario, equipo y nivel de puesto queda para **S10** (onboarding), que es donde el dato entra limpio en vez de teclearse dos veces.

**Tickets entregados:**

| Ticket | Commit | Qué se hizo |
|---|---|---|
| **REC-088** ✅ | `9d95f5f` | **Spike de solo lectura** (`scripts/factorial-explorar.mjs`, 110 líneas). Conexión verificada vía `x-api-key`. Capturó los IDs reales: company `355437`, legal_entity `380827`, location `488730`, **6 teams, 43 roles + 52 levels**. Hallazgo clave: el puesto mapea a **`role_id` + su `level` default**, NO a `tree_node` (que exige filtro). |
| **REC-089** ✅ | `41ccb77` | `lib/factorial/client.ts` con el SDK oficial `@factorialco/api-client`. |
| **REC-090** ✅ | `9e7a9ee` | Migración `rec_022`: columna `rec_candidatos.factorial_employee_id text`. **Idempotencia** — `NULL` = sin alta; con valor, no se vuelve a crear. |
| **REC-091** ✅ | `3c99f97` | `contratarCandidato` llama al alta best-effort y persiste el id; `contratacion-form.tsx` pide nombre y apellidos **por separado** (Factorial los exige así, y partir un `nombre_completo` a la adivina produce empleados mal dados de alta); el `Result` gana `factorialCreado` para el toast diferenciado. |
| **REC-092** ✅ | `84e505b` | Migración `rec_023`: clave `factorial` en `rec_ajustes` con `{ sync_activa: false }` + interruptor en `/reclutamiento/ajustes`. Apagar el alta ya no requiere desplegar. |
| — | `e414a4d` | **Fix:** `contratarCandidato` tronaba al llegar al alta (`lib/actions/comite.ts` + tipos). |

**Bloqueantes — resueltos:**
1. ~~Entorno demo~~ → no se usó; el spike de solo lectura contra producción lo sustituyó.
2. ~~Confirmar que el plan expone API Key~~ → **sí**, verificado con conexión real.
3. ~~Setup de catálogos~~ → los que necesita el alta básica ya existen (legal entity, location, teams, roles/levels).

**Pendiente de validación (no de código):** encender `sync_activa` y contratar un candidato de prueba contra producción, comprobando que (a) el empleado se crea, (b) `factorial_employee_id` queda persistido y (c) un reintento **no** duplica. Hasta que eso pase, S9 es código entregado pero **no probado end-to-end**.

**Fuera de alcance de S9:** el follow-up de `ContractVersion` (salario en cents + job title), la captura de equipo/nivel en la UI, sincronización bidireccional (webhooks de alta/baja hechas en Factorial), ATS de Factorial (mover candidato a `hired` por API), ausencias/documentos. Son extensiones posibles (los scopes existen) pero quedan como backlog.

### 8.14 S9.5 — Ajustes ampliado: plantillas editables + bitácora de correos ✅ 2026-07-31

> **Entregado** (REC-093..096). Continuación natural de S7.5: si los **destinatarios** ya se editaban desde la UI, el **contenido** de los correos no tenía por qué seguir cambiándose con migraciones.

**El problema:** `rec_plantillas_correo` guarda asunto y cuerpo desde el inicio, pero la única forma de cambiarlos era una migración — `rec_014` y `rec_019` son literalmente `update … set cuerpo = …`. Cada corrección de una coma en un correo exigía un archivo SQL, un `db push` y un despliegue.

| Ticket | Commit | Qué se hizo |
|---|---|---|
| **REC-093** ✅ | `b037425` | **`lib/reclutamiento/plantillas.ts`** (165 líneas, módulo puro): catálogo de las plantillas con `label`, `cuando` se envía, si el envío **realmente pasa `cc`** a Gmail, las variables disponibles con su descripción y cuáles son **requeridas**. Decisión: se exponen **solo las 6 que algún flujo manda**. `confirmacion_postulacion`, `descarte`, `oferta` e `informativa` están seedeadas pero ningún flujo las envía — mostrarlas haría creer que editarlas cambia algo. |
| **REC-094** ✅ | `b037425` | **`plantillas-editor.tsx`** (192 líneas) + `guardarPlantilla` en `lib/actions/ajustes.ts`. Valida contra las variables requeridas: no se puede guardar una invitación a entrevista sin `{{fecha}}`. `ajustes-panel.tsx` adelgaza 66 líneas al ceder el bloque de CC al editor. |
| **REC-095** ✅ | `c0b669e` | **Bitácora `/reclutamiento/correos`** (151 líneas): últimos 200 envíos de `rec_correos_enviados` con filtro Todos/Con error/Enviados, plantilla legible vía `plantillaMeta()`, destinatario, fecha y el mensaje de error cuando falló. Entrada en el sidebar. Antes, un correo que no llegaba solo se podía diagnosticar con SQL. |
| **REC-096** ✅ | `60bb72b`, `38cccf6` | **Navegación de regreso** en todo el módulo (el pipeline dejó de ser un camino de una sola dirección) + confirmación visible al guardar las notas del comité, con enlace al pipeline. |

**Fuera de alcance de S9.5:** previsualización del correo con datos reales, historial de versiones de plantilla, reenvío desde la bitácora, plantillas HTML con diseño (hoy son texto plano).

### 8.15 REC-024 — Exportación a CSV ✅ 2026-08-31

> **Entregado** (`c9a4a91`). A petición directa: *"¿no crees que la herramienta de reclutamiento debería permitir descargar reportes?"*

**El hallazgo que lo justifica:** no existía exportación **en ninguna parte de la plataforma** — cero CSV, cero xlsx, ningún endpoint de descarga fuera del de Inversiones. Y `/reclutamiento` no tiene pantalla propia: hace `redirect` a vacantes.

**Alcance deliberadamente acotado a "exportar lo que ya se ve".** Se separó de un tablero de métricas (embudo, tiempo por etapa, tiempo de contratación) y **solo se hizo lo primero**. Razón: las métricas de proceso no tienen datos todavía — un embudo con cero contrataciones históricas es una pantalla vacía. El dato **sí se está capturando** (`rec_candidato_historial` registra cada transición con fecha), así que el tablero es aditivo cuando el uso lo justifique.

| Pieza | Qué es |
|---|---|
| `lib/utils/csv.ts` | Constructor genérico y **puro**. BOM UTF-8 (sin él Excel en Windows rompe los acentos), comillas RFC 4180, y neutralización de celdas que empiezan con `=` `+` `-` `@` — que Excel ejecutaría como fórmula. **Los números se exceptúan a propósito**: un importe negativo neutralizado sale como texto y rompe la suma. Verificado con 7 casos. |
| `lib/reclutamiento/exportar.ts` | Puro. Define columnas y formato. Las etiquetas son **las de la pantalla**, no los enums: dice *Entrevistas agendadas*, no `entrevistas_agendadas`. Fechas en `YYYY-MM-DD HH:mm`, zona México explícita (el servidor corre en UTC). |
| `GET /api/reclutamiento/exportar/{candidatos,correos}` | Revalidan permiso; no lo heredan de la pantalla. Candidatos respeta los filtros de la URL; correos respeta el estado pero sube el tope de 200 a 5,000 y trae el error de Gmail sin truncar. |
| Migración `rec_024` | `rec_exportaciones`: quién, qué recurso, con qué filtros, cuántas filas. Append-only (sin políticas de UPDATE ni DELETE) y con `exportado_por = auth.uid()` en el `with check`, para que la bitácora no sea falsificable por quien la escribe. |

**La decisión de seguridad:** el registro se escribe **antes** de entregar el archivo y **falla cerrado** — si no se puede dejar rastro de quién se llevó los datos, no se entregan. Un CSV de candidatos saca nombre, correo y teléfono de personas que en su mayoría no fueron contratadas, a un archivo donde ya no aplica ninguna RLS. No crea el riesgo R-1 de retención (§8.7), pero lo amplifica; queda registrado como **R-1b** en el runbook, heredando su dueño pendiente.

**Fuera de alcance:** tablero de métricas, pantalla para leer `rec_exportaciones` (hoy solo se consulta en Supabase), exportación en xlsx (`exceljs` ya está en el árbol si se pide).

---

## 9. Módulo Inversiones *(I1–I6 planeados — 2026-08-29, sin código todavía)*

> **Research completo en `RESEARCH-CONSOLIDADO.md §14`.** Ahí está el análisis de los archivos, los cinco hallazgos que condicionan el diseño y las decisiones ya tomadas. Esta sección es solo el plan de ejecución; no repite el porqué.

### 9.1 Qué es

Custodia y consulta de los dos reportes que **Felix genera a diario** con scripts de Python a partir de exports de **Yunius**, el core bancario:

- **Calendario de Pagos a Fondeadores** — mensual. Cuánto hay que pagar, qué día, por qué medio. Audiencia: **Tesorería**.
- **Tablero Ejecutivo de Cartera de Inversiones** — a fecha de corte. Desempeño comercial de gerentes de inversión. Audiencia: **Dirección**.

**Nombre y forma decididos el 2026-08-29:** módulo `Inversiones`, ruta `/inversiones`, tablas `inv_*`. Hace pareja con Cartera — *Cartera es el activo (préstamos), Inversiones el pasivo (fondeo)*.

**Una tubería, dos puertas.** La carga, el almacenamiento del original, la bitácora, el versionado y la descarga se comparten. Las vistas y los permisos no.

```
inv_cargas   ← bitácora compartida
  ├── inv_pagos_*        (Calendario)  →  /inversiones/pagos       Tesorería
  └── inv_movimientos_*  (Tablero)     →  /inversiones/desempeno   Dirección
```

**Alcance del v1 (opción C):** repositorio + vistas de Tesorería + Tablero Ejecutivo renderizado, **con los dos reportes desde el arranque**.

**Fuera del v1:** el chat de IA (§14.7 — diseñado por adelantado, aditivo cuando se retome) y la tendencia entre cortes (§9.6).

### 9.2 Las tres reglas que no se negocian

Salen del research y son las que, si se rompen, obligan a rehacer:

1. **Las hojas derivadas se guardan como vienen. Nunca se recalculan.** Recomputar el ranking obliga a reimplementar la fórmula del Python de Felix en SQL, y el día que dé 62.3 donde el Excel dice 62.4 hay dos verdades. **El archivo es la autoridad.**
2. **`AL PLAZO` no sale de caja.** Se capitaliza. En agosto son **958,114.57 de 4,999,045.56** — casi un millón. Todo agregado de salida de efectivo lo excluye.
3. **Los importes traen signo.** Decrementos y vencimientos vienen negativos; inversiones, renovaciones e incrementos positivos. Sumar sin respetarlo da cifras mal con cara de correctas.

### 9.3 Los sprints

Cada uno termina en algo verificable contra los cuatro archivos reales que ya están analizados.

| # | Sprint | Entrega | Cómo se verifica |
|---|---|---|---|
| **I1** ✅ | **Tubería, sin parseo** *(entregado 2026-08-31, `d22c6cf`)* | Migraciones `inv_001..003` (tablas + RLS + bucket privado con separación de audiencias por prefijo de ruta) + banderas + tipos. `POST /api/inversiones/cargar` y `GET /api/inversiones/descargar/[id]`, que **revalida permiso contra el `tipo_reporte`**, no sirve por `storage_path`. Pantallas `/inversiones/{cargar,cargas}`; `pagos` y `desempeno` como placeholders **con guarda real**, para poder probar la separación de permisos desde esta iteración. Los tres huecos de §9.5 quedaron cerrados. **Desviación declarada:** se lee el encabezado del Excel antes de guardar, para no almacenar un archivo que no se pudo identificar | Felix sube los 4 archivos, los ve listados y los descarga **byte-idénticos** al original. ⏳ *pendiente de prueba en navegador* |
| **I2** | **Parseo del Calendario** | `lib/inversiones/excel.ts` puro: `detectarTipo()` + `leerCalendario()`. Tablas `inv_pagos`, `inv_pagos_validaciones`. El endpoint parsea y pasa a `procesado` | **Anclas de agosto:** 201 filas · total `4,999,045.56` · sale de caja `4,040,930.99` · capitalizado `958,114.57` · 8 filas en revisar. Al centavo o no pasa |
| **I3** | **Vistas de Tesorería** | RPCs `inv_curva_salidas`, `inv_revisar_medio`, `inv_resumen_calendario`. Pantalla `/inversiones/pagos` | La curva reproduce la tabla ya calculada: días **26 (846,372)**, **24 (837,077)** y **13 (622,257)** a la cabeza. La lista de revisar trae los 8 casos ordenados por fecha |
| **I4** | **Parseo del Tablero** | `leerTablero()` + tablas de las 12 hojas. **Manejo explícito de hojas degradadas** | El corte **27/08 carga completo**; el **02/09 carga con los rankings marcados como degradados y sin tronar**. Los dos archivos ya existen y ejercitan ambos caminos |
| **I5** | **Vistas de Desempeño** | Pantalla `/inversiones/desempeno` (Tablero, Estructura, Rankings, Cumplimiento). Segunda bandera | Las cifras en pantalla son **idénticas** a las del Excel. Si difiere una, es que algo se recalculó — ver regla 1 |
| **I6** | **Entrega** | Pre-vuelo, permisos reales asignados, documentación mínima, anuncio | Mismo criterio que Reclutamiento: **no se anuncia sin evidencia** |
| **I7** | **Chat de IA** *(fuera del v1 — §9.8)* | Tools sobre los RPCs de I3/I5 + tool de consulta parametrizada + system prompt + widget | Un set de preguntas con respuesta conocida, contestadas al centavo y citando el corte |

### 9.4 Modelo de datos

**Bitácora compartida.** `tipo_reporte` (`calendario` \| `tablero`), `periodo_inicio`, `periodo_fin`, `nombre_archivo`, `storage_path`, `hash`, `subido_por`, `estado`, `error_detalle`, `notas_metodologicas` (jsonb), `hojas_degradadas` (jsonb).

Los dos reportes **declaran su periodo en el encabezado** — el Calendario como `— 08/2026`, el Tablero como `Periodo analizado: 01/08/2026 al 27/08/2026`. Se parsea de ahí, no del nombre del archivo.

**Vigente = la carga más reciente por `(tipo_reporte, periodo_inicio)`.** Cae bien para los dos casos: el calendario de septiembre **no** reemplaza al de agosto (periodos distintos), pero un corte del 28/08 **sí** reemplaza al del 27/08 (mismo periodo). El histórico es `where carga_id = …`, no una tabla aparte.

**Hechos**, todos con `carga_id`:

```
inv_pagos                 hoja BASE del Calendario (20 col)
inv_pagos_validaciones    hoja VALIDACIONES
inv_movimientos           Historial_Movimientos (66 col)
inv_ranking               Ranking_Comercial + Ranking_Con_Meta
                          (mismo shape + 7 columnas de meta; discriminador `con_meta`)
inv_cumplimiento          Cumplimiento_Metas
inv_tablero_resumen       Tablero + Tablero_Estructura
inv_posiciones_vigentes   {CREDIFLEXI,RAMI}_Vigente (16 col; discriminador `universo`)
inv_eventos               {CREDIFLEXI,RAMI}_{Abiertos,Vencidos} (18 col; + `tipo`)
inv_validaciones          hoja Validaciones del Tablero
```

**La hoja `CALENDARIO` no se guarda.** Es un pivote exacto de `BASE` — verificado al centavo (§14.1). Se regenera si alguien la quiere.

**Degradación como dato, no como error.** Cuando una hoja llega en `SIN_DATOS` se registra en `hojas_degradadas` y la tabla de hechos queda vacía para esa carga. La UI dice *"no hubo movimientos para rankear en este corte"* en vez de mostrar una tabla vacía que parece rota.

### 9.5 Permisos

Tres banderas en `profiles`, cada una con alguien real detrás — a diferencia de Actividades, donde la segunda se pospuso por no haber a quién dársela:

| Bandera | Quién | Da acceso a |
|---|---|---|
| `acceso_inversiones_carga` | Felix | `/inversiones/cargar` |
| `acceso_inversiones_pagos` | Tesorería | `/inversiones/pagos` |
| `acceso_inversiones_desempeno` | Dirección | `/inversiones/desempeno` |

Patrón calcado de Actividades: columna en `profiles` (nace en `false`) + `has_*_access()` + guarda de layout + RLS. **Todo o nada dentro de cada puerta:** quien entra a pagos ve el calendario completo, CLABE incluida.

**Aun así, `CLABE` se aísla en el modelo desde el principio** (§14.7, punto 5): vista completa para tablero y descarga, vista sin PII para lo que consulte el chat el día que llegue. Retrofitear eso después es una migración fea.

#### Tres huecos que I1 tiene que cerrar — no son opcionales

Detectados al revisar este plan el 2026-08-30. Los tres son de seguridad y los tres se olvidan fácil porque quedan fuera de la pantalla:

1. **Las políticas del bucket de Storage.** Toda la RLS de las tablas no sirve de nada si el `.xlsx` original es descargable por cualquier autenticado: **ese archivo trae todas las CLABEs**. El bucket `inversiones` nace **privado**, con política de lectura restringida al mismo predicado que las tablas. Es el agujero más grande del diseño tal como estaba escrito.
2. **El endpoint de descarga.** Tiene que **revalidar el permiso** contra la carga que se pide, no servir por `storage_path`. Un path adivinable o filtrado no puede ser suficiente para bajar el archivo.
3. **Retención.** Se van a guardar CLABEs y nombres **todos los días, indefinidamente** — 365 copias al año del padrón completo de fondeadores. Es la misma pregunta abierta que arrastra Reclutamiento (LFPDPPP / CNBV, riesgo R-1 de su runbook), aquí más grande. **No bloquea el v1**, pero se documenta como riesgo con dueño pendiente en vez de lanzarse en silencio.

### 9.6 Riesgos y lo que no sé

- **I4 es el sprint incierto.** 12 hojas, 66 columnas, formas que cambian entre cortes. Los demás son mecánica conocida; este no. Si algo se desborda, es aquí.
- **Solo hay dos cortes del Tablero y sospecho que salen del mismo dump** (§14.3, hallazgo 5): 688 filas idénticas, cero altas en seis días. Hasta que no lleguen dos cargas de días realmente distintos, **no sé si la tendencia entre cortes tiene contenido o sale plana.** Por eso queda fuera del v1.
- **No está confirmado que Felix suba los dos archivos a diario** — dijo "el archivo", en singular (§14.6). El ingestor discrimina por contenido, así que soporta cualquiera de los dos casos, pero el histórico puede quedar disparejo.
- **El proceso vive en la laptop de Felix.** Riesgo aceptado y registrado (§14.5). Si no está, no hay reporte.

### 9.7 Qué se puede ajustar

- **I1 puede lanzarse solo.** El repositorio sirve por sí mismo: darle acceso a Felix y Tesorería desde el día uno, mientras lo demás se construye. Es la forma de tener algo en producción rápido.
- **El orden I2-I3 contra I4-I5 es intercambiable.** Recomendado como está: el Calendario es 3 hojas contra 12, valida la tubería con lo simple, y es de la audiencia que originó el encargo.
- **La tercera bandera puede esperar.** Al inicio, que la carga sea solo de admin y que Felix la use como admin. Se separa cuando estorbe.
- **La tendencia entre cortes entra en cuanto los datos digan que vale la pena.** Es la vista de más valor potencial y la única que no puedo prometer.
- **I7 se puede adelantar** — pero leer §9.8 antes de hacerlo.

### 9.8 I7 — el chat de Gemini

**Diseño completo en `RESEARCH §14.7`.** El v1 no lo construye por decisión del 2026-08-29, pero **los cinco requisitos que lo hacen posible sí están en el v1** y no cuestan trabajo extra: reglas 1 y 2 de §9.2, `notas_metodologicas` y `carga_id` en §9.4, los RPCs de I3/I5, y el aislamiento de `CLABE` en §9.5. Sin ellos, el chat obliga a rehacer el modelo.

**Qué falta construir, entonces:**

| Pieza | Trabajo real |
|---|---|
| Tools de lectura — `resumen_calendario`, `pagos_por_dia`, `revisar_medio`, `tablero`, `estructura`, `ranking`, `cumplimiento` | **Poco.** Son envolturas delgadas sobre los RPCs que I3 e I5 ya dejaron hechos |
| Tool `consultar(reporte, corte, medida, dimensiones[], filtros[], orden, limite)` | **El grueso.** RPC con gramática cerrada y lista blanca de columnas. Sin *text-to-SQL* |
| System prompt | Notas metodológicas de la carga vigente + **la convención de signos** + el guardrail heredado de §5.5: *nunca inventa cifras, todo número sale de una tool y se cita con `fecha_corte`* |
| Widget y alcance | Acotado al reporte y corte que se está viendo, no global |
| Evaluación | Un set de preguntas con respuesta conocida, verificadas contra el Excel |

**Por qué va después de I6 y no antes.** Un chat sobre datos que nadie validó es **peor que no tener chat**: convierte una cifra mal parseada en prosa segura de sí misma, y la gente actúa sobre ella sin volver al Excel. Primero I2 e I5 demuestran que lo cargado cuadra al centavo; después se le pone voz encima.

#### Qué ve el modelo — decidido el 2026-08-30

> *"No quiero la CLABE o datos personales e inútiles al LLM."*

**Se implementa como lista blanca sobre una vista, no como regla de conducta.** Las tools **no leen las tablas**; leen `inv_chat_pagos` y `inv_chat_movimientos`, vistas que **físicamente no contienen** las columnas excluidas. Así no es algo que alguien deba recordar: es algo que no se puede hacer.

| | Columnas |
|---|---|
| **Fuera — dato bancario** | `CLABE`, `IBNOMBRE` (banco) |
| **Fuera — identidad del cliente** | `INVERSIONISTA`, `NOMBRE_CL` — el modelo trabaja con `CLAVE`, igual que la tool de mora de §5.5 trabaja con códigos |
| **Fuera — plomería inútil** | `ARCHIVOS_ORIGEN`, `TIPO_PARCHE`, `ORIGEN_MOVIMIENTO`, `SECUENCIA_MOVIMIENTO`, `CODIGO_*` y demás columnas internas del generador |
| **Dentro** | `CLAVE`, montos, fechas, día, medio de pago, sección, universo, tipo de pago y rendimiento, plazo, sobretasa |
| **Dentro, pero es una elección** | **Nombres de gerentes y ejecutivos.** Son empleados, no clientes, y sin ellos el Tablero entero es ilegible: *"¿quién va primero?"* no tiene respuesta. Se queda salvo instrucción contraria |

**Quitar la plomería no es solo privacidad — mejora las respuestas.** El `Historial` trae 66 columnas y buena parte son rastro interno del generador. Metérselas al modelo agrega ruido y le da más formas de equivocarse. Aquí privacidad y calidad apuntan al mismo lado.

**El encuadre que importa:** esto no contradice el "todo o nada" de §9.5. Quien tenga la bandera **sigue viendo todo en la pantalla y en la descarga** — el punto no es esconderle datos al usuario, que ya los tiene, sino **acotar lo que sale de la empresa** hacia un tercero. Son dos amenazas distintas.

Con esta decisión, `RESEARCH §14.6` punto 1 queda **cerrado**.

---

*Fin del plan.*
