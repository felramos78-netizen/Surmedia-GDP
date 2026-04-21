# agente.md — Estado del Sistema GDP Surmedia

> Documento de contexto operacional para agentes de IA.
> Última actualización: 2026-04-21.
> Complementa `CLAUDE.md` con el estado ACTUAL del sistema (no el diseño objetivo).

---

## Estado General del Proyecto

**Fase actual:** Fase 0 completada — preparando Fase 1
**Branch de trabajo:** `claude/beautiful-planck-4GNQk`
**Branch estable:** `main`
**Commits totales:** 13

El proyecto tiene sus fundamentos listos y desplegados. La autenticación funciona. La base de datos está modelada. El siguiente paso es construir la funcionalidad de negocio real (Fase 1: Gestión Documental).

---

## Arquitectura Actual (lo que existe, no lo que está planeado)

```
Monorepo npm workspaces
├── frontend/   → React 19 + Vite + TypeScript → deploy en Vercel
└── backend/    → Fastify 5 + Prisma 5 + TypeScript → deploy en Railway
```

**Base de datos:** PostgreSQL (Railway)
**Cache/sesiones:** Redis (configurado en .env, no integrado aún en código)
**CI/CD:** GitHub Actions → Vercel (frontend) + Railway (backend) con integración nativa de GitHub

---

## Stack Tecnológico Exacto

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 22 (LTS) | Runtime |
| Fastify | 5.8.5 | HTTP framework |
| TypeScript | 5.5.0 | Lenguaje |
| Prisma | 5.22.0 | ORM (NO Prisma 6/7 — incompatible) |
| Google Auth Library | 10.6.2 | OAuth 2.0 |
| @fastify/jwt | - | Tokens JWT |
| @fastify/cors | - | CORS |
| @fastify/cookie | - | Cookies de sesión |
| tsx | 4.19.0 | Ejecutor TypeScript en dev |

**Nota importante sobre Prisma:** El proyecto usa Prisma 5 estable. Hubo problemas con Prisma 7 (incompatible) y con `prisma.config.ts` (solo Prisma 6/7). El start usa `prisma db push` en lugar de migrations para evitar dependencia de archivos de migración en Railway.

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.2.5 | UI framework |
| TypeScript | 6.0.2 | Lenguaje |
| Vite | 8.0.9 | Bundler |
| TailwindCSS | 4.2.3 | Estilos |
| React Router | 7.14.1 | Routing SPA |
| Zustand | 5.0.12 | Estado global (auth) |
| TanStack Query | 5.99.2 | Estado servidor |
| React Hook Form | 7.73.1 | Formularios |
| Zod | 4.3.6 | Validación de esquemas |
| Axios | 1.15.1 | Cliente HTTP |
| Lucide React | 1.8.0 | Iconos |

---

## Lo Que Está Implementado

### Autenticación (completa)
- Google OAuth 2.0 con restricción de dominio `@surmedia.cl`
- JWT para sesiones (8h access token)
- Microsoft 365 OAuth — endpoint configurado como stub, no implementado
- Middleware de autenticación aplicado a rutas protegidas
- Store de Zustand para estado de auth en frontend
- Hook `useAuth()` personalizado
- `ProtectedRoute` component para proteger rutas

### API Backend — Endpoints Activos
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| GET | `/api/auth/google` | No | Redirige a Google OAuth |
| GET | `/api/auth/google/callback` | No | Procesa callback OAuth |
| GET | `/api/auth/me` | Sí | Info del usuario actual |
| GET | `/api/employees` | Sí | Listar empleados |
| GET | `/api/employees/:id` | Sí | Detalle de empleado |

### Frontend — Páginas y Rutas
| Ruta | Componente | Estado |
|---|---|---|
| `/login` | `LoginPage` | Funcional — botones OAuth Google/Microsoft |
| `/auth/callback` | `AuthCallback` | Funcional — maneja token y redirección |
| `/dashboard` | `DashboardPage` | Stub — cards estáticas, sin datos reales |
| `/employees` | `EmployeesPage` | Stub — tabla vacía, sin datos reales |
| `/recruitment` | - | Ruta definida, sin página |
| `/onboarding` | - | Ruta definida, sin página |
| `/leave` | - | Ruta definida, sin página |
| `/documents` | - | Ruta definida, sin página |

### Estructura UI
- `AppLayout`: sidebar con navegación, cabecera con usuario
- Sidebar items: Dotación, Reclutamiento, Onboarding, Vacaciones, Documentos

### Base de Datos — Modelos Prisma Definidos
```
User          → usuarios del sistema (auth)
Employee      → colaboradores (datos personales + laborales)
Department    → áreas/departamentos con jerarquía
Position      → cargos vinculados a departamentos
Contract      → contratos laborales
Leave         → solicitudes de vacaciones/permisos
Document      → documentos con integración Google Drive
AuditLog      → trazabilidad de cambios
```

**Enums definidos:**
- `UserRole`: ADMIN, RRHH_MANAGER, RRHH_ANALYST, MANAGER, EMPLOYEE
- `EmployeeStatus`: ACTIVE, INACTIVE, ON_LEAVE
- `ContractType`: INDEFINIDO, PLAZO_FIJO, HONORARIOS, PRACTICA
- `LeaveType`: VACACIONES, PERMISO, LICENCIA_MEDICA, LICENCIA_MATERNIDAD, LICENCIA_PATERNIDAD, OTRO
- `LeaveStatus`: PENDING, APPROVED, REJECTED, CANCELLED

---

## Lo Que NO Está Implementado

### Tests — Estado: Cero
- No hay archivos `*.test.ts` ni `*.spec.ts`
- No hay Vitest, Jest, ni framework de testing configurado
- No hay scripts de test en package.json (solo linting)
- La deuda técnica de tests es alta (prioridad: Fase 2+)

### Integraciones externas — Estado: Solo configuradas en .env
- **BUK**: variables listas, sin código de integración
- **Previred**: variables listas, sin código de integración
- **Google Drive**: OAuth configurado, sin uso en código
- **Trello**: variables listas, sin código de integración
- **Zapier**: variables listas, sin webhooks activos
- **Redis**: URL en .env, no integrado en el código del servidor

### Módulos de negocio — Estado: Sin implementar
- Toda la lógica de negocio de Fases 1-5 está pendiente
- Los endpoints de employees son stubs (sin lógica real)
- No hay CRUD completo para ninguna entidad

### Otros
- Sin encriptación en reposo (campos sensibles como RUT)
- Sin documentación de API (Swagger/OpenAPI)
- Sin monitoreo (Sentry no integrado)
- Microsoft OAuth: solo botón visible, endpoint incompleto

---

## Historial de Commits (cronológico ascendente)

| Hash | Mensaje | Impacto |
|---|---|---|
| `6c52f3d` | Initial commit | Estructura inicial |
| `523ec59` | docs: documentación completa del repositorio | Docs fundacionales |
| `3c61bfc` | Add login system with user and admin authentication | Primera versión de auth |
| `df8f069` | feat(fase-0): proyecto base GDP listo para deploy ✅ | Fase 0 completa |
| `a0b4889` | fix(vercel): agregar rewrites para proxy /api a Railway | Fix deploy frontend |
| `42d1118` | fix(backend): usar Prisma 5 estable | Estabilizar ORM |
| `44e874a` | fix(backend): eliminar prisma.config.ts | Fix incompatibilidad Prisma 5 |
| `ea19147` | fix(ci): usar npm install en backend | Fix CI pipeline |
| `c183bbd` | fix(backend): correr migraciones en start | Fix startup Railway |
| `7b8692f` | chore: eliminar deploy.yml | Simplificar CD |
| `08cb23b` | fix(railway): agregar nixpacks.toml | Fix build Railway |
| `130f870` | fix(backend): reemplazar package-lock.json con Prisma 5 | Fix dependency lock |
| `8bd93c0` | fix(backend): usar prisma db push en start | Fix migraciones Railway |

**Patrón observado:** La mayoría de commits post-Fase 0 son fixes de deploy. La infraestructura de CI/CD requirió ajuste fino para los entornos Railway + Vercel.

---

## Configuración de Despliegue

### Frontend (Vercel)
- Build: `npm run build` desde `/frontend`
- Output: `dist/`
- Rewrites configurados: `/api/*` → Railway backend (proxy)
- Routing SPA: `/*` → `index.html`

### Backend (Railway)
- Build: `prisma generate && tsc`
- Start: `prisma db push && node dist/server.js`
- Usa `nixpacks.toml` para forzar `npm install` (no `npm ci`)
- NO tiene `package-lock.json` propio (workspace npm)

### CI (GitHub Actions — `.github/workflows/ci.yml`)
- Trigger: push y PR a `main`
- Jobs: lint + build para frontend y backend
- Backend usa `npm install` (no `npm ci`) por workspace

---

## Variables de Entorno Requeridas

```bash
# App
NODE_ENV, PORT, APP_URL, API_URL

# Base de datos
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis (configurado, no activo en código aún)

# Auth
JWT_SECRET            # mínimo 32 caracteres
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=7d

# OAuth Google
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI, GOOGLE_DOMAIN=surmedia.cl

# OAuth Microsoft (stub)
AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI

# BUK (no integrado aún)
BUK_API_KEY, BUK_BASE_URL, BUK_COMPANY_ID, BUK_WEBHOOK_SECRET

# Previred (no integrado aún)
PREVIRED_RUT_EMPRESA, PREVIRED_PASSWORD, PREVIRED_BASE_URL

# Google Drive (no integrado aún)
# Usa las mismas credenciales OAuth de Google

# Trello (no integrado aún)
TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_*_BOARD_ID

# Zapier (no integrado aún)
ZAPIER_WEBHOOK_*, ZAPIER_INCOMING_SECRET

# Email (no integrado aún)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM

# Seguridad
ENCRYPTION_KEY        # 32 bytes hex para AES-256 (no activo aún)

# Monitoreo
SENTRY_DSN            # No integrado aún
```

---

## Estructura de Archivos Relevante

```
/
├── CLAUDE.md                 # Contexto de diseño y arquitectura objetivo
├── agente.md                 # Este archivo — estado actual
├── package.json              # Monorepo root (workspaces: frontend, backend)
├── .env.example              # Template de variables de entorno
├── README.md                 # Presentación del proyecto
├── CONTRIBUTING.md           # Convenciones de desarrollo
│
├── backend/
│   ├── src/
│   │   ├── server.ts         # Entry point Fastify
│   │   ├── middleware/       # authenticate.ts (JWT)
│   │   ├── plugins/          # prisma.ts (plugin Fastify)
│   │   ├── routes/
│   │   │   ├── auth.ts       # Google OAuth + /me
│   │   │   └── employees.ts  # CRUD employees (stub)
│   │   ├── services/
│   │   │   └── auth.service.ts
│   │   └── types/
│   └── prisma/
│       └── schema.prisma     # Esquema DB (8 modelos, 5 enums)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Router principal + ProtectedRoute
│   │   ├── pages/
│   │   │   ├── auth/         # LoginPage, AuthCallback
│   │   │   ├── dashboard/    # DashboardPage
│   │   │   └── employees/    # EmployeesPage
│   │   ├── components/ui/    # ProtectedRoute
│   │   ├── layouts/          # AppLayout (sidebar)
│   │   ├── hooks/            # useAuth
│   │   ├── store/            # authStore (Zustand)
│   │   ├── lib/              # api.ts (Axios), utils.ts
│   │   └── types/            # TypeScript types compartidos
│   └── vite.config.ts
│
└── docs/
    ├── arquitectura.md
    ├── integraciones.md
    ├── modelo-datos.md
    ├── procesos-rrhh.md
    └── roadmap.md
```

---

## Próximos Pasos (Fase 1)

La Fase 1 — Gestión Documental arranca el 2026-04-21 con duración estimada de 7 semanas.

### Orden recomendado de implementación

1. **Employee CRUD completo** — Backend: validación de RUT, endpoints POST/PUT/DELETE. Frontend: formulario de ficha.
2. **Department + Position** — Organigrama y cargos (prerequisito para Employee).
3. **Contract module** — Alta de contratos, tipos, vigencias, alertas de vencimiento.
4. **BUK sync** — Importar dotación existente vía API BUK (unblock manual data entry).
5. **Document upload** — Integración Google Drive por colaborador.
6. **Payroll sync** — Liquidaciones desde BUK, informe mensual.
7. **Honorary receipts** — Boletas de honorarios, informe mensual.
8. **Benefits** — Pluxee, seguro complementario, enrolamiento.
9. **Budget** — Presupuesto DPDO por categoría.

### Deuda técnica a resolver en Fase 1
- Encriptación AES-256 para campos sensibles (RUT, datos previsionales)
- Integrar Redis para caché de sesiones
- Configurar Sentry para monitoreo de errores

---

## Convenciones de Desarrollo Activas

- **Idioma de código:** Inglés (variables, funciones, clases, rutas)
- **Idioma de UI/docs/comentarios:** Español
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- **Ramas:** `main` (estable), `develop` (integración), `feature/*`, `fix/*`
- **RUT chileno:** Validar y formatear siempre con dígito verificador (formato: `XX.XXX.XXX-X`)
- **Fechas:** ISO 8601 internamente, `DD/MM/YYYY` en UI
- **Moneda:** CLP como entero sin decimales
- **Sin archivos de migración Prisma:** El deploy usa `prisma db push` (decisión Railway)

---

## Decisiones de Arquitectura Tomadas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Prisma 5 (no 6/7) | Prisma 6/7 | Incompatibilidad — `prisma.config.ts` solo existe en 6/7 |
| `prisma db push` en deploy | `prisma migrate deploy` | Railway no persiste archivos de migración entre builds |
| `npm install` en CI/Railway | `npm ci` | Workspace npm sin `package-lock.json` propio en backend |
| Vercel + Railway nativo | Workflow GitHub Actions custom deploy | Simplifica el pipeline, menos puntos de falla |
| JWT en cookies + headers | Solo headers | Flexibilidad para SSR y apps móviles futuras |
| Google OAuth como primario | Credenciales propias | Toda la empresa usa `@surmedia.cl` en Google Workspace |

---

## Alertas y Consideraciones para el Agente

1. **No usar Prisma 6/7 syntax** — El proyecto está en Prisma 5. No existe `prisma.config.ts`.
2. **`prisma db push` en Railway** — No crear archivos de migración para el flujo de deploy. Pueden existir para dev local.
3. **Dominio @surmedia.cl obligatorio** — La validación de OAuth rechaza otros dominios de Google. No romper esta restricción.
4. **Sin tests aún** — No asumir que hay tests. Al agregar código nuevo, considerar si el test es requerido por la tarea.
5. **RUT chileno es dato sensible** — Toda lógica de RUT debe incluir validación del dígito verificador.
6. **Redis no activo** — Está en `.env.example` pero no hay código que lo use. No asumir que está disponible.
7. **Microsoft OAuth es stub** — El botón existe en UI, el endpoint no está implementado. No romper la UI al trabajar en auth.
8. **Branch de trabajo:** Siempre usar `claude/beautiful-planck-4GNQk` para desarrollo, no pushear a `main` directamente.
