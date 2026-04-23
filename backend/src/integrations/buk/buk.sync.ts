import type { PrismaClient } from '@prisma/client'
import { LegalEntity } from '@prisma/client'
import { BukClient } from './buk.client'
import { buildDuplicateSet, mapContractUpsert, mapEmployeeUpsert, normalizeRut } from './buk.mapper'
import type { BukEmployee, BukLegalEntity, BukSyncEmployeeResult } from './buk.types'

export interface SyncResult {
  legalEntity: BukLegalEntity
  employeesTotal: number
  employeesCreated: number
  employeesUpdated: number
  contractsUpserted: number
  duplicatesSkipped: number
  durationMs: number
  errors: Array<{ rut: string; error: string }>
}

// ─── Sync completo de una sola empresa ────────────────────────────────────────

async function syncCompany(
  prisma: PrismaClient,
  client: BukClient,
  allEmployeesByEntity: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }>
): Promise<SyncResult> {
  const startedAt = Date.now()
  const legalEntity = client.legalEntity
  const result: SyncResult = {
    legalEntity,
    employeesTotal: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    contractsUpserted: 0,
    duplicatesSkipped: 0,
    durationMs: 0,
    errors: [],
  }

  const log = await prisma.syncLog.create({
    data: {
      source: 'buk',
      legalEntity: legalEntity as LegalEntity,
      status: 'RUNNING',
    },
  })

  try {
    const myEmployees = allEmployeesByEntity.find(e => e.legalEntity === legalEntity)?.employees ?? []
    result.employeesTotal = myEmployees.length

    // Construir set de duplicados considerando ambas empresas
    const duplicateSet = buildDuplicateSet(allEmployeesByEntity)

    for (const bukEmp of myEmployees) {
      const rut = normalizeRut(bukEmp.rut)
      const duplicateKey = `${rut}::${legalEntity}`

      if (duplicateSet.has(duplicateKey)) {
        result.duplicatesSkipped++
        continue
      }

      try {
        const syncRes = await syncEmployee(prisma, bukEmp, legalEntity)
        if (syncRes.action === 'created') result.employeesCreated++
        else if (syncRes.action === 'updated') result.employeesUpdated++
        result.contractsUpserted++
      } catch (err) {
        result.errors.push({ rut, error: String(err) })
      }
    }

    result.durationMs = Date.now() - startedAt

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status:            'SUCCESS',
        completedAt:       new Date(),
        employeesTotal:    result.employeesTotal,
        employeesCreated:  result.employeesCreated,
        employeesUpdated:  result.employeesUpdated,
        contractsUpserted: result.contractsUpserted,
        duplicatesSkipped: result.duplicatesSkipped,
        errorDetails:      result.errors.length > 0 ? result.errors : undefined,
      },
    })
  } catch (fatalErr) {
    result.durationMs = Date.now() - startedAt
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status:       'ERROR',
        completedAt:  new Date(),
        errorMessage: String(fatalErr),
      },
    })
    throw fatalErr
  }

  return result
}

// ─── Resolución de departamento y cargo desde BUK ────────────────────────────

async function resolveDeptAndPosition(
  prisma: PrismaClient,
  bukEmp: BukEmployee
): Promise<{ departmentId?: string; positionId?: string }> {
  if (!bukEmp.department) return {}

  const dept = await prisma.department.upsert({
    where:  { code: String(bukEmp.department.id) },
    create: { name: bukEmp.department.name, code: String(bukEmp.department.id) },
    update: { name: bukEmp.department.name },
  })

  if (!bukEmp.current_job) return { departmentId: dept.id }

  let position = await prisma.position.findFirst({
    where: { departmentId: dept.id, title: bukEmp.current_job.name },
  })
  if (!position) {
    position = await prisma.position.create({
      data: { title: bukEmp.current_job.name, departmentId: dept.id },
    })
  }

  return { departmentId: dept.id, positionId: position.id }
}

// ─── Upsert de un colaborador + su contrato ───────────────────────────────────

async function syncEmployee(
  prisma: PrismaClient,
  bukEmp: BukEmployee,
  legalEntity: BukLegalEntity
): Promise<BukSyncEmployeeResult> {
  const rut = normalizeRut(bukEmp.rut)
  const { departmentId, positionId } = await resolveDeptAndPosition(prisma, bukEmp)
  const employeeData = {
    ...mapEmployeeUpsert(bukEmp),
    ...(departmentId != null && { departmentId }),
    ...(positionId   != null && { positionId }),
  }
  const contractData = mapContractUpsert(bukEmp, legalEntity)

  const existing = await prisma.employee.findFirst({ where: { rut } })

  if (!existing) {
    // Crear colaborador + contrato en una transacción
    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({ data: employeeData })
      await tx.contract.create({ data: { ...contractData, employeeId: emp.id } })
      return emp
    })
    return { rut, action: 'created', employeeId: employee.id }
  }

  // Actualizar colaborador y upsert de contrato por (employeeId + legalEntity)
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: existing.id }, data: employeeData })

    const existingContract = await tx.contract.findFirst({
      where: {
        employeeId:    existing.id,
        legalEntity:   legalEntity as LegalEntity,
        bukEmployeeId: bukEmp.id,
      },
    })

    if (existingContract) {
      await tx.contract.update({
        where: { id: existingContract.id },
        data:  contractData,
      })
    } else {
      await tx.contract.create({
        data: { ...contractData, employeeId: existing.id },
      })
    }
  })

  return { rut, action: 'updated', employeeId: existing.id }
}

// ─── Sync completo de ambas empresas (punto de entrada principal) ─────────────

export async function syncBukAll(prisma: PrismaClient): Promise<SyncResult[]> {
  const [clientComunicaciones, clientConsultoria] = BukClient.fromEnv()

  // Descargar empleados de ambas empresas en paralelo; cada una falla de forma independiente
  const [resComunicaciones, resConsultoria] = await Promise.allSettled([
    clientComunicaciones.fetchAllEmployees(),
    clientConsultoria.fetchAllEmployees(),
  ])

  const empsComunicaciones = resComunicaciones.status === 'fulfilled' ? resComunicaciones.value : []
  const empsConsultoria    = resConsultoria.status    === 'fulfilled' ? resConsultoria.value    : []

  const allByEntity: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }> = [
    { legalEntity: 'COMUNICACIONES_SURMEDIA', employees: empsComunicaciones },
    { legalEntity: 'SURMEDIA_CONSULTORIA',   employees: empsConsultoria },
  ]

  const results: SyncResult[] = []

  const pairs: Array<[BukClient, PromiseSettledResult<BukEmployee[]>]> = [
    [clientComunicaciones, resComunicaciones],
    [clientConsultoria,    resConsultoria],
  ]

  for (const [client, settled] of pairs) {
    if (settled.status === 'rejected') {
      const errMsg = String(settled.reason)
      await prisma.syncLog.create({
        data: {
          source:       'buk',
          legalEntity:  client.legalEntity as LegalEntity,
          status:       'ERROR',
          completedAt:  new Date(),
          errorMessage: errMsg,
        },
      })
      results.push({
        legalEntity:       client.legalEntity,
        employeesTotal:    0,
        employeesCreated:  0,
        employeesUpdated:  0,
        contractsUpserted: 0,
        duplicatesSkipped: 0,
        durationMs:        0,
        errors: [{ rut: '*', error: errMsg }],
      })
      continue
    }
    const result = await syncCompany(prisma, client, allByEntity)
    results.push(result)
  }

  return results
}

// ─── Sync de una sola empresa (para trigger manual por empresa) ───────────────

export async function syncBukCompany(
  prisma: PrismaClient,
  legalEntity: BukLegalEntity
): Promise<SyncResult> {
  const [clientComunicaciones, clientConsultoria] = BukClient.fromEnv()
  const targetClient = legalEntity === 'COMUNICACIONES_SURMEDIA'
    ? clientComunicaciones
    : clientConsultoria
  const otherClient = legalEntity === 'COMUNICACIONES_SURMEDIA'
    ? clientConsultoria
    : clientComunicaciones

  // Necesitamos los empleados de ambas para la deduplicación
  const [targetEmps, otherEmps] = await Promise.all([
    targetClient.fetchAllEmployees(),
    otherClient.fetchAllEmployees(),
  ])

  const otherEntity: BukLegalEntity = legalEntity === 'COMUNICACIONES_SURMEDIA'
    ? 'SURMEDIA_CONSULTORIA'
    : 'COMUNICACIONES_SURMEDIA'

  const allByEntity: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }> = [
    { legalEntity, employees: targetEmps },
    { legalEntity: otherEntity, employees: otherEmps },
  ]

  return syncCompany(prisma, targetClient, allByEntity)
}
