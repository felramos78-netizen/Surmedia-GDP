-- Elimina el módulo Perfiles. Los datos que apuntaban a un perfil quedan como texto libre:
--   responsable de hitos/subtareas → responsableName (nombre)
--   invitados de Calendar (automationConfig / plantilla / subTasks / templateSnapshot) → attendeeEmails
--   remitente de reglas de correo → fromName; CC de perfiles → se suman a ccCustomEmails
--
-- NO aplicar este archivo directamente: la conversión de los JSON se hace en
-- prisma/migrate-remove-profiles.ts, que ejecuta este mismo DDL en una sola transacción
-- (1) agrega columnas, (2) copia/convierte los datos, (3) borra columnas y tablas.

-- (1) Columnas nuevas
ALTER TABLE "calendar_email_rules" ADD COLUMN "fromName" TEXT;
ALTER TABLE "onboarding_template_subtasks" ADD COLUMN "responsableName" TEXT;
ALTER TABLE "onboarding_template_tasks" ADD COLUMN "responsableName" TEXT;

-- (3) Columnas y tablas de perfiles
ALTER TABLE "onboarding_task_assignments" DROP CONSTRAINT "onboarding_task_assignments_profileId_fkey";
ALTER TABLE "onboarding_task_assignments" DROP CONSTRAINT "onboarding_task_assignments_taskId_fkey";
ALTER TABLE "onboarding_template_subtasks" DROP CONSTRAINT "onboarding_template_subtasks_responsableProfileId_fkey";
ALTER TABLE "onboarding_template_tasks" DROP CONSTRAINT "onboarding_template_tasks_responsableProfileId_fkey";
ALTER TABLE "profile_roles" DROP CONSTRAINT "profile_roles_profileId_fkey";

ALTER TABLE "calendar_email_rules" DROP COLUMN "ccProfileIds", DROP COLUMN "fromProfileId";
ALTER TABLE "onboarding_template_subtasks" DROP COLUMN "responsableProfileId";
ALTER TABLE "onboarding_template_tasks" DROP COLUMN "responsableProfileId";

DROP TABLE "onboarding_task_assignments";
DROP TABLE "profile_roles";
DROP TABLE "profiles";
