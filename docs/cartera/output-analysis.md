# Análisis profundo del **output** — Reporte de Antigüedad

> **Fecha del análisis:** 2026-05-27
> **Archivos analizados:**
> - `FINAL TARGET.xlsx` (snapshot 24/04/2026 — diseño futuro al 100%)
> - `ReportedeAntiguedad_nuevo_31032026.xlsx` (snapshot 31/03/2026 — versión actual generada por el legacy `reportes.py`)
>
> **Objetivo:** mapear cada hoja del output esperado, identificar qué se deriva del input vs. qué viene de fuentes externas, y dejar listo el insumo para que el microservicio `crediflexi-services/cartera_etl.py` produzca el **FINAL TARGET** al 100 %.

---

## 0. Resumen ejecutivo

| Categoría | Hojas | Origen | Decisión |
|---|---|---|---|
| **Detalle de cartera (snapshot)** | `R_Completo` / `{ddmmyyyy}` / `Marzo2026` / `Abril2026` / `RECUPERADOR_000124` | 100 % derivado del input Yunius | Reproducir con la **misma columna y orden** (71 base + 4 calculadas en FINAL) |
| **Pivotes** | `X_Coordinación`, `X_Recuperador` | Pivot table de Excel sobre el snapshot | Reconstruir con `pandas.pivot_table` o `openpyxl.PivotTable` |
| **Bandeja operativa** | `Mora`, `Cuentas con saldo vencido` | Subconjunto del snapshot **+ 9 columnas manuales** para Call Center / Campo | Generar subconjunto y dejar columnas extra vacías para llenado manual |
| **Liquidación anticipada** | `Liquidación anticipada` | Cálculo determinístico sobre el snapshot + amortizaciones (próximo pago sin vencer) | Cómputo en microservicio |
| **Histórico de cartera** | `Asignación` | Acumulado de 4 snapshots semanales con `Corte` antepuesto | Append idempotente por `Corte = fecha_corte` |
| **Pagos** | `Recuperación` | **EXTERNO** — exportado del core Yunius (REPORTE DE PAGOS), no del input cartera | Cargar a `payments` aparte (Fase posterior) |
| **Tracking semanal** | `Cobranza` | **MANUAL** — formato operativo de Call Center con 3 ventanas de asignación (28/21/14 días) | Plantilla Excel exportable (no auto-llenable) |
| **Amortizaciones** | `amortizaciones_individual_test` *(solo FINAL)* | 100 % derivado del input — esquema rico de 89 cols con metadata joineada del snapshot | Producir en microservicio (extensión del cálculo actual de `loan_amortizacion_individual`) |

**Diferencias FINAL vs nuevo (= 31/03/2026):**
- FINAL agrega **4 columnas calculadas** al final del detalle (cols 72-75): `Cuotas sin pagar`, `Saldo_Riesgo_total`, `Combinado`, `Suma`.
- FINAL **divide el snapshot en cohortes**: `24042026` (todo), `Marzo2026` (cohorte pre-abril), `Abril2026` (cohorte ≥ abril) **+ R_Completo eliminada** (sustituida por la hoja `{ddmmyyyy}` que contiene todo).
- FINAL **agrega** `amortizaciones_individual_test` (89 cols, ~2 300 filas).
- FINAL **elimina** `R_Completo` y `Fraude`/`Columna1` (presentes en nuevo, basura).
- Pivotes **idénticos en estructura** — solo cambia el rango de PAR cubierto por los datos.
- `Asignación` y `Recuperación` siguen con el **mismo esquema** entre ambos archivos; cambia solo el contenido por fecha.
- `Mora`, `Cuentas con saldo vencido`, `Liquidación anticipada`, `RECUPERADOR_000124`, `Cobranza` → **estructura idéntica** entre ambos archivos.

---

## 1. Inventario de hojas

### 1.1 FINAL TARGET.xlsx (13 hojas)

| # | Hoja | Filas | Cols | Tipo |
|---|---|---:|---:|---|
| 1 | `X_Coordinación` | 58 | 74 | Pivot |
| 2 | `X_Recuperador` | 71 | 82 | Pivot |
| 3 | `Cobranza` | 204 | 19 | Manual |
| 4 | `Recuperación` | 91 | 101 | Externo |
| 5 | `Asignación` | 682 | 76 | Histórico (4 cortes) |
| 6 | `24042026` | 164 | 75 | Detalle full snapshot |
| 7 | `Marzo2026` | 163 | 75 | Detalle cohorte < abril |
| 8 | `Abril2026` | 4 | 75 | Detalle cohorte ≥ abril |
| 9 | `RECUPERADOR_000124` | 9 | 71 | Detalle filtrado |
| 10 | `Mora` | 114 | 78 | Operativo Call Center |
| 11 | `Cuentas con saldo vencido` | 12 | 69 | Subconjunto |
| 12 | `amortizaciones_individual_test` | 2 320 | 89 | Derivado amortizaciones |
| 13 | `Liquidación anticipada` | 14 | 14 | Cálculo |

### 1.2 ReportedeAntiguedad_nuevo_31032026.xlsx (12 hojas)

| # | Hoja | Filas | Cols | Notas vs FINAL |
|---|---|---:|---:|---|
| 1 | `Recuperación` | 155 | 101 | igual estructura |
| 2 | `Asignación` | 717 | 72 | igual estructura (716 filas = 4 cortes de marzo) |
| 3 | `X_Coordinación` | 34 | 54 | mismo formato; menos cols (menos PAR buckets presentes) |
| 4 | `X_Recuperador` | 49 | 32 | mismo formato; pivote más pequeño |
| 5 | `R_Completo` | 177 | 71 | **eliminada en FINAL** (sustituida por `{ddmmyyyy}`) |
| 6 | `31032026` | 177 | 81 | igual base + 4 calc + `Fraude`, `Columna1` (basura) + 5 cols vacías |
| 7 | `Abril2026` | 8 | 74 | igual estructura (cohorte) |
| 8 | `Cobranza` | 212 | 22 | igual estructura, +3 cols vacías |
| 9 | `RECUPERADOR_000124` | 9 | 71 | idéntica |
| 10 | `Mora` | 108 | 78 | idéntica |
| 11 | `Cuentas con saldo vencido` | 10 | 71 | igual + `Columna1`, `Columna2` (basura) |
| 12 | `Liquidación anticipada` | 14 | 14 | idéntica |

---

## 2. Esquema canónico del **detalle** (71 cols base)

Es el esquema base reusado en **5 hojas**: `R_Completo` (legacy), `{ddmmyyyy}` (snapshot), `Marzo2026`, `Abril2026`, `RECUPERADOR_000124`. La hoja `Asignación` antepone `Corte`. Las hojas `Mora` y `Cuentas con saldo vencido` reordenan cols 1-7 (mueven `Código acreditado` después de `Nombre recuperador`).

| # | Header output | Tipo | Origen (col input) | Notas |
|---:|---|---|---|---|
| 1 | Código acreditado | str(6) zfill | `Código acreditado` | `.zfill(6)` |
| 2 | Nom. región | str | `Nom. región` | passthrough |
| 3 | Coordinación | str | `Coordinación` | passthrough |
| 4 | Código promotor | str(6) zfill | `Código promotor` | `.zfill(6)` |
| 5 | Nombre promotor | str | `Nombre promotor` | passthrough |
| 6 | Código recuperador | str(6) zfill | `Código recuperador` | `.zfill(6)` |
| 7 | Nombre recuperador | str | `Nombre recuperador` | passthrough |
| 8 | Ciclo | str(2) zfill | `Ciclo` | `.zfill(2)` |
| 9 | Nombre acreditado | str | `Nombre acreditado` | passthrough |
| 10 | Inicio ciclo | date | `Inicio ciclo` | parse fecha |
| 11 | Fin ciclo | date | `Fin ciclo` | parse fecha |
| 12 | Cantidad entregada | numeric | `Cantidad entregada` | passthrough |
| 13 | Cantidad Prestada | numeric | `Cantidad Prestada` | passthrough |
| 14 | Días de mora | int | `Días de mora` | passthrough |
| 15 | PAR | str | derivado `Días de mora` | `asignar_rango_mora()`: 0/7/15/30/60/90/Mayor_90/Mayor_180 |
| 16 | Plazo del crédito | int | `Plazo del crédito` | passthrough |
| 17 | Periodicidad | str | `Periodicidad` | passthrough |
| 18 | Parcialidad + Parcialidad comisión | numeric | `Parcialidad` + `Parcialidad comisión` | suma |
| 19 | Comisión a pagar | numeric | `Comisión a pagar` | passthrough |
| 20 | Interés moratorio saldo vencido total | numeric | `Interés moratorio saldo vencido total` | passthrough |
| 21 | Pagos vencidos | int | `Pagos vencidos` | passthrough |
| 22 | Periodos vencidos | numeric | `Periodos vencidos` | passthrough |
| 23 | Saldo capital | numeric | `Saldo capital` | passthrough |
| 24 | Saldo vencido | numeric | `Saldo vencido` | passthrough |
| 25 | Saldo capital vencido | numeric | `Saldo capital vencido` | passthrough |
| 26 | Saldo interés vencido | numeric | `Saldo interés vencido` | passthrough |
| 27 | Saldo comisión vencida | numeric | `Saldo comisión vencida` | passthrough |
| 28 | Saldo recargos | numeric | `Saldo recargos` | passthrough |
| 29 | $ Último pago | numeric | `Monto último pago` | rename |
| 30 | Último pago | date | `Fecha último pago` | rename |
| 31 | Situación crédito | str | `Situación crédito` | **falta agregar al esquema staging** |
| 32 | Medio comunic. 1 | str | `Medio comunic. 1` | passthrough |
| 33 | Medio comunic. 2 | str | `Medio comunic. 2` | **falta agregar al esquema staging** |
| 34 | Medio comunic. 3 | str | `Medio comunic. 3` | **falta agregar al esquema staging** |
| 35 | Actividad económica PLD | str | `Actividad económica PLD` | passthrough |
| 36 | Código actividad económica PLD | str | `Código actividad económica PLD` | passthrough |
| 37 | Nombre conyuge | str | `Nombre conyuge` | passthrough |
| 38 | Teléfono conyuge | str | `Teléfono conyuge` | passthrough |
| 39 | Nombre Referencia1 | str | `Nombre Referencia1` | passthrough |
| 40 | Teléfono Referencia1 | str | `Teléfono Referencia1` | passthrough |
| 41 | Nombre Referencia2 | str | `Nombre Referencia2` | passthrough |
| 42 | Teléfono Referencia2 | str | `Teléfono Referencia2` | passthrough |
| 43 | Nombre Referencia3 | str | `Nombre Referencia3` | passthrough |
| 44 | Teléfono Referencia3 | str | `Teléfono Referencia3` | passthrough |
| 45 | Tipo Garantía 1 | str | `Tipo Garantía 1` | passthrough |
| 46 | Descripción garantía 1 | str | `Descripción garantía 1` | passthrough |
| 47 | Garantía 1 | str | `Garantía 1` | passthrough |
| 48 | Tipo Garantía 2 | str | `Tipo Garantía 2` | **falta agregar al esquema staging** |
| 49 | Descripción garantía 2 | str | `Descripción garantía 2` | **falta agregar al esquema staging** |
| 50 | Garantía 2 | str | `Garantía 2` | **falta agregar al esquema staging** |
| 51 | Saldo total | numeric | `Saldo total` | passthrough |
| 52 | Saldo adelantado | numeric | `Saldo adelantado` | passthrough |
| 53 | Cód. producto crédito | str | `Cód. producto crédito` | passthrough |
| 54 | Nom. producto crédito | str | `Nom. producto crédito` | passthrough |
| 55 | Calle | str | `Calle` | **falta agregar al esquema staging** |
| 56 | Colonia | str | `Colonia` | **falta agregar al esquema staging** |
| 57 | Entidad federativa | str | `Entidad federativa` | passthrough |
| 58 | Municipio | str | `Municipio` | passthrough |
| 59 | Geolocalización domicilio | str | `Geolocalización domicilio` | passthrough |
| 60 | Link de Geolocalización | str | **derivado** de `Geolocalización` | `=HIPERVINCULO("https://www.google.com/maps?q=" & lat & "," & lng)` |
| 61 | Castigado cartera | bool | `Castigado cartera` | passthrough |
| 62 | Nom. personal castiga cartera | str | `Nom. personal castiga cartera` | **falta agregar al esquema staging** |
| 63 | Frecuencia | str | `Frecuencia` | **falta agregar al esquema staging** |
| 64 | Criticidad | str | `Criticidad` | passthrough |
| 65 | Forma de entrega | str | `Forma de entrega` | passthrough |
| 66 | Concepto Depósito | str(9) | **derivado** | `"1" + cod(6) + ciclo(2)` → ej. `001039` + `01` ⇒ `100103901` |
| 67 | Saldo riesgo capital | numeric | `Saldo riesgo capital` | passthrough |
| 68 | Saldo riesgo total | numeric | `Saldo riesgo total` | passthrough |
| 69 | % MORA | numeric (4d) | `% MORA` | passthrough |
| 70 | Días desde el último pago | int | `Días desde el último pago` | passthrough |
| 71 | Alerta | str | `Alerta` | passthrough |

### 2.1 Columnas calculadas adicionales del FINAL (cols 72-75)

Aparecen en `24042026`, `Marzo2026`, `Abril2026`, **NO** en `RECUPERADOR_000124` ni en `R_Completo` legacy.

| # | Header | Cálculo | Notas |
|---:|---|---|---|
| 72 | **Cuotas sin pagar** | `count(amortizaciones where estatus != 'PAGADA' AND es_futura_al_corte = false)` para el `(cod_acreditado, ciclo)` | Algunas filas son `None` cuando no hay amortizaciones cargadas. Requiere JOIN con `loan_amortizacion_individual`. |
| 73 | **Saldo_Riesgo_total** | = col 68 (`Saldo riesgo total`) | **Duplicado**: legacy lo usa como fuente alternativa para los pivotes (evita colisión por header repetido). Mantener como copia literal. |
| 74 | **Combinado** | = col 73 = col 68 | **Duplicado** usado para pivote `X_Coordinación` ("Suma de Combinado") / `X_Recuperador`. Mantener como copia. |
| 75 | **Suma** | Acumulado de pagos recibidos en el periodo (cross-join con `Recuperación`) | En el sample = 0 para todas las filas pre-abril (sin pagos en abril 2026); cuando hay pago: monto recuperado. Si no se carga `Recuperación`, dejar 0. |

> **Nota arquitectónica:** `Saldo_Riesgo_total` y `Combinado` son **duplicados de col 68** introducidos por el legacy para evitar el problema de "headers repetidos rompen pivot tables de Excel". El microservicio puede emitirlos literalmente como copia o, mejor, usar pivot tables generadas por Python (`pandas`) y eliminar la duplicación.

---

## 3. Cohortes (`Marzo2026`, `Abril2026`)

**Regla** (confirmada de `reportes.py:1199` y de los datos):

```
cohorte = "Marzo2026" si Inicio_ciclo <  2026-04-01
cohorte = "Abril2026" si Inicio_ciclo >= 2026-04-01
```

- El nombre de la cohorte = primer mes que abre cohorte distinta (no es el mes del corte).
- Para snapshot 24/04/2026: `Marzo2026` contiene **todos los créditos vivos abiertos antes de abril 2026** (163 filas), `Abril2026` los nuevos (4 filas).
- Para snapshot 31/03/2026: solo existe `R_Completo` + `Abril2026` (8 filas con `Inicio_ciclo >= 2026-04-01` — *raro porque corte = 31/03*; probablemente créditos firmados en abril pero ya cargados al corte de marzo).

> **Decisión para el microservicio:** generar dinámicamente las cohortes con base en la fecha de corte: cohorte_actual = primer día del mes del corte; cohorte_previa = mes anterior. Para v1: solo separar < primer día de mes vs ≥ primer día de mes del corte.

---

## 4. Hojas operativas (`Mora`, `Cuentas con saldo vencido`)

### 4.1 `Mora` (78 cols = 69 base reordenadas + 9 manuales)

**Criterio de inclusión**: `Días de mora > 0`.

**Reordenamiento de cols 1-9** vs detalle canónico:

| Pos detalle | Pos Mora | Campo |
|---:|---:|---|
| 1 | 7 | Código acreditado |
| 2 | 1 | Nom. región |
| 3 | 2 | Coordinación |
| 4 | 3 | Código promotor |
| 5 | 4 | Nombre promotor |
| 6 | 5 | Código recuperador |
| 7 | 6 | Nombre recuperador |

A partir de la col 8 sigue el orden canónico (Ciclo, Nombre acreditado, …). **Solo van hasta col 69 (% MORA)**; se omiten `Días desde el último pago` y `Alerta`.

**9 columnas operativas (70-78)** para Call Center / Campo (todas vacías, llenado manual):

| # | Header | Tipo de uso |
|---:|---|---|
| 70 | Estatus de llamada (pago del día ó mora) | dropdown manual |
| 71 | Fecha del acuerdo de pago | manual |
| 72 | Horario del acuerdo de pago | manual |
| 73 | Monto del acuerdo | manual |
| 74 | Día de visita de cobranza en campo | manual |
| 75 | Fecha del acuerdo de pago2 | manual (segundo intento) |
| 76 | Horario del acuerdo de pago3 | manual |
| 77 | Monto del acuerdo4 | manual |
| 78 | Monto del acuerdo5 | manual |

> Los nombres tienen sufijos `2/3/4/5` por un bug histórico de openpyxl cuando hay headers repetidos — el ETL debe preservarlos textualmente para no romper macros downstream.

### 4.2 `Cuentas con saldo vencido` (69 cols)

**Criterio de inclusión**: `Saldo vencido > 0` (todos los morosos con saldo vencido > 0, no solo días > 0).

Mismo reordenamiento de cols 1-7 que `Mora`. Llega hasta col 69 (`% MORA`). El nuevo agrega `Columna1`, `Columna2` (basura) → eliminar en microservicio.

---

## 5. `RECUPERADOR_000124` (filtro fijo)

71 cols **idénticas** al detalle canónico, **sin reorden** ni cols extras.

**Criterio de inclusión**: `Código recuperador == "000124"` (CALL CENTER / GENTE Y CULTURA).

> En `cartera_etl.py`, `CODIGOS_RECUPERADOR_EXCLUIR = ["000124"]` filtra estos del staging. Pero el reporte los **muestra en hoja aparte** para tracking. Decisión: cargar **todos** al staging y solo filtrar en queries de UI/Dashboard.

---

## 6. `Liquidación anticipada` (14 cols, ~1-14 filas)

Cálculo determinístico para créditos elegibles (criterio TBD — probablemente `Días de mora == 0` AND `Situación crédito == 'Vigente'`).

| # | Header | Cálculo |
|---:|---|---|
| 1 | Código acreditado | from snapshot |
| 2 | Ciclo | from snapshot |
| 3 | Nombre del acreditado | from snapshot |
| 4 | Saldo interés vencido | from snapshot |
| 5 | Saldo comisión vencida | from snapshot |
| 6 | Saldo recargos | from snapshot |
| 7 | Saldo capital | from snapshot |
| 8 | Saldo adelantado | from snapshot |
| 9 | Intereses del próximo pago sin vencer | calc: `parcialidad × (interes_anual/periodicidad)` para próxima cuota futura |
| 10 | Comisiones del próximo pago sin vencer | calc: `comision × (proxima_cuota.principal / total_principal)` |
| 11 | Cantidad a liquidar | = `cols 4 + 5 + 6 + 7 + (col 9) + (col 10) − col 8` |
| 12 | Cálculo válido hasta el próximo pago | = `proxima_cuota.fecha_limite_pago` |
| 13 | (vacía) | — |
| 14 | (vacía) | — |

> Requiere JOIN con `loan_amortizacion_individual` para obtener la próxima cuota sin vencer.
> **Filas del sample**: solo 1 fila con datos (cod=001274, cic=01, monto=$26,839.69). El resto vacías.

---

## 7. `amortizaciones_individual_test` (solo FINAL, 89 cols)

**Esquema rico** de amortizaciones a nivel de cuota individual, con metadata de la cartera joineada. Este es el **target verdadero** para `loan_amortizacion_individual`.

### Estructura por bloques

**Identificadores (cols 1-3)**
1. `codigo_ciclo` — PK compuesta: `cod_acreditado + "_" + ciclo`
2. `codigo_acreditado` — str(6)
3. `ciclo` — str(2)

**Definición del ciclo y cuota (cols 4-7, 9-11, 19)**
4. `fecha_inicio_correcta` — fecha real de desembolso (ajustada si difiere de la declarada)
5. `plazo_credito` — int
6. `periodicidad` — str
7. `numero_amortizacion` — int (1..plazo)
8. `fecha_inicio_credito` — fecha declarada original
9. `fecha_inicio_amortizacion` — start de la cuota
10. `fecha_fin_amortizacion` — end de la cuota
11. `fecha_limite_pago` — fecha máxima de pago
12. `pago_periodico` — monto esperado (parcialidad + parc_comision)
19. `duracion_periodo` — días entre inicio y fin

**Estado del pago (cols 13-18, 20-22)**
13. `monto_recibido` — pagado por el cliente
14. `fecha_completitud` — fecha en que se completó el pago
15. `dias_mora` — días de mora de esta cuota específica
16. `dias_mora_acumulados` — suma desde la primera cuota morosa
17. `fecha_liquidacion` — fecha efectiva de liquidación
18. `estatus_amortizacion` — `PAGADA` / `INCOMPLETA` / `VENCIDA` / `FUTURA` / `NO APLICA LIQUIDACION`
20. `monto_faltante` — pago_periodico − monto_recibido
21. `num_movimientos_ventana` — cantidad de eventos de pago dentro del periodo
22. `fuente_fecha_liquidacion` — tag de qué algoritmo asignó la fecha (`fecha_completitud`, `inicio_siguiente_ciclo_menos_un_dia`, etc.)

**Marcadores de fin de ciclo (cols 23-26)**
23. `fecha_inicio_correcta_siguiente_ciclo` — para distinguir entre ciclos consecutivos
24. `inicio_siguiente_ciclo_menos_un_dia` — heurística para cuotas sin fecha
25. `fecha_observacion_final` — fecha de cierre lógica del ciclo
26. `fin_ciclo` — fecha de fin oficial

**Metadata joineada del snapshot cartera (cols 27-82)**
27-32: nom_region, coordinacion, cod/nom_promotor, cod/nom_recuperador
33: nombre_acreditado
34-46: cantidad_entregada/prestada, dias_de_mora, comision_a_pagar, interes_moratorio, pagos/periodos_vencidos, saldos
47-48: ultimo_pago, ultimo_pago_2 (monto y fecha)
49-54: situacion_credito, medio_comunic_1/2/3, actividad_economica_pld, cod
55-62: conyuge + 3 referencias (nombre/teléfono)
63-68: tipo/desc/garantia 1 y 2
69-82: saldo_total/adelantado, cod/nom_producto, calle, colonia, entidad, municipio, geo, castigado, nom_personal_castiga, frecuencia, criticidad, forma_de_entrega

**Cols computadas finales (83-89)**
83. `ciclo_num` — `int(ciclo)`
84. `cutoff_date` — fecha de corte (constante por upload)
85. `es_futura_al_corte` — bool: `fecha_inicio_amortizacion > cutoff_date`
86. `es_no_aplica_liquidacion` — bool: cuota que no aplica por estatus del crédito
87. `codigo_ciclo_acumulada` — `cod + "_" + ciclo` para joins multi-ciclo
88. `Categoría` — clasificación (`Vigente`, `Vencida temprana`, `Vencida tardía`, etc.)
89. `Incremento` — variación vs corte anterior

> El esquema actual `loan_amortizacion_individual` solo tiene 19 cols. **Falta extender** para cubrir el FINAL: agregar `estatus_amortizacion`, `fuente_fecha_liquidacion`, `categoria`, `incremento`, `monto_recibido`, `monto_faltante` (algunas ya existen pero con otros nombres). Los metadata cols (27-82) **NO se almacenan** porque son JOIN-able con `stg_yunius_cartera_individual`; el reporte los emite con un JOIN al exportar.

---

## 8. Pivotes `X_Coordinación` / `X_Recuperador`

**Estructura común** (filas 6-8 = headers de pivot):

```
[Coordinación|Recuperador] | Cantidad Prestada | Saldo Capital | Saldo Vencido | Saldo Total | Saldo Riesgo Capit | Saldo Riesgo Total | Clientes con Cuota
[espacio]
Etiquetas de fila | PAR=0 | PAR=7 | PAR=15 | PAR=30 | PAR=60 | PAR=90 | PAR=Mayor_90 | PAR=Mayor_180 | ... × {Suma de Suma, Suma de Saldo_Riesgo_total, Suma de Combinado}
```

- Bloque izquierdo (cols 1-7): **tabla simple agregada** por coordinación/recuperador (`groupby().sum()`).
- Bloque derecho (cols 9+): **pivot multinivel** filas = coord/recup, cols = PAR × 3 métricas.

**Diferencia FINAL vs nuevo:** el ancho cambia según los PAR presentes en datos. Estructura idéntica.

> **Recomendación microservicio:** generar con `pandas.pivot_table` y escribir con `xlsxwriter` directamente como tabla estática (no PivotTable de Excel). Razón: PivotTables nativos de openpyxl son frágiles y no se renderizan bien en LibreOffice / GSheets.

### 8.1 `X_Coordinación` (FINAL, 74 cols)

- 7 cols agregado simple
- 1 col `Clientes con Cuota` = `count(cuotas_sin_pagar > 0)` por coordinación
- Pivote PAR × 3 métricas × (n PARs presentes, hasta 8)

### 8.2 `X_Recuperador` (FINAL, 82 cols)

Mismo formato pero por `Código recuperador`. **Excluye** `000124` (CALL CENTER). Más cols porque hay más recuperadores con más PARs cubiertos.

---

## 9. `Asignación` (histórico)

**Estructura**: cols del detalle canónico **+ `Corte` como col 1** + `Columna1` `Columna2` (basura) como cols 71-72.

**Acumulación**: cada vez que se sube un snapshot, se **appendea** el snapshot completo con la fecha de corte como prefijo. Mantiene las últimas 4 semanas en FINAL (7/4, 14/4, 21/4, 28/4 → 680 filas).

**Decisión microservicio**:
- Mantener tabla `cartera_asignacion_historico` con `(corte, cod_acreditado, ciclo)` UNIQUE.
- Cada upload appendea su corte; idempotente por UNIQUE constraint.
- Para el export, hacer `SELECT * WHERE corte IN (últimos 4 cortes) ORDER BY corte, cod_acreditado`.

---

## 10. `Recuperación` (EXTERNO)

**Origen**: exportación del core bancario Yunius (REPORTE DE PAGOS). **NO** se deriva del input cartera.

**Esquema**: 101 columnas con detalle de cada pago/depósito (fecha_corte, fecha_pago, codigo, ciclo, periodo, referencia, modo, estatus, forma_pago, código región/coord/empresa, etc.).

**Decisión**:
- Fuera del scope de Fase Cartera-0.
- Documentar como **fuente externa** que el cliente sube por separado.
- Crear futura tabla `pagos_yunius` con esquema mapeado de los 101 cols.

---

## 11. `Cobranza` (MANUAL)

**Origen**: formato operativo de Call Center con tracking de 3 ventanas de asignación (28/21/14 días).

**Headers** (fila 6, 19 cols en FINAL):
1. `Asignación de cartera 28` (fecha hace 28 días)
2. `Asignación de cartera 21` (fecha hace 21 días)
3. `Asignación de cartera 14` (fecha hace 14 días)
4. Promotor
5. Coordinación
6. Acreditado (código)
7. Nombre Acreditado
8. PAR inicial
9. PAR actual
10. Cantidad prestada
11. Saldo Capital
12. Saldo vencido actual
13. Saldo Vencido anterior
14. Días de mora
15. Recuperado
16-19. (campos manuales: Resultado, Observaciones, etc.)

**Decisión**:
- Fuera del scope de cargas automáticas.
- Generar **plantilla vacía** con los headers correctos. El usuario llena manualmente.
- Posible futuro: pre-llenar cols 4-14 con datos del último snapshot.

---

## 12. Tabla maestra input → output

| Output (header esperado) | Input (header Excel) | Schema staging (col) | ¿Hoy mapeado? |
|---|---|---|---|
| Código acreditado | Código acreditado | `codigo_acreditado` | ✅ |
| Nom. región | Nom. región | `nom_region` | ✅ |
| Coordinación | Coordinación | `coordinacion` | ✅ |
| Código promotor | Código promotor | `codigo_promotor` | ✅ |
| Nombre promotor | Nombre promotor | `nombre_promotor` | ✅ |
| Código recuperador | Código recuperador | `codigo_recuperador` | ✅ |
| Nombre recuperador | Nombre recuperador | `nombre_recuperador` | ✅ |
| Ciclo | Ciclo | `ciclo` | ✅ |
| Nombre acreditado | Nombre acreditado | `nombre_acreditado` | ✅ |
| Inicio ciclo | Inicio ciclo | `fecha_inicio_ciclo` | ⚠️ rename |
| Fin ciclo | Fin ciclo | `fecha_fin_ciclo` | ⚠️ rename |
| Cantidad entregada | Cantidad entregada | `cantidad_entregada` | ✅ |
| Cantidad Prestada | Cantidad Prestada | `cantidad_prestada` | ✅ |
| Días de mora | Días de mora | `dias_mora` | ✅ |
| PAR | (derivado) | `par_bucket` | ✅ |
| Plazo del crédito | Plazo del crédito | `plazo_credito` | ✅ |
| Periodicidad | Periodicidad | `periodicidad` | ✅ |
| Parcialidad + Parcialidad comisión | Parcialidad + Parcialidad comisión | `parcialidad` | ⚠️ no preserva suma original |
| Comisión a pagar | Comisión a pagar | `comision_a_pagar` | ✅ |
| Interés moratorio saldo vencido total | Interés moratorio saldo vencido total | `interes_moratorio` | ⚠️ rename |
| Pagos vencidos | Pagos vencidos | `pagos_vencidos` | ✅ |
| Periodos vencidos | Periodos vencidos | `periodos_vencidos` | ✅ |
| Saldo capital | Saldo capital | `saldo_capital` | ✅ |
| Saldo vencido | Saldo vencido | `saldo_vencido` | ✅ |
| Saldo capital vencido | Saldo capital vencido | `saldo_capital_vencido` | ✅ |
| Saldo interés vencido | Saldo interés vencido | `saldo_interes_vencido` | ✅ |
| Saldo comisión vencida | Saldo comisión vencida | `saldo_comision_vencida` | ✅ |
| Saldo recargos | Saldo recargos | `saldo_recargos` | ✅ |
| $ Último pago | Monto último pago | `monto_ultimo_pago` | ✅ |
| Último pago | Fecha último pago | `fecha_ultimo_pago` | ✅ |
| **Situación crédito** | Situación crédito | **(falta)** | ❌ agregar |
| Medio comunic. 1 | Medio comunic. 1 | `medio_comunic_1` | ✅ |
| **Medio comunic. 2** | Medio comunic. 2 | **(falta)** | ❌ agregar |
| **Medio comunic. 3** | Medio comunic. 3 | **(falta)** | ❌ agregar |
| Actividad económica PLD | Actividad económica PLD | `actividad_economica_pld` | ✅ |
| Código actividad económica PLD | Código actividad económica PLD | `cod_actividad_pld` | ✅ |
| Nombre conyuge | Nombre conyuge | `nombre_conyuge` | ✅ |
| Teléfono conyuge | Teléfono conyuge | `telefono_conyuge` | ✅ |
| Nombre Referencia1 | Nombre Referencia1 | `nombre_ref1` | ✅ |
| Teléfono Referencia1 | Teléfono Referencia1 | `telefono_ref1` | ✅ |
| Nombre Referencia2 | Nombre Referencia2 | `nombre_ref2` | ✅ |
| Teléfono Referencia2 | Teléfono Referencia2 | `telefono_ref2` | ✅ |
| Nombre Referencia3 | Nombre Referencia3 | `nombre_ref3` | ✅ |
| Teléfono Referencia3 | Teléfono Referencia3 | `telefono_ref3` | ✅ |
| Tipo Garantía 1 | Tipo Garantía 1 | `tipo_garantia_1` | ✅ |
| Descripción garantía 1 | Descripción garantía 1 | `descripcion_garantia_1` | ✅ |
| Garantía 1 | Garantía 1 | `garantia_1` | ✅ |
| **Tipo Garantía 2** | Tipo Garantía 2 | **(falta)** | ❌ agregar |
| **Descripción garantía 2** | Descripción garantía 2 | **(falta)** | ❌ agregar |
| **Garantía 2** | Garantía 2 | **(falta)** | ❌ agregar |
| Saldo total | Saldo total | `saldo_total` | ✅ |
| Saldo adelantado | Saldo adelantado | `saldo_adelantado` | ✅ |
| Cód. producto crédito | Cód. producto crédito | `cod_producto` | ⚠️ rename |
| Nom. producto crédito | Nom. producto crédito | `nom_producto` | ⚠️ rename |
| **Calle** | Calle | **(falta)** | ❌ agregar |
| **Colonia** | Colonia | **(falta)** | ❌ agregar |
| Entidad federativa | Entidad federativa | `entidad_federativa` | ✅ |
| Municipio | Municipio | `municipio` | ✅ |
| Geolocalización domicilio | Geolocalización domicilio | `geolocalizacion` | ✅ |
| Link de Geolocalización | (derivado de Geolocalización) | (computar al exportar) | ⚠️ |
| Castigado cartera | Castigado cartera | `castigado_cartera` | ✅ |
| **Nom. personal castiga cartera** | Nom. personal castiga cartera | **(falta)** | ❌ agregar |
| **Frecuencia** | Frecuencia | **(falta)** | ❌ agregar |
| Criticidad | Criticidad | `criticidad` | ✅ |
| Forma de entrega | Forma de entrega | `forma_de_entrega` | ✅ |
| **Concepto Depósito** | (derivado) | **(falta — decidido agregar)** | ❌ agregar |
| Saldo riesgo capital | Saldo riesgo capital | `saldo_riesgo_capital` | ✅ |
| Saldo riesgo total | Saldo riesgo total | `saldo_riesgo_total` | ✅ |
| % MORA | % MORA | `pct_mora` | ✅ |
| Días desde el último pago | Días desde el último pago | `dias_desde_ultimo_pago` | ✅ |
| Alerta | Alerta | `alerta` | ✅ |
| **Cuotas sin pagar** | (calc) | (no almacenar — JOIN con amort en export) | ❌ |

### 12.1 Resumen del gap

- **Schema staging tiene** 52 cols de datos (de 105 totales con metadata).
- **Output canónico requiere** 71 cols del detalle (54 mapeables directo + 13 que faltan + 4 derivadas).
- **Columnas a agregar al schema** (10 nuevas):
  1. `situacion_credito text`
  2. `medio_comunic_2 text`
  3. `medio_comunic_3 text`
  4. `tipo_garantia_2 text`
  5. `descripcion_garantia_2 text`
  6. `garantia_2 text`
  7. `calle text`
  8. `colonia text`
  9. `nom_personal_castiga_cartera text`
  10. `frecuencia text`
  11. `concepto_deposito text` (derivado, se calcula al ingestar)

- **Columnas del ETL actual que NO existen en schema** (bug):
  - `cuotas_sin_pagar` → debe **NO** insertarse en staging; se calcula al exportar
  - `combinado` → eliminar (era duplicado de saldo_riesgo_total)

- **Renames a aplicar en `COLUMN_MAPPING`** del ETL para alinear:
  - `Inicio ciclo` → `fecha_inicio_ciclo` ✅ (ya hecho)
  - `Fin ciclo` → `fecha_fin_ciclo` ✅
  - `Interés moratorio saldo vencido total` → `interes_moratorio` ✅
  - `Monto último pago` → `monto_ultimo_pago` ✅
  - `Fecha último pago` → `fecha_ultimo_pago` ✅
  - Falta: agregar `Situación crédito → situacion_credito`, `Medio comunic. 2 → medio_comunic_2`, etc. para las 10 nuevas.

---

## 13. Reglas de transformación heredadas del legacy

Estas reglas deben replicarse fielmente en el microservicio:

1. **Zero-padding obligatorio**:
   - `codigo_acreditado`, `codigo_promotor`, `codigo_recuperador` → `.zfill(6)`
   - `ciclo` → `.zfill(2)`

2. **Filtros aplicados al cargar**:
   - `LISTA_FRAUDE` (27 códigos hardcoded en `cartera_etl.py`): **excluir** al persistir.
   - `CODIGOS_RECUPERADOR_EXCLUIR = ["000124"]`: **NO excluir** del staging (cambio de decisión); reporta en hoja `RECUPERADOR_000124`.

3. **Cálculo de PAR** (`asignar_rango_mora()`):
   ```
   0    si dias_mora == 0
   7    si 1   <= dias_mora <= 7
   15   si 8   <= dias_mora <= 15
   30   si 16  <= dias_mora <= 30
   60   si 31  <= dias_mora <= 60
   90   si 61  <= dias_mora <= 90
   Mayor_90  si  91 <= dias_mora <= 180
   Mayor_180 si dias_mora > 180
   ```

4. **`Concepto Depósito`**: `"1" + cod_acreditado(zfill 6) + ciclo(zfill 2)` → 9 chars.

5. **`Link de Geolocalización`**: si `Geolocalización` tiene `"lat,lng"`, generar URL `https://www.google.com/maps?q=<lat>,<lng>`. Si tiene texto descriptivo (ej. "ABASOLO SUR..."), dejar vacío.

6. **`Parcialidad + Parcialidad comisión`** (col 18 detalle): suma de las dos cols del input. El ETL actual solo persiste `parcialidad`; debe persistir las dos por separado o la suma. **Decisión**: persistir las dos por separado → `parcialidad`, `parcialidad_comision` y sumar al exportar.

7. **Cohortes Marzo/Abril**:
   - `cohorte_actual = primer día del mes de la fecha_corte`
   - Filas con `Inicio ciclo >= cohorte_actual` → hoja del mes nuevo.
   - Filas con `Inicio ciclo < cohorte_actual` → hoja del mes previo.
   - Nombrar las hojas con el mes en español + año (`Marzo2026`, `Abril2026`).

---

## 14. Recomendaciones para el microservicio (`crediflexi-services`)

### 14.1 Bugs/gaps actuales (críticos)

1. **`df_a_registros()` inserta 3 cols inexistentes** en el schema (`concepto_deposito`, `cuotas_sin_pagar`, `combinado`). Resultado: silently rejected por PostgREST. Causa pérdida de datos.
2. **Schema staging incompleto** (faltan ~10 cols necesarias para output).
3. **No genera el output Excel**: solo persiste a Supabase. Falta endpoint `/cartera/export/{fecha_corte}` que regenere el `.xlsx`.

### 14.2 Plan de extensión

| Paso | Acción |
|---|---|
| 1 | Agregar las 10 cols faltantes a `stg_yunius_cartera_individual` (nueva migración) |
| 2 | Extender `COLUMN_MAPPING` en `cartera_etl.py` para mapear las 10 nuevas (+ `parcialidad_comision`) |
| 3 | Eliminar inserts de `cuotas_sin_pagar` y `combinado` (no van al staging) |
| 4 | Agregar cálculo de `concepto_deposito` en `df_a_registros()` y persistir |
| 5 | Extender schema `loan_amortizacion_individual` con: `estatus_amortizacion`, `monto_recibido`, `monto_faltante`, `categoria`, `incremento`, `fuente_fecha_liquidacion` |
| 6 | Crear módulo `cartera_export.py` que recibe `fecha_corte` y emite el `.xlsx` con las 12 hojas del FINAL TARGET (excluyendo Recuperación/Cobranza/amortizaciones_test inicialmente) |
| 7 | Reemplazar PivotTables nativos de Excel por tablas estáticas generadas con `pandas.pivot_table` (más portable) |
| 8 | Implementar tabla histórica `cartera_asignacion_historico` y append idempotente |

### 14.3 Decisiones pendientes (a confirmar con cliente)

- ¿Mantener `RECUPERADOR_000124` como hoja aparte o eliminar (ya que el filtro `excluir` se quitó)?
- ¿Generar `amortizaciones_individual_test` desde el inicio o en fase posterior?
- ¿Habrá automatización de `Recuperación` (parser de export de Yunius)?
- ¿Cuál es el criterio exacto para `Liquidación anticipada` (todos los vigentes? solo morosos con cuotas adelantadas?)
- ¿Las cols extra de `Mora` y `Cuentas con saldo vencido` siguen llenándose manualmente o se migrarán a una UI? (afecta si dejarlas en el Excel o eliminarlas).

---

## 15. Tabla resumen de hojas con regla de generación

| Hoja | Cómo se genera | Criterio de inclusión | Cols extras vs base |
|---|---|---|---|
| `{ddmmyyyy}` | `SELECT * FROM staging WHERE fecha_corte=?` | todo el snapshot | +4 calc (cuotas_sp, ries_tot copy, combinado, suma) |
| `R_Completo` | igual que `{ddmmyyyy}` pero sin las 4 calc | todo el snapshot | 0 |
| `Marzo2026` | filtrar `Inicio ciclo < primer_día_mes_corte` | cohorte previa | +4 calc |
| `Abril2026` | filtrar `Inicio ciclo >= primer_día_mes_corte` | cohorte actual | +4 calc |
| `RECUPERADOR_000124` | filtrar `cod_recuperador = '000124'` | Call Center | 0 |
| `Mora` | filtrar `dias_mora > 0` + reorden cols 1-7 + 9 cols vacías | morosos | +9 op vacías |
| `Cuentas con saldo vencido` | filtrar `saldo_vencido > 0` + reorden cols 1-7 | con saldo vencido | 0 |
| `Liquidación anticipada` | JOIN cartera + amort + cálculo monto a liquidar | elegibles para liquidar | esquema propio (12 cols) |
| `X_Coordinación` | pivot agregado por Coordinación × PAR × 3 métricas | todos | tabla |
| `X_Recuperador` | pivot agregado por Recuperador × PAR × 3 métricas, excluye 000124 | todos − 000124 | tabla |
| `Asignación` | UNION de últimos 4 snapshots con `Corte` antepuesto | histórico | +1 (Corte) |
| `amortizaciones_individual_test` | amortizaciones + JOIN cartera, derivar metadata | todas las cuotas | esquema propio (89 cols) |
| `Recuperación` | **EXTERNO** — carga aparte | pagos del periodo | esquema propio (101 cols) |
| `Cobranza` | **MANUAL** — plantilla vacía | tracking semanal | esquema propio (19 cols) |

---

**Fin del análisis del output.**
