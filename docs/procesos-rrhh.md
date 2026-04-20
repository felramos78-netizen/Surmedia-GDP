# Procesos de Recursos Humanos

Descripción de los flujos de trabajo principales que GDP automatiza y soporta.

---

## 1. Proceso de Incorporación (Onboarding)

### Trigger
Ingreso de un nuevo colaborador confirmado por RRHH en BUK.

### Flujo

```
[RRHH crea colaborador en BUK]
         │
         ▼ (webhook)
[GDP recibe evento "employee.created"]
         │
         ├─→ Crear carpeta en Google Drive
         ├─→ Crear tarjeta en Trello (tablero Onboarding)
         ├─→ Enviar correo de bienvenida al colaborador
         ├─→ Notificar a IT para crear cuenta corporativa
         ├─→ Notificar a jefatura directa
         └─→ Registrar en GDP (sincronizar desde BUK)
```

### Checklist de Onboarding en Trello

**Lista: "Por Hacer"**
- [ ] Firmar contrato laboral
- [ ] Entregar documentos requeridos (cédula, certificado AFP, etc.)
- [ ] Crear cuenta de correo corporativo
- [ ] Dar acceso a herramientas del equipo
- [ ] Entregar equipamiento
- [ ] Presentar al equipo
- [ ] Enviar invitación a Google Workspace
- [ ] Asignar perfil en BUK

**Lista: "En Proceso"**
- Items movidos a medida que se completan

**Lista: "Completado"**
- Items finalizados

### Documentos que GDP genera automáticamente
- Carta de bienvenida (plantilla en Google Docs)
- Checklist de documentos pendientes
- Acceso al portal del colaborador

---

## 2. Proceso de Desvinculación (Offboarding)

### Trigger
Registro de término de contrato en BUK o GDP.

### Flujo

```
[RRHH registra término de contrato]
         │
         ├─→ Solicitar aprobación (si aplica según causal)
         ▼
[GDP procesa término]
         │
         ├─→ Crear tarjeta en Trello (tablero Offboarding)
         ├─→ Notificar a IT (revocar accesos)
         ├─→ Calcular finiquito (preview)
         ├─→ Agendar firma de finiquito
         ├─→ Enviar notificación al colaborador
         └─→ Actualizar estado en GDP y BUK
```

### Checklist de Offboarding en Trello

- [ ] Notificar al colaborador (carta de aviso)
- [ ] Preparar finiquito en BUK
- [ ] Agendar firma de finiquito
- [ ] Revocar accesos a sistemas (IT)
- [ ] Recuperar equipamiento
- [ ] Transferencia de conocimiento
- [ ] Entrevista de salida
- [ ] Declarar cotizaciones del mes en Previred
- [ ] Archivar documentos en Google Drive

---

## 3. Gestión de Vacaciones y Permisos

### Solicitud por Portal del Colaborador

```
[Colaborador solicita vacaciones en GDP]
         │
         ▼
[GDP verifica saldo disponible]
         │
    ┌────┴────┐
    │ Sin     │ Con saldo
    │ saldo   │
    ▼         ▼
[Rechazar] [Notificar a jefatura directa]
                    │
              ┌─────┴─────┐
              │ Rechaza   │ Aprueba
              ▼           ▼
       [Notificar   [Actualizar saldo]
        rechazo]    [Sincronizar con BUK]
                    [Notificar colaborador]
                    [Marcar en Google Cal.]
```

### Tipos de Permiso

| Tipo | Días Legales | Remunerado |
|---|---|---|
| Vacaciones anuales | 15 días hábiles (min. legal) | Sí |
| Licencia médica | Según certificado | Parcial (subsidio) |
| Pre y postnatal | 6 semanas pre + 12 post | Sí (subsidio SEIS) |
| Postnatal parental | 12 semanas adicionales | Sí (subsidio) |
| Permiso de paternidad | 5 días | Sí |
| Permiso administrativo | Según política interna | Sí |
| Día de cumpleaños | 1 día (política Surmedia) | Sí |

---

## 4. Proceso de Liquidación de Sueldos

### Ciclo Mensual

```
[Cierre de asistencia del mes]
         │
         ▼
[BUK calcula liquidaciones]
         │
         ▼ (sync automático)
[GDP importa liquidaciones desde BUK]
         │
         ├─→ Generar archivo Previred
         │         │
         │    [RRHH revisa y aprueba]
         │         │
         │    [GDP envía a Previred]
         │
         ├─→ Subir liquidaciones a Google Drive
         ├─→ Notificar a colaboradores (PDF disponible)
         └─→ Registrar en historial de GDP
```

### Calendario Mensual Típico

| Día | Actividad |
|---|---|
| 25-28 | Cierre de asistencia del mes en BUK Asistencia |
| 28-30 | BUK procesa liquidaciones |
| 1 | Sync automático GDP ← BUK |
| 2-3 | RRHH revisa y aprueba en GDP |
| 3-5 | Declaración en Previred |
| 5 | Pago de sueldos |
| 5-6 | Notificación a colaboradores |

---

## 5. Evaluación de Desempeño

### Ciclo Semestral / Anual

```
[RRHH abre período de evaluación]
         │
         ▼
[GDP notifica a todos los evaluadores]
         │
         ▼
[Evaluador completa formulario en GDP]
         │
         ▼
[GDP notifica al colaborador para autoevaluación]
         │
         ▼
[Reunión 1:1 entre jefatura y colaborador]
         │
         ▼
[Evaluación finalizada → cierre en GDP]
         │
         ├─→ Archivar resultado en expediente del colaborador
         └─→ Sync con BUK
```

### Escala de Evaluación

| Puntaje | Nivel | Descripción |
|---|---|---|
| 5.0 | Excepcional | Supera consistentemente las expectativas |
| 4.0 - 4.9 | Sobre lo esperado | Supera las expectativas en áreas clave |
| 3.0 - 3.9 | Cumple expectativas | Desempeño sólido y consistente |
| 2.0 - 2.9 | En desarrollo | Necesita mejorar en áreas relevantes |
| 1.0 - 1.9 | Bajo expectativas | No cumple con los requisitos del cargo |

---

## 6. Gestión Documental

### Documentos Obligatorios por Colaborador

**Al ingreso:**
- Copia de cédula de identidad
- Contrato laboral firmado
- Comprobante de AFP
- Comprobante de salud (Isapre o Fonasa)
- Ficha de datos personales

**Durante la relación laboral:**
- Anexos de contrato (cambios de cargo, sueldo)
- Liquidaciones mensuales
- Licencias médicas
- Permisos administrativos
- Evaluaciones de desempeño

**Al término:**
- Carta de aviso (si aplica)
- Finiquito firmado
- Certificado de cotizaciones

### Almacenamiento

Todos los documentos se almacenan en Google Drive bajo la estructura:
```
GDP - Documentos RRHH/Colaboradores/{RUT} - {Nombre}/
```

---

## 7. Reportería

### Reportes Disponibles en GDP

| Reporte | Frecuencia | Destinatario |
|---|---|---|
| Headcount por departamento | Mensual | Gerencia |
| Asistencia y ausentismo | Mensual | RRHH + Jefaturas |
| Rotación de personal | Mensual | RRHH + Gerencia |
| Costo de nómina | Mensual | Finanzas |
| Saldo de vacaciones | Bajo demanda | RRHH |
| Cumpleaños del mes | Mensual | RRHH |
| Vencimiento de contratos a plazo fijo | Semanal | RRHH |
| Evaluaciones pendientes | Bajo demanda | RRHH |

### Exportación

Todos los reportes exportables en:
- Excel (`.xlsx`) para análisis en Microsoft Office o Google Sheets
- PDF para distribución
- CSV para procesamiento automatizado
