# Tracking de sesiones — mea-tickets

Sistema de seguimiento de trabajo por fecha. Modelo **híbrido**: el detalle vive en el repo, el índice resumen vive en el vault de Obsidian.

## Archivos

- **`sessions.md`** (este repo) — **detalle** por sesión, append-only, orden cronológico (viejo arriba → reciente abajo). Una entrada por día con actividad: commits, duración, hecho, avance vs PLAN.md, pendientes, bloqueos y notas.
- **`mea-tickets_INDEX.md`** (vault: `70_Trabajo\proyectos\`) — **resumen** agregado para que el agente del vault lo lea en `/today` y `/closeday`. Contiene Estado actual, Stack, Path del repo, Pendientes top 3 y una tabla de sesiones (más reciente arriba).

## Archivos vivos (NO los toca este sistema)

- **`PLAN.md`** — plan de trabajo activo por módulo. Single source of truth de qué se hizo y qué sigue.
- **`RESEARCH-CONSOLIDADO.md`** — contexto técnico consolidado del repo.

Este sistema solo **lee** PLAN.md / RESEARCH para redactar sesiones; nunca los modifica.

## Cómo cerrar una sesión (procedimiento estándar)

1. Leer los commits desde la última entrada de `sessions.md`:
   `git log --since="<fecha última entrada>" --date=format:"%Y-%m-%d %H:%M" --pretty=format:"%ad|%h|%s"`
2. **Append** una nueva entrada al final de `sessions.md` con el formato fijo (encabezado `## YYYY-MM-DD — Sesión [HH:MM-HH:MM]` + campos Commits / Duración / Hecho / Avance vs PLAN.md / Pendiente próxima sesión / Bloqueos / Notas para RESEARCH-CONSOLIDADO.md). Entradas concretas y cortas, sin narrativa. No inventar trabajo fuera de commits.
3. Actualizar el **INDEX** del vault:
   - Insertar la fila nueva **arriba** de la tabla de Sesiones.
   - Refrescar **Estado actual del proyecto** y **Pendientes activos (top 3)**.
   - Hacer **bump** de `Última actualización` a la fecha de hoy.
4. Verificar que la tabla del INDEX tenga el mismo número de filas que encabezados `##` de sesión en `sessions.md`.
