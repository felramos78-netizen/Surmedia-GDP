-- AlterTable: agregar ingresos mensuales a work_centers
ALTER TABLE "work_centers"
  ADD COLUMN "ingresosMensuales" DOUBLE PRECISION;
