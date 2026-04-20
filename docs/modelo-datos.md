# Modelo de Datos GDP

Descripción de las entidades principales del sistema y sus relaciones.

## Diagrama Entidad-Relación (Simplificado)

```
Department ──< Position ──< Employee >── Contract
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                 Attendance   Leave      Payroll
                                │
                          Performance
                                │
                           Document
```

---

## Entidades Principales

### `Employee` — Colaborador

Tabla central del sistema. Representa a cada persona que trabaja o trabajó en Surmedia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único interno |
| `rut` | VARCHAR(12) | RUT chileno cifrado (ej: 12.345.678-9) |
| `first_name` | VARCHAR(100) | Nombre(s) |
| `last_name` | VARCHAR(100) | Apellido paterno |
| `second_last_name` | VARCHAR(100) | Apellido materno |
| `email_work` | VARCHAR(255) | Correo corporativo (@surmedia.cl) |
| `email_personal` | VARCHAR(255) | Correo personal |
| `phone` | VARCHAR(20) | Teléfono |
| `birth_date` | DATE | Fecha de nacimiento |
| `gender` | ENUM | `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` |
| `nationality` | VARCHAR(50) | Nacionalidad |
| `address` | TEXT | Dirección |
| `commune` | VARCHAR(100) | Comuna |
| `city` | VARCHAR(100) | Ciudad |
| `region` | VARCHAR(100) | Región |
| `afp` | ENUM | `HABITAT`, `CAPITAL`, `CUPRUM`, `MODELO`, `PLANVITAL`, `PROVIDA`, `UNO` |
| `health_institution` | ENUM | `FONASA`, `ISAPRE` |
| `health_institution_name` | VARCHAR(100) | Nombre de Isapre (si aplica) |
| `position_id` | UUID | FK → `Position` |
| `department_id` | UUID | FK → `Department` |
| `manager_id` | UUID | FK → `Employee` (jefatura directa) |
| `buk_id` | VARCHAR(50) | ID del colaborador en BUK |
| `status` | ENUM | `ACTIVE`, `INACTIVE`, `ON_LEAVE` |
| `hire_date` | DATE | Fecha de ingreso a la empresa |
| `termination_date` | DATE | Fecha de término (si aplica) |
| `termination_reason` | ENUM | Causal de término (Art. 159, 160, 161) |
| `created_at` | TIMESTAMPTZ | Fecha de creación del registro |
| `updated_at` | TIMESTAMPTZ | Última actualización |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Contacto de Emergencia (tabla separada `EmergencyContact`):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `name` | VARCHAR(200) | Nombre del contacto |
| `relationship` | VARCHAR(50) | Parentesco |
| `phone` | VARCHAR(20) | Teléfono |

---

### `Department` — Departamento

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `name` | VARCHAR(100) | Nombre del departamento |
| `code` | VARCHAR(20) | Código abreviado (ej: `TECH`, `COMM`, `ADM`) |
| `parent_id` | UUID | FK → `Department` (para sub-áreas) |
| `manager_id` | UUID | FK → `Employee` (jefe de área) |
| `cost_center` | VARCHAR(50) | Centro de costo contable |
| `is_active` | BOOLEAN | |

**Departamentos iniciales de Surmedia:** (confirmar con organigrama real)
- Tecnología (`TECH`)
- Comunicaciones / Contenidos (`COMM`)
- Administración y Finanzas (`ADM`)
- Comercial (`COM`)
- Recursos Humanos (`RRHH`)
- Diseño (`DES`)

---

### `Position` — Cargo

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `title` | VARCHAR(150) | Nombre del cargo |
| `department_id` | UUID | FK → `Department` |
| `level` | ENUM | `INTERN`, `JUNIOR`, `SENIOR`, `LEAD`, `MANAGER`, `DIRECTOR`, `C_LEVEL` |
| `is_active` | BOOLEAN | |

---

### `Contract` — Contrato Laboral

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `type` | ENUM | `INDEFINITE`, `FIXED_TERM`, `PART_TIME`, `INTERNSHIP`, `FREELANCE` |
| `start_date` | DATE | Inicio del contrato |
| `end_date` | DATE | Término (null si es indefinido) |
| `base_salary` | INTEGER | Remuneración base en CLP (sin decimales) |
| `currency` | VARCHAR(3) | Siempre `CLP` |
| `work_schedule` | ENUM | `FULL_TIME`, `PART_TIME`, `REMOTE`, `HYBRID` |
| `weekly_hours` | INTEGER | Horas semanales contractuales |
| `work_mode` | ENUM | `ON_SITE`, `REMOTE`, `HYBRID` |
| `buk_contract_id` | VARCHAR(50) | ID del contrato en BUK |
| `document_url` | TEXT | URL al contrato firmado en Google Drive |
| `is_current` | BOOLEAN | Contrato vigente |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `Attendance` — Registro de Asistencia

Sincronizado desde BUK Asistencia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `date` | DATE | Fecha del marcaje |
| `check_in` | TIMESTAMPTZ | Hora de entrada |
| `check_out` | TIMESTAMPTZ | Hora de salida |
| `worked_hours` | DECIMAL(5,2) | Horas trabajadas calculadas |
| `overtime_hours` | DECIMAL(5,2) | Horas extra |
| `status` | ENUM | `PRESENT`, `ABSENT`, `LATE`, `REMOTE`, `ON_LEAVE` |
| `source` | ENUM | `BUK_ASISTENCIA`, `MANUAL` |
| `notes` | TEXT | Observaciones |

---

### `Leave` — Vacaciones y Permisos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `type` | ENUM | `VACATION`, `SICK_LEAVE`, `MATERNITY`, `PATERNITY`, `ADMINISTRATIVE`, `OTHER` |
| `start_date` | DATE | Inicio del permiso |
| `end_date` | DATE | Fin del permiso |
| `days` | INTEGER | Días hábiles |
| `status` | ENUM | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `approver_id` | UUID | FK → `Employee` (quien aprueba) |
| `approved_at` | TIMESTAMPTZ | |
| `rejection_reason` | TEXT | Motivo de rechazo |
| `buk_request_id` | VARCHAR(50) | ID de la solicitud en BUK |
| `created_at` | TIMESTAMPTZ | |

**Saldo de Vacaciones (`LeaveBalance`):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `year` | INTEGER | Año |
| `entitled_days` | INTEGER | Días con derecho (por ley: 15 días) |
| `used_days` | INTEGER | Días utilizados |
| `pending_days` | INTEGER | Días pendientes de años anteriores |
| `available_days` | INTEGER | Días disponibles (calculado) |

---

### `Payroll` — Liquidación de Sueldo

Sincronizado desde BUK.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `period_year` | INTEGER | Año del período |
| `period_month` | INTEGER | Mes del período (1-12) |
| `base_salary` | INTEGER | Sueldo base (CLP) |
| `gross_salary` | INTEGER | Sueldo bruto (CLP) |
| `net_salary` | INTEGER | Sueldo líquido (CLP) |
| `afp_amount` | INTEGER | Monto cotización AFP (CLP) |
| `health_amount` | INTEGER | Monto cotización salud (CLP) |
| `tax_amount` | INTEGER | Impuesto único de segunda categoría (CLP) |
| `total_deductions` | INTEGER | Total deducciones (CLP) |
| `total_allowances` | INTEGER | Total asignaciones/bonos (CLP) |
| `buk_payroll_id` | VARCHAR(50) | ID en BUK |
| `document_url` | TEXT | URL a la liquidación en Drive |
| `previred_declared` | BOOLEAN | Si fue declarado en Previred |
| `previred_declared_at` | TIMESTAMPTZ | Fecha de declaración |
| `created_at` | TIMESTAMPTZ | |

---

### `Performance` — Evaluación de Desempeño

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `evaluator_id` | UUID | FK → `Employee` |
| `period` | VARCHAR(20) | Ej: `2024-H1`, `2024-ANNUAL` |
| `score` | DECIMAL(4,2) | Puntaje (ej: 1.0 a 5.0) |
| `status` | ENUM | `DRAFT`, `IN_PROGRESS`, `COMPLETED` |
| `goals` | JSONB | Metas y resultados |
| `feedback` | TEXT | Retroalimentación general |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

---

### `Document` — Documentos del Colaborador

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `employee_id` | UUID | FK → `Employee` |
| `type` | ENUM | `CONTRACT`, `ANNEX`, `PAYROLL`, `TERMINATION`, `CERTIFICATE`, `ID_CARD`, `OTHER` |
| `name` | VARCHAR(255) | Nombre descriptivo del documento |
| `file_url` | TEXT | URL en Google Drive |
| `drive_file_id` | VARCHAR(255) | ID del archivo en Google Drive |
| `uploaded_by` | UUID | FK → `Employee` |
| `created_at` | TIMESTAMPTZ | |

---

### `AuditLog` — Registro de Auditoría

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | FK → `Employee` (quien realizó la acción) |
| `action` | VARCHAR(100) | Ej: `employee.update`, `payroll.view`, `contract.terminate` |
| `entity_type` | VARCHAR(50) | Entidad afectada (ej: `Employee`) |
| `entity_id` | UUID | ID del registro afectado |
| `old_value` | JSONB | Valor anterior |
| `new_value` | JSONB | Valor nuevo |
| `ip_address` | VARCHAR(45) | IP del cliente |
| `created_at` | TIMESTAMPTZ | |

---

## Enums Importantes

### `TerminationReason` (Causales de Término)

```typescript
enum TerminationReason {
  ART_159_1 = 'Mutuo acuerdo',
  ART_159_2 = 'Renuncia voluntaria',
  ART_159_3 = 'Muerte del trabajador',
  ART_159_4 = 'Vencimiento del plazo',
  ART_159_5 = 'Conclusión del trabajo',
  ART_159_6 = 'Caso fortuito o fuerza mayor',
  ART_160_1 = 'Falta de probidad',
  ART_160_2 = 'Conductas indebidas',
  ART_160_3 = 'No concurrencia injustificada',
  ART_160_4 = 'Abandono de trabajo',
  ART_160_5 = 'Actos en perjuicio del empleador',
  ART_160_6 = 'Perjuicio material intencional',
  ART_160_7 = 'Incumplimiento grave del contrato',
  ART_161   = 'Necesidades de la empresa',
}
```

### `AFP`

```typescript
enum AFP {
  HABITAT  = 'Habitat',
  CAPITAL  = 'Capital',
  CUPRUM   = 'Cuprum',
  MODELO   = 'Modelo',
  PLANVITAL = 'PlanVital',
  PROVIDA  = 'Provida',
  UNO      = 'Uno',
}
```
