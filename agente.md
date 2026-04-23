# agente.md — Estado del Sistema GDP Surmedia

> Documento de contexto técnico para sesiones de IA. Actualizado: 2026-04-23.
> Propósito: proveer al agente el estado real, evolutivo y operativo del sistema en cada sesión.

---

## Estado General del Proyecto

**Fase actual:** Fase 0 (Fundamentos) — ~85% completada  
**Inicio del proyecto:** 20 de abril 2026  
**Último commit relevante:** 23 de abril 2026 — `fix(buk): try Bearer auth + per-company error isolation`  
**Deploy:** Activo en Vercel (frontend) + Railway (backend)  
**Branch de desarrollo activo:** `claude/beautiful-planck-10veU`

---

## Stack Tecnológico Real (confirmado en código)

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify v5.8.5 — puerto 4000
- **ORM:** Prisma 5.22.0 (Prisma 7 intentado, revertido por incompatibilidad)
- **Base de datos:** PostgreSQL
- **Auth:** JWT (`@fastify/jwt`) + bcryptjs para login temporal
- **OAuth preparado:** Google OAuth (`google-auth-library`, `googleapis`) + Azure/Microsoft (env configuradas)
- **Cifrado planificado:** AES-256 vía `ENCRYPTION_KEY` (aún no implementado)

### Frontend
- **Framework:** React 19.2.5 + TypeScript + Vite
- **Router:** React Router DOM v7.14.1
- **State server:** @tanstack/react-query v5.99.2
- **State cliente:** Zustand v5.0.12
- **Forms:** react-hook-form v7.73.1 + Zod v4.3.6
- **Estilos:** Tailwind CSS v4.2.3
- **HTTP:** Axios v1.15.1 con interceptores JWT (retry automático en 401)
- **Iconos:** Lucide React v1.8.0

### Infraestructura
- **Monorepo:** npm workspaces (`frontend/` + `backend/`)
- **Frontend deploy:** Vercel (con proxy `/api` → Railway en `vercel.json`)
- **Backend deploy:** Railway con Railpack (nixpacks.toml removido en commit 4133861)
- **CI/CD:** Integración nativa GitHub de Vercel y Railway (deploy.yml eliminado)
- **BD start:** `prisma db push --accept-data-loss` se ejecuta automáticamente al arrancar el servidor

---

## Arquitectura de Módulos Backend (`backend/src/`)

```
src/
├── server.ts               — Bootstrap Fastify (puerto 4000, CORS abierto)
├── routes/
│   ├── auth.ts             — POST /api/auth/login, GET /api/auth/me, OAuth callbacks
│   ├── employees.ts        — GET /api/employees (filtros), GET /api/employees/:id
│   └── sync.ts             — POST /api/sync/buk, GET /api/sync/logs, webhooks
├── integrations/
│   └── buk/
│       ├── buk.client.ts   — Cliente HTTP BUK API v1 (auth: Token + Bearer probado)
│       ├── buk.sync.ts     — Sync multi-empresa (COMUNICACIONES + CONSULTORIA)
│       ├── buk.mapper.ts   — Mapeo BUK Employee → GDP Employee/Contract
│       ├── buk.types.ts    — Tipos TypeScript para respuestas BUK
│       └── index.ts
├── middleware/
│   └── authenticate.ts     — Validación JWT como preHandler Fastify
├── plugins/
│   └── prisma.ts           — Inicialización Prisma Client
├── services/
│   └── auth.service.ts     — Lógica Google OAuth
└── types/
    └── index.ts            — Tipos JWT (JwtPayload) y User
```

---

## API REST Implementada

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login email/password (usuario temp: framos@surmedia.cl / 1234) |
| GET  | `/api/auth/google` | Redirect a Google OAuth |
| GET  | `/api/auth/google/callback` | Callback OAuth → JWT |
| GET  | `/api/auth/me` | Datos del usuario autenticado |

### Colaboradores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/employees` | Listado paginado (search, status, legalEntity, contractType, departmentId, page, limit) |
| GET | `/api/employees/:id` | Detalle: position, department, últimos 5 contratos, últimos 10 leaves, documentos |

### Sincronización BUK
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/sync/buk` | Sync completo ambas empresas (timeout 120s) |
| POST | `/api/sync/buk/:entity` | Sync de empresa específica (async, retorna 202) |
| GET  | `/api/sync/logs` | Historial últimas 50 sincronizaciones |
| POST | `/api/sync/webhook/buk` | Receptor webhook BUK (validación HMAC-SHA256) |

### Debug/Utilidades
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/debug/employees` | Contador de empleados en BD |

---

## Base de Datos — Estado del Esquema Prisma

### Tablas Implementadas
- `User` — Auth (email, googleId, microsoftId, role: ADMIN/RRHH/MANAGER/EMPLOYEE)
- `Employee` — Colaborador (rut, nombre, cargo, depto, jefatura, AFP, salud, estado)
- `Department` — Organigrama (jerarquía parent/children)
- `Position` — Cargo con descriptivo de cargo
- `Contract` — Contrato laboral (tipo, fechas, legalEntity, bukEmployeeId, grossSalary)
- `Leave` — Vacaciones/permisos (tipo, fechas, estado)
- `Document` — Documentos en Drive (url, nombre, tipo)
- `SyncLog` — Registro de sincronizaciones BUK (empresa, status, empleados, errores)
- `AuditLog` — Auditoría de cambios

### Enums Definidos
- `UserRole`: ADMIN, RRHH, MANAGER, EMPLOYEE
- `EmployeeStatus`: ACTIVE, INACTIVE, ON_LEAVE, TERMINATED
- `ContractType`: INDEFINIDO, PLAZO_FIJO, HONORARIOS, PRACTICA
- `LeaveType`: VACACIONES, PERMISO, LICENCIA, etc.
- `LeaveStatus`: PENDING, APPROVED, REJECTED
- `LegalEntity`: COMUNICACIONES_SURMEDIA, SURMEDIA_CONSULTORIA
- `SyncStatus`: RUNNING, SUCCESS, ERROR
- `TerminationReason`: Causales Artículos 159, 160, 161 Código Trabajo Chile

### Última Migración
`20260422_add_buk_integration/migration.sql`:
- Enums `LegalEntity` y `SyncStatus`
- Campos `legalEntity`, `bukEmployeeId`, `grossSalary` en `Contract`
- Tabla `sync_logs`

---

## Integración BUK — Estado Real

### Problema Resuelto (historial commits)
BUK API requiere autenticación específica. Se probaron dos formatos:
1. `Authorization: Token token=XXX` (formato Rails, commit b9b9be0)
2. `Authorization: Bearer XXX` (commit 76e74ef)

### Configuración Multi-empresa
El sistema sincroniza dos entidades legales de Surmedia:
- **COMUNICACIONES_SURMEDIA** → usa `BUK_URL_COMUNICACIONES` + `BUK_API_KEY_COMUNICACIONES`
- **SURMEDIA_CONSULTORIA** → usa `BUK_URL_CONSULTORIA` + `BUK_API_KEY_CONSULTORIA`

### Endpoint BUK Usado
`GET /api/v1/employees` (v2 retorna 404 en esta instancia de BUK — commit 3c5386c)

### Comportamiento del Sync
- Aislamiento de errores por empresa: si una falla, la otra continúa
- Upsert de empleados y contratos (por bukEmployeeId)
- Retorna: `{ ok, results: [{ entity, created, updated, errors }] }`
- UI muestra resultado detallado por empresa en un dialog

---

## Frontend — Componentes y Páginas

### Rutas React Router
```
/ → redirect /dashboard
/dashboard → DashboardPage
/employees → EmployeesPage (con EmployeeDrawer)
```

### EmployeesPage.tsx (página principal — 418 líneas)
- **Stats cards:** Total activos, Comunicaciones, Consultoría, Contratos por vencer
- **Filtros:** Búsqueda libre, empresa (legalEntity), estado, tipo contrato
- **Tabla de dotación:** Avatar + nombre, RUT, cargo, área, empresa, tipo contrato, antigüedad, estado badge
- **Botón Sync BUK:** Dispara sync completo, muestra resultados por empresa en dialog
- **Drawer:** Click en fila abre EmployeeDrawer con detalle del colaborador

### Hooks React Query
- `useEmployees(filters)` — Consulta paginada con filtros
- `useSyncBuk()` — Mutación que dispara sync y retorna resultados
- `useSyncLogs()` — Historial de sincronizaciones

### Estado Global (Zustand)
- `useAuth` store: `{ token, user, role, login(), logout() }`
- Token JWT guardado en localStorage, enviado como Bearer en cada request

---

## Funcionalidades por Estado

### Implementado y Funcionando
- [x] Autenticación email/password (usuario único temporal)
- [x] JWT con refresh automático en 401
- [x] Listado de colaboradores con filtros avanzados
- [x] Tabla de dotación con stats por empresa
- [x] Sincronización BUK multi-empresa (lectura unidireccional)
- [x] Logs de sincronización
- [x] Receptor de webhooks BUK (HMAC-SHA256)
- [x] Deploy automático Vercel + Railway

### Preparado pero No Activado
- [ ] Google OAuth (código presente, rutas registradas, falta GOOGLE_CLIENT_ID en producción)
- [ ] Microsoft OAuth (Azure env vars en .env.example)
- [ ] Cifrado de RUT (campo planificado, no implementado)
- [ ] Redis para caché (mencionado en arquitectura, no instalado)

### No Iniciado (Fases Futuras)
- [ ] Edición/creación manual de colaboradores
- [ ] Módulo de contratos (UI)
- [ ] Liquidaciones y sincronización Previred
- [ ] Google Drive (documentos)
- [ ] Módulo de Vacaciones/Permisos (UI)
- [ ] Módulo de Reclutamiento y Selección
- [ ] Módulo de Onboarding
- [ ] Capacitaciones internas y externas
- [ ] Evaluaciones de Desempeño
- [ ] Encuestas de Clima Laboral
- [ ] Reconocimientos y Eventos
- [ ] Reportería avanzada y exportación Excel
- [ ] Tests unitarios y E2E
- [ ] Monitoreo/alertas (Sentry)

---

## Deuda Técnica Activa

| Ítem | Impacto | Urgencia |
|------|---------|----------|
| Usuario temporal hardcodeado (framos@surmedia.cl / 1234) | Alto | Alta (antes de producción real) |
| `prisma db push --accept-data-loss` en start | Alto | Alta (migrar a `migrate deploy`) |
| CORS completamente abierto (`origin: true`) | Medio | Media |
| RUT almacenado en texto plano | Alto | Media |
| Sin tests (0% cobertura) | Alto | Media |
| Sin monitoreo de errores (Sentry) | Medio | Baja |
| Archivos relicto en raíz (index.html, admin-dashboard.html, user-dashboard.html) | Bajo | Baja |

---

## Variables de Entorno Requeridas

```bash
# Base de datos
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=...

# BUK Multi-empresa
BUK_URL_COMUNICACIONES=https://surmedia.buk.cl
BUK_API_KEY_COMUNICACIONES=...
BUK_URL_CONSULTORIA=https://surmedia-consultoria.buk.cl
BUK_API_KEY_CONSULTORIA=...
BUK_WEBHOOK_SECRET=...

# Google OAuth (preparado, no activo en prod)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
GOOGLE_DRIVE_ROOT_FOLDER_ID=...

# Microsoft (preparado)
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...

# Previred (planificado)
PREVIRED_USER=...
PREVIRED_PASSWORD=...

# Trello (planificado)
TRELLO_API_KEY=...
TRELLO_TOKEN=...

# Zapier (planificado)
ZAPIER_WEBHOOK_URL=...

# Email transaccional
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...

# Seguridad
ENCRYPTION_KEY=...  # AES-256, 32 bytes hex
```

---

## Roadmap de Fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| **Fase 0** | Setup, auth, CI/CD, estructura base | ~85% — Falta OAuth real y tests |
| **Fase 1** | Gestión Documental: dotación completa, contratos, liquidaciones, honorarios, beneficios | No iniciada |
| **Fase 2** | Talento: asistencia, vacaciones, reclutamiento, onboarding, prácticas | No iniciada |
| **Fase 3** | Desempeño: competencias, evaluaciones, sucesión | No iniciada |
| **Fase 4** | Bienestar & Valores: clima, capacitaciones, reconocimientos, comunicación | No iniciada |
| **Fase 5** | Optimización: Smart CTO, DT Digital, notificaciones, API pública | No iniciada |

---

## Decisiones de Arquitectura Tomadas

1. **Fastify sobre Express:** Mejor performance, tipado nativo, plugins oficiales
2. **Prisma 5 sobre 7:** Prisma 7 causó problemas de compatibilidad; se revirtió a v5 estable
3. **Railway sobre EC2/ECS:** Menor fricción de configuración para MVP
4. **nixpacks.toml removido:** Railway migró a Railpack; nixpacks ya no es necesario
5. **`prisma db push` en start:** Simplicidad para MVP; deberá migrarse a `migrate deploy` antes de producción
6. **OAuth diferido:** Se implementó login temporal para arrancar rápido; OAuth OAuth está preparado
7. **Multi-empresa por ENV vars:** Cada empresa tiene su propio par URL+API_KEY en lugar de tabla de configuración

---

## Contexto de Negocio para el Agente

- Las dos empresas sincronizadas desde BUK son entidades legales distintas de Surmedia
- **DPDO** = Departamento de Personas y Desarrollo Organizacional (nombre interno de RRHH)
- El RUT chileno tiene formato `XX.XXX.XXX-X` con dígito verificador (algoritmo módulo 11)
- Las liquidaciones siguen el **Código del Trabajo chileno** (no aplica legislación de otros países)
- **Previred** es el portal único para declarar cotizaciones AFP y salud en Chile
- **SENCE** permite subsidiar capacitaciones laborales vía franquicia tributaria
- **Pluxee** (ex-Sodexo) es la tarjeta de beneficios de alimentación/bienestar más usada en Chile
- **CEAL-SUCESO** es el cuestionario oficial del MINSAL para medir clima laboral
- El año de corte para las evaluaciones de desempeño en Surmedia es el año calendario (enero-diciembre)
