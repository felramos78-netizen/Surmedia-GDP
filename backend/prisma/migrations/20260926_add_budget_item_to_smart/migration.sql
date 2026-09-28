-- Partida del Presupuesto DPDO por documento Smart (reemplaza el cruce por área + nombre de categoría)
-- y partida por defecto del proveedor, que heredan sus documentos nuevos.
-- AlterTable
ALTER TABLE "smart_documents" ADD COLUMN     "budgetItemId" TEXT;

-- AlterTable
ALTER TABLE "smart_proveedores" ADD COLUMN     "budgetItemId" TEXT;

-- CreateIndex
CREATE INDEX "smart_documents_budgetItemId_idx" ON "smart_documents"("budgetItemId");

-- AddForeignKey
ALTER TABLE "smart_proveedores" ADD CONSTRAINT "smart_proveedores_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "budget_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_documents" ADD CONSTRAINT "smart_documents_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "budget_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

