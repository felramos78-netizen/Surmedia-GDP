import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE smart_documents sd
    SET "workCenterId" = sp."workCenterId"
    FROM smart_proveedores sp
    WHERE sd."proveedorId" = sp.id
      AND sp."workCenterId" IS NOT NULL
      AND sd."workCenterId" IS NULL
  `
  console.log(`Documentos actualizados con centro de trabajo: ${result}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
