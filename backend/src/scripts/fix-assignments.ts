import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()
}

async function main() {
  // ─── Mapas base ────────────────────────────────────────────────────────────
  const allEmployees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true },
  })
  const byName = new Map<string, string>()
  for (const e of allEmployees) {
    byName.set(normalize(`${e.lastName} ${e.firstName}`), e.id)
  }

  const allCenters = await prisma.workCenter.findMany()
  const byCenter = new Map<string, string>()
  for (const wc of allCenters) byCenter.set(wc.name, wc.id)

  function empId(name: string): string | undefined {
    return byName.get(normalize(name))
  }
  function wcId(name: string): string | undefined {
    return byCenter.get(name)
  }
  async function assign(empName: string, entity: 'COM' | 'CON', centers: string[]) {
    const eId = empId(empName)
    if (!eId) { console.warn(`⚠ No encontrado: ${empName}`); return }
    const legalEntity = entity === 'COM' ? 'COMUNICACIONES_SURMEDIA' : 'SURMEDIA_CONSULTORIA'
    for (const c of centers) {
      const cId = wcId(c)
      if (!cId) { console.warn(`⚠ Centro no encontrado: ${c}`); continue }
      await prisma.employeeWorkCenter.upsert({
        where: { employeeId_workCenterId_legalEntity: { employeeId: eId, workCenterId: cId, legalEntity: legalEntity as any } },
        update: {},
        create: { employeeId: eId, workCenterId: cId, legalEntity: legalEntity as any },
      })
    }
  }

  const AMSA = ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (NCEN)', 'AMSA (ZALDIVAR)']

  // ─── 1. Limpiar COSTOS COORDINACION OPERACIONAL (dejar solo Loreto) ────────
  const costosCentroId = wcId('COSTOS COORDINACION OPERACIONAL')
  const loretoId = empId('Echeverria Noton Loreto Cecilia')
  if (costosCentroId) {
    const deleted = await prisma.employeeWorkCenter.deleteMany({
      where: {
        workCenterId: costosCentroId,
        ...(loretoId ? { NOT: { employeeId: loretoId } } : {}),
      },
    })
    console.log(`✓ COSTOS COORDINACION OPERACIONAL: ${deleted.count} asignaciones eliminadas (Loreto conservada)`)
  } else {
    console.warn('⚠ Centro COSTOS COORDINACION OPERACIONAL no encontrado')
  }

  // ─── 2. Déborah Illanes → solo CEIM y SALAR (COM) ─────────────────────────
  const deborahId = empId('Illanes Caba Deborah Nicole')
  if (deborahId) {
    await prisma.employeeWorkCenter.deleteMany({ where: { employeeId: deborahId } })
    await assign('Illanes Caba Deborah Nicole', 'COM', ['CEIM', 'SALAR'])
    console.log('✓ Déborah Illanes → CEIM, SALAR')
  } else {
    console.warn('⚠ No encontrada: Déborah Illanes')
  }

  // ─── 3. Valeria Vega → solo PUERTO ANGAMOS (COM) ──────────────────────────
  const valeriaId = empId('Vega Velozo Valeria Andrea')
  if (valeriaId) {
    await prisma.employeeWorkCenter.deleteMany({ where: { employeeId: valeriaId } })
    await assign('Vega Velozo Valeria Andrea', 'COM', ['PUERTO ANGAMOS'])
    console.log('✓ Valeria Vega → PUERTO ANGAMOS')
  } else {
    console.warn('⚠ No encontrada: Valeria Vega')
  }

  // ─── 4. Josefa Valdez → 4 AMSA (COM) ─────────────────────────────────────
  const josefaId = empId('Valdes Tapia Josefa Antonieta')
  if (josefaId) {
    await prisma.employeeWorkCenter.deleteMany({ where: { employeeId: josefaId } })
    await assign('Valdes Tapia Josefa Antonieta', 'COM', AMSA)
    console.log('✓ Josefa Valdez → 4 AMSA (25% cada uno)')
  } else {
    console.warn('⚠ No encontrada: Josefa Valdez')
  }

  // ─── 5. Graciela Freire → solo 4 AMSA (COM) ──────────────────────────────
  const gracielaId = empId('Freire Meza Graciela Constanza')
  if (gracielaId) {
    await prisma.employeeWorkCenter.deleteMany({ where: { employeeId: gracielaId } })
    await assign('Freire Meza Graciela Constanza', 'COM', AMSA)
    console.log('✓ Graciela Freire → 4 AMSA (25% cada uno)')
  } else {
    console.warn('⚠ No encontrada: Graciela Freire')
  }

  console.log('\n✅ Listo.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
