# Auditor de depósitos — esquema para escribir consultas

> Para Charly. Acordamos que tú escribes las consultas SQL y la plataforma pone la pantalla. Este documento
> dice qué tablas hay, qué significa cada columna y cómo se entrega una consulta para que se vuelva vista.
> Base: Postgres (Supabase). Creado el 4 de octubre de 2026; actualizado el 8 de octubre (AUD-003).

## Qué hay hoy (desde el 8 de octubre, AUD-003)

**La base son los depósitos del banco**, no los registros. Pedido de Felix: *"un join en código, ciclo, fecha"*.

1. Del **reporte de depósitos de Yunius** (`Grup_Depósito_Garantía …xlsx`) se toman los depósitos cuya columna
   `Conciliado` dice **"No Conciliado"** ("Distribuido" = conciliado). Ese estado manda; el C/N del archivo de
   registros ya no se usa para decidir qué está pendiente.
2. Se agrupan por **grupo, ciclo y fecha del depósito**: monto depositado y cuántos depósitos.
3. **LEFT JOIN** contra **todos** los registros del promotor (C y N) de la carga vigente, por esa misma llave
   **exacta**, agrupados igual: monto registrado y cuántos registros.
4. Estado, en este orden:

| Estado | Cuándo | Leyenda en pantalla |
|---|---|---|
| `sin_registro` | No hay ningún registro ese grupo, ciclo y día | Sin registro |
| `diferencia` | Los montos no cuadran | "Registró $X de más" o "Faltan $X por registrar" |
| `un_registro` | Montos iguales, pero en más de un registro | Debe ser un solo registro |
| `listo` | Montos iguales y un solo registro | Listo para conciliar (falta que Tesorería concilie) |

La fecha es **exacta a propósito**: un depósito del 2 de octubre que se registró el 1 sale "Sin registro".

Con los archivos del 5 de octubre: **23 depósitos sin conciliar por $131,493**, en 20 grupo-ciclo-día:
10 listos para conciliar, 8 sin registro, 2 con diferencia y 0 que deban ser un solo registro.

La pantalla lee todo de la función `aud_conciliacion(p_grupo)`.

## Tablas de depósitos (AUD-003)

### `aud_dep_cargas` — cada reporte de depósitos que se sube

Cada carga es una foto completa. **La vigente es la de mayor `secuencia` con `estado = 'completa'`**: el reporte
entra por lotes desde el navegador, y una carga que se cortó a medias no se vuelve la vigente.

| Columna | Tipo | Qué es |
|---|---|---|
| `id`, `secuencia` | uuid, bigint | Identificador y consecutivo |
| `nombre_archivo` | text | Nombre del archivo subido |
| `filas_archivo`, `insertadas` | int | Lo que se iba a mandar y lo que entró; solo se cierra si coinciden |
| `no_conciliados` | int | Movimientos con "No Conciliado" |
| `fecha_min`, `fecha_max` | date | Rango de "Fecha del depósito" |
| `estado` | text | `en_curso` o `completa` |

### `aud_depositos` — un movimiento del reporte por fila (se guardan todas)

| Columna | Tipo | Columna del reporte |
|---|---|---|
| `carga_id` | uuid | — |
| `fecha_deposito` | date | Fecha del depósito |
| `grupo_id` | text | Código (6 dígitos con ceros) |
| `nombre_grupo` | text | Grupo solidario |
| `ciclo` | text | Ciclo ('04') |
| `periodo` | smallint | Periodo (semana) |
| `monto` | numeric | Cantidad |
| `conciliado` | boolean | `false` solo si Conciliado = "No Conciliado" |
| `estatus` | text | Conciliado, tal como viene |
| `cod_recuperador`, `recuperador` | text | Cód. Recuperador, Recuperador (no se muestran; servirán para la vista por promotor) |

```sql
-- Depósitos sin conciliar de la foto vigente
select * from aud_depositos
where carga_id = (select id from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1)
  and not conciliado;
```

## Tablas de registros (AUD-001)

### `aud_cargas` — cada archivo que se sube

Cada carga es una **foto completa**: la vigente es la de mayor `secuencia`. Las anteriores se conservan, así que
se puede comparar contra la carga pasada.

| Columna | Tipo | Qué es |
|---|---|---|
| `id` | uuid | Identificador de la carga |
| `secuencia` | bigint | Consecutivo. **La vigente es la de mayor secuencia** |
| `nombre_archivo` | text | Nombre del archivo subido |
| `registros`, `sin_conciliar`, `monto_sin_conciliar` | int, int, numeric | Totales calculados al cargar |
| `fecha_min`, `fecha_max` | date | Rango de `FREALDEP` del archivo |
| `created_at` | timestamptz | Cuándo se subió |

### `aud_registros` — un depósito registrado por fila

| Columna | Tipo | Columna del archivo | Qué es |
|---|---|---|---|
| `carga_id` | uuid | — | A qué carga pertenece |
| `fila` | int | — | Fila del Excel (para rastrear) |
| `conciliado` | boolean | `CONCILIADO` | `C` = true, `N` = false |
| `ciclo` | text | `CICLO` | Con ceros: `'04'` |
| `grupo_id` | text | `CDGCLNS` | Con ceros: `'000013'` |
| `periodo` | smallint | `PERIODO` | Semana del ciclo |
| `nombre_grupo` | text | `NOMBRENS` | |
| `fecha_deposito` | date | `FREALDEP` | |
| `monto` | numeric | `MONTODEP` | Exacto, sin redondeo |
| `promotor` | text | `PROMOTOR` | **Vacío hoy.** Ver "Lo que falta" |

Ojo: un mismo grupo y semana puede tener **varios depósitos** (por ejemplo, 500 + 869 el mismo día). No hay
llave única por depósito.

## Ejemplos

```sql
-- La carga vigente
select id from aud_cargas order by secuencia desc limit 1;

-- Lo que falta conciliar en la carga vigente, por grupo
select grupo_id, nombre_grupo, count(*) as depositos, sum(monto) as monto
from aud_registros
where carga_id = (select id from aud_cargas order by secuencia desc limit 1)
  and not conciliado
group by grupo_id, nombre_grupo
order by monto desc;
```

## Cómo se entrega una consulta

1. Escribe la consulta contra estas tablas (o contra las que necesites agregar, ver abajo) y mándamela con
   **qué pregunta responde** y **quién debe verla**.
2. Yo la envuelvo como función de la base (con el control de permisos) y la pantalla la lee de ahí. Así tu
   consulta queda igual y no tienes que tocar TypeScript.

## Lo que falta para la versión de promotores

1. **De quién es cada grupo.** El archivo no trae al promotor. Basta con agregar una columna `PROMOTOR` con el
   **correo con el que el promotor entra a la plataforma**. En cuanto venga, cada promotor ve solo lo suyo.
2. **Los depósitos del banco.** Para comparar "lo que entró" contra "lo que se registró" dentro de la
   plataforma hace falta el reporte de depósitos. Si la conciliación ya viene calculada en `CONCILIADO`, con
   este archivo alcanza.
3. **Que los promotores tengan cuenta.** Hoy la plataforma tiene pocos usuarios; cada promotor necesitaría
   entrar con su correo de CrediFlexi.
