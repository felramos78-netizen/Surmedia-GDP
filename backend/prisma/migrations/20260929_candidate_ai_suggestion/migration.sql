-- Reclutamiento: sugerencia de perfil por IA pendiente de revisión
-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "aiSuggestedAt" TIMESTAMP(3),
ADD COLUMN     "aiSuggestion" JSONB;

