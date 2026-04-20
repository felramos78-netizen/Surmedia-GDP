# Guía de Contribución

Guía para el equipo de desarrollo del proyecto GDP Surmedia.

## Flujo de Trabajo Git

### Ramas Principales

| Rama | Propósito |
|---|---|
| `main` | Producción. Solo merges desde `release/*` o hotfixes. |
| `develop` | Integración. Base para todas las features. |
| `feature/*` | Nuevas funcionalidades. |
| `fix/*` | Correcciones de bugs. |
| `release/*` | Preparación de releases. |
| `hotfix/*` | Correcciones urgentes en producción. |

### Convención de Nombres de Rama

```
feature/GDP-123-nombre-descriptivo
fix/GDP-456-descripcion-del-bug
hotfix/GDP-789-nombre-critico
```

### Flujo para Nueva Funcionalidad

```bash
# 1. Partir desde develop actualizado
git checkout develop
git pull origin develop

# 2. Crear rama de feature
git checkout -b feature/GDP-XXX-nombre-funcionalidad

# 3. Desarrollar y hacer commits
git add .
git commit -m "feat(modulo): descripción clara del cambio"

# 4. Mantener la rama actualizada
git fetch origin develop
git rebase origin/develop

# 5. Push y Pull Request hacia develop
git push -u origin feature/GDP-XXX-nombre-funcionalidad
```

## Convenciones de Commits

Seguimos **Conventional Commits**:

```
tipo(scope): descripción en imperativo

[cuerpo opcional]

[footer opcional: refs #123]
```

### Tipos Permitidos

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Formato, sin cambios de lógica |
| `refactor` | Refactorización sin nueva feature ni bug fix |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento, dependencias |
| `perf` | Mejoras de rendimiento |
| `ci` | Cambios en CI/CD |

### Scopes Principales

`employee`, `contract`, `attendance`, `payroll`, `leave`, `performance`, `document`, `auth`, `buk`, `previred`, `google`, `trello`, `zapier`, `ui`, `api`, `db`

### Ejemplos

```
feat(employee): agregar validación de RUT chileno
fix(payroll): corregir cálculo de cotización AFP
docs(integraciones): actualizar guía de BUK API
test(attendance): agregar tests para marcaje doble
chore(deps): actualizar prisma a v5.10
```

## Pull Requests

### Requisitos para Aprobar un PR

- [ ] Descripción clara del cambio y su motivación
- [ ] Tests unitarios para nueva lógica
- [ ] Sin errores de linting (`npm run lint`)
- [ ] Sin regresiones en tests existentes (`npm run test`)
- [ ] Revisión de al menos 1 miembro del equipo
- [ ] Rama actualizada con `develop` antes del merge

### Template de PR

Al abrir un PR, completar el template en `.github/PULL_REQUEST_TEMPLATE.md`.

## Estándares de Código

### TypeScript

- Strict mode habilitado (`"strict": true`)
- Sin `any` implícito; usar tipos explícitos o `unknown`
- Interfaces sobre types para objetos públicos
- Enums para valores constantes de dominio (ej: `ContractType`, `LeaveStatus`)

### Estructura de Carpetas (Backend)

```
src/
├── modules/
│   ├── employee/
│   │   ├── employee.controller.ts
│   │   ├── employee.service.ts
│   │   ├── employee.repository.ts
│   │   ├── employee.dto.ts
│   │   └── employee.test.ts
│   └── ...
├── integrations/
│   ├── buk/
│   ├── previred/
│   └── google/
├── common/
│   ├── middleware/
│   ├── guards/
│   └── utils/
└── config/
```

### Validaciones de Datos Chilenos

Siempre usar las utilidades en `src/common/utils/chile.ts`:

```typescript
import { validateRut, formatRut } from '@/common/utils/chile';
```

## Testing

### Niveles de Test

- **Unitario**: Lógica de negocio pura (services, utils). Meta: >80% cobertura.
- **Integración**: Endpoints de API con base de datos de test.
- **E2E**: Flujos críticos completos (onboarding, liquidación, etc.).

```bash
npm run test              # Unitarios
npm run test:integration  # Integración
npm run test:e2e          # E2E
npm run test:coverage     # Reporte de cobertura
```

## Seguridad

- **Nunca** commitear credenciales, API keys ni contraseñas.
- Usar `.env.local` para desarrollo local (ignorado por git).
- Los secretos de producción se gestionan en el gestor de secretos (a definir).
- Datos de colaboradores son sensibles — aplicar principio de mínimo privilegio.
- Los datos de RUT deben estar encriptados en reposo.

## Gestión de Issues

Usar las plantillas en `.github/ISSUE_TEMPLATE/` para reportar bugs o solicitar features. Etiquetar correctamente con el módulo afectado.
