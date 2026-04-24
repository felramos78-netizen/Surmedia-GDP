-- AlterTable: agregar campos extendidos de colaborador
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "city"            TEXT,
  ADD COLUMN IF NOT EXISTS "commune"         TEXT,
  ADD COLUMN IF NOT EXISTS "personalEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "workSchedule"    TEXT,
  ADD COLUMN IF NOT EXISTS "supervisorName"  TEXT,
  ADD COLUMN IF NOT EXISTS "supervisorTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "jobFamily"       TEXT;

-- CreateTable: remuneraciones mensuales por colaborador
CREATE TABLE IF NOT EXISTS "payroll_entries" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "employeeId"     UUID          NOT NULL,
  "legalEntity"    "LegalEntity" NOT NULL,
  "year"           INTEGER       NOT NULL,
  "month"          INTEGER       NOT NULL,
  "bukPayrollId"   INTEGER,
  "grossSalary"    INTEGER       NOT NULL DEFAULT 0,
  "liquidSalary"   INTEGER       NOT NULL DEFAULT 0,
  "items"          JSONB         NOT NULL DEFAULT '[]',
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_entries_employeeId_legalEntity_year_month_key"
    UNIQUE ("employeeId", "legalEntity", "year", "month")
);

ALTER TABLE "payroll_entries"
  ADD CONSTRAINT "payroll_entries_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
