# Gestión de Personas Surmedia (GDP)

Sistema integral de Recursos Humanos para Surmedia, diseñado para centralizar, automatizar y optimizar todos los procesos de gestión de personas.

## Descripción

Este repositorio contiene el código fuente, documentación y configuraciones del sistema **GDP (Gestión de Personas)** de Surmedia. El sistema actúa como hub central que conecta e integra el ecosistema digital de la empresa para proveer una experiencia unificada de gestión de personas.

## Ecosistema Digital Integrado

| Plataforma | Categoría | Rol en GDP |
|---|---|---|
| **BUK** | RRHH Principal | Contratos, liquidaciones, vacaciones, evaluaciones |
| **BUK Asistencia** | Control de asistencia | Marcajes, turnos, horas extra |
| **Previred** | Previsión social | Declaración y pago de cotizaciones AFP/salud |
| **Microsoft Office** | Productividad | Documentos, correo, reportería |
| **Suite de Google** | Colaboración | Drive, Sheets, Forms, Meet |
| **Trello** | Gestión de proyectos | Flujos de trabajo internos de RRHH |
| **Adobe Suite** | Diseño | Materiales corporativos y comunicaciones |
| **Smart CTO** | Gestión tecnológica | Gestión de equipo técnico |
| **DT Digital** | Transformación digital | Iniciativas de digitalización |
| **Zapier** | Automatización | Integración y automatización entre plataformas |

## Documentación

- [Arquitectura del Sistema](docs/arquitectura.md)
- [Integraciones](docs/integraciones.md)
- [Modelo de Datos](docs/modelo-datos.md)
- [Procesos de RRHH](docs/procesos-rrhh.md)
- [Roadmap](docs/roadmap.md)
- [Guía de Contribución](CONTRIBUTING.md)

## Inicio Rápido

```bash
# Clonar el repositorio
git clone https://github.com/felramos78-netizen/surmedia-gdp.git
cd surmedia-gdp

# Instalar dependencias (una vez definida la arquitectura tecnológica)
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales correspondientes

# Iniciar en desarrollo
npm run dev
```

## Variables de Entorno Requeridas

```env
# BUK API
BUK_API_KEY=
BUK_BASE_URL=

# Previred
PREVIRED_RUT=
PREVIRED_PASSWORD=

# Google Suite
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft (Azure AD)
AZURE_CLIENT_ID=
AZURE_TENANT_ID=
AZURE_CLIENT_SECRET=

# Zapier Webhooks
ZAPIER_WEBHOOK_URL=

# Base de datos
DATABASE_URL=
```

## Stack Tecnológico

- **Backend:** Node.js / TypeScript
- **Frontend:** React + TypeScript
- **Base de datos:** PostgreSQL
- **ORM:** Prisma
- **Autenticación:** OAuth 2.0 (Google / Microsoft)
- **CI/CD:** GitHub Actions
- **Infraestructura:** A definir (AWS / Azure / GCP)

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el proceso de desarrollo y estándares del proyecto.

## Licencia

Propietario — Surmedia. Todos los derechos reservados.
