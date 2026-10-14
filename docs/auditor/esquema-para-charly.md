# Auditor de depósitos — esquema para escribir consultas

> Para Charly. Acordamos que tú escribes las consultas SQL y la plataforma pone la pantalla. Este documento
> dice qué tablas hay, qué significa cada columna y cómo se entrega una consulta para que se vuelva vista.
> Base: Postgres (Supabase). Creado el 4 de octubre de 2026; actualizado el 8 de octubre (AUD-003) y el
> 13 de octubre (AUD-004: cada promotor ve solo lo suyo; AUD-005: avisos). Cómo se usa el módulo:
> [`README.md`](./README.md).

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

La pantalla lee todo de la función `aud_conciliacion(p_grupo, p_promotor)`. Desde AUD-004 esa función decide
también **qué ve cada quien**: ver "De quién es cada grupo" abajo.

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

## De quién es cada grupo (AUD-004, 13 de octubre)

Ningún archivo de depósitos trae al promotor. El cruce sale del **reporte de antigüedad grupal** de Yunius
(`AntigüedadGrupal_DDMMAA.xlsm`, hoja `CARTERA`): una fila por grupo, con su ciclo actual, su promotor y su
gerente. Se cruza **por grupo**, no por grupo y ciclo, porque el reporte solo trae el ciclo actual.

| Quién | Qué ve | Cómo entra |
|---|---|---|
| Admin, bandera `acceso_auditor` o `acceso_auditor_carga` | Toda la cartera, con filtro por promotor | Bandera |
| Gerente del reporte | Los grupos de sus promotores | Sin bandera: su correo está asignado a su nombre |
| Promotor del reporte | Solo sus grupos | Sin bandera: su correo está asignado a su nombre |

Quien no ve todo **no puede leer las tablas** (la RLS solo deja a quien tiene bandera): lee únicamente por
`aud_conciliacion`, que filtra adentro. Si escribes una consulta nueva para promotores, se envuelve igual.

### `aud_ant_cargas` — cada reporte de antigüedad que se sube

La vigente es la de mayor `secuencia`. Columnas: `nombre_archivo`, `fecha_corte` (del título de la hoja),
`grupos`, `avisos`, `subido_por`, `created_at`.

### `aud_ant_grupos` — un grupo por fila

| Columna | Tipo | Del reporte |
|---|---|---|
| `carga_id` | uuid | La carga a la que pertenece |
| `grupo_id` | text | `ID de grupo`, 6 dígitos con ceros |
| `nombre_grupo`, `ciclo`, `estatus` | text | `Nombre de grupo`, `Ciclo` (el actual), `Estatus` |
| `promotor`, `gerente` | text | `Nombre promotor`, `Nombre del gerente` (Yunius corta este a 30 letras) |
| `promotor_clave`, `gerente_clave` | text | `aud_clave(nombre)`: las palabras sin acentos ni signos, en orden alfabético |

### `aud_personas` — de qué cuenta es cada nombre del reporte

`clave` → `email`. Al cargar el reporte la base la busca sola: mismo nombre (sin importar orden, acentos ni
puntos) en perfiles, presets de alta y la base de Vacaciones; si el nombre viene cortado, basta con el
principio de la última palabra. `origen` = `auto` o `manual`. Lo que se asigna a mano en `/auditor/cargar`
no se pierde con la carga siguiente.

```sql
-- Lo pendiente por promotor, con la antigüedad vigente
with ant as (select * from aud_ant_grupos where carga_id = (select id from aud_ant_cargas order by secuencia desc limit 1))
select ant.promotor, count(*) as depositos, sum(d.monto) as monto
from aud_depositos d
join ant using (grupo_id)
where d.carga_id = (select id from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1)
  and not d.conciliado
group by ant.promotor
order by monto desc;
```

**Lo que sigue:** asignar el correo a los promotores que no tienen (en la carga del 12 de octubre: 5, todos
de ingreso reciente) y que cada promotor entre una vez con su correo de CrediFlexi.
