-- CreateEnum
CREATE TYPE "LegalEntity" AS ENUM ('COMUNICACIONES_SURMEDIA', 'SURMEDIA_CONSULTORIA');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');

-- AlterTable: agregar campos BUK a contracts
ALTER TABLE "contracts"
  ADD COLUMN "legalEntity"    "LegalEntity",
  ADD COLUMN "bukEmployeeId"  INTEGER,
  ADD COLUMN "grossSalary"    INTEGER;

-- CreateTable: sync_logs
CREATE TABLE "sync_logs" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "source"            TEXT         NOT NULL,
  "legalEntity"       "LegalEntity" NOT NULL,
  "status"            "SyncStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"       TIMESTAMP(3),
  "employeesTotal"    INTEGER      NOT NULL DEFAULT 0,
  "employeesCreated"  INTEGER      NOT NULL DEFAULT 0,
  "employeesUpdated"  INTEGER      NOT NULL DEFAULT 0,
  "contractsUpserted" INTEGER      NOT NULL DEFAULT 0,
  "duplicatesSkipped" INTEGER      NOT NULL DEFAULT 0,
  "errorMessage"      TEXT,
  "errorDetails"      JSONB,

  CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);
