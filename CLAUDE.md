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
  /api/payroll       → src/routes/payroll.ts
  /api/work-centers  → src/routes/workCenters.ts
  /api/buk           → src/routes/buk.ts        (sincronización BUK: API o Excel)
  /api/documents     → src/routes/bukDocuments.ts (documentos BUK vía API, solo lectura, solo ADMIN)
  /api/recruitment   → src/routes/recruitment.ts  (base de CVs; solo roles RRHH)
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
  - `/colaboradores` — Directorio de colaboradores (tarjetas con búsqueda y filtros)
  - `/colaboradores/:id` — Ficha completa con tabs: Datos (editable), Contratos, Remuneraciones, Ausencias, Centros
  - `/centros-trabajo` — Centros de trabajo
  - `/proveedores` — Gestión de proveedores Smart (honorarios y compras)
  - `/calendario` — Vista de fechas relevantes de la organización
  - `/onboarding` — Procesos de onboarding
  - `/buk` — Sincronización con BUK (API por defecto, Excel como respaldo)
  - `/recruitment` — Reclutamiento: base de CVs por vacante, importada desde la carpeta de Drive
  - `/documents` — Documentos de cada colaborador leídos en vivo desde la API de BUK (solo ADMIN)
- **Despliegue:** Vercel (configurado en `frontend/vercel.json`).

### Importación de datos (API de BUK, Excel como respaldo)

Los datos de BUK se sincronizan desde la **API de BUK** (ver módulo Importables `/buk` y módulo Documentos). Como respaldo, se mantiene el flujo anterior: el equipo RRHH exporta reportes manualmente desde BUK y los coloca en `reportes/` (raíz del proyecto), organizado por razón social:

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

`GET /api/buk/preview?source=api|excel` lee la API de BUK (por defecto) o parsea estos archivos con `xlsx`, y los compara contra la DB, devolviendo un diff (nuevos, cambios, sincronizados). `POST /api/buk/apply` aplica los cambios seleccionados. La UI en `/buk` permite revisar y confirmar cada importación antes de escribir en la DB. Previred no está implementado.

---

## Modelo de Datos Central

El esquema vive en `backend/prisma/schema.prisma`. Entidades núcleo:

- `Employee` — Colaborador. Campos extendidos desde BUK: `jobTitle`, `jobFamily`, `costCenter`, `vinculo`, `reemplazaA`, `supervisorName/Title`, etc.
- `Contract` — Contrato laboral. Tipos: `INDEFINIDO`, `PLAZO_FIJO`, `HONORARIOS`, `PRACTICA`.
- `WorkCenter` + `EmployeeWorkCenter` — Centros de trabajo (DIRECTO/INDIRECTO) con asignaciones por colaborador y razón social.
- `PayrollEntry` — Liquidaciones mensuales (importadas desde Excel BUK). Unique por `(employeeId, legalEntity, year, month)`.
- `Leave` — Vacaciones y permisos (tipos: `VACACIONES`, `LICENCIA_MEDICA`, etc.).
- `VacationBalance` — Saldo de vacaciones por colaborador × razón social × mes. Campos: `saldoLegal`, `saldoProgresivas`, `saldoAdministrativos`, `diasLicencias`, `vacacionesTomadas`. Importado desde Excel "Vacaciones y licencia". Unique por `(employeeId, legalEntity, year, month)`.
- `JobOpening` + `Candidate` + `CandidateApplication` + `CandidateFile` — Base de CVs de Reclutamiento (ver módulo Reclutamiento).
- `BukDocument` + `DocumentCategory` + `BukDocumentSync` — Metadata de los documentos BUK de cada colaborador, clasificada por palabras clave (ver módulo Documentos).
- `OnboardingProcess` + `OnboardingTask` — Proceso de onboarding con hitos por período (`PRE_INGRESO`, `DIA_1`, `SEMANA_1`, `MES_1`, `EVALUACION`) y automatizaciones.

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

Las migraciones existentes en `backend/prisma/migrations/` solo **documentan** la evolución del schema: la DB actual de Supabase se ha mantenido con `db push` y `prisma migrate status` las reporta todas como no aplicadas. **No correr `npm run db:deploy` ni `db:migrate` contra esa DB** (intentaría recrear tablas existentes). Para cambios de schema: generar el SQL con `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, revisar que sea aditivo, guardarlo como carpeta de migración y aplicarlo con `npx prisma db execute --file <migration.sql> --schema prisma/schema.prisma` (habilitar RLS en tablas nuevas).

---

## Despliegue

El proyecto corre solo en entorno local. No hay configuración de despliegue activa.

### App de escritorio (`desktop/`, Electron)

Forma de usar GDP para Felipe y Paula (reemplaza a `gdp-arrancar.bat` y al `git pull` manual). No es un workspace del monorepo: tiene su propio `node_modules`.

```bash
cd desktop && npm install     # una vez
npm start                     # probar los cambios del repo (modo desarrollo, puerto 4781)
npm run publicar              # publicar una versión nueva para las apps instaladas
npm run dist                  # solo generar el instalador local, sin publicar
```

- **Instalador autónomo:** `scripts/stage.js` arma `desktop/stage/` (backend compilado + `node_modules` de producción + cliente Prisma, y el build de Vite), que va dentro del instalador como `resources/backend` y `resources/frontend`. La app instalada no usa el repo, git ni Node. Compila con `vite build` + `tsc` directos (el `tsc -b` del frontend tiene errores de tipos antiguos).
- **Configuración:** el `.env` se lee desde `G:\Unidades compartidas\GDP\env de GDP\.env` (carpeta de Drive que solo tienen Felipe y Paula; ruta alternativa elegible en la app, guardada en `%APPDATA%\GDP Surmedia\config.json`). Al cambiar una variable, editar **ese** archivo además de `backend/.env`.
- `main.js` levanta el backend como proceso hijo con el Node de Electron (`ELECTRON_RUN_AS_NODE`), en `127.0.0.1:4780`, con `cwd` en `%APPDATA%\GDP Surmedia\data` (ahí quedan los `uploads/`). El backend sirve también el frontend (`GDP_STATIC_DIR` en `server.ts`). El respaldo Excel de `/buk` no está disponible en la app instalada (no tiene `reportes/`).
- **Publicar y actualizar:** `npm run publicar` sube la versión (1.0.N+1), arma el paquete, corre la **prueba de humo** (`scripts/smoke.js`: servidor empaquetado responde, sirve la interfaz y Prisma consulta la base; si falla no publica), genera el instalador y lo deja en `G:\…\env de GDP\versiones\` con `latest.json` (versión, sha256, commits desde la anterior como novedades). Al abrir, la app (`updater.js`) compara versiones, ofrece actualizar, copia el instalador a `%TEMP%`, verifica el hash y lo ejecuta en silencio (`/S --force-run`). Commitear `desktop/package.json` después de publicar.
- **Registros:** `%APPDATA%\GDP Surmedia\logs\gdp.log` (sesión actual; `gdp.anterior.log` la previa) y `actualizaciones.log` (local). En Drive, `versiones\historial-publicaciones.log` (quién publicó qué) y `versiones\registro\<usuario>.log` (actualizaciones de cada equipo).
- **Login con Google:** se abre en el navegador del sistema; Google vuelve a `http://localhost:4780/api/auth/google/callback` (debe estar registrada en el cliente OAuth de Google Cloud) y el backend entrega el token a la ventana por IPC (`GDP_DESKTOP=1`, `desktopHandoff()` en `routes/auth.ts`). Si el puerto 4780 está ocupado la app usa otro y el login con Google no funciona.

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

### Dotación (`/employees`) — removida de la navegación principal

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

### Proveedores (`/proveedores`)

Módulo Smart para gestionar proveedores externos (personas o empresas) que emiten boletas de honorarios o facturas de compra. Corresponde al módulo "Smart" del sistema.

Modelos principales: `SmartProveedor` (RUT, razón social, clasificación, área, categoría, vínculo opcional a `WorkCenter`) y `SmartDocument` (documentos tributarios: honorarios o compras, con montos, fechas y estado de pago).

**Categorías de documento:** `HONORARIO` y `COMPRA` (`SmartDocCategory`).

La página en `frontend/src/pages/proveedores/ProveedoresPage.tsx`. El backend expone rutas en `backend/src/routes/smart.ts`.

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

#### Creación de procesos — flujo en 2 pasos

**Paso 1 — Formulario + selección de hitos:**
- Campos obligatorios: nombre completo, empresa (`legalEntity`), email corporativo, cargo, centro de trabajo, fecha de ingreso.
- "Centro de Trabajo" es un dropdown con los `WorkCenter` existentes. "Cargo" es un dropdown con los `jobTitle` únicos de la DB, con opción de ingresar uno manualmente.
- El colaborador puede buscarse por RUT/nombre y pre-rellenar datos, o ingresarse manualmente sin vínculo a `Employee`.
- Selección de hitos por período (con toggle "Marcar todos / Quitar todos").
- Botón "Continuar →" (deshabilitado hasta completar todos los campos obligatorios y seleccionar al menos un hito).

**Paso 2 — Vista de calendario y confirmación (ANTES de crear el proceso):**
- Muestra un grid de calendario mensual (`CalendarPreview`) con los eventos de tipo `CALENDAR` posicionados.
- Lista de eventos bajo el calendario. Cada evento muestra: **nombre del hito padre (nombre de la tarea)**, fecha, número de día (`Día -7`, `Día 0`, `Día +30`, etc.), duración e invitados.
- Para eventos con `durationMinutes > 0`: input de hora **obligatorio** y visible siempre — el botón "Crear proceso" permanece deshabilitado hasta llenar todos los horarios.
- Botón "Editar" por evento para editar los invitados (emails escritos a mano; el email del colaborador va siempre).
- Botón "Abrir" genera link a Google Calendar con los datos del evento.
- Botón "Volver" regresa al paso 1 sin crear nada.
- Botón **"Crear proceso"** llama al backend y cierra el modal; abre el drawer del proceso creado.

El proceso **no requiere** que el colaborador exista en la DB — se registra con nombre libre y se vincula a un `Employee` en forma posterior.

Tipos de automatización: `MANUAL`, `EMAIL`, `CALENDAR`, `BUK_CHECK`, `EXTERNAL`, `SHEET_VERIFY`. **Ninguna automatización está operativa aún.**

La tab **Herramientas** es un placeholder, pendiente de implementar.

El responsable de cada hito/subtarea es texto libre (`responsableName`) y los invitados de Calendar son emails libres (`attendeeEmails`). El módulo Perfiles se eliminó el 2026-09-28 (migración `20260928_remove_profiles`, script `prisma/migrate-remove-profiles.ts`); sus datos se convirtieron a texto libre.

#### Lógica de fechas — `computeTaskDate` y offsets

La función `computeTaskDate(task, base)` en `OnboardingDrawer.tsx` calcula la fecha de cada hito:

```
PRE_INGRESO: daysFromStart=N → offset = -N (N días ANTES del ingreso)
Todos los demás períodos: daysFromStart=N → offset = +N (N días DESPUÉS del ingreso)
```

**Fallback** cuando no hay `daysFromStart` configurado — `PERIOD_OFFSETS`:
```
PRE_INGRESO: -7  |  DIA_1: 0  |  SEMANA_1: 1  |  MES_1: 8  |  EVALUACION: 60
```

La misma lógica aplica a las subtareas Calendar (campo `plantilla` en JSON). Si los `daysFromStart` de subtareas tienen valores incorrectos, corregirlos con: `cd backend && npx tsx prisma/fix-subtask-days.ts`

#### Drawer del proceso (ficha)

- **Header:** avatar con iniciales, nombre, cargo, botones Descargar ICS / Editar / Cerrar.
- **Meta:** empresa, email, fecha de ingreso, "Día N de 90", badge de estado.
- **Barra de progreso:** `X/Y hitos · Z%`.
- **Tab Progreso:** hitos agrupados por período. Cada hito muestra: fecha (`DD mmm`), número de día (`Día -7`, `Día 0`, `Día +30`) y alerta ámbar si está vencido y no completado. Las subtareas también muestran fecha y número de día.
- **Botón Descargar ICS:** genera un `.ics` con todos los eventos CALENDAR del proceso (hitos y subtareas) usando las mismas fechas calculadas.

#### Plantilla de hitos (`OnboardingTemplateTask` / `OnboardingTemplateSubTask`)

Seed base en `backend/prisma/seed-onboarding.ts`. Las subtareas se crean/editan desde la UI (tab Hitos). El campo `plantilla` de cada subtarea es un JSON con: `{ daysFromStart, durationMinutes, attendeeEmails, ... }`. El campo `automationConfig` del hito padre tiene la misma estructura.

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

**Exportar a Google Calendar:** botón "Cargar a Calendar" en el header. Abre `CalendarExportModal`, donde:
1. Se elige el rango y se escribe el email destinatario
2. Se muestran los eventos filtrados del rango con checkboxes (los ya exportados a ese email quedan desmarcados)
3. "Descargar .ics" genera el archivo con el email como invitado, para importarlo en Google Calendar

**Reglas de correo** (cumpleaños/aniversarios): el remitente es un nombre libre (`fromName`, el email sale de `SMTP_USER`) y las copias son emails libres (`ccCustomEmails`).

> **Fechas relevantes:** para agregar o modificar las fechas recurrentes hardcodeadas, editar `RECURRING` en `backend/src/routes/calendar.ts`. Cuando se implemente CRUD de fechas relevantes, se requerirá un nuevo modelo Prisma `CalendarEvent`.

---

### Importables (`/buk`)

Módulo para sincronizar GDP con BUK. Dos fuentes, elegibles con un selector en la UI (`source` en `/preview` y `/apply`):

- **API BUK (por defecto)** — `services/bukApiImport.service.ts` arma desde la API las mismas filas que los lectores de Excel, así el diff y la UI no dependen de la fuente. Toma ~40 s; `/preview` guarda la lectura en memoria (30 min) y `/apply` aplica esa misma lectura. Endpoints: `/employees` (dotación; por RUT se usa la ficha activa o la última terminada, solo fichas activas o terminadas en el año), `/payroll_detail/month` (solo períodos **cerrados**; líquido = `income_net`), `/vacations` (solo trae **aprobadas**: las del año ya iniciadas → "tomadas", las futuras → "aprobadas"; tipo Legales/Administrativos/Progresivas en `reason`), `/employees/{id}/vacations_available` (saldo del mes en curso) y `/absences/licence` (días de licencia del mes). La API **no expone solicitudes de vacaciones pendientes de aprobar**.
- **Excel (respaldo)** — `services/bukExcelImport.service.ts`, los reportes de `reportes/`.

**Saldo de vacaciones:** el saldo de la API **ya descuenta las vacaciones aprobadas a futuro**; el del Excel no. `VacationBalance.source` (`API` / `EXCEL`) lo indica y el reporte de saldos (`GET /api/reports/vacaciones`) solo resta las vacaciones futuras cuando el saldo es `EXCEL`. La API solo entrega el saldo actual (no historial): el historial mensual se arma con cada sincronización.

**Flujo:** botón "Sincronizar con BUK" (preview: diff contra DB) → selección de registros a aceptar → "Importar" (apply). Cada apply queda registrado en `AuditLog` (`action = 'BUK_SYNC'`, con usuario y conteos); `GET /api/buk/last-sync` devuelve la última y se muestra en la página. El Excel se activa con un enlace secundario ("¿Problemas con la API de BUK? Usar reportes Excel").

Con la fuente Excel, los archivos deben ubicarse en `reportes/Comunicaciones/` y `reportes/Consultoría/`. El sistema selecciona automáticamente el archivo más reciente que contenga la keyword correspondiente en el nombre.

**Tres tipos de datos que maneja:**

1. **Sueldos** (keyword `Sueldos`): crea o actualiza `PayrollEntry` por colaborador / mes / razón social. Incluye detalle de ítems (haberes imponibles y no imponibles). Los valores de bruto y líquido son editables antes de aplicar. Las secciones muestran: Nuevos, Cambios (diff de montos), Ya sincronizados.

2. **Dotación** (keyword `Dotación`): actualiza estado, AFP, isapre, cargo, familia de cargo, supervisor, tipo de contrato y fecha de vencimiento. También puede crear colaboradores nuevos que no existen en la DB. La detección de DUPLICADO depende parcialmente de esta importación (colaborador sin sueldo → `DUPLICATE`).

3. **Vacaciones tomadas** (keyword `Vacaciones tomadas`): crea registros `Leave` de tipo `VACACIONES` con fechas y días calculados. Solo registra las nuevas (no duplica las ya existentes).

4. **Vacaciones y licencia** (keyword `Vacaciones y licencia`): crea o actualiza registros `VacationBalance` con los saldos acumulados de vacaciones y licencias por colaborador × razón social × mes. Se hace upsert por la clave única `(employeeId, legalEntity, year, month)`.

---

### Documentos (`/documents`)

Documentos de cada colaborador (liquidaciones, contratos, anexos, S.S.O, RIOHS, etc.) de ambas razones sociales, obtenidos desde la **API de BUK**. GDP guarda solo la **metadata** (nombre, carpeta, fecha, ficha BUK, categoría); los archivos viven en BUK y se descargan vía proxy. Acceso solo para `ADMIN`.

**Modelos** (`schema.prisma`, migración `20260922_add_buk_documents`, con RLS):
- `BukDocument` — un documento BUK. Unique `(legalEntity, bukFileId)`. Guarda `rut`, `personName` y `bukStatus` de la ficha (sirve también para ex-colaboradores sin ficha GDP), `employeeId` (vinculado por RUT), `searchText` normalizado y `removedAt` cuando deja de aparecer en BUK.
- `DocumentCategory` — tipo de documento (RIOHS, ODI, Liquidación, Anexo teletrabajo…): `group`, `keywords` (prefijos de palabra), `required` (obligatorio → cobertura) y `sortOrder` (prioridad: gana la primera que coincide). Se editan desde la UI; semilla inicial en `DEFAULT_CATEGORIES`.
- `BukDocumentSync` — registro de cada sincronización (`scope` = `ALL` o el RUT).

**Clasificación:** `categorize()` en `services/bukDocumentSync.service.ts` busca las palabras clave como inicio de palabra, primero en el nombre del archivo y, si nada coincide, en la carpeta; todo normalizado con `fold()` (`utils/text.ts`: sin tildes, minúsculas, `_ - .` como espacios; BUK a veces borra tildes: "Liquidacin"). Crear/editar/borrar una categoría reclasifica todo (`recategorizeAll`).

- **Backend:** `services/bukApi.service.ts` (cliente BUK de solo lectura; credenciales `BUK_URL_*` / `BUK_API_KEY_*` en `.env`), `services/bukDocumentSync.service.ts` (sincronización y clasificación) y `routes/bukDocuments.ts`:
  - `POST /api/documents/sync` — sincronización total en segundo plano (~280 fichas, ~80 s). También se dispara sola al abrir el resumen o el buscador si la última tiene más de 24 h.
  - `GET /api/documents/employee/:employeeId` — documentos del colaborador desde la DB (si nunca se sincronizó, consulta BUK en el momento). `POST .../sync` actualiza solo sus fichas ("Actualizar desde BUK").
  - `GET /api/documents/search?q=&categoryId=&legalEntity=&status=` — cuántos documentos coinciden y quiénes los tienen (`categoryId=none` → sin clasificar).
  - `GET /api/documents/summary` — dashboard: documentos por categoría, cobertura de los obligatorios por persona activa y nombres sin clasificar más frecuentes. `GET /api/documents/categories/:id/missing` — personas activas sin esa categoría en ninguna de sus fichas.
  - `POST/PATCH/DELETE /api/documents/categories` — CRUD de categorías.
  - `GET /api/documents/file/:legalEntity/:bukEmployeeId/:fileId` — proxy del archivo (BUK redirige a una URL S3 prefirmada; el cliente nunca la ve).
- **Frontend:** `pages/documents/DocumentsPage.tsx` con tres pestañas: **Resumen** (`DocumentDashboard.tsx` + `CategoryModal.tsx`), **Por colaborador** (`EmployeePicker.tsx` + `EmployeeDocuments.tsx`) y **Buscar documento** (`DocumentSearch.tsx`). La ficha `/colaboradores/:id` tiene además el tab "Documentos". Hook: `useBukDocuments.ts`.
- **Cobertura de obligatorios: por persona (RUT), no por ficha.** Una persona activa está cubierta si tiene el documento en cualquiera de sus fichas BUK (la otra razón social o una ficha anterior por recontratación). "Activa" = tiene al menos una ficha BUK activa **con documentos** (una ficha sin documentos no queda registrada).
- **Firmas:** cada documento guarda el estado de firma del trabajador (`employeeSign`) y de la empresa (`companySign`: representante legal, o "otro firmante" si el documento no lo usa, ej. relator en Capacitaciones) — `NO_REQUERIDA` / `SIN_SOLICITAR` (el documento pide la firma pero no se envió la solicitud; típico en liquidaciones) / `PENDIENTE` / `FIRMADA` / `RECHAZADA`. Se leen con `GET /docs/{fileId}` (`settings` + `signatures`), **una consulta por documento**: `refreshSignatures()` corre al final de cada sincronización solo para los nunca consultados, los pendientes y los "sin solicitar" recientes (60 días). Carga inicial: `prisma/backfill-signatures.ts` (~35 min para ~12.000). Se ven como dos columnas en las listas de archivos y como filtros en "Buscar documento".
- **ODI e IRL son equivalentes:** desde 2025 (DS 44) la IRL reemplazó a la ODI; cada persona suele tener una u otra, así que la cobertura por separado de cada una se ve baja.

---

### Reclutamiento (`/recruitment`)

Base de CVs por vacante. Acceso: `ADMIN`, `RRHH_MANAGER`, `RRHH_ANALYST` (datos personales de postulantes).

Los archivos **no se copian**: viven en la unidad compartida `G:\Unidades compartidas\GDP\Surmedia RRHH\Reclutamiento` (sincronizada con Google Drive para escritorio; ruta configurable con `RECRUITMENT_DRIVE_PATH`). GDP guarda los datos del candidato y la ruta relativa + hash sha1 de cada archivo, y los sirve desde disco (`GET /api/recruitment/files/:id`). Por eso solo funciona en el equipo que tiene Drive montado.

**Modelos** (migración `20260928_add_recruitment`, con RLS): `JobOpening` (una por carpeta de primer nivel, `driveFolder`), `Candidate` (email y RUT únicos, `linkedinUrl`, `source`, `referredBy`, `searchText` con `fold()`), `CandidateApplication` (candidato × vacante, `stage`, `isArchived`) y `CandidateFile` (`drivePath` único, `contentHash`, `removedAt`).

**Importación desde Drive** (`services/recruitmentDriveImport.service.ts`, pestaña "Importar desde Drive"): preview → revisión/edición → apply, como en `/buk`. Reglas de carpeta:
- Carpeta de primer nivel = vacante; los archivos sueltos en la raíz (cartas oferta, planillas, claves) se ignoran.
- Subcarpeta más profunda que indique etapa: "No aplica"/"Descartados" → `DESCARTADO`; "Aplica"/"Idóneos"/"Preseleccionados"/"Selección"/"terna"/"top" → `PRESELECCIONADO`; "Dudas" → `EN_REVISION`; resto → `RECIBIDO`. "old" en la ruta → `isArchived` (histórico).
- Nombre `1234567_cv_nombre_1234567890.pdf` o `applicant_…` → origen `PORTAL` (descargas de portales de empleo); carpeta "Hunting" → `HUNTING`.
- Un archivo ya importado que aparece en otra ruta (mismo hash) se trata como **movido**: se actualiza la ruta y la etapa según la nueva carpeta. Los que desaparecen se marcan `removedAt`.
- Mismo candidato en varios archivos: se une por email → RUT → LinkedIn (**no por nombre**: con nombres mal extraídos, como "Sobre Mí", juntaba a personas distintas); solo se completan datos vacíos.

**Extracción de datos** (`services/cvParser.service.ts`, PDF con `unpdf`, Word con `mammoth`): nombre (texto del CV cruzado con el nombre del archivo), email, teléfono (+56 9), RUT (valida DV) y LinkedIn (también desde los hipervínculos del PDF). Es heurística: se revisa antes de importar. El texto de los PDF sale a veces sin separadores: `cleanEmail()` / `cleanLinkedinUrl()` quitan lo que queda pegado ("...@gmail.comcontacto"). `prisma/fix-recruitment-candidates.ts` corrigió los datos importados con la primera versión.

**Perfil y preselección:** `Candidate` tiene campos de perfil (`professionalTitle`, `institution`, `city`, `yearsExperience`, `lastEmployer`, `lastPosition`, `sector`, `skills`, `tools`, `certifications`, `availability`). `prisma/import-preseleccion.ts` los cargó desde las planillas "Preselección*.xlsx" de Drive (solo campos vacíos; también corrige el nombre si el del CV venía mal) junto con sus columnas de puntos como criterios MANUAL. Pestaña **Preselección** (`PreselectionView.tsx`): tabla por vacante con Total + una columna por criterio + perfil completo; etapa, puntajes manuales y comentario se editan en la tabla.

**Criterios de puntaje** (`ScoringCriterion`, por vacante, `CriteriaModal.tsx`): `RULE` = campo + condición (contiene / no contiene / igual / ≥ / ≤ / tiene dato; varias alternativas separadas por coma) → `pointsIfTrue`, si no `pointsIfFalse`; `MANUAL` = puntaje a mano guardado en `CandidateApplication.manualScores` (`{criterionId: puntos}`). Las reglas se evalúan en el frontend (`scoreCriterion()` en `useRecruitment.ts`); el total es la suma.

**Tablas:** todas usan `components/ui/DataTable.tsx` (orden por columna + fila de filtros: texto, lista o rango numérico). Regla de GDP: toda tabla nueva debe ser ordenable y filtrable.

**Perfil con IA** (`services/cvAi.service.ts`, **Gemini, plan gratuito**, `GEMINI_API_KEY` y opcional `GEMINI_MODEL` en `.env`, por defecto `gemini-3.5-flash-lite`; los modelos 2.5 ya no están disponibles para cuentas nuevas): **solo a pedido** — barra "Completar perfiles con IA" en Candidatos (candidatos visibles con perfil incompleto y sin leer) o botón en la ficha. Gemini recibe el PDF tal cual (también CVs escaneados). Lote en segundo plano, uno a la vez con pausa (`GEMINI_PAUSE_MS`, 4,5 s) por los límites del plan gratuito; si se agota la cuota diaria se detiene. El resultado queda en `Candidate.aiSuggestion` y se revisa en la pestaña **Revisión IA** (campo actual vs. leído, marcados por defecto los vacíos y los nombres mal extraídos). El usuario no quiere consumo autónomo de tokens de Claude en GDP: no usar Claude para esto ni activar la IA en segundo plano.

Pendiente: importación desde Gmail (búsqueda automática de correos con CV adjunto; el adjunto se guardaría en la carpeta de Drive). Publicación en LinkedIn/Chiletrabajos descartada por ahora (sin API accesible y GDP no se publica en internet).
