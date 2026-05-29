# Handoff OPS-001 — Deploy de `crediflexi-services` (Render + Docker)

> **Para el agente Implementador:** lee este documento **completo** antes de tocar código. Es el único brief autorizado para esta tarea.
>
> **Versión:** 1.0 (2026-05-28).

---

## 0. Roles

| Rol | Agente | Repo | Responsabilidad |
|---|---|---|---|
| **Coordinador** | Sesión Claude en `mea-tickets` | `mea-tickets` | Owner del plan. Valida entregables, actualiza brief y PLAN, responde dudas. |
| **Implementador** | Sesión Claude en `crediflexi-services` | `crediflexi-services` | Crea Dockerfile + render.yaml + CORS + /health. Sin tocar lógica de negocio. |
| **Postman** | Usuario humano | — | Crea cuenta Render, sube secrets al panel, hace el primer deploy desde panel/CLI, actualiza Vercel. |

> **Regla dura:** el Implementador **no** crea cuentas, **no** sube secrets, **no** dispara el deploy productivo. Solo prepara código + config + smoke test instructions. El primer deploy lo dispara el usuario tras revisar PR.

---

## 1. TL;DR

El microservicio Python (`crediflexi-services`) hoy solo corre en localhost. Para la demo ejecutiva en ~7 días necesitamos:
1. Deployarlo en **Render** (free tier inicial) con **Docker**.
2. Que Vercel pueda llamarlo desde producción.
3. Smoke test end-to-end (subir Excel real, ver datos en Supabase).

**Ticket:** OPS-001 (acelerado, antes de la demo).
**Decisión 2026-05-28:** plataforma = Render. Build = Docker (no nixpacks — más control y portabilidad si después migramos). Plan = Free; upgrade a Standard ($7/mes) solo si el cold start arruina UX post-aprobación.

**Bloquea:** demo ejecutiva.
**Bloqueado por:** CART-001 mergeado (no deployar bugs).

---

## 2. Repos involucrados

| Rol | Path local | Acción |
|---|---|---|
| **Trabajo principal** | `C:\Users\uzzie\Documents\Jale\crediflexi-services` | Cambios aquí. Branch + PR. |
| **Plataforma (referencia)** | `C:\Users\uzzie\Documents\mea-tickets` | Solo lectura. Brief y PLAN viven aquí. |

> Para que el Implementador trabaje sin clonar `mea-tickets`, los docs canónicos están en `crediflexi-services/docs/from-platform/`.

---

## 3. Lectura obligatoria (en este orden)

1. **`docs/from-platform/handoff/OPS-001-deploy-microservicio.md`** — este brief.
2. **`docs/from-platform/PLAN.md`** § Cartera-1 — contexto del módulo.
3. **`docs/from-platform/RESEARCH-CONSOLIDADO.md`** § OPS-001 — historia de la deuda operativa.
4. **`main.py` / `services/` actual** — entender qué arranca, qué endpoints existen.
5. **`requirements.txt`** — confirmar deps de runtime.

---

## 4. Cambios concretos (definición de hecho operativa)

### 4.1 `Dockerfile` en raíz del repo

Requisitos:
- Imagen base **Python 3.12-slim**.
- Instalar deps de sistema mínimas si pandas/openpyxl lo requieren (típicamente `gcc` para builds wheels nativos; intentar primero sin, agregar solo si falla).
- `pip install --no-cache-dir -r requirements.txt`.
- Copiar el código.
- Exponer puerto `$PORT` (Render inyecta esta env var; default 8000 si no existe).
- `CMD` con `uvicorn` apuntando a `main:app`, `--host 0.0.0.0 --port $PORT`.
- Multi-stage build **NO requerido** para esta iteración (simplicidad). Single stage está bien.
- `.dockerignore` con `.git`, `__pycache__`, `*.pyc`, `.venv`, `venv`, `.env*`, `docs/`, `tests/` (si existen), etc.

### 4.2 `render.yaml` declarativo en raíz del repo

Servicio único tipo `web`:
- `name: crediflexi-services`
- `env: docker`
- `plan: free`
- `dockerfilePath: ./Dockerfile`
- `healthCheckPath: /health`
- `region: oregon` (default — más cerca de Supabase US-East por latencia razonable; alternativa: `frankfurt` no aplica)
- `envVars`: declarar los nombres con `sync: false` (los valores los pone el usuario en el panel):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CORS_ALLOWED_ORIGINS` (lista CSV con dominios Vercel del usuario)
- `autoDeploy: true` (deploy automático al push a `master`).

### 4.3 Endpoint `/health` en FastAPI

Si no existe ya: agregar en `main.py`:

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

Debe responder 200 sin tocar Supabase (cold start no debe depender de la DB).

### 4.4 CORS middleware en FastAPI

En `main.py`, agregar `CORSMiddleware` con origins leídos de env var `CORS_ALLOWED_ORIGINS`:

```python
import os
from fastapi.middleware.cors import CORSMiddleware

cors_origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Si la variable está vacía, **no** agregar el middleware (evita exposición accidental en dev).

### 4.5 `README.md` del repo: sección "Deploy"

Agregar al README una sección con:
- Cómo correr en local (recordatorio).
- Cómo deployar en Render (link a panel + nota "los secrets se suben en panel, no en código").
- Cómo verificar `/health` post-deploy.
- Variables de entorno requeridas y por qué.

### 4.6 NO hacer en este ticket

- ❌ No agregar HMAC ni auth entre Next.js y microservicio (eso es SEC-002, post-aprobación).
- ❌ No tocar lógica de `services/cartera_etl.py` (ese repo se quedó como salió de CART-001).
- ❌ No crear cron de wake-up dentro del repo. El usuario lo agrega externamente (cron-job.org u otro) — solo documenta en README cómo configurarlo.
- ❌ No subir secrets al repo bajo NINGÚN concepto. `.gitignore` debe excluir `.env`.
- ❌ No tocar `mea-tickets`.
- ❌ No crear la cuenta Render ni hacer el deploy productivo. Solo PR con código + config + instrucciones para el usuario.

---

## 5. Criterios de aceptación (validables)

- [ ] `Dockerfile` existe, builda local (`docker build .` exitoso).
- [ ] `docker run -p 8000:8000 -e PORT=8000 <image>` levanta el microservicio.
- [ ] `curl http://localhost:8000/health` retorna 200.
- [ ] `render.yaml` válido (sintaxis correcta, todos los campos requeridos).
- [ ] `.dockerignore` excluye `.git`, `.env*`, `__pycache__`, etc.
- [ ] CORS middleware presente, configurado vía env var, ausente si var vacía.
- [ ] `/health` endpoint existe y no toca Supabase.
- [ ] README actualizado con sección Deploy.
- [ ] PR description completa con instrucciones paso a paso para el usuario (crear servicio en Render, subir secrets, primer deploy, verificación).

---

## 6. Convenciones del proyecto

- **Branch:** `ops-001-deploy-render` (mismo nombre por trazabilidad).
- **Commits atómicos**, en español, descriptivos.
- **Sin `Co-Authored-By: Claude`** ni firmas del agente en commits ni en PR description (regla del owner). Si la herramienta agrega firma automática al final del PR, **bórrala** antes de finalizar.
- **Comentarios en español, código (variables/funciones) en inglés.**
- Si una decisión técnica te bloquea, documéntala en `docs/from-platform/handoff/OPS-001-questions.md` y para.

---

## 7. Protocolo de comunicación (igual que CART-001)

### 7.1 PR description como bitácora viva

Plantilla:

```markdown
## OPS-001 — Deploy Render + Docker

Brief: docs/from-platform/handoff/OPS-001-deploy-microservicio.md (v1.0)

### Estado
- Iteración: 1
- Última actualización: YYYY-MM-DD HH:MM
- Bloqueado: NO / SÍ

### Checklist (§5 del brief)
- [ ] Dockerfile builda local
- [ ] docker run levanta el servicio
- [ ] /health retorna 200
- [ ] render.yaml válido
- [ ] .dockerignore correcto
- [ ] CORS middleware configurable
- [ ] /health no toca Supabase
- [ ] README sección Deploy
- [ ] PR description con instrucciones

### Pasos para el usuario (post-merge)
1. Crear cuenta Render → https://render.com
2. New → Blueprint → conectar repo crediflexi-services → master
3. Render detecta render.yaml → review → Apply
4. Settings → Environment → agregar:
   - SUPABASE_URL = (valor real)
   - SUPABASE_SERVICE_ROLE_KEY = (valor real)
   - CORS_ALLOWED_ORIGINS = https://tu-dominio.vercel.app
5. Trigger Deploy → esperar ~5 min
6. curl https://crediflexi-services.onrender.com/health → 200
7. Actualizar Vercel: PYTHON_SERVICE_URL = https://crediflexi-services.onrender.com → Redeploy
8. Smoke test desde UI: subir Excel chico → verificar en Supabase

### Bloqueadores / preguntas
(ninguno) — o lista con link a OPS-001-questions.md

### Smoke test
(no realizado — depende del usuario que haga el primer deploy)
```

### 7.2 Reporte estandarizado al Coordinador

Igual que §7.2 de CART-001, ajustando ID:

```
REPORT OPS-001
- Branch: ops-001-deploy-render
- Último commit: <hash> <mensaje corto>
- Checklist completada: N/9
- Bloqueado: NO/SÍ
- (si SÍ) Pregunta abierta: <link OPS-001-questions.md#qN>
- Siguiente paso planeado: ...
```

### 7.3 Preguntas abiertas

Si surgen, crear `docs/from-platform/handoff/OPS-001-questions.md` con la misma plantilla de CART-001.

---

## 8. Entregable final

- **1 PR en `crediflexi-services`** contra `master`, branch `ops-001-deploy-render`.
- PR description con checklist 100% marcada (excepto los items que son del usuario, claramente identificados).
- Instrucciones paso a paso para el usuario hacer el primer deploy.

---

## 9. Estado al momento del handoff

- **Crítico previo:** PR #1 (CART-001) **debe estar mergeado** antes de empezar OPS-001. Si no lo está, abre `OPS-001-questions.md` con la pregunta y para.
- `crediflexi-services` no tiene Dockerfile, render.yaml, ni `/health`. Verificar `git status` limpio antes de empezar.
- Plan = Render Free. Cold start ~30-60s después de 15min idle. El usuario mitigará con cron externo de wake-up.

---

## 10. Changelog

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 2026-05-28 | Coordinador | Brief inicial post-decisión Render + Docker + demo en 7 días. |

**Fin del brief.**
