/**
 * Knowledge base para el Asistente CrediFlexi (demo).
 * 
 * Dos dominios principales:
 * - empresa: conocimiento de CrediFlexi, cartera, reportes de antigüedad, legacy.
 * - plataforma: cómo usar mea-tickets (tickets, score, cartera, roles, flujos).
 * 
 * Cada chunk tiene id, dominio, título y contenido.
 * El retriever simple hace matching por palabras clave + score.
 */

export type KnowledgeChunk = {
  id: string
  dominio: 'empresa' | 'plataforma'
  titulo: string
  contenido: string
  keywords: string[] // para retrieval simple
}

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  // ==================== EMPRESA / DOMINIO ====================
  {
    id: 'empresa-legacy-reporte',
    dominio: 'empresa',
    titulo: 'Reporte de Antigüedad Individual (Legacy)',
    contenido: `El sistema legacy (automatizador-crediflexi, Flask local) genera el "Reporte de Antigüedad Individual" en Excel. Es el output operativo actual que se distribuye por correo. Contiene 10-12 hojas: R_Completo o hoja con fecha del corte (ej. 27052026), hojas de meses anteriores (Marzo2026, Abril2026), X_Coordinación y X_Recuperador (pivots para distribuir trabajo), RECUPERADOR_000124 (casos especiales), Mora (con columnas adicionales de Seguimiento Call Center en verde y Gestión de Cobranza en Campo en azul), Cuentas con saldo vencido, y Liquidación anticipada (con calculadora VLOOKUP).`,
    keywords: ['legacy', 'excel', 'reporte', 'antiguedad', 'individual', 'hojas', 'mora', 'coordinacion']
  },
  {
    id: 'empresa-par-buckets',
    dominio: 'empresa',
    titulo: 'Buckets PAR y clasificación de mora',
    contenido: `PAR (Portfolio at Risk) se calcula en la función asignar_rango_mora del legacy (reportes.py:213). Los buckets son: '0' (sin mora), '7' (1-7 días), '15', '30', '60', '90', 'Mayor_90' (91-180), 'Mayor_180'. Estos cortes están alineados con periodicidad de pagos (semanal=7, quincenal=15, mensual=30, etc.). % PAR>30 y % PAR>90 son métricas clave de riesgo que aparecen en todos los dashboards nuevos.`,
    keywords: ['par', 'mora', 'bucket', 'riesgo', 'mayor_90', 'antiguedad']
  },
  {
    id: 'empresa-columnas-derivadas',
    dominio: 'empresa',
    titulo: 'Columnas derivadas importantes (calculadas)',
    contenido: `Además de los campos crudos del Yunius, el procesamiento (legacy y ahora el microservicio) calcula: Concepto Depósito (1 + código_acreditado 6 dígitos + ciclo 2 dígitos), Saldo riesgo capital y total (solo si días de mora > 0), % MORA (saldo_vencido / saldo_total), Días desde el último pago + Alerta (1 si excede el plazo según periodicidad), Cuotas sin pagar, Saldo_Riesgo_total (definición nueva: saldo total si mora > 30), Combinado. Estas columnas son críticas para los dashboards de riesgo y cobranza.`,
    keywords: ['concepto deposito', 'saldo riesgo', 'alerta', 'cuotas sin pagar', 'combinado', 'derivadas']
  },
  {
    id: 'empresa-flujo-actual',
    dominio: 'empresa',
    titulo: 'Flujo de datos de Cartera (nuevo vs legacy)',
    contenido: `Antes: Yunius exporta Excel → operador lo sube al legacy Flask → se genera Excel reformateado de 12 hojas → se envía por correo. Ahora (en construcción): Yunius → upload en /cartera/cargar (a Supabase Storage) → botón Procesar llama al microservicio crediflexi-services (FastAPI) → ETL (replica lógica legacy) → insert en stg_yunius_cartera_individual + actualiza estado del upload → los RPCs de agregación alimentan los dashboards en tiempo real. El legacy sigue funcionando en paralelo como "intocable" y referencia de negocio.`,
    keywords: ['flujo', 'microservicio', 'etl', 'supabase', 'crediflexi-services', 'yunius']
  },
  {
    id: 'empresa-hoja-mora',
    dominio: 'empresa',
    titulo: 'Hoja "Mora" y seguimiento operativo',
    contenido: `En el Excel legacy, la hoja Mora filtra registros con Días de mora >=1. Tiene dos bloques de columnas adicionales (no vienen del input): "Seguimiento Call Center" (4 columnas con fondo verde) y "Gestión de Cobranza en Campo" (5 columnas con fondo azul). En los dashboards nuevos (/cartera/mora) esto se replica como "Bandeja de mora" con datos reales de los morosos. Actualmente las columnas de seguimiento están mockeadas en UI (modo demostración). La persistencia real vendrá en una tabla cartera_seguimiento.`,
    keywords: ['mora', 'cobranza', 'call center', 'campo', 'seguimiento', 'bandeja']
  },

  // ==================== PLATAFORMA / USO ====================
  {
    id: 'plataforma-modulos',
    dominio: 'plataforma',
    titulo: 'Módulos principales de mea-tickets',
    contenido: `La plataforma tiene 4 módulos principales: 1) Mesa de Tickets (incidencias internas: crear, asignar, responder en hilo, rechazar con motivo, cerrar). 2) Score Crediticio (CRUD de acreditados + referencias, modelo HM replicado, evaluación A/B/C/D de promotores). 3) Cartera Individual (carga de reportes Yunius, ETL vía microservicio, dashboards de riesgo: resumen ejecutivo, por coordinación, por recuperador, bandeja de mora operativa, cohortes). 4) Admin (catálogo, áreas, usuarios, accesos por módulo, métricas).`,
    keywords: ['modulos', 'tickets', 'score', 'cartera', 'admin', 'plataforma']
  },
  {
    id: 'plataforma-cartera-cargar',
    dominio: 'plataforma',
    titulo: 'Cómo cargar un reporte de Cartera',
    contenido: `Ve a /cartera/cargar. Arrastra o selecciona el Excel de Yunius (el mismo que usabas en el legacy). El archivo se sube a Supabase Storage (bucket 'cartera'). Luego presiona "Procesar". Esto crea un registro en cartera_uploads (estado pendiente) y llama POST /api/cartera/procesar que a su vez llama al microservicio en PYTHON_SERVICE_URL. El microservicio descarga el archivo, hace el ETL completo y lo inserta en stg_yunius_cartera_individual. El estado del upload cambia a 'procesado'. Luego puedes ver los datos en los dashboards. Si algo falla, revisa el estado en /cartera o pregunta en tickets.`,
    keywords: ['cargar', 'upload', 'procesar', 'storage', 'microservicio', '/cartera/cargar']
  },
  {
    id: 'plataforma-dashboards-cartera',
    dominio: 'plataforma',
    titulo: 'Dashboards de Cartera y qué muestran',
    contenido: `/cartera (principal): snapshot ejecutivo con totales (créditos, cartera, mora), distribución PAR en 8 buckets, indicadores %PAR>30 y >90, filtros por fecha_corte, coordinación, recuperador, ciclo. /cartera/coordinacion: tabla de riesgo por coordinación + heatmap de buckets. /cartera/recuperador: similar pero por recuperador (con filtro opcional de coordinación). /cartera/mora: bandeja operativa con los morosos (equivalente a la hoja Mora del legacy), con filtros y búsqueda. /cartera/cohort: comparativa de dos cohortes según fecha de inicio de ciclo (equivalente a las hojas de mes del legacy). Todo viene de RPCs (cartera_resumen, cartera_por_coordinacion, etc.).`,
    keywords: ['dashboard', 'cartera', 'coordinacion', 'recuperador', 'mora', 'cohort', 'par']
  },
  {
    id: 'plataforma-roles-accesos',
    dominio: 'plataforma',
    titulo: 'Roles y accesos (perfiles)',
    contenido: `Los perfiles tienen rol (admin, responsable, etc.) y flags booleanos: acceso_score, acceso_cartera. Si solo tienes acceso_score eres "operador Score" y el sidebar oculta tickets. El flag acceso_cartera (o ser admin) te da acceso a todo el módulo Cartera. En admin/cartera se gestionan los accesos por usuario. Los RPCs de cartera verifican que el usuario sea admin o tenga acceso_cartera (usando security definer + check).`,
    keywords: ['roles', 'acceso_cartera', 'acceso_score', 'perfil', 'admin', 'sidebar']
  },
  {
    id: 'plataforma-tickets-como-usar',
    dominio: 'plataforma',
    titulo: 'Cómo y cuándo levantar tickets',
    contenido: `Usa la Mesa de Tickets para cualquier incidencia interna (problemas con un acreditado, dudas operativas, fallas en carga de cartera, etc.). Como levantador: "Mis tickets". Como responsable: "Asignados a mí". El catálogo es dinámico (admin puede agregar campos). Al rechazar se requiere motivo de al menos 10 caracteres. Los adjuntos se suben a Storage y quedan asociados a la respuesta. Si tu duda es sobre Cartera, crea un ticket con el área correspondiente y adjunta captura del dashboard o el Excel problemático.`,
    keywords: ['tickets', 'levantar', 'incidencia', 'catalogo', 'rechazar', 'adjuntos']
  },
  {
    id: 'plataforma-chat-ia-proposito',
    dominio: 'plataforma',
    titulo: 'Propósito del Chat IA / Asistente',
    contenido: `Este chat (el que estás usando ahora) es la primera versión del asistente interno de CrediFlexi. Sirve para resolver dudas sobre la empresa (qué significa PAR, cómo se ve en el reporte viejo, etc.) y sobre el uso correcto de la plataforma (flujos, dónde encontrar cada cosa, qué tickets levantar para qué). En el futuro será un agente con tools que podrá consultar datos en vivo de tu cartera, sugerir acciones, y ayudar a crear tickets pre-llenados. Por ahora es conocimiento embebido de alta calidad basado en los RESEARCH, PLAN y el código del legacy.`,
    keywords: ['chat', 'asistente', 'ia', 'agente', 'demo', 'futuro']
  },
  {
    id: 'plataforma-legacy-vs-nuevo',
    dominio: 'plataforma',
    titulo: 'Legacy Excel vs nueva plataforma (diferencias clave)',
    contenido: `Legacy: Excel estático, 12 hojas, se genera una vez y se manda por correo, difícil de filtrar o cruzar cortes. Nueva plataforma: datos en Supabase, dashboards interactivos con filtros (fecha, coord, recuperador), agregaciones vía RPC (equivalentes a los pivots del legacy pero dinámicos), posibilidad de multi-corte (cohort), en el futuro drill-down a amortizaciones y persistencia real de notas de cobranza (superando las columnas mock del Excel). El objetivo es paridad funcional + mucho más usabilidad. El legacy queda como referencia y backup.`,
    keywords: ['legacy', 'excel', 'vs', 'plataforma', 'dashboards', 'paridad']
  },
  {
    id: 'plataforma-estado-demo-actual',
    dominio: 'plataforma',
    titulo: 'Estado actual de Cartera para la demo (junio 2026)',
    contenido: `Para la demo: los dashboards principales ya están listos (resumen ejecutivo con PAR buckets, por coordinación con heatmap, por recuperador, bandeja de mora con 120+ morosos reales, y cohortes comparativas). El flujo completo de carga → microservicio → Supabase → vistas funciona. Las columnas de seguimiento (estatus llamada, acuerdos) en la bandeja de mora están en "modo demostración" (solo local, no persistidas aún). Este Chat IA es la primera entrega del asistente (PRO-004).`,
    keywords: ['demo', 'junio 2026', 'dashboards listos', 'mora demostracion', 'chat ia', 'estado']
  }
]

/**
 * Retrieval simple por overlap de palabras clave + dominio.
 * Para demo es suficiente y 100% determinístico (sin LLM externo).
 */
export function retrieveRelevant(query: string, maxResults = 4): KnowledgeChunk[] {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)

  const scored = KNOWLEDGE_BASE.map(chunk => {
    let score = 0
    const contentLower = (chunk.titulo + ' ' + chunk.contenido).toLowerCase()

    // Match en keywords explícitas (fuerte)
    for (const kw of chunk.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3
    }

    // Match por palabras de la query en el contenido
    for (const w of words) {
      if (contentLower.includes(w)) score += 1
    }

    // Bonus si el dominio parece coincidir con la query
    if (q.includes('empresa') || q.includes('cartera') || q.includes('par') || q.includes('mora') || q.includes('legacy') || q.includes('excel')) {
      if (chunk.dominio === 'empresa') score += 1
    }
    if (q.includes('plataforma') || q.includes('usar') || q.includes('cómo') || q.includes('dónde') || q.includes('ticket') || q.includes('cargar') || q.includes('dashboard')) {
      if (chunk.dominio === 'plataforma') score += 1
    }

    return { chunk, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.chunk)
}

/**
 * Genera una respuesta "inteligente" para la demo.
 * Combina los chunks relevantes + guidance accionable.
 * En producción esto lo haría un LLM con el contexto inyectado (RAG).
 */
export function generateDemoResponse(question: string, relevant: KnowledgeChunk[]): {
  answer: string
  sources: string[]
} {
  const q = question.toLowerCase()

  // Respuestas de alta calidad para casos comunes (se ven excelentes en demo)
  if (q.includes('par') || q.includes('bucket') || q.includes('mora')) {
    const chunk = relevant.find(c => c.id === 'empresa-par-buckets') || relevant[0]
    return {
      answer: `Los buckets de PAR (Portfolio at Risk) que usamos en CrediFlexi son: 0 (sin mora), 7, 15, 30, 60, 90, Mayor_90 (91-180 días) y Mayor_180. Estos cortes están pensados para alinear con las periodicidades de pago de los créditos (semanal, quincenal, mensual, etc.) y con las políticas de provisiones y riesgo.\n\nEn los dashboards nuevos de Cartera verás siempre % PAR>30 y % PAR>90 como indicadores principales (son los que más importan para el riesgo de la cartera).\n\nEsto viene directamente de la lógica del legacy (ver función asignar_rango_mora en el código antiguo) y la estamos replicando en el ETL del microservicio y en los RPCs de agregación.`,
      sources: [chunk?.titulo || 'Buckets PAR']
    }
  }

  if (q.includes('cargar') || q.includes('subir') || q.includes('procesar') || q.includes('upload')) {
    return {
      answer: `Para cargar un nuevo corte de cartera:\n\n1. Ve a /cartera/cargar\n2. Arrastra o selecciona el Excel que te exporta Yunius (el mismo formato que usabas antes).\n3. El archivo se guarda en Supabase Storage.\n4. Presiona "Procesar". Esto dispara el microservicio (crediflexi-services) que hace el ETL completo.\n5. Cuando termine, el estado del upload pasa a 'procesado' y los datos quedan disponibles en todos los dashboards.\n\nSi el procesamiento falla o ves menos columnas de las esperadas, avísanos (puede ser que estemos en proceso de completar el mapeo de las ~55 columnas).`,
      sources: ['Cómo cargar un reporte de Cartera', 'Flujo de datos de Cartera']
    }
  }

  if (q.includes('mora') && (q.includes('bandeja') || q.includes('operativa') || q.includes('cobranza'))) {
    return {
      answer: `La "Bandeja de mora" (/cartera/mora) es el equivalente moderno de la hoja "Mora" del Excel legacy.\n\nMuestra los créditos con días de mora >=1 (puedes filtrar por coordinación y días mínimos). Incluye datos del acreditado, recuperador, saldos vencidos, bucket de PAR, y columnas de contacto.\n\nEn el Excel viejo esta hoja tenía bloques extra de "Seguimiento Call Center" (fondo verde) y "Gestión de Cobranza en Campo" (fondo azul). En la plataforma actual esas columnas están en modo demostración (editables localmente pero no se guardan todavía). La siguiente iteración va a persistirlas en una tabla de seguimiento para que realmente superemos al Excel.`,
      sources: ['Hoja "Mora" y seguimiento operativo', 'Bandeja de mora']
    }
  }

  if (q.includes('ticket') || q.includes('incidencia') || q.includes('levantar')) {
    return {
      answer: `Usa la Mesa de Tickets para cualquier cosa operativa:\n- Problemas con un acreditado o promotor\n- Dudas o fallas al cargar cartera\n- Solicitudes de accesos o cambios en el catálogo\n\nComo levantador vas a "Mis tickets". Los responsables ven "Asignados a mí". Al crear el ticket puedes elegir del catálogo dinámico (lo administra el admin). Si rechazas un ticket, el motivo debe tener mínimo 10 caracteres.\n\nPara temas de Cartera, adjunta capturas de los dashboards o el Excel problemático. Eso ayuda mucho al responsable.`,
      sources: ['Cómo y cuándo levantar tickets', 'Módulos principales de mea-tickets']
    }
  }

  if (q.includes('chat') || q.includes('asistente') || q.includes('ia') || q.includes('agente')) {
    return {
      answer: `Este chat es la primera versión del Asistente CrediFlexi (PRO-004 en el plan).\n\nHoy resuelve dudas sobre la empresa (significado de PAR, columnas del reporte legacy, flujo de datos) y sobre el uso de la plataforma (dónde cargar, qué significan los dashboards, cómo levantar tickets, roles y accesos).\n\nEn el futuro será un agente con tools: podrá consultar datos en vivo de tu cartera (usando los mismos RPCs que los dashboards), sugerirte la creación de un ticket pre-llenado, explicarte anomalías comparando cortes, y recordarte flujos según tu rol (acceso_cartera, etc.).\n\nPor ahora es conocimiento de alta calidad embebido (basado en los RESEARCH, PLAN, análisis de input/output del legacy y el código actual).`,
      sources: ['Propósito del Chat IA / Asistente', 'Chat IA en cartera']
    }
  }

  if (q.includes('legacy') || q.includes('excel') || q.includes('viejo') || q.includes('antiguo')) {
    return {
      answer: `El legacy (automatizador-crediflexi) es el sistema actual en producción que genera los Excels detallados de Antigüedad Individual. Sigue siendo "intocable" mientras terminamos de parificar la funcionalidad en la plataforma.\n\nLo que hace muy bien: limpieza de datos, cálculo de todas las columnas derivadas (PAR, Concepto Depósito, Alerta, las 3 nuevas columnas de riesgo, etc.), generación de las 10+ hojas con estilos y pivots (X_Coordinación, X_Recuperador, Mora con las columnas de seguimiento, Liquidación anticipada, etc.).\n\nLa plataforma nueva busca darte lo mismo (y más) pero en web, filtrable, actualizable por corte, y sin tener que bajar y abrir Excels gigantes.`,
      sources: ['Reporte de Antigüedad Individual (Legacy)', 'Legacy Excel vs nueva plataforma']
    }
  }

  if (q.includes('demo') || q.includes('estado') || q.includes('listo') || q.includes('implementado')) {
    return {
      answer: `Estado para la demo actual:\n\n• Dashboards principales implementados: resumen ejecutivo, coordinación (con heatmap), recuperador, bandeja de mora (con datos reales de morosos), y cohortes.\n• Flujo de carga + microservicio + Supabase ya funciona end-to-end.\n• Columnas de seguimiento en la mora están en "modo demostración" (solo UI, no se guardan todavía).\n• Este Chat IA es la primera entrega del asistente (ver PRO-004 en el PLAN).\n• RPCs de agregación (cartera_resumen, cartera_por_coordinacion, cartera_mora_operativa, etc.) ya existen y alimentan todo.\n\nEl siguiente paso natural es persistir el seguimiento de cobranza y agregar drill-down a amortizaciones.`,
      sources: ['Estado actual de Cartera para la demo (junio 2026)', 'Dashboards de Cartera y qué muestran']
    }
  }

  // Respuesta general (buena pero genérica + usa los chunks relevantes)
  let answer = `Gracias por tu pregunta. Aquí va lo que sé al respecto:\n\n`

  let sources: string[] = []

  if (relevant.length > 0) {
    answer += relevant.map(c => `**${c.titulo}**\n${c.contenido.substring(0, 420)}...\n\n`).join('')
    sources = relevant.map(c => c.titulo)
  } else {
    answer += `No encontré chunks muy específicos para "${question}". Te recomiendo probar con términos como "PAR", "cargar cartera", "bandeja de mora", "tickets", "roles", "legacy" o "dashboards".\n\n`
    sources = ['Conocimiento general de la plataforma y operaciones de CrediFlexi']
  }

  answer += `Si tu duda es más específica sobre un acreditado o un corte en particular, en el futuro el asistente podrá consultar los datos en vivo de Supabase directamente.\n\n¿Quieres que te explique algo más concreto (por ejemplo cómo se ve esto en el Excel viejo, o el paso a paso exacto en la plataforma)?`

  return { answer, sources }
}
