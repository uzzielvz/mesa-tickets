# Auditor de depósitos — esquema para escribir consultas

> Para Charly. Acordamos que tú escribes las consultas SQL y la plataforma pone la pantalla. Este documento
> dice qué tablas hay, qué significa cada columna y cómo se entrega una consulta para que se vuelva vista.
> Base: Postgres (Supabase). Fecha: 4 de octubre de 2026.

## Qué hay hoy

La plataforma ya recibe el archivo que manda Felix desde Yunius (`pagos_registrados_MMAAAA.xlsx`) y enseña la
lista de depósitos con `CONCILIADO = N`. Está en **/auditor** para quien tenga el permiso.

Con el archivo de septiembre: **1,090 depósitos, 45 sin conciliar por $333,651.39 en 44 grupos**.

## Tablas

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
