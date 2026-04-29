import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Limpiando dotación y remuneraciones...\n')

  const payroll = await prisma.payrollEntry.deleteMany({})
  console.log(`  payroll_entries:          ${payroll.count} eliminadas`)

  const wc = await prisma.employeeWorkCenter.deleteMany({})
  console.log(`  employee_work_centers:    ${wc.count} eliminadas`)

  const contracts = await prisma.contract.deleteMany({})
  console.log(`  contracts:                ${contracts.count} eliminados`)

  const leaves = await prisma.leave.deleteMany({})
  console.log(`  leaves:                   ${leaves.count} eliminados`)

  const docs = await prisma.document.deleteMany({})
  console.log(`  documents:                ${docs.count} eliminados`)

  // Desconectar onboarding processes del employee antes de borrar
  await prisma.onboardingProcess.updateMany({ data: { employeeId: null } })
  console.log(`  onboarding_processes:     employeeId → null`)

  // Desconectar users del employee antes de borrar
  const users = await prisma.user.updateMany({ data: { employeeId: null } })
  console.log(`  users desconectados:      ${users.count}`)

  const employees = await prisma.employee.deleteMany({})
  console.log(`  employees:                ${employees.count} eliminados`)

  console.log('\n✓ Base de datos limpia y lista para importar datos 2026.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
