-- Reclutamiento: perfil del candidato (planillas de preselección) y criterios de puntaje por vacante
-- CreateEnum
CREATE TYPE "ScoringCriterionType" AS ENUM ('MANUAL', 'RULE');

-- AlterTable
ALTER TABLE "candidate_applications" ADD COLUMN     "manualScores" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "availability" TEXT,
ADD COLUMN     "certifications" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "lastEmployer" TEXT,
ADD COLUMN     "lastPosition" TEXT,
ADD COLUMN     "professionalTitle" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "skills" TEXT,
ADD COLUMN     "tools" TEXT,
ADD COLUMN     "yearsExperience" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "scoring_criteria" (
    "id" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScoringCriterionType" NOT NULL DEFAULT 'MANUAL',
    "field" TEXT,
    "operator" TEXT,
    "value" TEXT,
    "pointsIfTrue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "pointsIfFalse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_criteria_jobOpeningId_idx" ON "scoring_criteria"("jobOpeningId");

-- AddForeignKey
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "scoring_criteria" ENABLE ROW LEVEL SECURITY;
