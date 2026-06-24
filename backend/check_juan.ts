import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const emps = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Juan', mode: 'insensitive' }, lastName: { contains: 'Pérez', mode: 'insensitive' } },
        { firstName: { contains: 'Juan', mode: 'insensitive' }, lastName: { contains: 'Perez', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, firstName: true, lastName: true, rut: true, email: true,
      status: true, startDate: true, jobTitle: true, createdAt: true,
      legalEntity: true,
    },
  })
  console.log(JSON.stringify(emps, null, 2))
}
main().finally(() => prisma.$disconnect())
