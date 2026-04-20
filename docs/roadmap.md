# Roadmap de Desarrollo

Plan de desarrollo del sistema GDP por fases, priorizando funcionalidades críticas para Surmedia.

---

## Fase 0 — Fundamentos (Semanas 1-2)

**Objetivo:** Dejar el proyecto listo para el desarrollo.

### Tareas

- [ ] Definir stack tecnológico definitivo
- [ ] Configurar repositorio y ramas (`main`, `develop`)
- [ ] Configurar GitHub Actions (CI básico: lint + tests)
- [ ] Diseñar schema de base de datos en Prisma
- [ ] Configurar entornos (`development`, `staging`, `production`)
- [ ] Configurar autenticación OAuth con Google (login @surmedia.cl)
- [ ] Levantar proyecto base (Frontend + Backend + DB)
- [ ] Documentar estructura del proyecto en `CLAUDE.md`

**Entregable:** Proyecto ejecutable con login funcional.

---

## Fase 1 — Core de Personas (Semanas 3-6)

**Objetivo:** CRUD completo de colaboradores y organigrama.

### Módulos

**Backend:**
- [ ] Módulo `employee` (CRUD + validación RUT)
- [ ] Módulo `department` (árbol de departamentos)
- [ ] Módulo `position` (cargos por departamento)
- [ ] Módulo `contract` (contratos laborales)
- [ ] Módulo `document` (upload a Google Drive)
- [ ] Sistema de roles y permisos (`ADMIN`, `RRHH_MANAGER`, `MANAGER`, `EMPLOYEE`)

**Frontend:**
- [ ] Portal RRHH: listado y ficha del colaborador
- [ ] Formulario de alta de colaborador
- [ ] Organigrama visual
- [ ] Gestión de documentos

**Integraciones:**
- [ ] Sync inicial desde BUK (importar colaboradores existentes)
- [ ] Webhook BUK → GDP (nuevos colaboradores)

**Entregable:** Sistema reemplaza el Excel actual como fuente de verdad de colaboradores.

---

## Fase 2 — Asistencia y Vacaciones (Semanas 7-10)

**Objetivo:** Control de asistencia y gestión de permisos.

### Módulos

**Backend:**
- [ ] Módulo `attendance` (sync desde BUK Asistencia)
- [ ] Módulo `leave` (solicitudes, aprobaciones, saldos)

**Frontend:**
- [ ] Dashboard de asistencia para jefaturas
- [ ] Portal del colaborador: solicitar vacaciones/permisos
- [ ] Bandeja de aprobación para jefaturas
- [ ] Calendario de ausencias del equipo

**Integraciones:**
- [ ] Sync diario BUK Asistencia → GDP
- [ ] Zapier: vacación aprobada → evento en Google Calendar

**Entregable:** RRHH y jefaturas pueden monitorear asistencia. Colaboradores solicitan vacaciones en GDP.

---

## Fase 3 — Liquidaciones y Previred (Semanas 11-14)

**Objetivo:** Importar liquidaciones desde BUK y declarar cotizaciones en Previred.

### Módulos

**Backend:**
- [ ] Módulo `payroll` (sync desde BUK)
- [ ] Generador de archivo Previred
- [ ] Flujo de aprobación de nómina

**Frontend:**
- [ ] Portal del colaborador: ver liquidaciones históricas
- [ ] Panel RRHH: revisión y aprobación de nómina mensual
- [ ] Dashboard de costos de nómina

**Integraciones:**
- [ ] Sync mensual BUK → GDP (liquidaciones)
- [ ] GDP → Previred (declaración mensual)
- [ ] Upload de liquidaciones a Google Drive

**Entregable:** Proceso de declaración de cotizaciones automatizado y auditable.

---

## Fase 4 — Evaluaciones y Reportería (Semanas 15-18)

**Objetivo:** Módulo de evaluaciones de desempeño y reportes gerenciales.

### Módulos

**Backend:**
- [ ] Módulo `performance` (ciclos de evaluación, formularios, resultados)
- [ ] Motor de reportes (headcount, rotación, ausentismo, costos)

**Frontend:**
- [ ] Portal de evaluaciones (evaluador y evaluado)
- [ ] Dashboard gerencial con métricas clave
- [ ] Exportación de reportes (Excel, PDF)

**Integraciones:**
- [ ] Trello: automatizar tarjetas de onboarding/offboarding
- [ ] Zapier: notificaciones automáticas por eventos de RRHH

**Entregable:** RRHH tiene visibilidad completa de métricas y puede generar reportes ejecutivos.

---

## Fase 5 — Optimización y Funciones Avanzadas (Semanas 19+)

**Objetivo:** Mejoras basadas en feedback del equipo y funciones avanzadas.

### Funciones Planificadas

- [ ] Módulo de selección y reclutamiento
- [ ] Encuestas de clima laboral (integración con Google Forms)
- [ ] Integración Smart CTO (datos del equipo tecnológico)
- [ ] App móvil para marcaje de asistencia (si BUK Asistencia no cubre)
- [ ] Notificaciones push (vencimiento de contratos, cumpleaños)
- [ ] API pública para integraciones futuras
- [ ] Análisis predictivo de rotación (ML básico)

---

## Deuda Técnica Planificada

| Item | Prioridad | Fase ideal |
|---|---|---|
| Tests de integración completos | Alta | Fase 2 |
| Tests E2E flujos críticos | Alta | Fase 3 |
| Encriptación en reposo (campos sensibles) | Alta | Fase 1 |
| Monitoreo y alertas (Sentry + uptime) | Media | Fase 2 |
| Documentación de API (Swagger/OpenAPI) | Media | Fase 2 |
| Optimización de queries (índices, caché) | Media | Fase 4 |
| Auditoría completa de seguridad | Alta | Fase 3 |

---

## Métricas de Éxito

| Métrica | Meta |
|---|---|
| Tiempo de onboarding de nuevo colaborador | < 30 minutos (desde cero) |
| Tiempo de generación del archivo Previred | < 5 minutos |
| Adopción del portal del colaborador | > 90% del personal en 3 meses |
| Reducción de trabajo manual en RRHH | > 60% |
| Uptime del sistema | > 99.5% |
| Tiempo de respuesta de la API | < 300ms p95 |
