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

## Modelo de Datos Core

### Entidades Principales
- `Employee` — Colaborador (datos personales, contractuales, laborales)
- `Contract` — Contrato laboral (tipo, fechas, remuneración)
- `Department` — Área/departamento
- `Position` — Cargo/puesto
- `Attendance` — Registro de asistencia (sync desde BUK Asistencia)
- `Leave` — Solicitudes de vacaciones/permisos
- `Payroll` — Liquidaciones de sueldo (sync desde BUK)
- `Performance` — Evaluaciones de desempeño
- `Document` — Documentos del colaborador

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
