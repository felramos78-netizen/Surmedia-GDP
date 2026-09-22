-- CreateTable
CREATE TABLE "buk_documents" (
    "id" TEXT NOT NULL,
    "legalEntity" "LegalEntity" NOT NULL,
    "bukEmployeeId" INTEGER NOT NULL,
    "bukFileId" INTEGER NOT NULL,
    "rut" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "bukStatus" TEXT NOT NULL,
    "employeeId" TEXT,
    "filename" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "bukCreatedAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "buk_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "keywords" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buk_document_syncs" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "fichas" INTEGER NOT NULL DEFAULT 0,
    "filesSeen" INTEGER NOT NULL DEFAULT 0,
    "filesAdded" INTEGER NOT NULL DEFAULT 0,
    "filesRemoved" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "buk_document_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buk_documents_employeeId_idx" ON "buk_documents"("employeeId");

-- CreateIndex
CREATE INDEX "buk_documents_rut_idx" ON "buk_documents"("rut");

-- CreateIndex
CREATE INDEX "buk_documents_categoryId_idx" ON "buk_documents"("categoryId");

-- CreateIndex
CREATE INDEX "buk_documents_legalEntity_bukEmployeeId_idx" ON "buk_documents"("legalEntity", "bukEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "buk_documents_legalEntity_bukFileId_key" ON "buk_documents"("legalEntity", "bukFileId");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_name_key" ON "document_categories"("name");

-- CreateIndex
CREATE INDEX "buk_document_syncs_scope_startedAt_idx" ON "buk_document_syncs"("scope", "startedAt");

-- AddForeignKey
ALTER TABLE "buk_documents" ADD CONSTRAINT "buk_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buk_documents" ADD CONSTRAINT "buk_documents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security sin políticas (igual que 20260819_enable_row_level_security):
-- bloquea PostgREST/anon; Prisma se conecta como dueño de las tablas.
ALTER TABLE "buk_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buk_document_syncs" ENABLE ROW LEVEL SECURITY;
