-- Reclutamiento: base de CVs (vacantes, candidatos, postulaciones y archivos en Drive)
-- CreateEnum
CREATE TYPE "RecruitmentStage" AS ENUM ('RECIBIDO', 'EN_REVISION', 'PRESELECCIONADO', 'ENTREVISTA', 'OFERTA', 'CONTRATADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('PORTAL', 'DRIVE', 'GMAIL', 'REFERIDO', 'HUNTING', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateTable
CREATE TABLE "job_openings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driveFolder" TEXT,
    "city" TEXT,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'ABIERTA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rut" TEXT,
    "linkedinUrl" TEXT,
    "source" "CandidateSource" NOT NULL DEFAULT 'DRIVE',
    "referredBy" TEXT,
    "notes" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_applications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "stage" "RecruitmentStage" NOT NULL DEFAULT 'RECIBIDO',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_files" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobOpeningId" TEXT,
    "fileName" TEXT NOT NULL,
    "drivePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "modifiedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_openings_driveFolder_key" ON "job_openings"("driveFolder");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_rut_key" ON "candidates"("rut");

-- CreateIndex
CREATE INDEX "candidate_applications_jobOpeningId_idx" ON "candidate_applications"("jobOpeningId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_applications_candidateId_jobOpeningId_key" ON "candidate_applications"("candidateId", "jobOpeningId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_files_drivePath_key" ON "candidate_files"("drivePath");

-- CreateIndex
CREATE INDEX "candidate_files_candidateId_idx" ON "candidate_files"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_files_contentHash_idx" ON "candidate_files"("contentHash");

-- AddForeignKey
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_applications" ADD CONSTRAINT "candidate_applications_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_files" ADD CONSTRAINT "candidate_files_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_files" ADD CONSTRAINT "candidate_files_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (acceso solo vía backend)
ALTER TABLE "job_openings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_files" ENABLE ROW LEVEL SECURITY;
