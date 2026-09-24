-- Rendiciones del Presupuesto DPDO: gastos que no son BH ni facturas, imputados a una partida
CREATE TABLE "budget_rendiciones" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_rendiciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_rendiciones_itemId_idx" ON "budget_rendiciones"("itemId");

ALTER TABLE "budget_rendiciones" ADD CONSTRAINT "budget_rendiciones_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "budget_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (igual que el resto de las tablas)
ALTER TABLE "budget_rendiciones" ENABLE ROW LEVEL SECURITY;

-- Excepción por documento: área propia cuando no es la de su proveedor
ALTER TABLE "smart_documents" ADD COLUMN "area" TEXT;
