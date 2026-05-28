Eres el agente IMPLEMENTADOR del ticket CART-001.

Tu trabajo en esta iteración es implementar el refactor de `cartera_etl.py`
según el brief v1.1 en `docs/from-platform/handoff/CART-001-refactor-etl.md`.

---

## Lectura obligatoria antes de tocar código

Lee en este orden:
1. `docs/from-platform/handoff/CART-001-refactor-etl.md` — brief completo.
2. `docs/from-platform/cartera/mapping-matrix.md` §2 y §3.2 — fuente de verdad.
3. `services/cartera_etl.py` — estado actual completo.
4. `docs/from-platform/lib/supabase/database.types.ts` — busca el tipo de
   `stg_yunius_cartera_individual` para confirmar nombres exactos de columnas.

---

## Tarea: refactor de `services/cartera_etl.py`

Haz estos cambios en el orden indicado. Commit atómico por cambio lógico.

---

### Paso 1 — Extender `COLUMN_MAPPING`

Agrega al diccionario `COLUMN_MAPPING` (o equivalente) TODOS los campos del
input que deben persistirse pero que hoy faltan. Referencia: columna
"Input header" → "Schema staging col" de la matriz maestra §2, todas las
filas marcadas ❌ o ⚠️ en la columna "ETL df_a_registros()".

Lista completa de pares a agregar (header del Excel → nombre en schema):

```python
"Nom. región": "nom_region",
"Código promotor": "codigo_promotor",
"Nombre promotor": "nombre_promotor",
"Código recuperador": "codigo_recuperador",
"Nombre recuperador": "nombre_recuperador",
"Cód. producto crédito": "cod_producto",
"Nom. producto crédito": "nom_producto",
"Plazo del crédito": "plazo_credito",
"Forma de entrega": "forma_de_entrega",
"Inicio ciclo": "fecha_inicio_ciclo",
"Fin ciclo": "fecha_fin_ciclo",
"Cantidad entregada": "cantidad_entregada",
"Cantidad Prestada": "cantidad_prestada",
"Parcialidad": "parcialidad",
"Parcialidad comisión": "parcialidad_comision",
"Comisión a pagar": "comision_a_pagar",
"Interés moratorio saldo vencido total": "interes_moratorio",
"Pagos vencidos": "pagos_vencidos",
"Periodos vencidos": "periodos_vencidos",
"Saldo capital vencido": "saldo_capital_vencido",
"Saldo interés vencido": "saldo_interes_vencido",
"Saldo comisión vencida": "saldo_comision_vencida",
"Saldo recargos": "saldo_recargos",
"Saldo adelantado": "saldo_adelantado",
"Monto último pago": "monto_ultimo_pago",
"Situación crédito": "situacion_credito",
"Medio comunic. 1": "medio_comunic_1",
"Medio comunic. 2": "medio_comunic_2",
"Medio comunic. 3": "medio_comunic_3",
"Actividad económica PLD": "actividad_economica_pld",
"Código actividad económica PLD": "cod_actividad_pld",
"Nombre conyuge": "nombre_conyuge",
"Teléfono conyuge": "telefono_conyuge",
"Nombre Referencia1": "nombre_ref1",
"Teléfono Referencia1": "telefono_ref1",
"Nombre Referencia2": "nombre_ref2",
"Teléfono Referencia2": "telefono_ref2",
"Nombre Referencia3": "nombre_ref3",
"Teléfono Referencia3": "telefono_ref3",
"Tipo Garantía 1": "tipo_garantia_1",
"Descripción garantía 1": "descripcion_garantia_1",
"Garantía 1": "garantia_1",
"Tipo Garantía 2": "tipo_garantia_2",
"Descripción garantía 2": "descripcion_garantia_2",
"Garantía 2": "garantia_2",
"Calle": "calle",
"Colonia": "colonia",
"Municipio": "municipio",
"Entidad federativa": "entidad_federativa",
"Geolocalización domicilio": "geolocalizacion",
"Castigado cartera": "castigado_cartera",
"Nom. personal castiga cartera": "nom_personal_castiga_cartera",
"Frecuencia": "frecuencia",
"Criticidad": "criticidad",
```

No mapear: "Fecha de corte" (va como metadata del upload, no como col del staging).
No mapear nada marcado como 📤 en la matriz (filas 73-76: cuotas sin pagar,
Saldo_Riesgo_total, Combinado, Suma).

Commit: `refactor(cartera): extiende COLUMN_MAPPING con 53 cols del input`

---

### Paso 2 — Limpiar inserts inválidos en `df_a_registros()`

En `df_a_registros()`, elimina los inserts de estas columnas que NO existen
en el schema de staging:
- `cuotas_sin_pagar` — se calcula al exportar, no persistir
- `combinado` — copia de saldo_riesgo_total, se calcula al exportar
- Si hay también `Saldo_Riesgo_total` con ese nombre exacto (distinto a
  `saldo_riesgo_total` en snake_case), eliminar también.

Conservar: el insert de `concepto_deposito` (sí existe en el schema desde
la migración C0-4). Verifica que el cálculo produce formato `1XXXXXXYY`
(9 chars: "1" + codigo_acreditado.zfill(6) + ciclo.zfill(2)). Si el cálculo
ya está correcto, no lo toques. Si no existe aún, créalo antes del insert.

Commit: `fix(cartera): elimina inserts inválidos cuotas_sin_pagar y combinado`

---

### Paso 3 — Usar COLUMN_MAPPING completo en `df_a_registros()`

Con el COLUMN_MAPPING extendido del Paso 1, asegúrate de que `df_a_registros()`
itera sobre él (o sobre el DataFrame renombrado) para construir el dict/lista
de registros a insertar. Evita cualquier lista hardcodeada de columnas que
ignore el mapping nuevo.

Si el código actual ya hace `.rename(columns=COLUMN_MAPPING)` y luego inserta
dinámicamente todas las columnas presentes en el DataFrame, este paso puede
ser trivial (solo verifica). Si hay una lista hardcodeada de columnas a
insertar, reemplázala por iteración sobre las columnas presentes en el
DataFrame tras el rename, filtrando solo las que existan en el schema de
staging (usa database.types.ts como referencia de columnas válidas).

Commit: `refactor(cartera): df_a_registros usa COLUMN_MAPPING completo dinámicamente`

---

### Paso 4 — `.zfill(2)` en `ciclo`

Añade `.zfill(2)` al campo `ciclo` en la misma etapa donde se aplica
`.zfill(6)` a `codigo_acreditado`. `ciclo` debe quedar como string de 2
chars ("1" → "01", "12" → "12"). Asegúrate de que el cast a str ocurre
antes del zfill si el campo viene como int/float del Excel.

Commit: `fix(cartera): zfill(2) en ciclo (paralelo a zfill(6) de codigo_acreditado)`

---

### Paso 5 — Quitar filtro `CODIGOS_RECUPERADOR_EXCLUIR` al persistir

Decisión de scope (2026-05-28): persistimos TODOS los registros, incluyendo
codigo_recuperador = "000124". El filtro solo aplica al exportar el reporte
(hoja X_Recuperador, ticket C1-4).

- Elimina (o comenta con `# TODO C1-4: filtrar al exportar, no al persistir`)
  cualquier `df[~df['codigo_recuperador'].isin(CODIGOS_RECUPERADOR_EXCLUIR)]`
  que ocurra antes del insert a Supabase.
- Conserva la variable CODIGOS_RECUPERADOR_EXCLUIR si ya existe — la usará
  cartera_export.py en el ticket C1-4.

Commit: `fix(cartera): elimina filtro CODIGOS_RECUPERADOR_EXCLUIR al persistir`

---

## Scope de este ticket

- No toques cartera_export.py (es C1-4, ticket siguiente).
- No toques loan_amortizacion_individual en este ticket (es CART-003).
- No toques el repo mea-tickets desde esta sesión.
- Si encuentras ambigüedad no resuelta, escríbela en
  docs/from-platform/handoff/CART-001-questions.md con formato §7.3 del
  brief y para el trabajo relacionado hasta tener respuesta.

## Branch

`cart-001-refactor-etl` (créalo desde main si no existe).

## Convenciones

- Commits atómicos, en español, descriptivos. Sin commits gigantes.
- Sin Co-Authored-By ni firmas del agente en los commits.
- Comentarios en español, código (variables/funciones) en inglés.

---

## Al terminar

Abre un PR contra main en crediflexi-services con la descripción plantilla
del §7.1 del brief (checklist marcada al estado actual, bloqueadores si los hay).

Luego devuelve al Postman este bloque exacto:

REPORT CART-001
- Branch: cart-001-refactor-etl
- Último commit: <hash> <mensaje corto>
- Checklist completada: N/9
- Bloqueado: NO/SÍ
- (si SÍ) Pregunta abierta: docs/from-platform/handoff/CART-001-questions.md#QN
- PR URL: <url>
- Siguiente paso planeado: <qué queda o qué hiciste>
