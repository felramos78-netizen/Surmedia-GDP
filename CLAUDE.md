# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Proyecto: Gestión de Personas Surmedia (GDP)

Sistema interno de RRHH para Surmedia (empresa de medios y tecnología, Chile). Reemplaza procesos manuales en Excel. Centraliza gestión de personas integrando BUK, Previred, Google Workspace y otras plataformas del ecosistema digital.

**Dos razones sociales operativas:**
- `COMUNICACIONES_SURMEDIA` — Comunicaciones Surmedia Spa
- `SURMEDIA_CONSULTORIA` — Surmedia Consultoría Spa

Ambas entidades conviven en la misma base de datos; casi todos los modelos relevantes llevan `legalEntity: LegalEntity`.

---

## Comandos de Desarrollo

```bash
# Desde la raíz del monorepo
npm run dev:frontend          # Frontend en http://localhost:3000
npm run dev:backend           # Backend en http://localhost:4000

# Desde cada workspace directamente
cd backend && npm run dev     # tsx watch (hot reload)
cd frontend && npm run dev    # Vite dev server

# Build
npm run build                 # Compila frontend (Vite) + backend (tsc)

# Lint
npm run lint                  # ESLint en ambos workspaces
cd backend && npm run lint    # Solo tsc --noEmit (sin ESLint)

# Base de datos (backend/)
npm run db:migrate            # prisma migrate dev (crea migración y aplica)
npm run db:deploy             # prisma migrate deploy (solo aplica, para producción)
npm run db:push               # prisma db push (sin migración, útil en dev)
npm run db:seed               # tsx prisma/seed.ts
npm run db:studio             # Prisma Studio
npm run generate              # prisma generate (regenerar cliente)
```

No hay suite de tests definida en este momento.

---

## Arquitectura

### Monorepo (npm workspaces)
```
surmedia-gdp/
├── frontend/     React 19 + Vite + TailwindCSS v4
├── backend/      Fastify 5 + Prisma + PostgreSQL
├── reportes/     Excel exportados manualmente desde BUK (ver sección Importación)
└── package.json  Workspace root — scripts dev:frontend / dev:backend
```

### Backend (`backend/`)

- **Runtime:** Node.js con `tsx watch` en desarrollo; `tsc` → `node dist/server.js` en producción.
- **Framework:** Fastify 5 con plugins registrados en `src/server.ts`: CORS, cookie, JWT (`@fastify/jwt`), Prisma (plugin propio), y `authenticate` (decorador de instancia).
- **Puerto:** 4000. Todas las rutas bajo `/api/`.
- **Autenticación:** JWT via `Authorization: Bearer <token>`. El decorador `fastify.authenticate` se añade como `preHandler` en cada router que requiere auth. Actualmente hay un usuario temporal hardcodeado (`framos@surmedia.cl` / `1234`) mientras se termina el flujo de Google OAuth.
- **ORM:** Prisma 5 con PostgreSQL. El cliente se expone como `fastify.prisma` via el plugin `src/plugins/prisma.ts`.
- **Estructura de rutas:**
  ```
  /api/auth          → src/routes/auth.ts       (login, Google OAuth, /me)
  /api/employees     → src/routes/employees.ts
  /api/onboarding    → src/routes/onboarding.ts
  /api/profiles      → src/routes/profiles.ts
  /api/payroll       → src/routes/payroll.ts
  /api/work-centers  → src/routes/workCenters.ts
  /api/buk           → src/routes/buk.ts        (importación desde Excel)
  /api/health        → health check
  ```
- **Servicios:**
  - `services/auth.service.ts` — Google OAuth + resolución de usuario
  - `services/automation.service.ts` — Ejecuta automatizaciones de tareas de onboarding (EMAIL, CALENDAR, BUK_CHECK, EXTERNAL)
  - `services/email.service.ts` — SMTP via Nodemailer; contiene las plantillas de correo de onboarding
  - `services/sheets.service.ts` — Integración Google Sheets

### Frontend (`frontend/`)

- **Stack:** React 19 + TypeScript + Vite + TailwindCSS v4 (plugin de Vite, no CLI).
- **Puerto:** 3000. Proxy Vite envía `/api/*` → `http://localhost:4000`.
- **Path alias:** `@` → `frontend/src/`.
- **Estado global:** Zustand (`store/auth.ts`) para sesión de usuario. TanStack Query para datos del servidor (staleTime 5 min).
- **HTTP:** axios (`lib/api.ts`) con interceptor de JWT. Lee token de `localStorage` (`gdp_token`). Tiene lógica de re-login automático con las credenciales del usuario temporal — esto debe revisarse cuando se active Google OAuth.
- **Routing:** React Router v7. Layout único `AppLayout` con sidebar de navegación.
- **Páginas activas:**
  - `/employees` — Dotación (listado + drawer de detalle)
  - `/colaboradores` — Directorio de colaboradores (tarjetas con búsqueda y filtros)
  - `/colaboradores/:id` — Ficha completa con tabs: Datos (editable), Contratos, Remuneraciones, Ausencias, Centros
  - `/centros-trabajo` — Centros de trabajo
  - `/onboarding` — Procesos de onboarding
  - `/perfiles` — Perfiles del equipo RRHH
  - `/buk` — Importación de Excel desde BUK
- **Despliegue:** Vercel (configurado en `frontend/vercel.json`).

### Importación de datos (flujo Excel manual)

No hay integración directa con ninguna API externa. El equipo RRHH exporta reportes manualmente desde BUK y los coloca en `reportes/` (raíz del proyecto), organizado por razón social:

```
reportes/
├── Comunicaciones/
│   ├── Dotación YYYY-MM.xlsx
│   ├── Sueldos YYYY-MM.xlsx
│   ├── Vacaciones tomadas YYYY-MM.xlsx
│   └── Vacaciones y licencia YYYY-MM.xlsx
└── Consultoría/
    ├── Dotación YYYY-MM.xlsx
    ├── Sueldos YYYY-MM.xlsx
    ├── Vacaciones tomadas YYYY-MM.xlsx
    └── Vacaciones y licencia YYYY-MM.xlsx
```

`GET /api/buk/preview` parsea estos archivos con `xlsx` y los compara contra la DB, devolviendo un diff (nuevos, cambios, sincronizados). `POST /api/buk/apply` aplica los cambios seleccionados. La UI en `/buk` permite revisar y confirmar cada importación antes de escribir en la DB. Previred no está implementado.

---

## Modelo de Datos Central

El esquema vive en `backend/prisma/schema.prisma`. Entidades núcleo:

- `Employee` — Colaborador. Campos extendidos desde BUK: `jobTitle`, `jobFamily`, `costCenter`, `vinculo`, `reemplazaA`, `supervisorName/Title`, etc.
- `Contract` — Contrato laboral. Tipos: `INDEFINIDO`, `PLAZO_FIJO`, `HONORARIOS`, `PRACTICA`.
- `WorkCenter` + `EmployeeWorkCenter` — Centros de trabajo (DIRECTO/INDIRECTO) con asignaciones por colaborador y razón social.
- `PayrollEntry` — Liquidaciones mensuales (importadas desde Excel BUK). Unique por `(employeeId, legalEntity, year, month)`.
- `Leave` — Vacaciones y permisos (tipos: `VACACIONES`, `LICENCIA_MEDICA`, etc.).
- `VacationBalance` — Saldo de vacaciones por colaborador × razón social × mes. Campos: `saldoLegal`, `saldoProgresivas`, `saldoAdministrativos`, `diasLicencias`, `vacacionesTomadas`. Importado desde Excel "Vacaciones y licencia". Unique por `(employeeId, legalEntity, year, month)`.
- `OnboardingProcess` + `OnboardingTask` — Proceso de onboarding con hitos por período (`PRE_INGRESO`, `DIA_1`, `SEMANA_1`, `MES_1`, `EVALUACION`) y automatizaciones.
- `Profile` + `ProfileRole` — Perfiles del equipo RRHH con roles por área (BUK, SMART, ADMINISTRACION, etc.) y tipo (RESPONSABLE_HITO, ENVIA_CORREOS, etc.).

---

## Convenciones de Código

- **Idioma de código:** Inglés (variables, funciones, clases, nombres de modelos).
- **Idioma de comentarios y UI:** Español.
- **RUT chileno:** Formato `XX.XXX.XXX-X` con dígito verificador en mayúscula. Ver `normalizeRut()` en `backend/src/routes/buk.ts`.
- **Fechas:** ISO 8601 internamente; `DD/MM/YYYY` en UI.
- **Moneda:** CLP como entero (sin decimales). Campos `salary`, `grossSalary`, `liquidSalary` son `Int` en Prisma.
- Los tipos TypeScript del frontend y backend **no se comparten** — cada workspace define los suyos en `src/types/index.ts`. Mantenerlos sincronizados manualmente cuando cambie el schema.

---

## Variables de Entorno Requeridas

El archivo `.env` vive en `backend/` y se carga via `--env-file=.env` en `tsx watch`. No usa `dotenv` en código. Ver `.env.example` para la plantilla completa.

```env
DATABASE_URL=postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[ref]:[pwd]@aws-0-[region].supabase.com:5432/postgres
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_URL=http://localhost:3000
```

Supabase requiere dos URLs: `DATABASE_URL` usa el **connection pooler** (puerto 6543), `DIRECT_URL` usa la conexión directa (puerto 5432) y es la que usa Prisma para ejecutar migraciones.

## Conexión a Supabase

Para conectar a un proyecto Supabase nuevo:

```bash
# 1. Actualizar backend/.env con las URLs de Supabase
# 2. Empujar el schema a la DB
cd backend && npm run db:push

# O si se quiere usar el sistema de migraciones:
npm run db:migrate
```

Las migraciones existentes en `backend/prisma/migrations/` documentan la evolución del schema y se pueden aplicar en orden con `npm run db:deploy`.

---

## Despliegue

El proyecto corre solo en entorno local. No hay configuración de despliegue activa.

---

## Módulos del Sistema

> **Término correcto:** siempre referirse a las personas como **"Colaborador"**, nunca "empleado". El identificador único de todo colaborador es siempre el **RUT** (no el ID interno de la DB).

---

### Colaborador — Data Dictionary

El Colaborador es la entidad central del sistema. Su identificador único siempre es el **RUT** (nunca el UUID interno). Todos los módulos giran en torno a él.

Los datos de un colaborador provienen de cuatro fuentes:
- **BUK Dotación** — Excel exportado manualmente (`reportes/*/Dotación*.xlsx`)
- **BUK Sueldos** — Excel exportado manualmente (`reportes/*/Sueldos*.xlsx`)
- **BUK Vacaciones Tomadas** — Excel exportado manualmente (`reportes/*/Vacaciones tomadas*.xlsx`)
- **BUK Vacaciones y licencia** — Excel exportado manualmente (`reportes/*/Vacaciones y licencia*.xlsx`); contiene saldos acumulados por mes
- **Manual** — ingresado directamente en GDP, no tiene equivalente en BUK

---

#### Identidad y contacto

| Campo | Origen | Columna BUK | Notas |
|---|---|---|---|
| `rut` | BUK Dotación | `Empleado - Número de Documento` | Normalizado a formato `XX.XXX.XXX-X` con DV en mayúscula |
| `firstName` | BUK Dotación | Derivado de `Empleado - Nombre Completo` | Parsing: las palabras 3 en adelante (BUK usa formato "Apellido1 Apellido2 Nombre") |
| `lastName` | BUK Dotación | Derivado de `Empleado - Nombre Completo` | Parsing: las primeras 2 palabras |
| `email` | Auto + Manual | — | Al importar se genera `{digitos_rut}@buk.import`; debe reemplazarse con el correo real |
| `personalEmail` | Manual | — | Correo personal; se usa en Onboarding para envíos previos al ingreso |
| `phone` | Manual | — | No viene de BUK |
| `birthDate` | Manual | — | BUK lo tiene internamente pero no aparece en los Excel de dotación |
| `address` | Manual | — | Dirección completa |
| `city` | Manual | — | Ciudad de residencia |
| `commune` | Manual | — | Comuna (subdivide la ciudad) |
| `nationality` | Manual | — | Default `"Chilena"` |
| `gender` | Manual | — | Valores en DB: `M` / `F` / `male` / `female` (inconsistencia heredada, normalizar) |

#### Previsión social

| Campo | Origen | Columna BUK | Notas |
|---|---|---|---|
| `afp` | BUK Dotación | `Plan - Fondo de Cotización` | Almacenado en minúsculas; ej: `"modelo"`, `"habitat"` |
| `isapre` | BUK Dotación | `Plan - Fonasa/Isapre` | Almacenado en minúsculas; ej: `"fonasa"`, `"banmédica"` |
| `previredCode` | Manual | — | Campo reservado, no implementado |

#### Datos laborales

| Campo | Origen | Columna BUK | Notas |
|---|---|---|---|
| `status` | BUK Dotación | `Empleado - Estado` | `Activo→ACTIVE`, `Inactivo→INACTIVE`; ver regla DUPLICATE más abajo |
| `startDate` | BUK Dotación | `Trabajo - Fecha Ingreso Compañía` | Fecha de ingreso a la compañía (Excel serial → Date UTC) |
| `endDate` | BUK Dotación | `Trabajo - Fecha Vencimiento Contrato` | Solo para plazo fijo; `null` si es indefinido |
| `jobTitle` | BUK Dotación | `Trabajo - Cargo` | Cargo directo del colaborador en BUK |
| `jobFamily` | BUK Dotación | `Trabajo - Familia de Cargo` | Agrupador de cargos (ej: "Tecnología", "Creativo") |
| `workSchedule` | BUK Dotación | `Trabajo - Jornada Laboral` | Texto libre (ej: `"Mensual 40.0 hrs. (L, M, M, J, V)"`) |
| `supervisorName` | BUK Dotación | `Trabajo - Nombre Supervisor` | Nombre del jefe directo según BUK |
| `supervisorTitle` | BUK Dotación | `Trabajo - Cargo Supervisor` | Cargo del supervisor |
| `costCenter` | BUK Dotación | `Trabajo - Centro de Costos` | String libre de BUK; distinto a los `WorkCenter` de GDP (ver abajo) |
| `exclusive` | Manual | — | Booleano: exclusividad laboral con Surmedia |
| `vinculo` | Manual | — | `"Planta"` o `"Reemplazo"`; editable inline en tabla de Dotación |
| `reemplazaA` | Manual | — | Nombre de la persona a quien reemplaza (solo cuando `vinculo = "Reemplazo"`) |

> **Diferencia `costCenter` vs `WorkCenter`:** `costCenter` es un string que viene de BUK y refleja el centro de costos administrativo interno. `WorkCenter` son las entidades propias de GDP (con presupuesto, ingresos, etc.) a las que se asigna el colaborador manualmente.

#### Contratos (`Contract[]`)

Cada colaborador puede tener múltiples contratos (activos e históricos). La razón social del contrato determina en qué empresa está registrado.

| Campo | Origen | Columna BUK | Notas |
|---|---|---|---|
| `type` | BUK Dotación | `Trabajo - Tipo de Contrato` | `INDEFINIDO` / `PLAZO_FIJO` / `HONORARIOS` / `PRACTICA` |
| `startDate` | BUK Dotación | `Trabajo - Fecha Ingreso Compañía` | Misma fecha que `Employee.startDate` al crear |
| `endDate` | BUK Dotación | `Trabajo - Fecha Vencimiento Contrato` | `null` si indefinido |
| `legalEntity` | BUK Dotación | Determinado por la carpeta del Excel | `COMUNICACIONES_SURMEDIA` o `SURMEDIA_CONSULTORIA` |
| `salary` | BUK Dotación | — | Inicia en `0`; no se llena automáticamente desde Excel de sueldos |
| `grossSalary` | Manual / referencia | — | Se puede poblar, pero el dato definitivo vive en `PayrollEntry` |
| `isActive` | Derivado | — | `true` al crear; `false` cuando se termina o reemplaza por uno nuevo |

#### Remuneraciones (`PayrollEntry[]`)

Una entrada por colaborador × razón social × mes. Son el dato financiero real, separado del contrato.

| Campo | Origen | Columna BUK | Notas |
|---|---|---|---|
| `year` / `month` | BUK Sueldos | `Mes de Cálculo` + lógica de año | El año se infiere por rollover de meses en el archivo |
| `grossSalary` | BUK Sueldos | `Sueldo Bruto` | Entero CLP |
| `liquidSalary` | BUK Sueldos | `Sueldo Líquido` | Entero CLP; lo que se muestra en el drawer |
| `items` | BUK Sueldos | Columnas `Haberes Imponibles - *` y `Haberes No Imponibles - *` | Array JSON con `{name, amount, taxable}`. En el drawer se clasifican en Bonos y Horas Extras |
| `legalEntity` | BUK Sueldos | Carpeta del Excel | Permite ver remuneraciones por razón social por separado |

#### Ausencias (`Leave[]`)

| Tipo | Origen | Fuente BUK |
|---|---|---|
| `VACACIONES` | BUK Vacaciones Tomadas | Excel `Vacaciones tomadas`; campos: RUT, nombre, inicio, término |
| `LICENCIA_MEDICA` / `LICENCIA_MATERNIDAD` / `LICENCIA_PATERNIDAD` | Manual | No vienen de Excel; se ingresan en GDP |
| `PERMISO` / `OTRO` | Manual | No vienen de Excel |

Las vacaciones importadas quedan con `status: APPROVED` automáticamente. Las licencias se ven en el tab "Licencias" de Dotación.

#### Saldo de vacaciones (`VacationBalance[]`)

Una entrada por colaborador × razón social × mes. Importado desde Excel "Vacaciones y licencia".

| Campo | Columna BUK | Notas |
|---|---|---|
| `saldoLegal` | `Saldo Legal` | Días de vacaciones legales disponibles |
| `saldoProgresivas` | `Saldo Progresivas` | Días de vacaciones progresivas acumulados |
| `saldoAdministrativos` | `Saldo Administrativos` | Días adicionales de tipo administrativo |
| `diasLicencias` | `Días Licencias` | Días de licencia médica en el período |
| `vacacionesTomadas` | `Vacaciones Tomadas` | Días de vacaciones ya utilizados |

Se muestra en el tab **Ausencias** de `/colaboradores/:id` como 4 números grandes (último mes registrado por razón social).

#### Datos gestionados en GDP (no BUK)

| Relación | Módulo | Descripción |
|---|---|---|
| `workCenters[]` (`EmployeeWorkCenter`) | Centros de Trabajo | Asignación manual del colaborador a uno o más centros. Lleva `legalEntity` porque la misma persona puede estar en centros de distintas razones sociales |
| `onboardingProcesses[]` | Onboarding | Vinculación opcional; el proceso puede existir sin que el colaborador esté en la DB |
| `documents[]` | — | Documentos del colaborador (no implementado aún en UI) |
| `user?` | Auth | Cuenta de acceso al sistema GDP; vincula el `Employee` con un `User` para login |
| `positionId` / `position` | — | FK a `Position` (cargo formal con departamento); distinto de `jobTitle` que viene de BUK |
| `departmentId` / `department` | — | FK a `Department`; distinto de la Familia de Cargo de BUK |
| `managerId` | — | Auto-referencia a otro `Employee` como jefe directo; distinto de `supervisorName` (string de BUK) |

---

#### Estado DUPLICATE — detalle técnico

Al importar dotación, si un RUT ya existe en la DB pero ahora aparece en la otra razón social (o en la misma con sueldo $0), el sistema lo marca `DUPLICATE`. Criterio actual: el colaborador viene con sueldo bruto $0 en el Excel de Sueldos → es el duplicado.

Casos de ambigüedad que requieren intervención manual:
1. Un colaborador sin sueldo en el Excel de Dotación actual pero que sí tuvo sueldo antes (baja o salida)
2. Alan Alcayaga — trabaja para ambas razones sociales; **ninguno** de sus registros debe marcarse DUPLICATE

Pendiente: UI para que RRHH marque manualmente el duplicado cuando el mismo RUT está en ambas empresas.

---

### Colaboradores (`/colaboradores`)

Módulo independiente para navegar y editar la ficha de un colaborador en profundidad. Complementa Dotación (que es más operativa/tabular) con una vista enfocada en el individuo.

**`/colaboradores`** — Directorio con tarjetas (grid). Filtros: búsqueda libre, razón social (Todas / Comunicaciones / Consultoría), estado (Todos / Activos / Inactivos). Cada tarjeta muestra avatar con iniciales, nombre completo, cargo (`jobTitle`), RUT, badge de razón social y punto de estado.

**`/colaboradores/:id`** — Ficha completa con 5 tabs:

- **Datos** — Identidad, contacto, datos laborales, previsión social. Tiene **modo edición** completo: botón "Editar" → todos los campos se vuelven inputs/selects controlados → "Guardar" hace PATCH a `/api/employees/:id`.
- **Contratos** — Lista de contratos (activos e históricos) con tipo, razón social, fechas y estado.
- **Remuneraciones** — Tabla de `PayrollEntry` mes a mes con bruto, líquido y detalle de ítems (bonos, horas extras).
- **Ausencias** — Saldo de vacaciones actual (card con 4 números: saldo legal, progresivas, administrativos, licencias), seguido de listado de `Leave` individuales.
- **Centros** — Centros de trabajo asignados al colaborador con razón social.

**Patrón de edición (`empToForm`):** la función `empToForm(emp)` inicializa un objeto `FormData` tipado desde el `Employee`. Los componentes `TextField`, `DateField`, `SelectField` son controlados con `onChange`. Al guardar, convierte `exclusive` de string a booleano antes del PATCH. El backend acepta todos los campos via whitelist en `PATCH /api/employees/:id`.

---

### Dotación (`/employees`)

Módulo principal de gestión de la nómina. Tiene tres tabs:

- **Personas** — tabla principal de colaboradores con filtros (razón social, estado, tipo de contrato, mes/año activo, búsqueda libre) y ordenamiento por cualquier columna. Columnas visibles: Colaborador, Vínculo, Razón Social, Centros de Trabajo, Estado, Cargo, Ciudad, Jornada, Tipo Contrato, Ingreso, Término, Exclusividad, RUT, Género, Supervisor.
- **Vacaciones / Licencias** — ausencias del período filtradas por mes y año, con vista tabla o calendario.

Panel de **Ingresos y Salidas** muestra movimientos del mes seleccionado.

**Drawer de colaborador:** ficha completa con datos personales, laborales, contratos vigentes e históricos, y remuneraciones mes a mes con detalle de bonos y horas extras.

**Campo Vínculo** (editable inline desde la tabla): `Planta` o `Reemplazo`. Si es Reemplazo, se puede registrar el nombre de la persona a quien reemplaza.

**Estado DUPLICADO — regla de negocio clave:**
Un mismo RUT puede estar registrado en ambas razones sociales en BUK (por visibilidad o administración). El registro que pertenece a la razón social donde el colaborador **no percibe sueldo** (Sueldo Base $0 en BUK) o **no tiene trabajo asignado** ("Empleado sin Trabajo" en BUK) se marca como `DUPLICATE`. Excepción conocida: Alan Alcayaga trabaja genuinamente para ambas razones sociales y no debe marcarse duplicado.

Pendiente: el sistema aún no permite que RRHH marque manualmente cuál es el duplicado cuando el mismo RUT se carga en ambas empresas; hoy la detección es parcial (verifica si tiene sueldo).

**Deuda técnica pendiente:** al re-importar desde BUK, el sistema siempre sobreescribe. A futuro se quiere que pregunte si desea conservar los valores editados manualmente en GDP.

---

### Centros de Trabajo (`/centros-trabajo`)

Agrupadores de colaboradores por proyecto o área de negocio. Cada centro tiene nombre, tipo (`DIRECTO` / `INDIRECTO`), presupuesto, y ubicación.

Un colaborador puede estar asignado a múltiples centros. La asignación lleva `legalEntity`, ya que un mismo colaborador puede pertenecer a centros distintos según la razón social. La asignación se gestiona inline desde la tabla de Dotación (clic en la columna Centros de una fila).

**Ingresos mensuales** (`WorkCenterIngreso`): representan los ingresos económicos del proyecto o cliente que ese centro genera. Por ahora son datos mock ingresados manualmente; no provienen de ningún sistema externo. Sirven para poner en perspectiva el costo de la dotación asignada al centro.

El dashboard del módulo muestra viñetas arrastrables con métricas por centro.

---

### Onboarding (`/onboarding`)

Seguimiento del proceso de ingreso de nuevos colaboradores durante los primeros 90 días. El **Día 1** es el día de ingreso del colaborador (campo `startDate` del proceso).

#### Segmentos del proceso

El proceso se organiza en **4 segmentos temporales**. En el esquema Prisma se modelan con 5 `OnboardingPeriod`, donde `DIA_1` y `SEMANA_1` son sub-tramos del mismo segmento "Primera Semana":

| Segmento | Período(s) DB | Tramo | Tipo de hitos |
|---|---|---|---|
| **Pre Ingreso** | `PRE_INGRESO` | Mínimo 7 días antes del Día 1 | Mixto: "Carta oferta recibida y aceptada" es **fecha específica**; el resto (documentos, coordinación, BUK, correo empresa, etc.) son **plazos** |
| **Primera Semana** | `DIA_1` | Día 1 exacto (fecha de ingreso) | Todos **fecha específica** — ocurren el día de ingreso: bienvenida, EPP, inducción jefatura, kit, firmas, computador, etc. |
| **Primera Semana** | `SEMANA_1` | Días 2–5 hábiles | Todos **plazos** — a completar durante la primera semana: foto, SSO, presentación empresa, seguro, Pluxee, foto web |
| **Primer Mes** | `MES_1` | Hasta el Día 30 | Mixto: "Checkpoint 1 · Día 30" es **fecha específica**; "Mentor asignado" y "Café virtual con directores" son **plazos** |
| **Segundo Mes** | `EVALUACION` | Días 60 y 90 | Todos **fecha específica** — "Checkpoint 2 · Día 60" y "Feedback 3 meses · Día 90" |

**Hito de fecha específica:** se ejecuta en una fecha fija y normalmente genera un evento de Google Calendar (`automationType: CALENDAR` con `daysFromStart`, o es acción puntual del Día 1).  
**Hito de plazo:** debe completarse antes del fin del segmento; no tiene fecha exacta asignada (`automationType: EMAIL`, `MANUAL`, `BUK_CHECK`, `SHEET_VERIFY`, `EXTERNAL`).

> **Nota de fechas:** el `startDate` se almacena como mediodía UTC (`T12:00:00Z`) para evitar desfases de zona horaria en el frontend (Chile UTC-3/UTC-4).

#### Creación de procesos

Cada proceso se crea a partir de una **plantilla global de hitos** (`OnboardingTemplateTask`). Al crear un proceso, el usuario puede seleccionar qué hitos aplican (por período completo o uno a uno). El proceso **no requiere** que el colaborador exista en la DB de empleados — se registra con nombre libre y se vincula a un `Employee` en forma posterior.

El formulario de creación exige: nombre completo y empresa (`legalEntity`) como campos obligatorios. "Centro de Trabajo" es un dropdown con los `WorkCenter` existentes. "Cargo" es un dropdown con los `jobTitle` únicos existentes en la DB, con opción de ingresar uno nuevo manualmente.

Tipos de automatización por hito: `MANUAL`, `EMAIL`, `CALENDAR`, `BUK_CHECK`, `EXTERNAL`, `SHEET_VERIFY`. **Ninguna automatización está operativa aún; toda la lógica de `automation.service.ts` y `email.service.ts` está en desarrollo.**

La tab **Herramientas** es un placeholder, pendiente de implementar.

Los perfiles (ver módulo Perfiles) se asignan a los hitos para indicar quién es responsable, quién envía correos, quién recibe copia, etc.

---

### Perfiles (`/perfiles`)

Directorio de personas que participan en cualquier proceso interno de RRHH (no exclusivo del equipo RRHH). Incluye jefaturas, TI, administración, mentores, y cualquier persona con rol en el proceso de onboarding.

Cada perfil tiene: nombre, cargo, email, teléfono, notas.

Se les asignan roles cruzando **ÁREA** × **TIPO DE ROL**:

- **Áreas:** `BUK`, `SMART`, `ADMINISTRACION`, `ACREDITACION`, `INGRESANTE`, `JEFATURA`, `MENTORIA`, `CHECKPOINTS`, `GENERAL`
- **Tipos de rol:** `ENVIA_CORREOS`, `RECIBE_CORREOS`, `COPIA_CORREOS`, `PREPARA_ADM_FISICA`, `RESPONSABLE_HITO`

Un perfil puede tener múltiples combinaciones área+rol. Estas combinaciones se usan para asignar automáticamente responsabilidades cuando se crea un proceso de onboarding.

---

### Calendario (`/calendario`)

Módulo transversal de vista de fechas relevantes de toda la organización. Centraliza en un solo calendario visual todas las fuentes de datos temporales de GDP.

**Vistas:** Mes (BUK-style: barras horizontales que se extienden entre días), Semana (misma grilla para 7 días, sin límite de lanes), Día (listado detallado). Navegación con `<` `>` y botón "Hoy". Hacer clic en un día desde vista Mes/Semana navega a la vista Día de ese día.

**Fuentes de datos** — endpoint `GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` (`backend/src/routes/calendar.ts`):

| Tipo | Descripción | Color |
|---|---|---|
| `VACACIONES` | `Leave` de tipo VACACIONES (aprobadas o pendientes) | verde |
| `LICENCIA_MEDICA` / `_MATERNIDAD` / `_PATERNIDAD` | `Leave` de tipos licencia | naranja / rosado / violeta |
| `PERMISO` / `OTRO` | Otros tipos de `Leave` | amarillo / gris |
| `INGRESO` | Colaboradores con `startDate` en el rango (status ACTIVE/ON_LEAVE) | azul |
| `SALIDA` | Colaboradores con `endDate` en el rango | rojo |
| `ONBOARDING` | 5 hitos por proceso activo: Pre-ingreso (−7d), Ingreso (0d), Semana 1 (+1d), Mes 1 (+8d), Evaluación (+60d) | índigo/violeta |
| `ONBOARDING_TASK` | Tareas tipo CALENDAR de procesos activos con su `daysFromStart` | violeta |
| `VENCIMIENTO` | Contratos activos con `endDate` en el rango | ámbar |
| `FECHA_RELEVANTE` | Fechas recurrentes mensuales hardcodeadas en el backend: Pagos Antofagasta (d31), Pagos Santiago (d5), Revisión Honorarios (d20), Pagos Servicios Prov. (d25) | cian |

**Filtros** (panel derecho): 8 categorías con checkbox coloreado, independientes entre sí. Todos activos por defecto.

**Carga a Google Calendar por perfil:** botón "Cargar a Calendar" en el header. Abre un modal donde:
1. Se selecciona un `Profile` existente (dropdown con todos los perfiles)
2. Se muestran los eventos filtrados del rango actual con checkboxes (todos marcados por defecto)
3. Cada evento tiene un link individual a Google Calendar (visible al hover) con el email del perfil como invitado
4. "Abrir en Google Calendar" abre todos los seleccionados como eventos new-tab usando la URL de GCal con `add=profile.email`

> **Fechas relevantes:** para agregar o modificar las fechas recurrentes hardcodeadas, editar `RECURRING` en `backend/src/routes/calendar.ts`. Cuando se implemente CRUD de fechas relevantes, se requerirá un nuevo modelo Prisma `CalendarEvent`.

---

### Importables Excel (`/buk`)

Módulo para importar datos desde reportes Excel exportados manualmente de BUK. No hay conexión directa con la API de BUK.

**Flujo:** Preview (diff contra DB) → Selección de registros a aplicar → Apply.

Los archivos Excel deben ubicarse en `reportes/Comunicaciones/` y `reportes/Consultoría/`. El sistema selecciona automáticamente el archivo más reciente que contenga la keyword correspondiente en el nombre.

**Tres tipos de datos que maneja:**

1. **Sueldos** (keyword `Sueldos`): crea o actualiza `PayrollEntry` por colaborador / mes / razón social. Incluye detalle de ítems (haberes imponibles y no imponibles). Los valores de bruto y líquido son editables antes de aplicar. Las secciones muestran: Nuevos, Cambios (diff de montos), Ya sincronizados.

2. **Dotación** (keyword `Dotación`): actualiza estado, AFP, isapre, cargo, familia de cargo, supervisor, tipo de contrato y fecha de vencimiento. También puede crear colaboradores nuevos que no existen en la DB. La detección de DUPLICADO depende parcialmente de esta importación (colaborador sin sueldo → `DUPLICATE`).

3. **Vacaciones tomadas** (keyword `Vacaciones tomadas`): crea registros `Leave` de tipo `VACACIONES` con fechas y días calculados. Solo registra las nuevas (no duplica las ya existentes).

4. **Vacaciones y licencia** (keyword `Vacaciones y licencia`): crea o actualiza registros `VacationBalance` con los saldos acumulados de vacaciones y licencias por colaborador × razón social × mes. Se hace upsert por la clave única `(employeeId, legalEntity, year, month)`.
