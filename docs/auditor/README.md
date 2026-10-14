# Auditor de depósitos

Compara los depósitos del banco que siguen **sin conciliar** contra lo que registraron los promotores en
Yunius. Dice qué falta en cada grupo, ciclo y día; cada promotor ve solo lo suyo; y a cada carga le avisa a
cada promotor y a cada gerente lo que le falta.

Pedido de Charly (junta del 18 de septiembre), rediseñado con Felix (AUD-003, 8 de octubre). La vista por
promotor (AUD-004) y los avisos (AUD-005) son del 13 de octubre. Las tablas y la forma de escribir consultas
están en [`esquema-para-charly.md`](./esquema-para-charly.md).

## Quién ve qué

| Quién | Qué ve | Cómo entra |
|---|---|---|
| Admin, o bandera **V** (`acceso_auditor`) | Toda la cartera, con filtro por promotor | Bandera en `/admin/usuarios` |
| Bandera **C** (`acceso_auditor_carga`) | Todo, y además carga los archivos y asigna cuentas | Bandera en `/admin/usuarios` |
| Gerente | Los grupos de sus promotores | **Sin bandera.** Basta con que su correo esté asignado a su nombre en el reporte de antigüedad |
| Promotor | Solo sus grupos | **Sin bandera.** Igual que el gerente |

Promotores y gerentes entran con su correo de CrediFlexi (Google o enlace al correo). Al entrar ven en el
inicio cuántos depósitos tienen sin conciliar. Quien no ve todo **no puede leer las tablas**: solo recibe lo
suyo por la función `aud_conciliacion`, que filtra adentro.

## Los tres archivos

Todos salen de Yunius y se suben en **`/auditor/cargar`**. Cada carga es una foto completa que reemplaza a
la anterior; las anteriores quedan en el historial.

| # | Archivo | Qué aporta | Cada cuándo |
|---|---|---|---|
| 1 | Depósitos del banco: `Grup_Depósito_Garantía … .xlsx` | **La base.** Lo que dice "No Conciliado" es lo pendiente | Cada que Felix lo manda |
| 2 | Pagos registrados: `pagos_registrados_MMAAAA.xlsx` | Lo que registró el promotor, para comparar | Junto con el de depósitos |
| 3 | Antigüedad grupal: `AntigüedadGrupal_DDMMAA.xlsm` | De quién es cada grupo (promotor y gerente) | Cuando cambien los grupos o los promotores |

El de depósitos pesa ~5 MB y se lee **en el navegador**: no cierres la pestaña hasta que termine. Los pagos
registrados también se pueden subir desde Python con el paquete `crediflexi-cargas`.

**Orden recomendado:** depósitos y pagos registrados del mismo día, y después la antigüedad si cambió. Los
avisos salen solos en cuanto los dos primeros están al día (ver abajo).

## Cómo se decide el estado

Los depósitos "No Conciliado" se agrupan por **grupo, ciclo y fecha exacta del depósito** y se comparan con
todos los registros de esa misma llave:

| Estado | Cuándo | Quién actúa |
|---|---|---|
| Sin registro | Nadie registró ese depósito ese día | Promotor |
| Con diferencia | Los montos no cuadran ("Registró $X de más" / "Faltan $X por registrar") | Promotor |
| Debe ser un solo registro | Los montos cuadran, pero en varios registros | Promotor |
| Listo para conciliar | Montos iguales y un solo registro | Tesorería |

La fecha es exacta a propósito: un depósito del 2 de octubre registrado el 1 sale "Sin registro".

## Cuentas de promotores y gerentes

El reporte de antigüedad trae **nombres**, no correos. Al cargarlo, la plataforma busca sola la cuenta de
cada persona en perfiles, presets de alta y la base de Vacaciones:

- El nombre tiene que coincidir completo, sin importar el orden, los acentos ni los puntos.
- Si Yunius lo cortó a 30 letras, basta con el principio de la última palabra.
- Si hay dos candidatos, no adivina y lo deja para asignar a mano.

Las que no encuentra se asignan a mano en **`/auditor/cargar` → Promotores y gerentes**. Ahí mismo se sugiere
el candidato cuando la diferencia es un error de dedo ("Bentancourt" / "Betancourt"). Lo asignado a mano
**no se pierde** con la carga siguiente; "Volver a la búsqueda automática" lo deshace.

Las marcas en pantalla: **sin cuenta** (no tiene correo asignado, no puede entrar ni recibir avisos) y
**no ha entrado** (tiene correo, pero nunca ha abierto la plataforma).

## Avisos

Cada que se termina de cargar cualquiera de los tres archivos, la plataforma avisa a cada promotor de lo
suyo y a cada gerente de lo de su equipo. Los avisos llegan a la campana y, cuando hace falta, al correo.

**Interruptor (AUD-006).** Los avisos **arrancaron apagados** el 13 de octubre, para que no salieran correos
antes de presentar el Auditor. Mientras estén apagados, ninguna carga avisa a nadie y el acuse lo dice. Se
encienden arriba de `/auditor/cargar` con **"Encender y avisar ahora"**, que en ese momento avisa con lo que
haya pendiente. "Apagar" solo deja de avisar.

- **Qué dice:** "Tienes 3 depósitos sin conciliar ($6,435). Por corregir: 3 con diferencia de monto." Al
  gerente le llega además el desglose por promotor. El aviso lleva a `/auditor`.
- **Correo solo si tiene algo que hacer.** Si todo lo suyo está "Listo para conciliar", eso le toca a
  Tesorería: el aviso queda en la campana, sin correo.
- **No se repite.** Si lo pendiente de alguien es idéntico a su último aviso, no se le manda otro. Al llegar
  uno nuevo, el anterior se marca leído; a quien ya no tiene pendientes también.
- **No avisa con datos a medias.** Si los pagos registrados llegan hasta una fecha anterior al último
  depósito, todo lo reciente saldría "Sin registro" por falta del archivo. En ese caso no avisa, lo dice en
  el acuse, y avisa cuando se cargan los registros al día.
- **Sin cuenta, sin aviso.** El acuse dice a cuántos no se les pudo avisar.

El acuse de cada carga dice a cuántas personas se avisó, o por qué no. Los correos los manda el navegador de
quien cargó, justo después de la carga, con el remitente de la plataforma. Si alguno falla, lo reintenta el
cron diario (`/api/notificaciones/cron`), que necesita `CRON_SECRET` configurado en Vercel. Si los registros
se suben desde Python no hay navegador: el aviso llega a la campana al momento y el correo sale con ese cron.

## Pantallas

| Ruta | Para qué |
|---|---|
| `/auditor` | La conciliación. Quien ve todo tiene además el panel **Por promotor** (pendientes y quién no tiene cuenta) y el filtro por promotor |
| `/auditor/cargar` | Los tres archivos, su historial y las cuentas de promotores y gerentes. Solo bandera C o admin |
| `/dashboard` | La tarjeta "Depósitos sin conciliar" para promotores y gerentes |
| `/notificaciones` | Los avisos de cada quien |

## Para desarrolladores

| Pieza | Dónde |
|---|---|
| Migraciones | `supabase/migrations/*_aud_001` … `*_aud_006` |
| Estado de cada grupo, ciclo y día | `aud_estado_vigente()` (interna; la usan la pantalla y los avisos) |
| Pantalla | `aud_conciliacion(p_grupo, p_promotor)` y `aud_mi_papel()` |
| Cargas | `aud_dep_iniciar_carga` / `aud_dep_cargar_lote` / `aud_dep_cerrar_carga`, `aud_cargar`, `aud_ant_cargar` |
| Cuentas | `aud_personas`, `aud_buscar_correo`, `aud_asignar_correo`, `aud_personas_vigentes` |
| Avisos | `aud_avisar()` (revisa el interruptor `aud_ajustes`) → `aud_avisar_ahora()` sobre `ntf_crear` (NTF-001); el acuse los trae en `notificaciones`. Interruptor: `aud_avisos_encender(p_activos)` |
| Lectores de Excel | `lib/auditor/depositos.ts`, `lib/auditor/excel.ts`, `lib/auditor/antiguedad.ts` |
| Contrato de tipos | `lib/auditor/tipos.ts` |
| Componentes | `components/auditor/` |

Reglas del módulo:

- Las consultas nuevas se envuelven como funciones `security definer` que revisan permisos adentro. Nunca SQL
  suelto en la página.
- Si cambia una regla de `lib/auditor/excel.ts`, hay que cambiarla también en `crediflexi-cargas/auditor.py`.
- Antes de aplicar una migración se ensaya contra producción dentro de `begin … rollback`, con
  `npx --yes supabase@2.115.0 db query --linked -f <ruta absoluta>`, simulando la sesión con
  `request.jwt.claims`. Luego `npx --yes supabase@2.115.0 db push --linked --yes`.

## Pendiente

- Asignar el correo de los promotores que no tienen cuenta (en la carga del 12 de octubre: 5, de ingreso
  reciente).
- Que promotores y gerentes entren una primera vez. Al 13 de octubre no había entrado ninguno.
- `CRON_SECRET` en Vercel, para que el cron reintente los correos que fallen.
- La pregunta abierta a Felix sobre la fecha exacta (caso MS 000265).
