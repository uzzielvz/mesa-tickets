# Matriz de mapeo input → schema → output

> **Fecha:** 2026-05-27
> **Documentos hermanos:**
> - [`input-analysis.md`](./input-analysis.md) — análisis exhaustivo del input (63 cols)
> - [`output-analysis.md`](./output-analysis.md) — análisis exhaustivo del output (12-13 hojas)
>
> **Objetivo:** documentar la **única fuente de verdad** sobre cómo cada columna del Excel de Yunius se transforma para terminar en (a) la base Supabase y (b) cada celda del reporte FINAL TARGET.

---

## 1. Cómo leer esta matriz

| Símbolo | Significado |
|---|---|
| ✅ | Mapeado correctamente (input → schema → output) |
| ⚠️ | Mapeado parcialmente o necesita ajuste de nombre |
| ❌ | **No mapeado** — falta agregar al schema y/o al ETL |
| 🔒 | Calculado / derivado en el ETL (no proviene del input) |
| 📤 | Calculado al exportar (no se persiste) |
| 🌐 | Externo al input cartera (otra fuente de datos) |

---

## 2. Matriz maestra

| # | Input header (Excel Yunius) | Schema staging col | ETL `df_a_registros()` | Output header | Estado |
|---:|---|---|---|---|:---:|
| 1 | Código acreditado | `codigo_acreditado` | ✅ con `.zfill(6)` | Código acreditado | ✅ |
| 2 | Ciclo | `ciclo` | ✅ | Ciclo | ⚠️ falta `.zfill(2)` en ETL |
| 3 | Nom. región | `nom_region` | ❌ no insertado | Nom. región | ⚠️ schema OK, ETL no lo persiste |
| 4 | Coordinación | `coordinacion` | ✅ | Coordinación | ✅ |
| 5 | Código promotor | `codigo_promotor` | ❌ | Código promotor | ⚠️ schema OK, ETL no lo persiste |
| 6 | Nombre promotor | `nombre_promotor` | ❌ | Nombre promotor | ⚠️ schema OK, ETL no lo persiste |
| 7 | Código recuperador | `codigo_recuperador` | ❌ | Código recuperador | ⚠️ schema OK, ETL no lo persiste |
| 8 | Nombre recuperador | `nombre_recuperador` | ❌ | Nombre recuperador | ⚠️ schema OK, ETL no lo persiste |
| 9 | Nombre acreditado | `nombre_acreditado` | ✅ | Nombre acreditado | ✅ |
| 10 | Cód. producto crédito | `cod_producto` | ❌ | Cód. producto crédito | ⚠️ |
| 11 | Nom. producto crédito | `nom_producto` | ❌ | Nom. producto crédito | ⚠️ |
| 12 | Periodicidad | `periodicidad` | ✅ | Periodicidad | ✅ |
| 13 | Plazo del crédito | `plazo_credito` | ❌ | Plazo del crédito | ⚠️ |
| 14 | Forma de entrega | `forma_de_entrega` | ❌ | Forma de entrega | ⚠️ |
| 15 | Inicio ciclo | `fecha_inicio_ciclo` | ❌ | Inicio ciclo | ⚠️ |
| 16 | Fin ciclo | `fecha_fin_ciclo` | ❌ | Fin ciclo | ⚠️ |
| 17 | Cantidad entregada | `cantidad_entregada` | ❌ | Cantidad entregada | ⚠️ |
| 18 | Cantidad Prestada | `cantidad_prestada` | ❌ | Cantidad Prestada | ⚠️ |
| 19 | Parcialidad | `parcialidad` | ❌ | (sumar con #20) | ⚠️ |
| 20 | Parcialidad comisión | **falta** `parcialidad_comision` | ❌ | (sumar con #19) → `Parcialidad + Parcialidad comisión` | ❌ |
| 21 | Comisión a pagar | `comision_a_pagar` | ❌ | Comisión a pagar | ⚠️ |
| 22 | Días de mora | `dias_mora` | ✅ | Días de mora | ✅ |
| 23 | (derivado) | `par_bucket` | ✅ | PAR | ✅ |
| 24 | Interés moratorio saldo vencido total | `interes_moratorio` | ❌ | Interés moratorio saldo vencido total | ⚠️ |
| 25 | Pagos vencidos | `pagos_vencidos` | ❌ | Pagos vencidos | ⚠️ |
| 26 | Periodos vencidos | `periodos_vencidos` | ❌ | Periodos vencidos | ⚠️ |
| 27 | Saldo capital | `saldo_capital` | ✅ | Saldo capital | ✅ |
| 28 | Saldo vencido | `saldo_vencido` | ✅ | Saldo vencido | ✅ |
| 29 | Saldo capital vencido | `saldo_capital_vencido` | ❌ | Saldo capital vencido | ⚠️ |
| 30 | Saldo interés vencido | `saldo_interes_vencido` | ❌ | Saldo interés vencido | ⚠️ |
| 31 | Saldo comisión vencida | `saldo_comision_vencida` | ❌ | Saldo comisión vencida | ⚠️ |
| 32 | Saldo recargos | `saldo_recargos` | ❌ | Saldo recargos | ⚠️ |
| 33 | Saldo total | `saldo_total` | ✅ | Saldo total | ✅ |
| 34 | Saldo adelantado | `saldo_adelantado` | ❌ | Saldo adelantado | ⚠️ |
| 35 | Saldo riesgo capital | `saldo_riesgo_capital` | ✅ (calc en ETL) | Saldo riesgo capital | ✅ |
| 36 | Saldo riesgo total | `saldo_riesgo_total` | ✅ (calc en ETL) | Saldo riesgo total | ✅ |
| 37 | 🔒 derivado | `pct_mora` | ✅ | % MORA | ✅ |
| 38 | Monto último pago | `monto_ultimo_pago` | ❌ | $ Último pago | ⚠️ |
| 39 | Fecha último pago | `fecha_ultimo_pago` | ✅ | Último pago | ✅ |
| 40 | 🔒 derivado | `dias_desde_ultimo_pago` | ✅ | Días desde el último pago | ✅ |
| 41 | 🔒 derivado | `alerta` | ✅ | Alerta | ✅ |
| 42 | **Situación crédito** | **❌ falta** `situacion_credito` | ❌ | Situación crédito | ❌ |
| 43 | Medio comunic. 1 | `medio_comunic_1` | ❌ | Medio comunic. 1 | ⚠️ |
| 44 | **Medio comunic. 2** | **❌ falta** `medio_comunic_2` | ❌ | Medio comunic. 2 | ❌ |
| 45 | **Medio comunic. 3** | **❌ falta** `medio_comunic_3` | ❌ | Medio comunic. 3 | ❌ |
| 46 | Actividad económica PLD | `actividad_economica_pld` | ❌ | Actividad económica PLD | ⚠️ |
| 47 | Código actividad económica PLD | `cod_actividad_pld` | ❌ | Código actividad económica PLD | ⚠️ |
| 48 | Nombre conyuge | `nombre_conyuge` | ❌ | Nombre conyuge | ⚠️ |
| 49 | Teléfono conyuge | `telefono_conyuge` | ❌ | Teléfono conyuge | ⚠️ |
| 50 | Nombre Referencia1 | `nombre_ref1` | ❌ | Nombre Referencia1 | ⚠️ |
| 51 | Teléfono Referencia1 | `telefono_ref1` | ❌ | Teléfono Referencia1 | ⚠️ |
| 52 | Nombre Referencia2 | `nombre_ref2` | ❌ | Nombre Referencia2 | ⚠️ |
| 53 | Teléfono Referencia2 | `telefono_ref2` | ❌ | Teléfono Referencia2 | ⚠️ |
| 54 | Nombre Referencia3 | `nombre_ref3` | ❌ | Nombre Referencia3 | ⚠️ |
| 55 | Teléfono Referencia3 | `telefono_ref3` | ❌ | Teléfono Referencia3 | ⚠️ |
| 56 | Tipo Garantía 1 | `tipo_garantia_1` | ❌ | Tipo Garantía 1 | ⚠️ |
| 57 | Descripción garantía 1 | `descripcion_garantia_1` | ❌ | Descripción garantía 1 | ⚠️ |
| 58 | Garantía 1 | `garantia_1` | ❌ | Garantía 1 | ⚠️ |
| 59 | **Tipo Garantía 2** | **❌ falta** `tipo_garantia_2` | ❌ | Tipo Garantía 2 | ❌ |
| 60 | **Descripción garantía 2** | **❌ falta** `descripcion_garantia_2` | ❌ | Descripción garantía 2 | ❌ |
| 61 | **Garantía 2** | **❌ falta** `garantia_2` | ❌ | Garantía 2 | ❌ |
| 62 | **Calle** | **❌ falta** `calle` | ❌ | Calle | ❌ |
| 63 | **Colonia** | **❌ falta** `colonia` | ❌ | Colonia | ❌ |
| 64 | Municipio | `municipio` | ❌ | Municipio | ⚠️ |
| 65 | Entidad federativa | `entidad_federativa` | ❌ | Entidad federativa | ⚠️ |
| 66 | Geolocalización domicilio | `geolocalizacion` | ❌ | Geolocalización domicilio | ⚠️ |
| 67 | 📤 derivado de #66 | (no persistir) | — | Link de Geolocalización | 📤 |
| 68 | Castigado cartera | `castigado_cartera` | ❌ | Castigado cartera | ⚠️ |
| 69 | **Nom. personal castiga cartera** | **❌ falta** `nom_personal_castiga_cartera` | ❌ | Nom. personal castiga cartera | ❌ |
| 70 | **Frecuencia** | **❌ falta** `frecuencia` | ❌ | Frecuencia | ❌ |
| 71 | Criticidad | `criticidad` | ❌ | Criticidad | ⚠️ |
| 72 | 🔒 derivado | **❌ falta** `concepto_deposito` | ⚠️ inserta pero col no existe | Concepto Depósito | ❌ |
| 73 | 📤 derivado JOIN amort | (no persistir) | ⚠️ inserta pero col no existe | Cuotas sin pagar | 📤 |
| 74 | 📤 copia de col 36 | (no persistir) | ⚠️ inserta pero col no existe | Saldo_Riesgo_total | 📤 |
| 75 | 📤 copia de col 36 | (no persistir) | ⚠️ inserta pero col no existe | Combinado | 📤 |
| 76 | 📤 JOIN con Recuperación | (no persistir) | — | Suma | 📤 |

### 2.1 Columnas adicionales del input **no mapeadas a ningún output**

Del input hay otras 11 columnas que **no aparecen en el output canónico** (referencia: ver `input-analysis.md` §2):

| Idx input | Header | Decisión |
|---:|---|---|
| 1 | Fecha de corte | Pasa a `fecha_corte` del upload (metadata, no col del staging) |
| varias | (otras del input que no usé arriba) | Persistir en staging para análisis futuros, no se exportan |

---

## 3. Resumen del **gap** (qué hay que hacer)

### 3.1 Migraciones de schema necesarias

Agregar 11 columnas a `stg_yunius_cartera_individual`:

```sql
alter table stg_yunius_cartera_individual
  add column situacion_credito text,
  add column medio_comunic_2 text,
  add column medio_comunic_3 text,
  add column tipo_garantia_2 text,
  add column descripcion_garantia_2 text,
  add column garantia_2 text,
  add column calle text,
  add column colonia text,
  add column nom_personal_castiga_cartera text,
  add column frecuencia text,
  add column concepto_deposito text,
  add column parcialidad_comision numeric(12,2);
```

### 3.2 Cambios en `cartera_etl.py`

1. **Extender `COLUMN_MAPPING`** para incluir TODOS los campos del input que vamos a persistir (actualmente solo mapea 10 de 63).

2. **Eliminar inserts inválidos** en `df_a_registros()`:
   - `cuotas_sin_pagar` → quitar (no va al staging)
   - `combinado` → quitar (no va al staging)

3. **Agregar inserts faltantes** (~38 cols) en `df_a_registros()`.

4. **Agregar `.zfill(2)` para `ciclo`** en algún paso temprano (similar a `codigo_acreditado`).

5. **No filtrar `CODIGOS_RECUPERADOR_EXCLUIR` al persistir**: cambio de política. Persistir todo (incluso `000124`) y filtrar solo al exportar el reporte por hoja.

### 3.3 Cambios en `loan_amortizacion_individual`

Agregar al schema:
- `estatus_amortizacion text` — `PAGADA`/`INCOMPLETA`/`VENCIDA`/`FUTURA`/`NO APLICA LIQUIDACION`
- `monto_recibido numeric(12,2)`
- `monto_faltante numeric(12,2)` *(ya existe — verificar)*
- `categoria text` — clasificación final
- `incremento text` — variación vs corte anterior
- `fuente_fecha_liquidacion text` — algoritmo que asignó la fecha
- `cutoff_date date` *(equivalente a `fecha_corte` — verificar redundancia)*
- `es_no_aplica_liquidacion boolean`
- `codigo_ciclo text` (PK alternativa)

### 3.4 Módulo nuevo: `cartera_export.py`

Responsabilidad: dado un `fecha_corte`, generar el `.xlsx` con las 12 hojas del FINAL TARGET.

Pseudocódigo:

```python
def export_reporte_antiguedad(fecha_corte: date) -> bytes:
    # 1. Cargar snapshot completo de Supabase
    snapshot = sb.from_('stg_yunius_cartera_individual') \
                 .select('*').eq('fecha_corte', fecha_corte).execute()
    amort = sb.from_('loan_amortizacion_individual') \
              .select('*').eq('fecha_corte', fecha_corte).execute()

    # 2. Construir DataFrame canónico de detalle (71 cols)
    df_detail = build_detail_df(snapshot)

    # 3. Generar columnas calculadas (cuotas_sp, ries_tot copy, combinado, suma)
    df_full = add_calc_columns(df_detail, amort)

    # 4. Generar hojas:
    sheets = {
        f'{fecha_corte:%d%m%Y}': df_full,
        'Marzo2026': df_full[df_full['Inicio ciclo'] < first_day_of_month(fecha_corte)],
        'Abril2026': df_full[df_full['Inicio ciclo'] >= first_day_of_month(fecha_corte)],
        'RECUPERADOR_000124': df_detail[df_detail['Código recuperador'] == '000124'],
        'Mora': build_mora_sheet(df_detail),
        'Cuentas con saldo vencido': build_cuentas_vencido_sheet(df_detail),
        'Liquidación anticipada': build_liquidacion_sheet(df_detail, amort),
        'X_Coordinación': build_pivot_coordinacion(df_full),
        'X_Recuperador': build_pivot_recuperador(df_full),
        'Asignación': build_asignacion_historica(),
        # 'amortizaciones_individual_test': build_amort_sheet(amort) — fase 2
    }

    # 5. Escribir XLSX con xlsxwriter (estilos y formato)
    return write_xlsx(sheets)
```

### 3.5 Endpoint nuevo en `crediflexi-services`

```
GET /cartera/export/{fecha_corte}
→ stream xlsx + content-disposition attachment
```

Llamable desde la UI de `mea-tickets` para descargar el reporte.

---

## 4. Checklist de aceptación para que el microservicio quede al 100 %

- [ ] Migración SQL aplica 11 cols nuevas a `stg_yunius_cartera_individual`
- [ ] Migración SQL aplica cols nuevas a `loan_amortizacion_individual`
- [ ] `COLUMN_MAPPING` actualizado con TODAS las cols del input persistibles
- [ ] `df_a_registros()` ya **no** inserta `cuotas_sin_pagar` ni `combinado`
- [ ] `df_a_registros()` inserta las ~38 cols actualmente ignoradas
- [ ] `Concepto Depósito` se calcula y se persiste correctamente (validar formato `1XXXXXXYY`)
- [ ] `ciclo` se zero-padea a 2 chars antes de persistir
- [ ] `CODIGOS_RECUPERADOR_EXCLUIR` ya **no** filtra al persistir (solo al exportar)
- [ ] `cartera_export.py` genera las 12 hojas del FINAL TARGET (sin `Recuperación`/`Cobranza`)
- [ ] Pivots reproducen visualmente lo de FINAL (con tabla estática, no PivotTable)
- [ ] Hoja `Mora` incluye las 9 cols operativas vacías con headers exactos
- [ ] Hoja `Asignación` mantiene últimos 4 cortes con append idempotente
- [ ] `Link de Geolocalización` se calcula como hyperlink en celdas con `lat,lng`
- [ ] Endpoint `GET /cartera/export/{fecha_corte}` regresa XLSX válido
- [ ] Tests E2E: subir un input → ETL persiste → export → comparar `.xlsx` resultante celda a celda contra FINAL TARGET

---

**Fin de la matriz de mapeo.**
