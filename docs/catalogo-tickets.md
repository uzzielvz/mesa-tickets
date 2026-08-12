# Catálogo de problemas — Mesa de Ayuda

> Trazabilidad de todos los tipos de ticket que se pueden levantar hoy, con su
> configuración completa. Corte al **2026-08-11**.
>
> **Origen de los datos:** las filas marcadas 🟢 están verificadas contra las
> migraciones del repo. Las marcadas 🟡 se dieron de alta desde `/admin/catalogo`
> y no viven en código, así que su configuración fina (campos dinámicos, textos)
> hay que confirmarla en la pantalla de administración.
>
> Todo lo de aquí es **editable sin desplegar** desde `/admin/catalogo`.

---

## 1. Resumen — los 11 tipos

| # | Tipo de problema | Área | Prioridad | SLA | Modalidad | Flujo | Evidencia |
|---|---|---|---|---|---|---|---|
| 1 | 🟢 Cámaras y alarmas | Sistemas | **Alta** | 60 min | Presencial | Directo · cierra solo | Opcional |
| 2 | 🟢 Problemas de red | Sistemas | **Alta** | 30 min | Ambas | Directo | Opcional |
| 3 | 🟢 Soporte a equipo de cómputo | Sistemas | Media | 30 min | Ambas | Directo | Opcional |
| 4 | 🟢 Impresoras y escáneres | Sistemas | Media | 30 min | Ambas | Directo | Opcional |
| 5 | 🟢 Usuarios y accesos | Sistemas | Media | **20 min** | Remoto | Directo | Opcional |
| 6 | 🟢 Solicitud de servicio de TI | Sistemas | Baja | Variable | Ambas | Con pausa: *Programado* | Opcional |
| 7 | 🟢 Ficha no reflejada (grupal/comercial) | Tesorería | Media | Variable | Ambas | Con pausa: *Siguiente corte* | **Obligatoria** |
| 8 | 🟢 Crédito faltante | Tesorería | Media | Variable | Ambas | Con pausa: *Siguiente corte* | **Obligatoria** |
| 9 | 🟢 Error en mora | Data Science | **Alta** | 4 horas | Ambas | Con pausa: *Siguiente corte* | Opcional |
| 10 | 🟡 Aclaración de mora | Data Science | **Alta** | 4 horas | Ambas | Con pausa: *Esperando al usuario* | Por confirmar |
| 11 | 🟡 Falla en el sistema | Call Center | Media | Variable | Ambas | Con pausa: *Esperando al usuario* | Por confirmar |

**Lectura rápida:** 5 de los 6 tipos de Sistemas son de **dos clics** (tomar → resolver). Los de Tesorería y Data Science llevan pausa porque su corrección entra en un corte, no se aplica al momento.

---

## 2. Ficha por tipo

### 1. Cámaras y alarmas 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Alta · 60 min · **Presencial** |
| **Pausa** | ninguna |
| **Cierre** | **Directo** — al resolver se cierra sin pedir confirmación (es presencial) |
| **Instrucciones al usuario** | Fallas en el sistema de CCTV y seguridad (Hikvision), cámaras o alarmas. Indica dónde está el equipo: la atención es presencial. Prioridad alta. |

**Campos que se piden**
| Campo | Tipo | Obligatorio | Opciones / pista |
|---|---|---|---|
| ¿Qué falla? | select | Sí | Hikvision (DVR/NVR) · Cámara · Alarma |
| Ubicación del equipo | texto | **Sí** | Sucursal / punto donde está la cámara o alarma |

---

### 2. Problemas de red 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Alta · 30 min · Ambas |
| **Pausa** | ninguna |
| **Instrucciones** | Fallas de conectividad: internet, WiFi, carpetas compartidas, servidor o recursos de red. Elige el tipo de falla y describe desde cuándo y a quién afecta. |

**Campos**
| Campo | Tipo | Obligatorio | Opciones / pista |
|---|---|---|---|
| ¿Qué falla? | select | Sí | Internet · WiFi · Carpetas compartidas · Servidor · Recursos de red |
| Ubicación (si requiere visita) | texto | No | Sucursal / piso / área afectada |

---

### 3. Soporte a equipo de cómputo 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Media · 30 min · Ambas |
| **Pausa** | ninguna |
| **Instrucciones** | Problemas con tu equipo: lento, no enciende, instalación o configuración de software, o periféricos. Elige qué necesitas y describe el detalle. |

**Campos**
| Campo | Tipo | Obligatorio | Opciones / pista |
|---|---|---|---|
| ¿Qué necesitas? | select | Sí | Equipo lento · No enciende · Instalación de software · Configuración de equipo · Mouse, teclado, monitor u otro periférico |
| Equipo afectado | texto | No | Nombre, etiqueta o número de inventario |
| Ubicación (si requiere visita) | texto | No | Sucursal / piso / área |

---

### 4. Impresoras y escáneres 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Media · 30 min · Ambas |
| **Pausa** | ninguna |
| **Instrucciones** | La impresora no imprime, el escáner no escanea, o necesitas una instalación o cambio de consumibles. Indica el modelo del equipo. |

**Campos**
| Campo | Tipo | Obligatorio | Opciones / pista |
|---|---|---|---|
| ¿Qué necesitas? | select | Sí | No imprime · No escanea · Instalación · Cambio de consumibles |
| Modelo del equipo | texto | No | Modelo de la impresora o escáner |
| Ubicación (si requiere visita) | texto | No | Sucursal / piso / área |

---

### 5. Usuarios y accesos 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Media · **20 min** (el más corto del catálogo) · Remoto |
| **Pausa** | ninguna — por eso mismo: un alta de 20 minutos no necesita estado intermedio |
| **Instrucciones** | Alta/baja de usuarios, contraseñas, permisos, Google Workspace, alta en la App de Asistencias o problemas con cualquier aplicación (Yunius, Office, etc.). |

**Campos**
| Campo | Tipo | Obligatorio | Opciones / pista |
|---|---|---|---|
| ¿Qué necesitas? | select | Sí | Alta o baja de usuario · Contraseña · Permisos · Google Workspace · Alta en App de Asistencias · Problema con una aplicación (Yunius, Office, etc.) |
| Aplicación o sistema | texto | No | Sistema afectado, si aplica |
| Usuario afectado | texto | No | Correo o usuario, si es distinto al tuyo |

---

### 6. Solicitud de servicio de TI 🟢
| | |
|---|---|
| **Área** | Sistemas |
| **Prioridad · SLA · Modalidad** | Baja · Variable · Ambas |
| **Pausa** | **"Programado"** — es el cajón de sastre; se agenda |
| **Instrucciones** | Cualquier otra solicitud de TI que no encaje en las categorías anteriores. El tiempo de atención es variable según el caso. |

**Campos**
| Campo | Tipo | Obligatorio | Pista |
|---|---|---|---|
| ¿Qué servicio necesitas? | textarea | **Sí** | Describe con detalle el servicio que solicitas |
| Ubicación (si aplica) | texto | No | Sucursal / piso / área |

---

### 7. Ficha no reflejada (grupal/comercial) 🟢
| | |
|---|---|
| **Área** | Tesorería |
| **Prioridad · SLA · Modalidad** | Media · Variable · Ambas |
| **Pausa** | **"Entra en el siguiente corte"** |
| **Evidencia** | **Obligatoria** — captura o comprobante del pago |
| **Quién lo levanta** | Gerentes de sucursal o dirección comercial |
| **Qué hace el área** | Valida que el pago exista y carga la ficha, o rechaza indicando el motivo |

**Campos**
| Campo | Tipo | Obligatorio | Pista |
|---|---|---|---|
| ID del grupo | texto | Sí | Ej: GRP-1042 |
| Nombre del grupo | texto | Sí | Nombre completo |
| Fecha de la ficha | fecha | Sí | — |
| Monto de la ficha (MXN) | número | Sí | Ej: 15400.00 |

---

### 8. Crédito faltante 🟢
| | |
|---|---|
| **Área** | Tesorería |
| **Prioridad · SLA · Modalidad** | Media · Variable · Ambas |
| **Pausa** | **"Entra en el siguiente corte"** |
| **Evidencia** | **Obligatoria** — captura del correo que confirma la dispersión |
| **Quién lo levanta** | Comercial o Crédito Individual |
| **Qué hace el área** | Añade el crédito o rechaza con motivo |

**Campos**
| Campo | Tipo | Obligatorio | Pista |
|---|---|---|---|
| ID de cliente o grupo | texto | Sí | Ej: CLI-2210 o GRP-1042 |
| Ciclo | texto | Sí | Ej: Ciclo 12 |
| Fecha de desembolso | fecha | Sí | — |

---

### 9. Error en mora 🟢
| | |
|---|---|
| **Área** | Data Science |
| **Prioridad · SLA · Modalidad** | **Alta** · **4 horas** · Ambas |
| **Pausa** | **"Entra en el siguiente corte"** |
| **Qué hace el área** | Explica por qué está en mora, o confirma el error y lo corrige |

**Campos**
| Campo | Tipo | Obligatorio | Pista |
|---|---|---|---|
| ID de cliente o grupo | texto | Sí | Ej: CLI-2210 o GRP-1042 |
| Ciclo | texto | Sí | Ej: Ciclo 12 |
| Descripción de la discrepancia | textarea | Sí | Qué cifra esperabas, qué muestra el sistema y por qué crees que es un error |

---

### 10. Aclaración de mora 🟡
| | |
|---|---|
| **Área** | Data Science |
| **Prioridad · SLA · Modalidad** | **Alta** · **4 horas** · Ambas |
| **Pausa** | **"Esperando al usuario"** |
| **Instrucciones (observadas)** | Escribir ID del grupo, su ciclo y describir el problema |

> **Por confirmar en `/admin/catalogo`:** campos dinámicos exactos y si requiere evidencia. Se creó desde la interfaz, no está en migraciones.

---

### 11. Falla en el sistema 🟡
| | |
|---|---|
| **Área** | Call Center |
| **Prioridad · SLA · Modalidad** | Media · Variable · Ambas |
| **Pausa** | **"Esperando al usuario"** |
| **Instrucciones (observadas)** | Intenta borrar los datos de navegación de tu navegador antes de levantar el ticket |

> **Por confirmar en `/admin/catalogo`:** campos dinámicos y evidencia. Creado desde la interfaz.
>
> **Sugerencia:** agregarle un campo `select` "¿Dónde está la falla?" con opciones (Yunius, Office, otro). Doble beneficio: el ticket llega diciendo qué sistema falló, y el buscador de `/tickets/nuevo` indexa esas opciones — escribir "yunius" encontraría el tipo.

---

## 3. Cómo se comporta cada flujo

**Sin pausa** (tipos 1-5)
```
Cola → [Tomar] → En revisión → [Resolver] → Cerrado
```

**Con pausa** (tipos 6-11)
```
Cola → [Tomar] → En revisión → [<etiqueta>] ⇄ [Reanudar] → [Resolver] → Cerrado
```

En cualquiera, el responsable puede **Rechazar** con motivo obligatorio (mín. 10 caracteres), **Devolver a la cola** o **Pasar a…** alguien de su área.

### Reglas transversales

| Regla | Detalle |
|---|---|
| **El ticket nace sin dueño** | Cae en la cola de su área; el primero que lo toma se lo queda |
| **El área la decide el tipo** | El usuario nunca elige área; un trigger la deriva del catálogo |
| **El reloj del SLA** | Corre en *Abierto* y *En revisión*. La pausa lo detiene. Se mide desde que se levantó el ticket; **las pausas no se acumulan** |
| **Confirmación de cierre** | Presencial → cierra directo. Remoto o ambas → el solicitante confirma |
| **Autocierre** | Un *Resuelto* sin actividad **3 días** se cierra solo (3:00 a.m.) |
| **Quién ve qué** | Tu área ve su cola; quien tiene *Supervisa* ve todas; admin ve todo |

---

## 4. Qué revisar de este catálogo

| # | Pendiente | Dónde |
|---|---|---|
| 1 | Confirmar campos y evidencia de los dos tipos 🟡 | `/admin/catalogo` |
| 2 | ~~Data Science sin SLA~~ — resuelto 2026-08-12: prioridad alta y 4 horas. Los de **Tesorería** siguen con **SLA variable**: nunca se marcan como vencidos, así que no aparecen en el filtro "Vencidos" ni en la cifra de la cola | Definir con Tesorería y Data Science si quieren un compromiso de tiempo |
| 3 | Las tres pausas de "siguiente corte" asumen **la misma cadencia** en Tesorería y Data Science | Confirmar que así opera |
| 4 | `responsable_default_id` sigue guardado en el catálogo pero **ya no se usa**: desde la cola por área el ticket nace sin dueño | Limpiar cuando se toque el catálogo |
