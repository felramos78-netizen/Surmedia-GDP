-- Documentos BUK: estado de firma del trabajador y de la empresa
-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('NO_REQUERIDA', 'SIN_SOLICITAR', 'PENDIENTE', 'FIRMADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "buk_documents" ADD COLUMN     "companySign" "SignatureStatus",
ADD COLUMN     "companySignedAt" TIMESTAMP(3),
ADD COLUMN     "companySignerType" TEXT,
ADD COLUMN     "employeeSign" "SignatureStatus",
ADD COLUMN     "employeeSignedAt" TIMESTAMP(3),
ADD COLUMN     "signaturesCheckedAt" TIMESTAMP(3);

