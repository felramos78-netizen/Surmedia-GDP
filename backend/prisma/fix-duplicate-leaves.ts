import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all VACACIONES leaves grouped by (employeeId, startDate)
  const leaves = await prisma.leave.findMany({
    where: { type: 'VACACIONES' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, employeeId: true, startDate: true, createdAt: true },
  })

  // Group by employeeId+startDate, keep first (oldest), collect the rest to delete
  const seen = new Map<string, string>()
  const toDelete: string[] = []

  for (const l of leaves) {
    const key = `${l.employeeId}|${l.startDate.toISOString().slice(0, 10)}`
    if (seen.has(key)) {
      toDelete.push(l.id)
    } else {
      seen.set(key, l.id)
    }
  }

  console.log(`Found ${toDelete.length} duplicate Leave records to delete`)
  if (toDelete.length > 0) {
    const { count } = await prisma.leave.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`Deleted ${count} duplicates`)
  } else {
    console.log('No duplicates found')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
