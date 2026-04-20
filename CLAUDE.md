# CLAUDE.md — Contexto del Proyecto GDP Surmedia

Este archivo provee contexto esencial para sesiones de desarrollo asistido por IA en el proyecto **Gestión de Personas Surmedia (GDP)**.

## Empresa: Surmedia

Empresa de medios y tecnología con sede en Chile. GDP es su sistema interno de Recursos Humanos construido para reemplazar y complementar los procesos manuales actualmente gestionados en Excel.

## Propósito del Proyecto

Centralizar la gestión de personas de Surmedia integrando todas las herramientas del ecosistema digital en un único sistema coherente. Eliminar silos de información, reducir trabajo manual y mejorar la experiencia del colaborador.

## Ecosistema Digital de Surmedia

### Plataformas Críticas (integraciones obligatorias)
- **BUK**: Sistema principal de RRHH. Contratos, liquidaciones, vacaciones, beneficios, evaluaciones de desempeño.
- **BUK Asistencia**: Control de marcaje y asistencia. Turnos, horas extra, ausencias.
- **Previred**: Declaración y pago de cotizaciones previsionales (AFP, salud) ante organismos chilenos.

### Plataformas Importantes (integraciones deseadas)
- **Microsoft Office / Outlook**: Documentos Word/Excel, correos corporativos.
- **Suite de Google**: Drive para almacenamiento, Sheets para reportes, Forms para encuestas, Meet para entrevistas.
- **Trello**: Flujos de trabajo del equipo de RRHH (onboarding, offboarding, procesos de selección).
- **Zapier**: Automatizaciones entre plataformas (ej: nuevo empleado en BUK → crear carpeta en Drive → crear tarjeta en Trello).

### Plataformas de Contexto
- **Adobe Suite**: Utilizada por el equipo creativo. Considerar al modelar perfiles y roles.
- **Smart CTO**: Gestión del equipo tecnológico.
- **DT Digital**: Iniciativas de transformación digital de la empresa.

## Arquitectura de Alto Nivel

```
[GDP Frontend] → [GDP API] → [PostgreSQL]
                     ↕
        [Integration Layer / Zapier]
                     ↕
    BUK | Previred | Google | Microsoft | Trello
```

## Arquitectura de Módulos RRHH (fuente: Arquitectura.xlsx)

El sistema GDP está organizado en **5 macro-módulos** que reflejan exactamente la estructura de RRHH de Surmedia (DPDO — Departamento de Personas y Desarrollo Organizacional):

### 1. Gestión de Bienestar Laboral
- **Evaluación de clima laboral**: Encuestas de clima, Comité paritario, CEAL-SUCESO

### 2. Gestión de Talento
- **Capacitaciones externas**: Diplomados, Magíster, Cursos Copagados, Cursos SENCE
- **Capacitaciones internas**: Liderazgo, Talleres
- **Onboarding**: Feedback e indefinido, Acreditaciones, Antecedentes del ingresante, Inducción corporativa, Inducción SSO, Programa de mentoría, Elementos de ingreso
- **Prácticas laborales**: Presupuesto de prácticas
- **Reclutamiento**: Requerimientos y vacantes, Portales de publicación
- **Selección**: Entrevistas y pruebas, Carta oferta

### 3. Gestión de Valores
- **Difusión interna**: Canales de Círculos SM, La Alcuza, Cumpleaños, Canales de comunicación interna
- **Integración cultural**: Estructura organizacional y organigrama, Año de la Excelencia, Celebraciones anuales, Reconocimientos, Puntos de encuentro

### 4. Gestión del Desempeño
- **Cargos**: Descriptivos de cargo
- **Diccionario de competencias**: Competencias laborales
- **Evaluación de desempeño**: Planificación anual, Análisis de métricas, Planes de sucesión

### 5. Gestión Documental
- **Presupuestos**: Presupuesto DPDO
- **Boletas de honorarios**: Informe mensual de boletas
- **Dotación**: Administración documental, Generación de contratos y anexos
- **Procesos de soporte personas**: Seguro complementario, Tarjeta Pluxee, Enrolamiento oficina
- **Remuneraciones**: Informe mensual de remuneraciones

> **Glosario clave:**
> - **DPDO**: Departamento de Personas y Desarrollo Organizacional (nombre interno de RRHH en Surmedia)
> - **SSO**: Seguridad y Salud Ocupacional
> - **CEAL-SUCESO**: Cuestionario de Evaluación de Ambiente Laboral (herramienta oficial MINSAL Chile)
> - **La Alcuza**: Newsletter/canal de comunicación interna de Surmedia
> - **Pluxee**: Tarjeta de beneficios (ex-Sodexo) para alimentación y/o bienestar
> - **SENCE**: Servicio Nacional de Capacitación y Empleo (subsidio estatal de capacitación)
> - **Círculos SM**: Grupos de trabajo internos de Surmedia
> - **Feedback e indefinido**: Proceso de evaluación al término del período de prueba antes de pasar a contrato indefinido

## Modelo de Datos Core

### Entidades Principales — Núcleo
- `Employee` — Colaborador (datos personales, contractuales, laborales)
- `Contract` — Contrato laboral (tipo, fechas, remuneración)
- `Department` — Área/departamento
- `Position` — Cargo/puesto con descriptivo
- `Attendance` — Registro de asistencia (sync desde BUK Asistencia)
- `Leave` — Solicitudes de vacaciones/permisos
- `Payroll` — Liquidaciones de sueldo (sync desde BUK)
- `Document` — Documentos del colaborador en Drive
- `HonoraryReceipt` — Boletas de honorarios (prestadores externos)

### Entidades — Gestión de Talento
- `Training` — Capacitación interna o externa
- `TrainingEnrollment` — Inscripción de colaborador en capacitación
- `Internship` — Práctica laboral + presupuesto
- `JobPosting` — Vacante publicada
- `Candidate` — Candidato a vacante
- `Interview` — Entrevista de selección
- `JobOffer` — Carta oferta

### Entidades — Desempeño y Bienestar
- `PerformanceCycle` — Ciclo anual de evaluaciones
- `PerformanceReview` — Evaluación individual de desempeño
- `SuccessionPlan` — Plan de sucesión por cargo clave
- `Competency` — Competencias del diccionario corporativo
- `ClimateSurvey` — Encuesta de clima laboral (CEAL-SUCESO u otras)
- `ClimateSurveyResponse` — Respuestas anónimas por colaborador

### Entidades — Valores y Beneficios
- `Recognition` — Reconocimientos a colaboradores
- `CulturalEvent` — Celebraciones y eventos internos
- `InternalCommunication` — Publicaciones de La Alcuza / comunicaciones
- `EmployeeBenefit` — Beneficios asignados (Pluxee, seguro complementario)

### Campos Chilenos Obligatorios
- `rut` — RUT chileno (formato: XX.XXX.XXX-X)
- `afp` — AFP del trabajador
- `isapre` — Isapre o Fonasa
- `previred_codigo` — Código de previred para declaraciones

## Convenciones de Código

- **Idioma de código**: Inglés (variables, funciones, clases)
- **Idioma de comentarios/docs**: Español
- **Formato de RUT**: Siempre validar y formatear con dígito verificador
- **Fechas**: ISO 8601 internamente, formato DD/MM/YYYY en UI
- **Moneda**: CLP (peso chileno) como entero (sin decimales)

## Comandos de Desarrollo

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run test         # Tests unitarios
npm run test:e2e     # Tests end-to-end
npm run lint         # ESLint + Prettier
npm run db:migrate   # Ejecutar migraciones Prisma
npm run db:seed      # Poblar base de datos con datos de prueba
npm run db:studio    # Abrir Prisma Studio
```

## Contexto de RRHH Chileno

- Las liquidaciones de sueldo siguen la legislación laboral chilena (Código del Trabajo)
- Cotizaciones previsionales: AFP (~10% trabajador), salud (7%), seguro cesantía, etc.
- Declaración mensual de cotizaciones a través de Previred
- Feriados legales chilenos deben considerarse en el módulo de asistencia
- Finiquitos deben cumplir causales del Artículo 159, 160, 161 del Código del Trabajo

## Archivos Importantes

- `docs/arquitectura.md` — Diseño técnico detallado
- `docs/integraciones.md` — Configuración de cada integración
- `docs/modelo-datos.md` — Esquema completo de base de datos
- `docs/procesos-rrhh.md` — Flujos de proceso de RRHH
- `docs/roadmap.md` — Plan de desarrollo por fases
- `prisma/schema.prisma` — Esquema de base de datos (cuando exista)
