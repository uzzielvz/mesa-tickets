# Input — Reporte Yunius de Antigüedad (Individual)

> Análisis profundo, columna-por-columna, del archivo de entrada al pipeline.
> Fuente analizada: `test_abril2026_input.xlsx` (Jale/automatizador-crediflexi).
> Generado: 2026-05-27. Fase C0-1 del PLAN.

---

## 1. Metadatos del archivo

| Atributo | Valor |
|---|---|
| Hojas | 1 (`Sheet1`) |
| Filas (incluye header) | 343 |
| Filas de datos | **342** |
| Columnas | **63** |
| Encoding | UTF-8 con `ñ`, tildes y caracteres Windows `_x000D_` en algunos textos largos |
| Headers | Fila 1, con saltos de línea `\n` en nombres compuestos (ej. `Código\npromotor`) |
| Origen | Export del core bancario **Yunius** — siempre mismo schema (confirmado por el usuario) |

> **Limpieza obligatoria del nombre de columna** antes de cualquier operación:
> `df.columns = df.columns.str.replace("\n"," ").str.strip()`
> Esto está implementado tanto en legacy (`reportes.py:71`) como en microservicio (`cartera_etl.py:106`).

---

## 2. Resumen ejecutivo

- Total: **63 columnas**, agrupables en 8 dominios.
- **2 columnas 100% null** en el muestreo (`Castigado cartera`, `Nom. personal castiga cartera`) — son flags operativos opcionales que la institución no usa activamente, pero siguen viniendo en el export.
- **Códigos con leading zeros** críticos: `Código promotor`, `Código recuperador`, `Código acreditado`, `Ciclo`, `Cód. producto crédito` — todos vienen como string ya zero-padded. **Nunca convertir a int sin re-padding.**
- **Calidad de datos preocupante en referencias** (cols 37-42): los campos de nombre y teléfono están desordenados (nombres en columna de teléfono y viceversa) en un porcentaje no despreciable de filas. Es un bug del operador que captura, no de Yunius.
- **Geolocalización dirty**: 61.7% null y dentro de las pobladas hay nombres de personas en lugar de coordenadas (más bugs de captura).
- **Forma de entrega** dominado por `Transferencia electrónica` (83%) → `Desembolso en caja` (16.7%) → `Dispersión de fondos` (0.3%).
- **Cohort** por `Inicio ciclo`: rango 2023-08-02 → 2026-04-22. Histórico real de ~2.5 años.

### Dominios

| # | Dominio | Cols | Notas |
|---|---|---|---|
| 1 | Geografía organizacional | 0,1 (Nom. región, Coordinación) | Nom. región es constante (1 valor) |
| 2 | Personal asignado | 2-5 (promotor, recuperador con código y nombre) | Códigos string zfill(6) |
| 3 | Identidad del acreditado | 6-8 (Código, Ciclo, Nombre) | Ciclo string zfill(2) |
| 4 | Crédito (estructura) | 9-17, 51-52, 60, 62 (fechas, montos, plazo, periodicidad, producto, frecuencia) | |
| 5 | Mora y saldos | 13, 18-26, 49-50, 27-28 (días mora, vencidos, capital, intereses, recargos, totales, último pago) | Núcleo del análisis |
| 6 | Crédito (estado) | 29 (Situación crédito) | Categórica: Entregado/Liquidado/Autorizado por cartera |
| 7 | Datos de contacto / referencias | 30-42 | Calidad sucia |
| 8 | Garantías | 43-48 | Mayoritariamente nulas |
| 9 | Domicilio | 53-57 (Calle, Colonia, Entidad, Municipio, Geo) | |
| 10 | PLD | 33-34 | Actividad económica + código |
| 11 | Castigado | 58-59 | Siempre nulo en este sample |
| 12 | Operación de cobro | 61 (Criticidad) | Numérico 0-39 |

---

## 3. Inventario completo de columnas

> Para cada columna: índice (posición en el export), nombre canónico (después de limpiar `\n`), tipo dominante, % nulos, # únicos, distribución (top o stats), muestras reales, rol semántico y uso en el legacy.
> "Rol" = `KEY` (identificador) · `DIM` (dimensión de agrupación) · `METRIC` (medida numérica) · `META` (atributo descriptivo) · `DERIV` (se calcula a partir de otras) · `OPS` (uso operativo).

### [00] `Nom. región`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 1
- **Top**: `'Región Estado México' = 342`
- **Samples**: `['Región Estado México']`
- **Rol**: `DIM` (geográfica de nivel superior; en este export, constante)
- **Legacy**: copiada tal cual a hojas derivadas. No se usa para agrupar.
- **Schema stg**: `nom_region text` (mapeo directo).

### [01] `Coordinación`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 7
- **Top**: `Valle de bravo=109 | Tenancingo=89 | Metepec=88 | Maravatio=32 | Atlacomulco=20 | Toluca=3 | Oficina Central=1`
- **Rol**: `DIM` **principal de agregación** (eje del dashboard de coordinación + filtro transversal).
- **Legacy**: clave de groupby en `X_Coordinación` y co-clave (junto a recuperador) en `X_Recuperador`.
- **Schema stg**: `coordinacion text` (indexada en `idx_cartera_coord`).
- **Anomalía**: nomenclatura inconsistente (`Valle de bravo` con minúscula; `Oficina Central` con título). Normalizar en consultas.

### [02] `Código promotor`

- **Tipo**: `str` (con zfill(6)) · **Nulos**: 0/342 (0.0%) · **Únicos**: 36
- **Samples**: `['000008', '000005']`
- **Rol**: `KEY` (FK a catálogo de promotores)
- **Legacy**: `standardize_codes` lo asegura zfill(6). No se usa para agrupar en pivots (sí en hoja Asignación externa).
- **Schema stg**: `codigo_promotor text`.

### [03] `Nombre promotor`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 36
- **Samples**: `['Lopez Vargas Betsabe Yesenia', 'Garduño Hernandez Miguel Angel']`
- **Rol**: `META` (denormalización del catálogo)
- **Schema stg**: `nombre_promotor text`.

### [04] `Código recuperador`

- **Tipo**: `str` (zfill(6)) · **Nulos**: 0/342 (0.0%) · **Únicos**: 21
- **Samples**: `['000005']`
- **Rol**: `KEY` + **DIM** (eje del dashboard de recuperador)
- **Legacy**: `standardize_codes` zfill(6). El código `000124` (`GENTE Y CULTURA`) se **excluye** del análisis principal y se manda a hoja `RECUPERADOR_000124` aparte. Configurable en `CODIGOS_RECUPERADOR_EXCLUIR`.
- **Schema stg**: `codigo_recuperador text` (indexada `idx_cartera_recup`).

### [05] `Nombre recuperador`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 21
- **Samples**: `['Garduño Hernandez Miguel Angel']`
- **Rol**: `META`
- **Schema stg**: `nombre_recuperador text`.

### [06] `Código acreditado`

- **Tipo**: `str` (zfill(6)) · **Nulos**: 0/342 (0.0%) · **Únicos**: **272**
- **Samples**: `['001041', '001014', '001005', '001002', '001007']`
- **Rol**: `KEY` principal (junto a `ciclo` forma identidad única del crédito).
- **Legacy**:
  - `standardize_codes` zfill(6).
  - Se cruza contra `LISTA_FRAUDE` (27 códigos hardcoded en `cartera_etl.py:28-33`) para excluir registros sospechosos antes del análisis.
  - Es la base del `Concepto Depósito` (concatena `1 + codigo + ciclo`).
- **Schema stg**: `codigo_acreditado text not null`. Forma parte de la unique key `(fecha_corte, codigo_acreditado, ciclo)`.
- **Observación**: 342 filas vs 272 únicos → en promedio 1.26 créditos por acreditado (algunos con varios ciclos vivos a la vez).

### [07] `Ciclo`

- **Tipo**: `str` (zfill(2)) · **Nulos**: 0/342 (0.0%) · **Únicos**: 4
- **Top**: `'01'=271 | '02'=63 | '03'=7 | '04'=1`
- **Rol**: `KEY` (parte de identidad única del crédito) + `DIM` (analytics de retención)
- **Legacy**: formateado a 2 dígitos. Combinado con `Código acreditado` arma `Concepto Depósito`.
- **Schema stg**: `ciclo text not null`.

### [08] `Nombre acreditado`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 272 (= # acreditados)
- **Samples**: `['VICTORIA MARCOS CATALINA SUSANA', ...]`
- **Rol**: `META`. Mayúsculas todas.
- **Schema stg**: `nombre_acreditado text`.

### [09] `Inicio ciclo`

- **Tipo**: `datetime` · **Nulos**: 0/342 (0.0%) · **Únicos**: 195
- **Stats**: `min=2023-08-02` · `max=2026-04-22`
- **Rol**: `DIM` (cohort por fecha de originación)
- **Legacy**: **clave de segmentación de hojas mensuales** (`Marzo2026` = `Inicio ciclo < 2026-04-01`; `Abril2026` = `>= 2026-04-01`). Confirma decisión 2026-05-27 del PLAN: la cohort es por Inicio ciclo, no por fecha de corte.
- **Schema stg**: `fecha_inicio_ciclo date`. **CRITICAL**: ETL actual NO mapea esto (bloquea cohort dashboard).

### [10] `Fin ciclo`

- **Tipo**: `datetime` · **Nulos**: 0/342 (0.0%) · **Únicos**: 219
- **Stats**: `min=2024-03-01` · `max=2027-02-19`
- **Rol**: `META` (vencimiento programado del crédito)
- **Schema stg**: `fecha_fin_ciclo date`. ETL actual NO la mapea.

### [11] `Cantidad entregada`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 44
- **Stats**: `min=0 · max=350,000 · sum=8,922,384.35 · avg=26,088.84`
- **Rol**: `METRIC` (capital desembolsado al cliente)
- **Legacy**: aparece en hojas derivadas pero NO se usa para agregaciones (X_Coord usa `Cantidad Prestada`).
- **Schema stg**: `cantidad_entregada numeric(14,2)`. ETL no la mapea.

### [12] `Cantidad Prestada`

- **Tipo**: `float+int` · **Nulos**: 2/342 (0.6%) · **Únicos**: 51
- **Stats**: `min=5,267.04 · max=368,692.72 · sum=9,516,594.59 · avg=27,989.98`
- **Rol**: `METRIC` (capital + comisiones + intereses = obligación total contratada)
- **Legacy**: **base de la agregación en X_Coordinación y X_Recuperador** (suma "Cantidad Prestada" por grupo).
- **Schema stg**: `cantidad_prestada numeric(14,2)`. ETL no la mapea. **CRITICAL para dashboards de paridad**.

### [13] `Días de mora`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 105
- **Stats**: `min=0 · max=713 · sum=35,229 · avg=103.01`
- **Rol**: `METRIC` central. **Es el eje de toda la analítica de mora.**
- **Legacy**:
  - Se ordena el reporte por mora descendente.
  - Deriva `PAR` (bucket) — ver función `asignar_par`/`asignar_rango_mora`.
  - Filtra hojas: `Mora` = `mora >= 1`.
  - Filtra `Saldo riesgo` = saldo cuando `mora > 0`.
- **Schema stg**: `dias_mora int` (indexada implícitamente vía `idx_cartera_par`). ETL SÍ la mapea.

### [14] `Plazo del crédito`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 16
- **Top**: `12=178 | 6=96 | 10=16 | 24=16 | 8=12 | 18=6 | 9=3 | 4=3 | 16=3 | 7=2 | 1=2 | 48=1 | 15=1 | 5=1 | 3=1 | 2=1`
- **Rol**: `META` (número de pagos del crédito). El producto más vendido es a 12 meses, luego 6.
- **Schema stg**: `plazo_credito smallint`. ETL no la mapea.

### [15] `Periodicidad`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 4
- **Top**: `Mensual=263 | Catorcenal=51 | Quincenal=14 | Semanal=14`
- **Rol**: `DIM` + `METRIC` indirecta (define el plazo entre pagos).
- **Legacy**: convertida a días vía `PERIODICIDAD_A_DIAS` (`semanal=7, catorcenal=14, quincenal=15, mensual=30, bimensual=60, trimestral=90`). Se usa para calcular `Alerta` (días desde último pago > plazo) y `Cuotas sin pagar`.
- **Schema stg**: `periodicidad text`. ETL SÍ la mapea.

### [16] `Parcialidad + Parcialidad comisión`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 170
- **Stats**: `min=365.70 · max=134,083.64 · sum=1,681,587.50 · avg=4,916.92`
- **Rol**: `METRIC` (importe a pagar cada periodo, capital + intereses + comisión).
- **Legacy**: copiada a hojas derivadas; no se agrega.
- **Schema stg**: `parcialidad numeric(12,2)`. ETL no la mapea.

### [17] `Comisión a pagar`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 26
- **Stats**: `min=0 · max=17,409 · sum=219,895 · avg=642.97`
- **Schema stg**: `comision_a_pagar numeric(12,2)`. ETL no la mapea.

### [18] `Interés moratorio saldo vencido total`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 33
- **Stats**: `min=0 · max=12,760 · sum=410,468.33 · avg=1,200.20`
- **Schema stg**: `interes_moratorio numeric(14,2)`. ETL no la mapea.

### [19] `Pagos vencidos`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 17
- **Top**: `0=277 (81%) | 12=29 | 24=9 | …`
- **Rol**: `METRIC` (cantidad de pagos atrasados).
- **Schema stg**: `pagos_vencidos int`. ETL no la mapea.

### [20] `Periodos vencidos`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 58
- **Stats**: `min=0 · max=21.8 · sum=714.40 · avg=2.09`
- **Schema stg**: `periodos_vencidos numeric(6,2)`. ETL no la mapea.

### [21] `Saldo capital`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 157
- **Stats**: `min=-13.08 · max=300,000 · sum=3,612,284.42 · avg=10,562.24`
- **Rol**: `METRIC` central. (Saldo de principal aún por pagar.) Hay un valor negativo (`-13.08`) — probable redondeo / sobre-cobro.
- **Legacy**: usado en `Saldo riesgo capital = IF(mora > 0, Saldo capital, 0)`. Se suma en X_Coord/X_Recup.
- **Schema stg**: `saldo_capital numeric(14,2)`. ETL SÍ la mapea.

### [22] `Saldo vencido`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 165
- **Stats**: `min=0 · max=303,009 · sum=3,247,754.45 · avg=9,496.36`
- **Rol**: `METRIC` central. (Suma de pagos vencidos no cobrados, incluye capital + interés + comisión + recargos vencidos.)
- **Legacy**: usado en `% MORA = Saldo vencido / Saldo total`. Se suma en X_Coord.
- **Schema stg**: `saldo_vencido numeric(14,2)`. ETL SÍ la mapea.

### [23] `Saldo capital vencido`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 122
- **Stats**: `min=0 · max=210,000 · sum=1,812,525.91`
- **Rol**: `METRIC` (porción del Saldo vencido que es principal).
- **Schema stg**: `saldo_capital_vencido numeric(14,2)`. ETL no la mapea.

### [24] `Saldo interés vencido`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 122
- **Stats**: `min=0 · max=75,600 · sum=932,945.39`
- **Schema stg**: `saldo_interes_vencido numeric(14,2)`. ETL no la mapea.

### [25] `Saldo comisión vencida`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 75
- **Stats**: `min=0 · max=17,409 · sum=92,999.05`
- **Schema stg**: `saldo_comision_vencida numeric(14,2)`. ETL no la mapea.

### [26] `Saldo recargos`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 33
- **Stats**: `min=0 · max=12,760 · sum=409,888.33`
- **Schema stg**: `saldo_recargos numeric(14,2)`. ETL no la mapea.

### [27] `$ Último pago`

- **Tipo**: `int+float` · **Nulos**: 15/342 (4.4%) · **Únicos**: 246
- **Stats**: `min=27 · max=137,970.15 · sum=1,930,568.33 · avg=5,903.88`
- **Rol**: `METRIC` (monto del último pago recibido). Null cuando el crédito nunca recibió pago.
- **Schema stg**: `monto_ultimo_pago numeric(12,2)`. ETL no la mapea.

### [28] `Último pago`

- **Tipo**: `datetime` · **Nulos**: 15/342 (4.4%) · **Únicos**: 168
- **Stats**: `min=2023-11-01 · max=2026-02-18`
- **Rol**: `METRIC`/`DIM`. **Es la base de `Días desde el último pago` y `Alerta`**.
- **Legacy**: `Días desde último pago = today - Último pago`; `Alerta = 1 si días > plazo_periodicidad else 0`.
- **Schema stg**: `fecha_ultimo_pago date`. ETL SÍ la mapea.

### [29] `Situación crédito`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 3
- **Top**: `Entregado=214 (62.6%) | Liquidado=126 (36.8%) | Autorizado por cartera=2`
- **Rol**: `DIM` (estado del ciclo de vida).
- **Schema stg**: **NO EXISTE**. Hay que agregar `situacion_credito text` si se quiere filtrar por estado.

### [30] `Medio comunic. 1`

- **Tipo**: `str` (dtype forzado por `DTYPE_CONFIG`) · **Nulos**: 0/342 (0.0%) · **Únicos**: 272
- **Samples**: `['7294736723', '7225628638', ...]` — son teléfonos.
- **Rol**: `META` (canal de contacto primario, casi siempre celular).
- **Schema stg**: `medio_comunic_1 text`. ETL no la mapea.

### [31] `Medio comunic. 2`

- **Tipo**: `str` · **Nulos**: 37/342 (10.8%) · **Únicos**: 241
- **Samples**: emails y otros teléfonos (`Sandra@gmail.com`, `silviamiba16@gmail.com`).
- **Rol**: `META`.
- **Schema stg**: **NO EXISTE**.

### [32] `Medio comunic. 3`

- **Tipo**: `str` · **Nulos**: 339/342 (99.1%) · **Únicos**: 2
- **Top**: `'7293774847'=2 | '2225315368'=1`
- **Rol**: `META`. Casi inútil por nulidad.
- **Schema stg**: **NO EXISTE**.

### [33] `Actividad económica PLD`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 105
- **Samples**: `['COMPRAVENTA DE ARTICULOS DE MERCERIA Y CEDERIA', …]`
- **Rol**: `DIM` (segmentación por giro). Posible filtro avanzado en dashboards.
- **Schema stg**: `actividad_economica_pld text`. ETL no la mapea.

### [34] `Código actividad económica PLD`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 105
- **Samples**: `['6215017', '2028018', '6326020', …]`
- **Rol**: `KEY` (catálogo SAT/PLD).
- **Schema stg**: `cod_actividad_pld text`. ETL no la mapea.

### [35] `Nombre conyuge`

- **Tipo**: `str` · **Nulos**: 178/342 (52.0%) · **Únicos**: 130
- **Rol**: `META` (referencia familiar).
- **Schema stg**: `nombre_conyuge text`. ETL no la mapea.

### [36] `Teléfono conyuge`

- **Tipo**: `str` (dtype forzado) · **Nulos**: 275/342 (80.4%) · **Únicos**: 53
- **Schema stg**: `telefono_conyuge text`. ETL no la mapea.

### [37-42] Referencias 1/2/3 (nombre + teléfono)

- **Tipos**: `str` · **Nulos**: ~20-21% en cada par.
- **CALIDAD DE DATOS ANÓMALA**:
  - En col 38 (`Teléfono Referencia1`) aparecen valores como `DANIEL LEON BAÑUELOS`, `SANDRA BUCIO MERCADO` — son NOMBRES en columna de teléfono.
  - En col 39 (`Nombre Referencia2`) aparecen valores como `7224612899` — TELÉFONOS en columna de nombre.
  - En col 37 (`Nombre Referencia1`) aparecen valores como `15 AÑOS` — texto basura.
  - En col 41 (`Nombre Referencia3`) aparecen valores como `10 AÑOS` — mismo bug.
- **Causa probable**: el operador que captura en Yunius confunde el orden de los campos. **No es bug del ETL.**
- **Implicación para dashboards**: no se puede confiar en estos campos para validaciones automáticas. Mostrar como texto crudo. Eventualmente, ofrecer una vista de "data quality" que los muestre en rojo cuando un teléfono es alfabético.
- **Schema stg**: `nombre_ref1..3 text`, `telefono_ref1..3 text`. ETL no los mapea.

### [43] `Tipo Garantía 1`

- **Tipo**: `str` · **Nulos**: 294/342 (86.0%) · **Únicos**: 2
- **Top**: `'Garantía Prendaria'=47 | 'Avales'=1`
- **Rol**: `DIM`. Casi solo aplica al 14% de créditos garantizados.
- **Schema stg**: `tipo_garantia_1 text`. ETL no la mapea.

### [44] `Descripción garantía 1`

- **Tipo**: `str` · **Nulos**: 295/342 (86.3%) · **Únicos**: 47
- **Samples**: textos largos describiendo facturas de vehículos, títulos de propiedad, etc.
- **Schema stg**: `descripcion_garantia_1 text`. ETL no la mapea.

### [45] `Garantía 1`

- **Tipo**: `str` · **Nulos**: 294/342 (86.0%) · **Únicos**: 44
- **Samples**: nombre corto del bien (`VEHICULO NP300 CHASIS DIESEL`, etc.). En una fila aparece un nombre de persona (`VALDES VILLEGAS ANTONIO`) — más data quality issue.
- **Schema stg**: `garantia_1 text`. ETL no la mapea.

### [46-48] Garantía 2 (Tipo / Descripción / Garantía)

- **Tipo**: `str` · **Nulos**: 339/342 (99.1%)
- **Rol**: `META`. Casi inútil.
- **Schema stg**: **NO EXISTE** ninguna de las 3. Si la segunda garantía no aporta, se puede ignorar.

### [49] `Saldo total`

- **Tipo**: `float+int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 276
- **Stats**: `min=-5,705.61 · max=303,009 · sum=5,688,987.54 · avg=16,634.47`
- **Rol**: `METRIC` central. **Es la base de % MORA y Saldo Riesgo Total.**
- **Legacy**:
  - `% MORA = Saldo vencido / Saldo total` (por fila y agregado).
  - `Saldo riesgo total = IF(mora > 0, Saldo total, 0)`.
  - Suma en X_Coord/X_Recup.
- **Schema stg**: `saldo_total numeric(14,2)`. ETL SÍ la mapea.

### [50] `Saldo adelantado`

- **Tipo**: `int+float` · **Nulos**: 0/342 (0.0%) · **Únicos**: 115
- **Stats**: `min=0 · max=109,186.33 · sum=267,903.46 · avg=783.34`
- **Rol**: `METRIC` (sobre-pago disponible para aplicar a próximos vencimientos).
- **Legacy**: usado en hoja **Liquidación anticipada** (resta del cálculo final).
- **Schema stg**: `saldo_adelantado numeric(14,2)`. ETL no la mapea.

### [51] `Cód. producto crédito`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 7
- **Top**: `'01'=287 | '0001'=24 | '04'=14 | '0002'=7 | '02'=6 | '03'=3 | '06'=1`
- **Rol**: `KEY` (catálogo de productos crediticios).
- **ANOMALÍA**: dos convenciones de codificación coexisten (`'01'` y `'0001'` ambos parecen referirse al mismo producto base; nomenclatura inconsistente desde Yunius).
- **Schema stg**: `cod_producto text`. ETL no la mapea.

### [52] `Nom. producto crédito`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 12
- **Top**: `Individual sin Garantía=229 | Individual mensual garantia liquida nivel I TI=30 | …`
- **Rol**: `DIM`.
- **Schema stg**: `nom_producto text`. ETL no la mapea.

### [53] `Calle`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 266
- **Samples**: `['MISIONEROS #SN', 'CIRUELO #SN', '2A SECCION #SN', 'DOMICILIO CONOCIDO #SN', …]`
- **Rol**: `META`.
- **Schema stg**: **NO EXISTE**. Si se construye dirección completa, sí debería existir.

### [54] `Colonia`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 152
- **Schema stg**: **NO EXISTE**.

### [55] `Entidad federativa`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 5
- **Top**: `México=303 (88.6%) | Michoacán=32 | Ciudad de México=4 | Puebla=2 | Hidalgo=1`
- **Rol**: `DIM`.
- **Schema stg**: `entidad_federativa text`. ETL no la mapea.

### [56] `Municipio`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 38
- **Rol**: `DIM`.
- **Schema stg**: `municipio text`. ETL no la mapea.

### [57] `Geolocalización domicilio`

- **Tipo**: `str` · **Nulos**: 211/342 (61.7%) · **Únicos**: 118
- **Samples válidas**: `'19°12\'17.6"N 100°07\'14.9"W'` (coordenadas DMS)
- **Samples basura**: `'ESTEBAN BAÑUELOS RUMBO'`, `'AIDE CELESTE GARDUÑO ROJAS'` — son nombres, no geolocalización.
- **Legacy**: `generar_link_google_maps()` parsea DMS → URL Google Maps. Maneja casos vacíos y dirección texto.
- **Schema stg**: `geolocalizacion text`. ETL no la mapea.

### [58] `Castigado cartera`

- **Tipo**: `null` · **Nulos**: 342/342 (100.0%)
- **Rol**: `META`. En este export está totalmente vacío. **El flag existe en el esquema Yunius pero no se usa**.
- **Schema stg**: `castigado_cartera boolean default false`. ETL no la mapea (default funciona).

### [59] `Nom. personal castiga cartera`

- **Tipo**: `null` · **Nulos**: 342/342 (100.0%)
- **Schema stg**: **NO EXISTE**.

### [60] `Frecuencia`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 29
- **Stats**: `min=0 · max=39 · sum=2,096 · avg=6.13`
- **Rol**: `METRIC` operativo. Significado probable: contador de algún evento (re-llamadas, intentos, frecuencia de seguimiento). **Sin documentación clara en Yunius.**
- **Schema stg**: **NO EXISTE**.

### [61] `Criticidad`

- **Tipo**: `int` · **Nulos**: 0/342 (0.0%) · **Únicos**: 27
- **Stats**: `min=0 · max=39 · sum=2,011 · avg=5.88`
- **Rol**: `METRIC` operativo. Strongly correlated con `Frecuencia` (parecen casi idénticas).
- **Schema stg**: `criticidad text` (¡tipado como `text`, no numérico — revisar!). ETL no la mapea.

### [62] `Forma de entrega`

- **Tipo**: `str` · **Nulos**: 0/342 (0.0%) · **Únicos**: 3
- **Top**: `Transferencia electrónica=284 (83.0%) | Desembolso en caja=57 (16.7%) | Dispersión de fondos=1`
- **Rol**: `DIM`.
- **Schema stg**: `forma_de_entrega text`. ETL no la mapea.

---

## 4. Cruce input ↔ schema ↔ ETL

### 4.1 Resumen cuantitativo

| Métrica | Valor |
|---|---|
| Columnas del input | **63** |
| Columnas del schema `stg_yunius_cartera_individual` (sin metadata) | **52** |
| Columnas del schema que el ETL mapea hoy | **16** (de las que pertenecen al schema) |
| Columnas del input usadas hoy por el ETL | **10** (`COLUMN_MAPPING` + saldo total + última pago) |
| Columnas derivadas que el ETL calcula | **8** (par_bucket, saldo_riesgo_capital/total, pct_mora, dias_desde_ultimo_pago, alerta, concepto_deposito, cuotas_sin_pagar, combinado) |
| **Bug**: cols que ETL inserta y NO existen en schema | **3** (`concepto_deposito`, `cuotas_sin_pagar`, `combinado`) |
| Columnas del input que NO viajan a Supabase | **~38** |

### 4.2 Columnas del input NO mapeadas hoy por el ETL (a corregir en CART-001)

> Las que SÍ existen en el schema actual y solo falta poblarlas.

| input | stg | ¿bloquea dashboard? |
|---|---|---|
| Nom. región | nom_region | No (constante) |
| Código promotor | codigo_promotor | Útil para drill |
| Nombre promotor | nombre_promotor | Útil para drill |
| Código recuperador | codigo_recuperador | **Sí** (DASH-003) |
| Nombre recuperador | nombre_recuperador | **Sí** (DASH-003) |
| Inicio ciclo | fecha_inicio_ciclo | **Sí** (DASH-005 cohort) |
| Fin ciclo | fecha_fin_ciclo | Sí indirecto |
| Cantidad entregada | cantidad_entregada | Útil |
| Cantidad Prestada | cantidad_prestada | **Sí** (DASH-001/002/003 — base de sumas) |
| Parcialidad + Parcialidad comisión | parcialidad | Útil (drill) |
| Comisión a pagar | comision_a_pagar | Útil |
| Interés moratorio saldo vencido total | interes_moratorio | Útil |
| Pagos vencidos | pagos_vencidos | **Sí** (DASH-004 mora) |
| Periodos vencidos | periodos_vencidos | Sí |
| Saldo capital vencido | saldo_capital_vencido | Sí (drill) |
| Saldo interés vencido | saldo_interes_vencido | Sí (drill) |
| Saldo comisión vencida | saldo_comision_vencida | Útil |
| Saldo recargos | saldo_recargos | Útil |
| $ Último pago | monto_ultimo_pago | Útil |
| Plazo del crédito | plazo_credito | Útil |
| Saldo adelantado | saldo_adelantado | Útil (liquidación) |
| Cód. producto crédito | cod_producto | Útil (filtro) |
| Nom. producto crédito | nom_producto | Útil (filtro) |
| Forma de entrega | forma_de_entrega | Útil |
| Medio comunic. 1 | medio_comunic_1 | **Sí** (DASH-004 — contactar) |
| Nombre conyuge | nombre_conyuge | Drill |
| Teléfono conyuge | telefono_conyuge | Drill |
| Nombre Referencia1..3 | nombre_ref1..3 | Drill |
| Teléfono Referencia1..3 | telefono_ref1..3 | Drill |
| Tipo Garantía 1 | tipo_garantia_1 | Drill |
| Descripción garantía 1 | descripcion_garantia_1 | Drill |
| Garantía 1 | garantia_1 | Drill |
| Actividad económica PLD | actividad_economica_pld | Filtro avanzado |
| Código actividad económica PLD | cod_actividad_pld | Filtro avanzado |
| Municipio | municipio | Filtro |
| Entidad federativa | entidad_federativa | Filtro |
| Geolocalización domicilio | geolocalizacion | Drill |
| Criticidad | criticidad | Filtro avanzado |
| Castigado cartera | castigado_cartera | Filtro |

### 4.3 Columnas del input que NO existen en el schema (decisión: agregar / ignorar)

| input | Decisión propuesta | Justificación |
|---|---|---|
| `Situación crédito` | **Agregar** `situacion_credito text` | Filtro útil (Entregado/Liquidado). |
| `Medio comunic. 2` | **Agregar** `medio_comunic_2 text` | Email / segundo canal. Útil para multicanal. |
| `Medio comunic. 3` | Ignorar | 99% null. |
| `Tipo/Descripción/Garantía 2` | Ignorar | 99% null. |
| `Calle`, `Colonia` | **Agregar** `calle text`, `colonia text` | Dirección completa para drill. |
| `Nom. personal castiga cartera` | Ignorar | Siempre null en sample. Revisar en otro export. |
| `Frecuencia` | **Investigar** con negocio antes de decidir | Significado opaco. |

### 4.4 Bug crítico del ETL actual

```python
# cartera_etl.py:336-338
"concepto_deposito": _safe(row.get("Concepto Depósito")),
"cuotas_sin_pagar":  _safe(row.get("Cuotas sin pagar")),
"combinado":         _safe(row.get("Combinado")),
```

**Estas 3 columnas NO existen en `stg_yunius_cartera_individual`.** PostgREST debería rechazarlas con `PGRST204` o similar. Verificar comportamiento real en runtime (probable insert exitoso con columnas ignoradas, o error silente). Decisión propuesta:

- **Concepto Depósito**: agregar al schema como `concepto_deposito text` (es información útil para conciliar pagos por transferencia).
- **Cuotas sin pagar**: agregar como `cuotas_sin_pagar int`. Útil para dashboards.
- **Combinado**: **NO agregar**. Es una métrica derivada Excel-específica que mezcla tipos (entero o monto) según el bucket de mora — no tiene sentido en una DB relacional. Recalcular en frontend/RPC si se necesita.

### 4.5 Columnas del schema que NO tienen origen en este input

- `alerta` — derivada por ETL ✓
- `par_bucket` — derivada por ETL ✓
- `pct_mora` — derivada por ETL ✓
- `saldo_riesgo_capital` / `saldo_riesgo_total` — derivadas por ETL ✓
- `dias_desde_ultimo_pago` — derivada por ETL ✓

Todas están justificadas.

---

## 5. Notas de calidad de datos (para advertir al usuario en UI)

1. **Geolocalización**: 61.7% null + 5-10% basura textual (nombres). Mostrar como link Google Maps cuando es DMS válido, sino oculto.
2. **Referencias (cols 37-42)**: nombres en columnas de teléfono y viceversa, en aprox. 5-15% de las filas. Validar al render: si `teléfono_refN` no es numérico, marcar advertencia.
3. **Cód. producto**: dos convenciones (`'01'` y `'0001'`). Normalizar a `zfill(4)` o mapear a catálogo.
4. **Castigado cartera**: 100% null en sample. Confirmar con operación si realmente se usa.
5. **Saldo capital con valor negativo** (-13.08): puede ocurrir tras over-payment. Permitir en UI, no validar > 0.

---

## 6. Reglas de transformación obligatorias (heredadas del legacy)

Antes de mapear a `stg_yunius_cartera_individual`:

1. **Estandarizar headers**: `df.columns.str.replace("\n"," ").str.strip()` (microservicio lo hace, OK).
2. **Forzar dtypes a string**: `Medio comunic. 1/2/3`, `Teléfono conyuge`, `Teléfono Referencia1..3` (microservicio lo hace, OK).
3. **Zero-pad códigos**: `codigo_acreditado`, `codigo_promotor`, `codigo_recuperador` → `zfill(6)`; `ciclo` → `zfill(2)`; `cod_producto` → `zfill(4)`.
4. **Filtrar fraude**: excluir registros con `codigo_acreditado in LISTA_FRAUDE` (27 códigos) ANTES de insertar (microservicio lo hace, OK).
5. **Apartar recuperador 000124**: el código `000124` (`GENTE Y CULTURA`) se mete en una hoja aparte en el legacy. **Decisión propuesta**: en plataforma SÍ insertarlo en stg (con su flag de coordinación), pero los dashboards principales lo excluyen vía filtro. No replicar la "hoja aparte" como tabla aparte.
6. **Ordenar por días de mora desc**: no es semántico en DB, pero sí lo es para Excel de paridad. Las consultas SQL ordenan en SELECT.
7. **PAR bucket** (asignación):
   - `mora == 0` → `'0'`
   - `1-7` → `'7'`; `8-15` → `'15'`; `16-30` → `'30'`; `31-60` → `'60'`; `61-90` → `'90'`
   - `91-180` → `'Mayor_90'`; `> 180` → `'Mayor_180'`
   - **Discrepancia legacy**: en X_Coordinación del Excel `nuevo_31032026` se usa la separación `Mayor_90` (91-180) y `Mayor_180` (>180). El microservicio ya lo implementa correctamente; el bucket "Mayor_90" en algunas hojas viejas era todo lo > 90 en un solo bucket.
8. **Derivar Concepto Depósito**: `1 + codigo(6) + ciclo(2)` (string de 9 chars). En el legacy se asigna SOLO al registro con mayor ciclo cuando hay varios créditos del mismo acreditado vivos. Esa regla es operativa del banco (1 depósito conceptual por acreditado, aplica al ciclo activo). **Replicar tal cual**.

---

## 7. Apéndice — Cómo regenerar este análisis

```python
import openpyxl
from collections import Counter
WB = 'test_abril2026_input.xlsx'
wb = openpyxl.load_workbook(WB, read_only=True, data_only=True)
ws = wb['Sheet1']
rows = list(ws.iter_rows(values_only=True))
# (ver script completo en commit que generó este doc)
```

Script generador: ver historia del commit `docs(cartera): C0-1 análisis profundo del input`.

---

*Fin del análisis del input. Siguiente: `output-analysis.md` (C0-2).*
