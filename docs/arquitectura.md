# Arquitectura del Sistema GDP

## Visión General

GDP (Gestión de Personas) es una aplicación web fullstack que actúa como sistema central de RRHH para Surmedia. Se integra con las plataformas existentes del ecosistema digital de la empresa mediante APIs y automatizaciones.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIOS                                  │
│         RRHH │ Jefaturas │ Colaboradores │ Admin IT             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)                 │
│   Portal RRHH │ Portal Colaborador │ Dashboard Jefatura         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API / GraphQL
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js + TypeScript)            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Módulos    │  │    Auth      │  │   Integration Layer   │  │
│  │  de negocio  │  │  OAuth 2.0   │  │   (Adaptadores API)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             ▼                                ▼
┌────────────────────┐          ┌─────────────────────────────────┐
│   PostgreSQL DB    │          │      INTEGRACIONES EXTERNAS      │
│   (datos propios)  │          │                                  │
│                    │          │  BUK ←→ BUK Asistencia           │
│  ┌──────────────┐  │          │  Previred                        │
│  │ Redis Cache  │  │          │  Google Suite                    │
│  └──────────────┘  │          │  Microsoft 365                   │
└────────────────────┘          │  Trello                          │
                                │  Zapier (webhooks)               │
                                │  Smart CTO                       │
                                │  DT Digital                      │
                                └─────────────────────────────────┘
```

## Capas de la Aplicación

### 1. Frontend

**Tecnologías:** React 18 + TypeScript + Vite

**Portales:**
- **Portal RRHH**: Gestión completa de colaboradores, contratos, reportería.
- **Portal del Colaborador**: Self-service: solicitar vacaciones, ver liquidaciones, actualizar datos personales.
- **Dashboard Jefatura**: Aprobación de solicitudes, vista del equipo, asistencia en tiempo real.
- **Panel de Administración**: Configuración del sistema, integraciones, usuarios.

**Librerías Clave:**
- `@tanstack/react-query` — Gestión de estado servidor
- `react-hook-form` + `zod` — Formularios y validación
- `recharts` — Gráficos y dashboards
- `shadcn/ui` — Componentes UI

### 2. Backend API

**Tecnologías:** Node.js + TypeScript + Fastify (o Express)

**Módulos de Negocio** (alineados a los 5 macro-módulos de DPDO Surmedia):

| Módulo Backend | Macro-módulo RRHH | Responsabilidad |
|---|---|---|
| `wellbeing` | Gestión de Bienestar Laboral | Encuestas clima, CEAL-SUCESO, comité paritario |
| `talent.training` | Gestión de Talento | Capacitaciones internas y externas, SENCE |
| `talent.onboarding` | Gestión de Talento | Onboarding, inducción, mentoría, elementos de ingreso |
| `talent.recruitment` | Gestión de Talento | Vacantes, portales de publicación, candidatos |
| `talent.selection` | Gestión de Talento | Entrevistas, pruebas, carta oferta |
| `talent.internship` | Gestión de Talento | Prácticas laborales y presupuesto |
| `values.communication` | Gestión de Valores | La Alcuza, cumpleaños, comunicación interna |
| `values.culture` | Gestión de Valores | Organigrama, eventos, reconocimientos |
| `performance.review` | Gestión del Desempeño | Ciclos de evaluación, métricas, planes de sucesión |
| `performance.competency` | Gestión del Desempeño | Diccionario de competencias, descriptivos de cargo |
| `docmgmt.payroll` | Gestión Documental | Liquidaciones, informe mensual remuneraciones |
| `docmgmt.contracts` | Gestión Documental | Contratos, anexos, dotación |
| `docmgmt.honorary` | Gestión Documental | Boletas de honorarios mensuales |
| `docmgmt.benefits` | Gestión Documental | Seguro complementario, Pluxee, enrolamiento |
| `docmgmt.budget` | Gestión Documental | Presupuesto DPDO |
| `employee` | Transversal | CRUD colaboradores, perfiles, datos personales |
| `attendance` | Transversal | Asistencia sync desde BUK Asistencia |
| `leave` | Transversal | Vacaciones, permisos, licencias |
| `auth` | Transversal | Autenticación, autorización, roles |
| `reports` | Transversal | Reportería y exportaciones |

**Capa de Integración (`src/integrations/`):**
Cada integración externa tiene su propio adaptador que abstrae la complejidad de la API de terceros.

### 3. Base de Datos

**Motor:** PostgreSQL 15+

**Principios:**
- UUID como primary keys
- `created_at` / `updated_at` en todas las tablas
- Soft delete con `deleted_at` para colaboradores y contratos
- Auditoría de cambios en tabla `audit_log`
- Datos sensibles (RUT completo, remuneraciones) encriptados con AES-256

**Caché:** Redis para:
- Sesiones de usuario
- Resultados de consultas frecuentes (organigrama, listas de empleados)
- Rate limiting de API

### 4. Autenticación y Autorización

**Método:** OAuth 2.0 con Google Workspace (dominio @surmedia.cl) y Microsoft 365.

**Roles del Sistema:**

| Rol | Descripción |
|---|---|
| `ADMIN` | Acceso total. Configuración del sistema. |
| `RRHH_MANAGER` | Gestión completa de personas. |
| `RRHH_ANALYST` | Operaciones de RRHH sin acceso a remuneraciones. |
| `MANAGER` | Vista y aprobaciones de su equipo. |
| `EMPLOYEE` | Self-service: sus propios datos. |

### 5. Integraciones

Ver documento completo en [integraciones.md](integraciones.md).

**Patrón de integración:** Cada integración sigue el patrón Adaptador:

```typescript
interface IntegrationAdapter {
  sync(): Promise<SyncResult>;
  push(data: unknown): Promise<void>;
  getStatus(): IntegrationStatus;
}
```

**Sincronización:**
- BUK → GDP: Sync diario automático (cron job) + webhooks para cambios en tiempo real.
- GDP → Previred: Push mensual de nómina.
- GDP → Trello: Creación automática de tarjetas vía Zapier.

## Infraestructura

### Entornos

| Entorno | Propósito |
|---|---|
| `development` | Local en máquina del desarrollador |
| `staging` | QA y pruebas de integración |
| `production` | Producción |

### CI/CD (GitHub Actions)

```
Push a feature/* → Tests → Lint → Build
Merge a develop  → Tests → Build → Deploy staging
Merge a main     → Tests → Build → Deploy producción
```

### Monitoreo (a definir)

- **Logs:** Estructurados en JSON, centralizar en servicio de logging
- **Errores:** Sentry para captura de excepciones
- **Métricas:** Uptime, latencia de API, estado de integraciones
- **Alertas:** Notificación vía email/Slack en fallos críticos

## Consideraciones de Seguridad

- Comunicación HTTPS en todos los entornos
- Variables de entorno nunca en el repositorio
- Validación de input en todas las capas (frontend + API)
- Rate limiting en endpoints de autenticación
- Logs de auditoría para operaciones sensibles (modificación de remuneraciones, terminación de contratos)
- Respaldo diario de base de datos con retención de 30 días
