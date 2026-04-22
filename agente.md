# agente.md — Estado Actual del Proyecto GDP Surmedia

> Última actualización: 2026-04-22
> Rama activa: `claude/beautiful-planck-4DFUw`
> Fase: **0 — Fundamentos (completada ~95%)**

Este archivo es el punto de partida para cualquier sesión de desarrollo asistido por IA. Complementa `CLAUDE.md` con el estado real y concreto del sistema en este momento.

---

## Stack Tecnológico Activo

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript | React 19, TS 6.0 |
| Build tool | Vite | 8.0.9 |
| State global | Zustand | 5.0 |
| Data fetching | React Query | 5.99 |
| Formularios | React Hook Form + Zod | 7.73 / 4.3 |
| Routing | React Router | 7.14 |
| UI | Tailwind CSS | 4.2 |
| HTTP client | Axios | — |
| Backend | Fastify + TypeScript | 5.8 / 5.5 |
| ORM | Prisma | 5.22 |
| Base de datos | PostgreSQL | 15+ |
| Auth | @fastify/jwt + Google OAuth | — |
| Monorepo | npm workspaces | — |

**Deploy:**
- Frontend → Vercel (SPA con rewrites `/api` → Railway)
- Backend → Railway (con `nixpacks.toml`, binaryTargets Linux)

---

## Estructura del Repositorio

```
/
├── frontend/src/
│   ├── pages/auth/          LoginPage.tsx, AuthCallback.tsx
│   ├── pages/dashboard/     DashboardPage.tsx  ← VACÍO
│   ├── pages/employees/     EmployeesPage.tsx  ← UI parcial, sin datos
│   ├── components/ui/       ProtectedRoute.tsx
│   ├── layouts/             AppLayout.tsx
│   ├── store/               auth.ts (Zustand + persistencia)
│   ├── lib/                 api.ts (axios + interceptores), utils.ts
│   ├── hooks/               useAuth.ts ← NO IMPLEMENTADO
│   └── types/               index.ts
├── backend/src/
│   ├── routes/              auth.ts, employees.ts
│   ├── services/            auth.service.ts (Google OAuth)
│   ├── middleware/          authenticate.ts (JWT)
│   ├── plugins/             prisma.ts
│   └── server.ts            (Fastify, puerto 4000)
├── backend/prisma/
│   └── schema.prisma        8 modelos, 225 líneas
├── docs/
│   ├── arquitectura.md
│   ├── integraciones.md
│   ├── modelo-datos.md      35+ entidades documentadas
│   ├── procesos-rrhh.md     Todos los flujos por macro-módulo
│   └── roadmap.md           5 fases de desarrollo
├── index.html               Prototipo HTML estático (login) — legado
├── admin-dashboard.html     Prototipo HTML estático — legado
├── user-dashboard.html      Prototipo HTML estático — legado
├── CLAUDE.md                Contexto RRHH + arquitectura para IA
└── agente.md                ← Este archivo
```

> Los archivos HTML en la raíz (`index.html`, `admin-dashboard.html`, `user-dashboard.html`) son prototipos estáticos del commit inicial. No forman parte de la app React. Se pueden archivar o eliminar en cualquier momento.

---

## Autenticación — Estado Real

La autenticación está en un estado **temporal simplificado**:

- **Login activo**: Email `framos@surmedia.cl` / password `1234` hardcodeado en backend
- **Google OAuth**: Código completo presente (`auth.service.ts`, `AuthCallback.tsx`, ruta `/api/auth/google`) pero **desactivado** en UI — se reemplazó temporalmente para resolver bloqueos de deploy
- **JWT**: Generación y verificación funcionales. Payload: `{ userId, email, role }`
- **Middleware `authenticate`**: Operativo para rutas protegidas
- **Zustand store**: Persiste `{ token, user }` en `localStorage`

**Pendiente crítico**: Reactivar Google OAuth (dominio `@surmedia.cl`) como método principal. El código ya existe, solo falta reconectar el botón en `LoginPage.tsx`.

---

## Base de Datos — Estado Actual

**Schema Prisma activo** (`backend/prisma/schema.prisma`):

| Modelo | Descripción |
|--------|------------|
| `User` | Usuarios del sistema (vinculable a Employee) |
| `Department` | Áreas con jerarquía (parentId) |
| `Position` | Cargos por departamento |
| `Employee` | Colaboradores (RUT, datos personales, contratos, licencias) |
| `Contract` | Contratos laborales (tipo, fechas, salario) |
| `Leave` | Vacaciones y permisos (solicitud, aprobación) |
| `Document` | Documentos del colaborador |
| `AuditLog` | Trazabilidad de cambios |

**Importante**: No hay archivos de migración. Se usa `prisma db push` (schema-first sin historial de migraciones). Esto es aceptable para la fase actual pero deberá migrarse a `prisma migrate` antes de producción real con datos.

**Datos**: La BD tiene 0 registros reales (solo usuario temporal en memoria del backend).

---

## API REST — Endpoints Activos

```
POST /api/auth/login         Email/password temporal
GET  /api/auth/google        Redirect a Google OAuth
GET  /api/auth/google/callback  Callback OAuth (funcional)
GET  /api/auth/me            Info usuario autenticado (JWT requerido)

GET  /api/employees          Lista empleados (sin soft-deleted)
GET  /api/employees/:id      Detalle + contratos + licencias + documentos

GET  /health                 Health check
```

---

## Frontend — Páginas y Estado

| Ruta | Componente | Estado |
|------|-----------|--------|
| `/login` | `LoginPage` | ✅ Funcional (usuario temporal) |
| `/auth/callback` | `AuthCallback` | ✅ Funcional (OAuth) |
| `/dashboard` | `DashboardPage` | ❌ Archivo vacío |
| `/employees` | `EmployeesPage` | ⚠️ UI esqueleto, sin datos reales |

**`AppLayout`**: Existe pero la navegación lateral no está completa.

---

## Historial de Cambios Recientes

Todos los commits son del 20–21 de abril de 2026 (proyecto iniciado hace ~2 días):

| Commit | Descripción |
|--------|------------|
| `6a4e972` | Elimina página de login, va directo a la app |
| `c4298ed` | Mueve `prisma db push` a fase de build en Railway |
| `93f98c5` | Hardcodea usuario temporal para login |
| `c04f9e8` | Reemplaza OAuth por email/password (temporal) |
| `574de48` | Agrega binaryTargets Linux para Prisma en Railway |
| `d7aa0f2` | Mejora manejo de errores en auth (códigos específicos) |
| `8bd93c0` | Usa `prisma db push` en lugar de `migrate` |
| `08cb23b` | Agrega `nixpacks.toml` para Railway |
| `a0b4889` | Configura rewrites Vercel para proxy API + SPA |
| `df8f069` | Proyecto base GDP listo para deploy (Fase 0) |
| `3c61bfc` | Sistema de login con user/admin (HTML estático) |
| `523ec59` | Documentación completa del repositorio |
| `6c52f3d` | Commit inicial |

**Patrón observable**: Los últimos ~10 commits son correcciones de deploy en Railway/Vercel. La Fase 0 ha sido dominada por el setup de infraestructura, no por features de negocio.

---

## Estado de Implementación por Módulo

### ✅ Completado

- Infraestructura (monorepo, TypeScript, Vite, Fastify, Prisma)
- Auth base (JWT, middleware, Google OAuth code, Zustand store)
- Schema BD (8 tablas core)
- Documentación completa (arquitectura, integraciones, modelo-datos, procesos, roadmap)
- Deploy básico (Vercel + Railway)

### ⚠️ Parcial / Esqueleto

- `EmployeesPage` — UI presente, sin conexión real a API
- `AppLayout` — Existe, navegación incompleta
- `useAuth.ts` — Hook vacío, sin implementar

### ❌ No iniciado (ordenado por roadmap)

**Fase 1 — Gestión Documental:**
- CRUD completo de Employee (crear, editar, eliminar)
- Módulo de contratos (crear, alertas de vencimiento)
- Módulo de licencias (solicitud, aprobación, saldos)
- Liquidaciones (sincronización BUK)
- Boletas de honorarios
- Integración Google Drive (carpeta por colaborador)
- Integración Previred (push mensual de nómina)

**Fase 2 — Gestión de Talento:**
- Onboarding (checklist interactivo + Trello)
- Reclutamiento y selección (vacantes, candidatos, entrevistas, oferta)
- Portal self-service del colaborador
- Asistencia (sincronización BUK Asistencia)
- Capacitaciones (SENCE, diplomados)
- Prácticas laborales

**Fase 3 — Gestión del Desempeño:**
- Ciclo de evaluaciones anual
- Autoevaluación + evaluación jefatura
- Diccionario de competencias
- Descriptivos de cargo
- Planes de sucesión

**Fase 4 — Bienestar y Valores:**
- Encuestas de clima (CEAL-SUCESO)
- Comité paritario
- Comunicación interna (La Alcuza, Círculos SM)
- Reconocimientos
- Eventos culturales

**Transversales (todas las fases):**
- Dashboard con métricas
- Panel de administración
- Reportería (headcount, rotación, costos)
- Tests (unitarios, integración, E2E)
- Swagger / OpenAPI
- Auditoría (AuditLog activo)
- Monitoreo (Sentry)
- Roles y permisos granulares (actualmente solo validación JWT)

---

## Prioridades Inmediatas Recomendadas

Dado el estado actual, las siguientes tareas tienen mayor impacto para avanzar de Fase 0 a Fase 1:

1. **Reactivar Google OAuth** — Eliminar el login hardcodeado, usar SSO corporativo `@surmedia.cl`
2. **Dashboard funcional** — Al menos KPIs básicos (headcount, cumpleaños próximos, contratos próximos a vencer)
3. **CRUD Employee completo** — Formulario de creación/edición con validación de RUT chileno
4. **Módulo Leave** — Flujo de solicitud y aprobación de vacaciones (alta demanda operacional)
5. **Inicializar `prisma migrate`** — Transición de `db push` a migraciones versionadas antes de datos reales

---

## Variables de Entorno Necesarias

Ver `/home/user/Surmedia-GDP/.env.example` para el listado completo. Variables mínimas para desarrollo local:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
GOOGLE_DOMAIN=surmedia.cl
APP_URL=http://localhost:5173
PORT=4000
```

---

## Convenciones Activas

- **Código**: inglés (variables, funciones, tipos)
- **Comentarios / UI**: español
- **RUT**: validar y formatear `XX.XXX.XXX-X` en toda entrada de usuario
- **Fechas**: ISO 8601 interno, `DD/MM/YYYY` en UI
- **Moneda**: CLP como entero (sin decimales)
- **Soft delete**: campo `deletedAt` en Employee (no borrar registros)
- **Roles**: `ADMIN > RRHH_MANAGER > RRHH_ANALYST > MANAGER > EMPLOYEE`
