# agente.md — Estado y Planes de Desarrollo GDP

## Estado del Sistema (actualizado 2026-04-23)

### Completado (Fase 0 + Fase 1 parcial)
- [x] Setup monorepo (backend Fastify + frontend React/Vite)
- [x] Prisma schema: User, Employee, Department, Position, Contract, Leave, Document, AuditLog, SyncLog
- [x] Autenticación JWT (auto-login, interceptores Axios)
- [x] Integración BUK multi-empresa (Comunicaciones + Consultoría)
- [x] Sync de dotación desde BUK → PostgreSQL
- [x] Vista Dotación: tabla filtrable con drawer de detalle
- [x] Railway deploy (backend + frontend + DB)

### En Progreso (Fase 1 incompleta)
- [ ] Employee CRUD (solo GET implementado; faltan POST/PUT/DELETE)
- [ ] Dashboard con datos reales (muestra "—" estático)
- [ ] Módulo de Vacaciones/Permisos (modelo en DB, sin rutas ni UI)
- [ ] Módulo de Contratos (solo lectura desde drawer)
- [ ] Módulo de Documentos (modelo en DB, sin rutas ni UI)

---

## 5 Planes de Acción (ordenados por prioridad)

### Plan 1 — Dashboard con Datos Reales
**Tiempo estimado:** 0.5 días  
**Impacto:** Muy Alto  
**Estado:** ✅ COMPLETADO (2026-04-23)

Conectar el Dashboard a datos reales de la base de datos. Primera impresión del sistema para gestión.

**Tareas:**
- [x] Backend: endpoint `GET /api/stats` con conteos reales (activos, por vencer, vacaciones pendientes)
- [x] Frontend: DashboardPage conectada a datos de stats
- [x] Dashboard: próximos cumpleaños del mes
- [x] Dashboard: contratos por vencer en 30 días
- [x] Dashboard: actividad reciente (últimos sync BUK)

---

### Plan 2 — CRUD Completo de Colaboradores
**Tiempo estimado:** 1.5 días  
**Impacto:** Muy Alto  
**Estado:** ✅ COMPLETADO (2026-04-23)

Sin esto, el sistema depende 100% de BUK para crear colaboradores. Necesario para registrar honorarios, practicantes y casos especiales.

**Tareas:**
- [x] Backend: `POST /api/employees` (crear con validación RUT)
- [x] Backend: `PUT /api/employees/:id` (actualizar datos)
- [x] Backend: `DELETE /api/employees/:id` (soft delete)
- [x] Backend: `GET /api/departments` (listar para formularios)
- [x] Frontend: Formulario crear/editar en EmployeeDrawer
- [x] Frontend: Botón "Nuevo Colaborador" en Dotación

---

### Plan 3 — Módulo de Vacaciones y Permisos
**Tiempo estimado:** 1.5 días  
**Impacto:** Alto  
**Estado:** ✅ COMPLETADO (2026-04-23)

Proceso más frecuente del RRHH diario. Actualmente se maneja por email/Excel.

**Tareas:**
- [x] Backend: `GET/POST /api/leaves` + `PUT /api/leaves/:id` (aprobar/rechazar)
- [x] Frontend: Página `/leave` con listado y estados
- [x] Frontend: Formulario de solicitud de permiso/vacación
- [x] Frontend: Flujo de aprobación para managers/RRHH
- [x] Frontend: Alertas de licencias pendientes en Dashboard

---

### Plan 4 — Gestión de Contratos y Alertas
**Tiempo estimado:** 2 días  
**Impacto:** Alto  
**Estado:** 🔜 PENDIENTE

Digitalizar contratos, generar alertas automáticas de vencimiento y manejar renovaciones.

**Tareas:**
- [ ] Backend: `POST /api/contracts` (crear contrato)
- [ ] Backend: `PUT /api/contracts/:id` (renovar/finalizar)
- [ ] Backend: Job de alertas: contratos vencen en 30/60/90 días
- [ ] Frontend: Página `/contracts` con listado y filtros
- [ ] Frontend: Formulario de nuevo contrato/anexo
- [ ] Frontend: Badge de "⚠ por vencer" en dotación (ya parcial)
- [ ] Integración: Notificación email/Zapier al vencer contrato

---

### Plan 5 — Módulo de Documentos
**Tiempo estimado:** 1.5 días  
**Impacto:** Medio  
**Estado:** 🔜 PENDIENTE

Centralizar documentos del colaborador (contratos firmados, finiquitos, certificados).

**Tareas:**
- [ ] Backend: `POST /api/documents/upload` (upload local + Google Drive opcional)
- [ ] Backend: `GET /api/documents?employeeId=X`
- [ ] Backend: `DELETE /api/documents/:id`
- [ ] Frontend: Tab "Documentos" en EmployeeDrawer
- [ ] Frontend: Página `/documents` con búsqueda global
- [ ] Frontend: Categorías (Contrato, Finiquito, Certificado, Otro)

---

## Registro de Sesiones

### Sesión 2026-04-23
**Branch:** `claude/eloquent-wozniak-rBCZa`

**Completado:**
- Plan 1: Dashboard con datos reales (stats endpoint + UI conectada)
- Plan 2: CRUD completo de colaboradores (POST/PUT/DELETE + form)
- Plan 3: Módulo de vacaciones y permisos (backend + frontend)

**Commits:**
- `feat(stats): endpoint /api/stats + dashboard con datos reales`
- `feat(employees): CRUD completo + formulario crear/editar`
- `feat(leaves): módulo vacaciones y permisos completo`

---

## Sugerencias para Continuar

1. **Plan 4 — Contratos con alertas automáticas** es la siguiente prioridad natural. Los vencimientos de contratos a plazo fijo son críticos y ya existe el badge en la UI.

2. **Notificaciones email** (Plan 4 + 5): Con Nodemailer o SendGrid, activar alertas automáticas de contratos por vencer, permisos aprobados/rechazados. Alto valor con bajo esfuerzo.

3. **Plan 5 — Documentos** se puede implementar sin Google Drive inicialmente (upload a disco/S3) y agregar Drive después, desbloqueando la ficha completa del colaborador.
