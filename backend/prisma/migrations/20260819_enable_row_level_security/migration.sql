-- Habilita Row-Level Security en todas las tablas de public.
-- Sin políticas: bloquea por completo el acceso vía la API REST
-- autogenerada de Supabase (roles anon/authenticated). La app se
-- conecta directo a Postgres como dueña de las tablas, por lo que
-- Prisma sigue teniendo acceso normal.
-- Corrige las alertas del Security Advisor: rls_disabled_in_public
-- y sensitive_columns_exposed.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_center_ingresos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_work_centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vacation_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_processes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_task_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_template_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_template_subtasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_sheet_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_email_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_forms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "form_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "smart_proveedores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "smart_documents" ENABLE ROW LEVEL SECURITY;
