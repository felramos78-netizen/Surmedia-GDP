# Integraciones del Ecosistema Digital

Documentación técnica de cada integración entre GDP y las plataformas externas de Surmedia.

---

## 1. BUK (RRHH Principal)

**Propósito:** BUK es el sistema maestro de RRHH. GDP consume su API para sincronizar datos de colaboradores, contratos y liquidaciones.

**Dirección del flujo:** BUK → GDP (lectura principal) y GDP → BUK (actualizaciones específicas).

**Datos sincronizados:**

| Dato | Frecuencia | Dirección |
|---|---|---|
| Listado de colaboradores | Diario | BUK → GDP |
| Contratos vigentes | Diario | BUK → GDP |
| Liquidaciones de sueldo | Mensual | BUK → GDP |
| Solicitudes de vacaciones | Tiempo real (webhook) | BUK ↔ GDP |
| Evaluaciones de desempeño | Bajo demanda | BUK → GDP |

**Configuración:**

```env
BUK_API_KEY=your_api_key
BUK_BASE_URL=https://app.buk.cl/api/v1
BUK_COMPANY_ID=surmedia_company_id
BUK_WEBHOOK_SECRET=webhook_secret_for_validation
```

**Endpoints utilizados:**
- `GET /employees` — Listado de colaboradores
- `GET /employees/{id}` — Detalle de colaborador
- `GET /contracts` — Contratos
- `GET /payrolls` — Liquidaciones
- `POST /webhooks` — Registro de webhooks

**Notas:**
- La API de BUK usa autenticación Bearer Token.
- Revisar documentación oficial en el portal de desarrolladores de BUK.
- Los cambios críticos (ej: término de contrato) deben seguir originándose en BUK.

---

## 2. BUK Asistencia

**Propósito:** Sincronizar marcajes de entrada/salida, turnos y control de horas.

**Dirección del flujo:** BUK Asistencia → GDP.

**Datos sincronizados:**

| Dato | Frecuencia | Dirección |
|---|---|---|
| Marcajes diarios | Cada hora | BUK Asistencia → GDP |
| Turnos asignados | Semanal | BUK Asistencia → GDP |
| Horas extra aprobadas | Tiempo real | BUK Asistencia → GDP |
| Ausencias justificadas | Tiempo real | BUK Asistencia → GDP |

**Procesamiento en GDP:**
- Calcular horas trabajadas por colaborador/día/semana/mes.
- Detectar inconsistencias (marcaje de entrada sin salida).
- Generar reportes de asistencia para jefaturas.
- Alimentar el cálculo de remuneraciones variables.

---

## 3. Previred

**Propósito:** Declaración y pago mensual de cotizaciones previsionales (AFP, salud, seguro de cesantía).

**Dirección del flujo:** GDP → Previred (push mensual).

**Proceso mensual:**

```
1. GDP genera archivo de nómina (último día hábil del mes)
2. Validación de datos (RUTs, montos, AFP/isapre de cada colaborador)
3. Generación de archivo en formato Previred (.txt o integración API)
4. Envío a Previred
5. Confirmación y guardado del comprobante en GDP
```

**Campos requeridos por Previred:**

| Campo | Descripción |
|---|---|
| RUT trabajador | Formateado sin puntos, con guión |
| RUT empleador | RUT de Surmedia |
| Remuneración imponible | Monto base para calcular cotizaciones |
| AFP | Código de AFP del trabajador |
| Isapre/Fonasa | Código de institución de salud |
| Meses cotizados | Para trabajadores con contratos parciales |

**Configuración:**

```env
PREVIRED_RUT_EMPRESA=12345678-9
PREVIRED_PASSWORD=your_previred_password
PREVIRED_BASE_URL=https://www.previred.com/api
```

**Importante:**
- Esta integración maneja datos financieros y legales sensibles.
- Toda operación debe quedar registrada en el `audit_log`.
- Validar siempre los montos antes del envío.
- El archivo de nómina debe ser aprobado por RRHH antes del envío.

---

## 4. Suite de Google (Google Workspace)

**Propósito:** Autenticación SSO, almacenamiento de documentos en Drive y sincronización con Google Sheets para reportes.

**Dirección del flujo:** Bidireccional.

**Usos:**

| Uso | Descripción |
|---|---|
| **Autenticación** | Login con cuenta @surmedia.cl via OAuth 2.0 |
| **Google Drive** | Carpeta por colaborador con documentos (contratos, finiquitos, certificados) |
| **Google Sheets** | Exportación de reportes de RRHH |
| **Google Forms** | Encuestas de clima laboral, formularios de incorporación |
| **Google Meet** | Links de entrevistas integrados en el proceso de selección |

**Configuración OAuth:**

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://gdp.surmedia.cl/auth/google/callback
GOOGLE_DRIVE_FOLDER_ID=root_folder_id_for_employee_docs
```

**Estructura de carpetas en Drive:**
```
GDP - Documentos RRHH/
├── Colaboradores/
│   ├── {RUT} - {Nombre Colaborador}/
│   │   ├── Contrato/
│   │   ├── Anexos/
│   │   ├── Liquidaciones/
│   │   └── Otros/
├── Plantillas/
└── Reportes/
```

---

## 5. Microsoft 365

**Propósito:** Alternativa de autenticación SSO y envío de correos transaccionales mediante Outlook/Exchange.

**Dirección del flujo:** Bidireccional.

**Usos:**

| Uso | Descripción |
|---|---|
| **Autenticación** | Login alternativo con cuenta Microsoft |
| **Correo** | Notificaciones automáticas via Microsoft Graph API |
| **Calendario** | Creación de eventos (reuniones de evaluación, onboarding) |

**Configuración:**

```env
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
MICROSOFT_FROM_EMAIL=rrhh@surmedia.cl
```

---

## 6. Trello

**Propósito:** Gestionar flujos de trabajo de RRHH: procesos de selección, onboarding, offboarding.

**Dirección del flujo:** GDP → Trello (creación y actualización de tarjetas).

**Tableros gestionados por GDP:**

| Tablero | Flujo Automatizado |
|---|---|
| **Selección y Reclutamiento** | Nueva posición abierta → tarjeta en "Vacantes" |
| **Onboarding** | Colaborador ingresado → checklist de onboarding |
| **Offboarding** | Término de contrato registrado → checklist de offboarding |
| **Gestión de Solicitudes** | Solicitudes de colaboradores pendientes de aprobación |

**Configuración:**

```env
TRELLO_API_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token
TRELLO_ONBOARDING_BOARD_ID=board_id
TRELLO_OFFBOARDING_BOARD_ID=board_id
TRELLO_SELECTION_BOARD_ID=board_id
```

**Automatización recomendada:**
Combinar Trello con Zapier para triggers automáticos desde GDP.

---

## 7. Zapier

**Propósito:** Automatización de flujos entre plataformas sin código adicional. Actúa como pegamento entre el ecosistema digital.

**Dirección del flujo:** GDP → Zapier (webhooks de salida) y Zapier → GDP (webhooks de entrada).

**Automatizaciones configuradas:**

| Trigger (GDP) | Acción (Zapier) | Destino |
|---|---|---|
| Nuevo colaborador creado | Crear carpeta en Drive | Google Drive |
| Nuevo colaborador creado | Crear tarjeta de onboarding | Trello |
| Contrato finalizado | Crear tarjeta de offboarding | Trello |
| Evaluación de desempeño completada | Notificar al colaborador | Gmail |
| Solicitud de vacaciones aprobada | Notificar al colaborador y jefatura | Outlook/Gmail |
| Marcaje de asistencia anómalo | Alertar a RRHH | Gmail |

**Configuración:**

```env
ZAPIER_WEBHOOK_NEW_EMPLOYEE=https://hooks.zapier.com/hooks/catch/...
ZAPIER_WEBHOOK_CONTRACT_END=https://hooks.zapier.com/hooks/catch/...
ZAPIER_WEBHOOK_LEAVE_APPROVED=https://hooks.zapier.com/hooks/catch/...
ZAPIER_INCOMING_SECRET=secret_for_validating_zapier_webhooks
```

**Formato de payload enviado a Zapier:**

```json
{
  "event": "employee.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "employeeId": "uuid",
    "fullName": "Juan Pérez",
    "rut": "12.345.678-9",
    "email": "jperez@surmedia.cl",
    "department": "Tecnología",
    "position": "Desarrollador Frontend",
    "startDate": "2024-02-01"
  }
}
```

---

## 8. Smart CTO

**Propósito:** Gestión específica del equipo tecnológico de Surmedia. Sincronizar datos relevantes del personal de tecnología.

**Estado:** A definir alcance de integración con el equipo de Smart CTO.

**Datos potenciales a sincronizar:**
- Asignación de proyectos técnicos
- Stack tecnológico por colaborador
- Certificaciones técnicas
- Métricas de productividad del equipo tech

---

## 9. DT Digital

**Propósito:** Plataforma de transformación digital de Surmedia. GDP puede ser fuente de datos para iniciativas de digitalización de procesos de personas.

**Estado:** A definir alcance de integración con el equipo de DT Digital.

---

## 10. Adobe Suite

**Nota:** Adobe Suite es una herramienta del equipo creativo, no requiere integración directa con GDP. Sin embargo, debe considerarse al modelar el perfil del colaborador para reflejar correctamente los roles y habilidades del equipo de diseño.

---

## Estado de Integraciones

| Integración | Estado | Prioridad |
|---|---|---|
| BUK | Planificada | Alta |
| BUK Asistencia | Planificada | Alta |
| Previred | Planificada | Alta |
| Google Suite (Auth) | Planificada | Alta |
| Google Drive | Planificada | Media |
| Zapier | Planificada | Media |
| Trello | Planificada | Media |
| Microsoft 365 | Planificada | Media |
| Smart CTO | Por definir | Baja |
| DT Digital | Por definir | Baja |
