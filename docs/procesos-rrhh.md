# Procesos de Recursos Humanos

Descripción de los flujos de trabajo principales que GDP automatiza y soporta, organizados según los **5 macro-módulos del DPDO Surmedia**.

---

# MACRO-MÓDULO 1: Gestión de Bienestar Laboral

## 1.1 Encuesta de Clima Laboral (CEAL-SUCESO)

El **CEAL-SUCESO** es el cuestionario oficial del Ministerio de Salud de Chile para medir riesgo psicosocial en el trabajo. Su aplicación es obligatoria cada dos años.

### Flujo

```
[RRHH abre ciclo de encuesta en GDP]
         │
         ├─→ GDP genera link de Google Forms (o CEAL externo)
         ├─→ Notificación masiva a todos los colaboradores
         │
[Período de respuesta (2-4 semanas)]
         │
         ▼
[Cierre del período]
         │
         ├─→ GDP registra tasa de participación
         ├─→ RRHH sube informe de resultados a Drive
         ├─→ GDP almacena resultados agregados por área
         └─→ RRHH genera plan de acción
```

### Tipos de Encuesta
| Tipo | Obligatoriedad | Frecuencia |
|---|---|---|
| CEAL-SUCESO | Legal (MINSAL) | Cada 2 años |
| Encuesta interna de clima | Voluntaria | Semestral o anual |

## 1.2 Comité Paritario

El comité paritario es un organismo de participación mixta (empresa-trabajadores) exigido por ley para empresas con 25+ trabajadores (Ley 16.744).

### Gestión en GDP
- Registro de miembros (representantes empresa y trabajadores)
- Registro de actas de reuniones mensuales
- Almacenamiento de actas en Google Drive
- Seguimiento de acuerdos adoptados

---

# MACRO-MÓDULO 2: Gestión de Talento

## 2.1 Reclutamiento y Selección

### Flujo de Reclutamiento

```
[Jefatura genera requerimiento de vacante]
         │
         ▼
[RRHH valida y crea JobPosting en GDP]
         │
         ├─→ Publicar en portales (LinkedIn, Get On Board, AIEP, etc.)
         ├─→ Publicar oferta interna (si aplica)
         └─→ Notificar a Trello (tablero Selección)
```

### Flujo de Selección

```
[Candidato aplica → GDP registra candidato]
         │
         ▼
[Screening RRHH]
         │
    ┌────┴────┐
  Rechaza   Avanza
    │         │
    ▼         ▼
[Notificar] [Agendar entrevista en GDP]
             │   (Google Meet automático)
             ▼
[Entrevistas por etapas]
         │
    ┌────┴────┐
  Rechaza   Finalista
             │
             ▼
[Generar Carta Oferta en GDP]
         │
    ┌────┴────┐
  Rechaza   Acepta
             │
             ▼
[Iniciar proceso de Onboarding]
```

### Portales de Publicación Utilizados
- LinkedIn Jobs
- Get On Board
- Trabajando.com
- Portales de universidades (para prácticas)
- Página web de Surmedia (si aplica)
- Comunicación interna (vacantes internas)

---

## 2.2 Proceso de Incorporación (Onboarding)

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

### Etapas del Onboarding en GDP/Trello

**Antecedentes del Ingresante**
- [ ] Cédula de identidad (ambos lados)
- [ ] Certificado de AFP vigente
- [ ] Certificado de salud (Isapre o Fonasa)
- [ ] Certificado de estudios (si el cargo lo requiere)
- [ ] Certificado de antecedentes

**Acreditaciones y Firma**
- [ ] Firma de contrato laboral
- [ ] Firma de reglamento interno
- [ ] Firma de política de confidencialidad

**Inducción Corporativa**
- [ ] Presentación de Surmedia (historia, valores, áreas)
- [ ] Presentación del Año de la Excelencia (iniciativa cultural vigente)
- [ ] Recorrido por instalaciones / Puntos de encuentro
- [ ] Presentación al equipo y jefatura directa

**Inducción SSO (Seguridad y Salud Ocupacional)**
- [ ] Reglamento de higiene y seguridad
- [ ] Procedimientos de emergencia
- [ ] Derecho a saber (riesgos del cargo)

**Programa de Mentoría**
- [ ] Asignación de mentor interno
- [ ] Primera reunión con mentor agendada
- [ ] Plan de mentoría definido (30/60/90 días)

**Elementos de Ingreso**
- [ ] Equipamiento entregado (notebook, accesorios)
- [ ] Tarjeta Pluxee activada
- [ ] Acceso a Google Workspace (@surmedia.cl)
- [ ] Acceso a BUK (portal colaborador)
- [ ] Acceso a herramientas del área

**Feedback e Indefinido**
- [ ] Reunión de seguimiento al mes 1
- [ ] Reunión de seguimiento al mes 3
- [ ] Evaluación período de prueba (mes 3 en contratos a plazo fijo)
- [ ] Firma de anexo indefinido (si aplica al término del período de prueba)

### Documentos que GDP genera automáticamente
- Carta de bienvenida (plantilla en Google Docs)
- Checklist de antecedentes pendientes
- Correo de bienvenida con accesos y canales internos
- Acceso al portal del colaborador

---

## 2.3 Capacitaciones

### Flujo de Capacitación Externa (SENCE / Copagada / Diplomado / Magíster)

```
[Colaborador o jefatura solicita capacitación]
         │
         ▼
[RRHH evalúa: ¿hay presupuesto? ¿aplica SENCE?]
         │
    ┌────┴────┐
  Sin ppto  Con ppto
             │
             ▼
[RRHH crea Training en GDP]
         │
         ├─→ Inscribir colaborador (TrainingEnrollment)
         ├─→ Registrar código SENCE si aplica
         ├─→ Registrar copago del colaborador (si aplica)
         ▼
[Capacitación en curso]
         │
         ▼
[Colaborador finaliza → RRHH actualiza estado]
         │
         ├─→ Subir certificado a Google Drive
         ├─→ Cerrar TrainingEnrollment con calificación
         └─→ Actualizar presupuesto ejecutado DPDO
```

### Tipos de Capacitación en GDP

| Tipo | Descripción | SENCE |
|---|---|---|
| Diplomado | Postítulo, generalmente universidad | A veces |
| Magíster | Posgrado académico | No |
| Curso copagado | Empresa + trabajador comparten costo | A veces |
| Curso SENCE | Financiado total o parcialmente por el Estado | Sí |
| Taller interno | Impartido por personal interno | No |
| Capacitación de Liderazgo | Programa para jefaturas | A veces |

---

## 2.4 Prácticas Laborales

- RRHH registra cada práctica con presupuesto mensual asignado
- GDP lleva el presupuesto anual de prácticas con ejecución real
- Al término de la práctica, GDP genera el certificado de práctica

---

## 2.5 Proceso de Desvinculación (Offboarding)

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

---

# MACRO-MÓDULO 3: Gestión de Valores

## 3.1 Comunicación Interna

GDP registra y organiza las comunicaciones internas de Surmedia:

| Canal | Descripción | Frecuencia |
|---|---|---|
| **La Alcuza** | Newsletter interno de Surmedia | Mensual |
| **Círculos SM** | Grupos temáticos de colaboradores | Variable |
| **Canal general** | Comunicados institucionales de RRHH | Según necesidad |
| **Cumpleaños** | Felicitaciones y recordatorio | Mensual |

GDP automatiza: recordatorio de cumpleaños del mes → notificación al canal correspondiente vía Zapier.

## 3.2 Reconocimientos

- RRHH o jefaturas registran reconocimientos en GDP
- GDP notifica al colaborador y lo comunica internamente (según configuración)
- Los reconocimientos quedan en el expediente del colaborador

## 3.3 Eventos Culturales (Celebraciones, Puntos de Encuentro)

- Registro en GDP con presupuesto y organizador responsable
- Incluye: Celebraciones anuales, "Año de la Excelencia", reuniones de equipos, actividades de integración
- Documentación (fotos, presentaciones) vinculada a Drive

---

# MACRO-MÓDULO 4: Gestión del Desempeño

## 4.1 Ciclo Anual de Evaluación de Desempeño

### Planificación (inicio del año)
- RRHH crea el `PerformanceCycle` en GDP con fechas y alcance
- Se definen objetivos a nivel empresa, área y cargo
- Se asignan evaluadores a cada colaborador

### Ejecución (Q3-Q4)
```
[GDP activa ciclo → notifica a evaluadores y evaluados]
         │
         ▼
[Colaborador completa autoevaluación en GDP]
         │
         ▼
[Jefatura completa evaluación en GDP]
         │
         ▼
[GDP agenda reunión 1:1 (Google Meet)]
         │
         ▼
[Reunión: acuerdo de puntaje final y plan de desarrollo]
         │
         ▼
[RRHH cierra ciclo → análisis de métricas]
```

### Planes de Sucesión
Al cierre de cada ciclo, RRHH identifica colaboradores con potencial para cargos clave y registra `SuccessionPlan` en GDP.

## 4.2 Descriptivos de Cargo y Diccionario de Competencias

- Cada `Position` tiene un `PositionDescription` versionado en GDP
- El diccionario de competencias define los comportamientos esperados por nivel
- GDP vincula competencias requeridas a cada cargo
- Documentos almacenados en Google Drive

---

# MACRO-MÓDULO 5: Gestión Documental

## 5.1 Gestión de Vacaciones y Permisos

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

## 5.2 Boletas de Honorarios

Proceso mensual para prestadores externos que emiten boleta de honorarios:

```
[Prestador emite boleta (SII electrónico)]
         │
         ▼
[RRHH registra en GDP: monto bruto, retención, neto]
         │
         ├─→ Subir PDF de boleta a Google Drive
         └─→ GDP genera informe mensual consolidado de honorarios
```

- La retención legal es 10.75% del monto bruto
- El informe mensual es insumo para el área de Finanzas/Contabilidad

## 5.3 Dotación — Contratos y Administración Documental

- GDP gestiona generación y archivo de contratos y anexos
- Contratos generados en BUK → sincronizados a GDP → archivados en Drive
- GDP alerta sobre contratos a plazo fijo próximos a vencer (30 días antes)

## 5.4 Procesos de Soporte (Beneficios)

| Beneficio | Proceso en GDP |
|---|---|
| **Seguro complementario** | Registro de póliza, vigencia, cobertura por colaborador |
| **Tarjeta Pluxee** | Registro de tarjeta asignada, monto mensual, activación |
| **Enrolamiento oficina** | Registro de accesos físicos y digitales asignados |

## 5.5 Presupuesto DPDO

- RRHH registra el presupuesto anual por categoría (Capacitación, Bienestar, Eventos, Beneficios, etc.)
- GDP calcula automáticamente el monto ejecutado vs. presupuestado
- Alertas cuando una categoría supera el 80% de ejecución

## 5.6 Proceso de Liquidación de Sueldos

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
