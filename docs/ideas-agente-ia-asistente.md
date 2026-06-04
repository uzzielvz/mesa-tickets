# Lluvia de Ideas — Agente IA / Asistente CrediFlexi (Demo)

**Contexto**: Queremos un asistente conversacional dentro de la plataforma mea-tickets que sirva como:
- Experto en la **empresa** (CrediFlexi, operaciones de cartera, significado de los reportes de antigüedad, PAR, etc.).
- Experto en el **uso de la plataforma** (cómo levantar tickets, cómo usar Cartera, Score, qué dashboards hay, flujo de carga de reportes, roles y permisos, a quién preguntar para qué).

El usuario pidió una **pequeña demo** funcional para la demo actual (aunque sea solo chat con conocimiento estático). Futuro: agente real con tools, memoria, acciones, RAG sobre datos vivos de Supabase + docs.

---

## 1. Principios de Diseño (Pensamiento Profundo)

### 1.1 Doble Rol (no mezclar mal)
- **Modo Empresa / Dominio de Negocio**: Responde con autoridad sobre qué significa la cartera, cómo se ve en el legacy Excel (12 hojas, columnas derivadas como Concepto Depósito, Alerta, las 3 nuevas Cuotas sin pagar / Saldo_Riesgo_total / Combinado, buckets de PAR exactos, hojas X_Coordinación con pivots dobles, etc.), por qué importan ciertas métricas (% PAR>30 es crítico para riesgo, etc.).
- **Modo Plataforma / Operativo**: Guía de uso concreto de la UI. "Para ver la mora de un recuperador específico ve a /cartera/recuperador, filtra por coordinación si quieres. El dato viene del RPC cartera_por_recuperador que replica la lógica de agrupación del legacy pero en vivo."

El asistente debe **siempre** poder cambiar de rol fluidamente o detectar la intención ("estoy preguntando sobre el Excel viejo o sobre los dashboards nuevos?").

### 1.2 Grounding y Citas (crítico para confianza)
- Toda respuesta debe citar fuente implícita o explícita: "Según el RESEARCH-CONSOLIDADO §5.4 y el legacy en automatizador-crediflexi/app/reportes.py:213 (función asignar_rango_mora)..."
- O "Equivalente a la hoja 'Mora' del Reporte de Antigüedad Individual del sistema anterior."
- Esto genera confianza y educa al usuario sobre dónde está la verdad.

### 1.3 Actionable + Workflow Guidance
No solo "explica", sino "qué hacer ahora".
Ejemplos buenos:
- "Tu pregunta es sobre un acreditado con 529 días de mora. En el dashboard de /cartera/mora aparece como el top. Si necesitas seguimiento, por ahora las columnas de 'Estatus de llamada' y 'Acuerdo de pago' están en modo demostración (mock local). En la siguiente iteración se persistirán en una tabla cartera_seguimiento."
- "Para cargar el nuevo corte de hoy: ve a /cartera/cargar, arrastra el Excel de Yunius, dale a Procesar. El microservicio (crediflexi-services) hace el ETL y lo deja en stg_yunius_cartera_individual. Luego los dashboards se actualizan solos."

### 1.4 Futuro Agente (tool use + proactividad)
Ideas profundas para cuando sea un agente real (no solo chat RAG):

**Tools posibles** (function calling):
- getCarteraResumen(fecha_corte) — llama el RPC actual.
- getMoraOperativa(filtros) — trae lista de morosos.
- buscarEnDocumentacion( query ) — busca en todos los .md de docs/ + research legacy.
- sugerirTicket(tema) — genera borrador de ticket con los campos correctos del catálogo.
- explicarAnomalia( fecha, metrica ) — compara contra cortes anteriores (requiere más datos históricos).
- quienEsResponsable(modulo) — mira el catálogo o perfiles.

**Comportamientos agente**:
- Memoria de sesión: "Hace un momento preguntaste por Valle de Bravo. ¿Quieres ver también su evolución vs el corte anterior?"
- Proactivo después de una carga: "Detecté que procesaste el corte 2026-05-30. ¿Quieres que te resuma las diferencias vs 2026-04-30 en PAR>90 por recuperador?"
- Detección de intención de acción: "Parece que quieres ayuda para levantar un ticket sobre un problema de ETL fallido → te preparo el formulario con 'cartera' en el catálogo y lo asigno al área correspondiente."
- Rol-based: Si el usuario tiene acceso_cartera pero no es admin, filtra respuestas y sugerencias a "mi cartera" cuando sea posible (cuando tengamos el mapeo profile → codigo_recuperador).

### 1.5 Alcance para esta pequeña demo (MVP realista)
- Solo chat (sin tools reales aún).
- Conocimiento embebido (no RAG vectorial pesado).
- Dos dominios claros: Empresa + Plataforma.
- Respuestas de alta calidad, con citas y sugerencias de próximos pasos.
- UI linda y consistente con el resto de la app (usa el mismo estilo de componentes).
- Sugerencias rápidas (chips) para los flujos más comunes.
- Banner "Demo con conocimiento embebido. En producción usaría LLM + RAG sobre Supabase + todos los docs + tools para consultar datos en vivo."

---

## 2. Lluvia de Ideas Concretas (Brainstorm Profundo)

### Ideas de Contenido / KB

**Empresa / Dominio (basado en legacy + research):**
- Explicar qué es el "Reporte de Antigüedad Individual" y por qué se llama así (antigüedad de la cartera = días de mora + buckets PAR).
- Significado exacto de cada bucket (0, 7, 15, 30, 60, 90, Mayor_90, Mayor_180) y por qué se usan esos cortes (semanal/quincenal/mensual + provisiones/regulatorio).
- Las columnas derivadas importantes que el legacy calcula y que el nuevo ETL debe preservar:
  - PAR (asignar_rango_mora)
  - Concepto Depósito (1 + código 6 dígitos + ciclo 2)
  - Saldo riesgo capital / total (if mora > 0)
  - % MORA
  - Días desde último pago + Alerta (según periodicidad)
  - Cuotas sin pagar, Saldo_Riesgo_total (nueva def >30), Combinado
- Hojas clave del Excel legacy y su propósito operativo:
  - Hoja de fecha (31032026): snapshot del corte.
  - X_Coordinación y X_Recuperador: pivots para distribuir trabajo.
  - Mora: con columnas extra de Call Center (verde) y Campo (azul) para seguimiento.
  - Cuentas con saldo vencido: casos especiales (mora <=0 pero saldo vencido).
  - Liquidación anticipada: calculadora con VLOOKUPs.
- Origen de los datos: Yunius (core bancario) → export → procesamiento (antes legacy Flask, ahora microservicio) → antes Excel por correo, ahora dashboards + Supabase.

**Plataforma / Uso (basado en RESEARCH + PLAN + código actual):**
- Flujo completo de Cartera: Cargar (Storage) → Procesar (llama crediflexi-services) → ETL a stg_... → RPCs de agregación → Dashboards (resumen, coord, recuperador, mora, cohort).
- Cada dashboard qué muestra y para qué sirve (ej. /cartera/mora es la "bandeja operativa" equivalente a la hoja Mora del Excel, pero filtrable y con datos reales).
- Roles y accesos: acceso_cartera flag en profiles, admin ve todo, soloScore oculta tickets, etc.
- Cómo levantar tickets útiles para Cartera: qué catálogo elegir, a qué área/responsable, adjuntar el Excel o captura de dashboard.
- Diferencias legacy vs nuevo: Legacy = Excel estático por correo. Nuevo = datos en Supabase + filtros + agregaciones + multi-corte (cohort) + en el futuro drill-down a amortizaciones + persistencia de notas de cobranza.
- Problemas comunes y cómo resolverlos en la plataforma: "El ETL solo insertó 20 columnas" → ya se está cerrando con CART-001. "No veo mis datos" → verifica fecha_corte y que el upload quedó en estado 'procesado'.
- Quién preguntar: Para Cartera → operadores con acceso_cartera + admin/cartera en /admin/cartera. Para el microservicio → equipo de ops (ver handoff docs).

### Ideas de UX / Interacción

- **Chips de inicio** organizados en dos columnas o tabs: "Sobre la empresa / Cartera" y "Cómo usar la plataforma".
- **Citar fuentes** debajo de cada respuesta del asistente (links internos si posible, o nombres de documentos).
- **Acciones sugeridas** después de respuestas: botones que navegan ("Ir a Bandeja de mora") o que pre-cargan un ticket.
- **Contexto del usuario**: Pasar el profile al chat (rol, acceso_cartera, area) para personalizar ("Como tienes acceso_cartera, puedes ver...").
- **Modo "Explicar como en el Excel"**: Botón que re-responde la misma pregunta pero "traduciendo" a términos del legacy (hojas, columnas específicas).
- **Historial por sesión** + opción de "Limpiar".
- **Búsqueda en el chat** o "preguntas relacionadas".
- **"Preguntar sobre este dashboard"**: Desde cualquier página de cartera (ej. /cartera/mora), un floating button "Pregúntale al asistente sobre esta vista" que inyecta contexto ("El usuario está viendo la bandeja de mora con 120 registros...").

### Ideas Técnicas / Arquitectura para la Demo y Futuro

**Para la pequeña demo actual**:
- Knowledge base estática en `lib/ai/knowledge.ts` (TS objects con secciones + chunks).
- Retriever simple (keyword overlap + boost por dominio).
- Responder: función determinística que elige el mejor template + inyecta excerpts relevantes + agrega guidance.
- UI: usa `useChat` de @ai-sdk/react aunque el "transport" sea un custom fetch a nuestra route que no usa LLM todavía.
- Persistencia: opcional guardar conversaciones en una tabla `assistant_conversations` (para futuro fine-tuning o revisión).

**Evolución a Agente real**:
- Usar Vercel AI SDK + provider (OpenAI, Anthropic, o Grok/xAI si exponen compatible).
- System prompt dinámico que incluye:
  - Rol + principios.
  - Resumen del estado actual del usuario (rol + accesos).
  - Inyección de los chunks recuperados (RAG).
- Tools reales (con `tool` de AI SDK):
  - `queryCartera` (llama RPCs vía server action o fetch interno).
  - `crearBorradorTicket`.
  - `buscarDocumentacion`.
- Almacenar embeddings de todos los .md en una tabla o usar Supabase pgvector cuando crezca.
- Logging de preguntas para mejorar el KB (las dudas reales de los usuarios son oro).
- Guardrails: no inventar números de cartera en vivo si no los consulta via tool; siempre "Según los datos al corte X...".

### Otras Ideas Avanzadas

- **Multi-agente interno** (inspirado en el COORDINATOR-PROMPT que ya existe para desarrollo): un "Agente Cartera" + "Agente Tickets" + "Agente Score" que se coordinan.
- Integración con el hilo de tickets: "Convierte esta conversación en un ticket" (crea el ticket + adjunta el transcript).
- Voice? (overkill para ahora).
- "Modo experto legacy": el asistente puede describir exactamente cómo se vería la misma info en el Excel viejo (columnas, hojas).
- Dashboard "Preguntas frecuentes de Cartera" generado automáticamente desde las interacciones reales.

---

## 3. Recomendación para esta iteración (pequeña demo)

Implementar:
1. Página `/cartera/chat` con UI de chat profesional.
2. Knowledge base curada con ~15-20 chunks buenos (mezcla empresa + plataforma).
3. Lógica de respuesta que siempre cite + sea accionable + ofrezca 2-3 sugerencias.
4. 8-10 chips de sugerencias iniciales bien pensados.
5. Banner claro de "Demo".
6. Opcional: un archivo `lib/ai/demo-responses.ts` con respuestas de muy alta calidad para las preguntas más probables en la demo (para que se vea excelente aunque la retrieval falle).

Esto da una impresión muy fuerte de "ya tenemos el asistente funcionando" sin requerir LLM key ni infraestructura extra para la demo.

Luego, en la siguiente fase real, se cablea el LLM + tools.

---

**Próximos archivos a crear/editar** (plan de ejecución):
- `docs/ideas-agente-ia-asistente.md` (este)
- `lib/ai/knowledge-base.ts`
- `app/api/ai/assistant/route.ts` (o server action)
- `app/(dashboard)/cartera/chat/page.tsx`
- `components/cartera/assistant-chat.tsx` (reusable)
- Posible pequeño update en sidebar si hace falta (ya tiene el link).

Listo para implementar la demo.