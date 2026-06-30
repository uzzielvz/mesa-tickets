# Módulo Reclutamiento — docs

Módulo en planeación (4º del repo, mismo Next.js + Supabase). Automatiza el flujo de entrevistas del Gerente de RH para vacantes de **Gerente de Inversiones**.

La documentación de referencia vive en los documentos raíz del proyecto:

- **Contexto, stakeholders, flujo as-is, pain points, restricciones y conflictos con el codebase:** `RESEARCH-CONSOLIDADO.md §13`.
- **Plan de ejecución (modelo de datos refinado, arquitectura, integraciones, roadmap de sprints, fuera de MVP, decisiones y TODOs):** `PLAN.md §8`.

## Decisiones cerradas (resumen)

- **Alcance MVP = Opción A — full Google Workspace:** Gmail API (envío) + Calendar API (eventos con Meet links), OAuth de `reclutamiento@financieracrediflexi.com` conectado una sola vez en `/reclutamiento/admin/conectar-google`.
- **Roadmap:** S1 → S2 → S3 → **Sprint G (Google)** → S4 (agendamiento masivo) → S5 (evaluaciones) → S6 (vista de comité). Sprint G va antes del agendamiento porque éste no entrega valor sin Google conectado.
- **Cifrado `refresh_token`:** Supabase Vault si está disponible (validar al inicio del Sprint G); fallback `pgcrypto` con llave en `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- **Pipeline 1↔1** candidato ↔ vacante (N↔N a v2).
- **RLS MVP:** admin (Héctor) ve/escribe todo; nadie más entra a la app; entrevistadores solo por magic link a su sesión.

Esta carpeta alojará el material específico del módulo conforme avance (briefs de handoff, análisis de plantillas de correo, mapeo de fuentes de candidatos, etc.).
