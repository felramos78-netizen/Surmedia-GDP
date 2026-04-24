import type { PrismaClient } from '@prisma/client'
import { LegalEntity } from '@prisma/client'
import { BukClient } from './buk.client'
import { buildDuplicateSet, mapContractUpsert, mapEmployeeUpsert, normalizeRut } from './buk.mapper'
import type { BukEmployee, BukLegalEntity, BukSyncEmployeeResult, BukProcessPeriod } from './buk.types'

export interface PreviewEntry {
  rut: string
  firstName: string
  lastName: string
  department?: string
  position?: string
  startDate?: string | null
  endDate?: string | null
}

export interface PreviewResult {
  legalEntity: BukLegalEntity
  employeesTotal: number
  toCreate: number
  toUpdate: number
  duplicatesSkipped: number
  newEntries: PreviewEntry[]
  dateRange: { min: string | null; max: string | null }
}

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
  const hasDept  = !!bukEmp.department
  const jobTitle = bukEmp.current_job?.name

  if (!hasDept && !jobTitle) return {}

  // Si BUK provee departamento, usarlo; si solo hay cargo, agruparlo bajo "Sin Área"
  const deptCode = hasDept ? String(bukEmp.department!.id) : '__sin_area__'
  const deptName = hasDept ? bukEmp.department!.name       : 'Sin Área'

  const dept = await prisma.department.upsert({
    where:  { code: deptCode },
    create: { name: deptName, code: deptCode },
    update: hasDept ? { name: deptName } : {},
  })

  if (!jobTitle) return { departmentId: hasDept ? dept.id : undefined }

  let position = await prisma.position.findFirst({
    where: { departmentId: dept.id, title: jobTitle },
  })
  if (!position) {
    position = await prisma.position.create({
      data: { title: jobTitle, departmentId: dept.id },
    })
  }

  // Solo propagamos departmentId al empleado si BUK entregó un departamento real
  return {
    departmentId: hasDept ? dept.id : undefined,
    positionId:   position.id,
  }
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

// ─── Vista previa sin guardar (compara BUK vs DB) ────────────────────────────

export async function previewBukAll(prisma: PrismaClient): Promise<PreviewResult[]> {
  const [clientComunicaciones, clientConsultoria] = BukClient.fromEnv()

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

  const duplicateSet = buildDuplicateSet(allByEntity)

  // Fetch all existing RUTs in a single query to avoid N+1
  const allRutsToCheck = new Set<string>()
  for (const { legalEntity, employees } of allByEntity) {
    for (const bukEmp of employees) {
      const rut = normalizeRut(bukEmp.rut)
      if (!duplicateSet.has(`${rut}::${legalEntity}`)) allRutsToCheck.add(rut)
    }
  }
  const existingRows = await prisma.employee.findMany({
    where: { rut: { in: [...allRutsToCheck] } },
    select: { rut: true },
  })
  const existingRuts = new Set(existingRows.map(e => e.rut))

  const results: PreviewResult[] = []

  for (const { legalEntity, employees } of allByEntity) {
    const result: PreviewResult = {
      legalEntity,
      employeesTotal: employees.length,
      toCreate: 0,
      toUpdate: 0,
      duplicatesSkipped: 0,
      newEntries: [],
      dateRange: { min: null, max: null },
    }

    const dates: string[] = []

    for (const bukEmp of employees) {
      const rut = normalizeRut(bukEmp.rut)
      if (duplicateSet.has(`${rut}::${legalEntity}`)) {
        result.duplicatesSkipped++
        continue
      }

      const rawStartDate = bukEmp.start_date ?? bukEmp.current_job?.start_date ?? null
      if (rawStartDate) dates.push(rawStartDate)

      const fullLastName = [bukEmp.surname, bukEmp.second_surname].filter(Boolean).join(' ')

      if (!existingRuts.has(rut)) {
        result.toCreate++
        result.newEntries.push({
          rut,
          firstName: bukEmp.first_name,
          lastName: fullLastName,
          department: bukEmp.department?.name,
          position: bukEmp.current_job?.name,
          startDate: rawStartDate,
          endDate: bukEmp.end_date ?? null,
        })
      } else {
        result.toUpdate++
      }
    }

    if (dates.length) {
      const sorted = [...dates].sort()
      result.dateRange = { min: sorted[0], max: sorted[sorted.length - 1] }
    }

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

// ─── Sync de remuneraciones mensuales desde BUK ───────────────────────────────

export interface PayrollSyncResult {
  legalEntity:      BukLegalEntity
  periodsProcessed: number
  entriesUpserted:  number
  errors:           Array<{ period: string; error: string }>
}

export async function syncPayrollAll(
  prisma: PrismaClient,
  startDate: string,
  endDate: string
): Promise<PayrollSyncResult[]> {
  const [clientComunicaciones, clientConsultoria] = BukClient.fromEnv()
  const pairs: Array<[BukClient, BukLegalEntity]> = [
    [clientComunicaciones, 'COMUNICACIONES_SURMEDIA'],
    [clientConsultoria,    'SURMEDIA_CONSULTORIA'],
  ]

  const results: PayrollSyncResult[] = []

  for (const [client, legalEntity] of pairs) {
    const result: PayrollSyncResult = {
      legalEntity,
      periodsProcessed: 0,
      entriesUpserted:  0,
      errors:           [],
    }

    try {
      const periods = await client.fetchProcessPeriods(startDate, endDate)
      result.periodsProcessed = periods.length

      // Mapa bukEmployeeId → employeeId interno (un solo query por empresa)
      const bukContracts = await prisma.contract.findMany({
        where: { legalEntity: legalEntity as LegalEntity, bukEmployeeId: { not: null } },
        select: { bukEmployeeId: true, employeeId: true },
      })
      const bukIdToEmployeeId = new Map(
        bukContracts.map(c => [c.bukEmployeeId!, c.employeeId])
      )

      for (const period of periods) {
        try {
          const settlements = await client.fetchPayrollSettlements(period.id)

          const periodDate = new Date(period.start_date)
          const year  = periodDate.getFullYear()
          const month = periodDate.getMonth() + 1

          for (const settlement of settlements) {
            const employeeId = bukIdToEmployeeId.get(settlement.employee_id)
            if (!employeeId) continue

            const items    = JSON.stringify(settlement.items ?? settlement.payment_items ?? [])
            const gross    = settlement.gross_salary  ?? 0
            const liquid   = settlement.liquid_salary ?? 0
            const entity   = legalEntity

            await prisma.$executeRaw`
              INSERT INTO payroll_entries
                ("employeeId", "legalEntity", year, month, "bukPayrollId", "grossSalary", "liquidSalary", items, "updatedAt")
              VALUES (
                ${employeeId}::uuid,
                ${entity}::"LegalEntity",
                ${year},
                ${month},
                ${period.id},
                ${gross},
                ${liquid},
                ${items}::jsonb,
                NOW()
              )
              ON CONFLICT ("employeeId", "legalEntity", year, month)
              DO UPDATE SET
                "grossSalary"  = EXCLUDED."grossSalary",
                "liquidSalary" = EXCLUDED."liquidSalary",
                items          = EXCLUDED.items,
                "bukPayrollId" = EXCLUDED."bukPayrollId",
                "updatedAt"    = NOW()
            `
            result.entriesUpserted++
          }
        } catch (err) {
          result.errors.push({ period: period.start_date, error: String(err) })
        }
      }
    } catch (err) {
      result.errors.push({ period: '*', error: String(err) })
    }

    results.push(result)
  }

  return results
}
