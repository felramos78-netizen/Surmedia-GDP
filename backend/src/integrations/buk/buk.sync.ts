import type { PrismaClient } from '@prisma/client'
import { EmployeeStatus, LegalEntity } from '@prisma/client'
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

// ─── Deduplicación intra-empresa (mismo RUT dos veces en la misma lista) ─────
// BUK a veces devuelve el mismo RUT como activo e inactivo (contratos históricos).
// Nos quedamos con el más "vivo": primero el activo, luego el de mayor sueldo.

function deduplicateWithinCompany(employees: BukEmployee[]): BukEmployee[] {
  const seen = new Map<string, BukEmployee>()
  for (const emp of employees) {
    const rut = normalizeRut(emp.rut)
    const existing = seen.get(rut)
    if (!existing) { seen.set(rut, emp); continue }

    const existingActive = existing.status?.toLowerCase() === 'activo'
    const newActive      = emp.status?.toLowerCase()      === 'activo'

    if (newActive && !existingActive) { seen.set(rut, emp); continue }
    if (newActive === existingActive && (emp.liquid_salary ?? 0) > (existing.liquid_salary ?? 0)) {
      seen.set(rut, emp)
    }
  }
  return [...seen.values()]
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

    const { skipSet, duplicateRuts } = buildDuplicateSet(allEmployeesByEntity)
    const toProcess = myEmployees.filter(emp => !skipSet.has(`${normalizeRut(emp.rut)}::${legalEntity}`))
    result.duplicatesSkipped = myEmployees.length - toProcess.length

    if (toProcess.length > 0) {
      // 1. Pre-resolver todos los depts/cargos en batch (evita N*3 queries)
      const deptPositionMap = await resolveAllDeptsAndPositions(prisma, toProcess)

      // 2. Pre-fetch empleados existentes en un solo query
      const ruts = toProcess.map(emp => normalizeRut(emp.rut))
      const existingEmployees = await prisma.employee.findMany({
        where:  { rut: { in: ruts } },
        select: { id: true, rut: true },
      })
      const existingByRut = new Map(existingEmployees.map(e => [e.rut, e.id]))

      const toCreate = toProcess.filter(emp => !existingByRut.has(normalizeRut(emp.rut)))
      const toUpdate = toProcess.filter(emp =>  existingByRut.has(normalizeRut(emp.rut)))

      // Helper: genera datos del empleado, sobreescribiendo status a DUPLICATE si aplica
      const empData = (bukEmp: BukEmployee) => {
        const rut = normalizeRut(bukEmp.rut)
        const { departmentId, positionId } = deptPositionMap.get(rut) ?? {}
        const base = mapEmployeeUpsert(bukEmp)
        if (duplicateRuts.has(rut)) base.status = EmployeeStatus.DUPLICATE
        return { ...base, ...(departmentId != null && { departmentId }), ...(positionId != null && { positionId }) }
      }

      // 3. Pre-fetch contratos existentes en un solo query
      const idsToUpdate = toUpdate.map(emp => existingByRut.get(normalizeRut(emp.rut))!)
      const existingContracts = idsToUpdate.length > 0
        ? await prisma.contract.findMany({
            where:  { employeeId: { in: idsToUpdate }, legalEntity: legalEntity as LegalEntity },
            select: { id: true, employeeId: true, bukEmployeeId: true },
          })
        : []
      const contractMap = new Map(existingContracts.map(c => [`${c.employeeId}::${c.bukEmployeeId}`, c.id]))

      // 4. Crear nuevos — paralelo por empleado (pool de conexiones limita la concurrencia)
      const createResults = await Promise.allSettled(
        toCreate.map(async (bukEmp) => {
          const emp = await prisma.employee.create({ data: empData(bukEmp) })
          await prisma.contract.create({ data: { ...mapContractUpsert(bukEmp, legalEntity), employeeId: emp.id } })
        })
      )
      for (let i = 0; i < createResults.length; i++) {
        if (createResults[i].status === 'fulfilled') { result.employeesCreated++; result.contractsUpserted++ }
        else result.errors.push({ rut: normalizeRut(toCreate[i].rut), error: String((createResults[i] as PromiseRejectedResult).reason) })
      }

      // 5. Actualizar existentes — paralelo por empleado
      const updateResults = await Promise.allSettled(
        toUpdate.map(async (bukEmp) => {
          const rut        = normalizeRut(bukEmp.rut)
          const existingId = existingByRut.get(rut)!
          await prisma.employee.update({
            where: { id: existingId },
            data:  empData(bukEmp),
          })
          const contractId = contractMap.get(`${existingId}::${bukEmp.id}`)
          if (contractId) {
            await prisma.contract.update({ where: { id: contractId }, data: mapContractUpsert(bukEmp, legalEntity) })
          } else {
            await prisma.contract.create({ data: { ...mapContractUpsert(bukEmp, legalEntity), employeeId: existingId } })
          }
        })
      )
      for (let i = 0; i < updateResults.length; i++) {
        if (updateResults[i].status === 'fulfilled') { result.employeesUpdated++; result.contractsUpserted++ }
        else result.errors.push({ rut: normalizeRut(toUpdate[i].rut), error: String((updateResults[i] as PromiseRejectedResult).reason) })
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

// ─── Pre-resolución batch de departamentos y cargos ──────────────────────────

async function resolveAllDeptsAndPositions(
  prisma: PrismaClient,
  bukEmployees: BukEmployee[]
): Promise<Map<string, { departmentId?: string; positionId?: string }>> {
  // Recolectar departamentos únicos
  const deptMeta = new Map<string, string>() // code → name
  for (const emp of bukEmployees) {
    if (emp.department) {
      deptMeta.set(String(emp.department.id), emp.department.name)
    } else if (emp.role?.name) {
      deptMeta.set('__sin_area__', 'Sin Área')
    }
  }

  // Upsert todos los departamentos en una sola transacción
  const upsertedDepts = new Map<string, string>() // code → id
  if (deptMeta.size > 0) {
    await prisma.$transaction(async (tx) => {
      for (const [code, name] of deptMeta) {
        const dept = await tx.department.upsert({
          where:  { code },
          create: { name, code },
          update: code !== '__sin_area__' ? { name } : {},
        })
        upsertedDepts.set(code, dept.id)
      }
    }, { timeout: 30_000 })
  }

  // Recolectar posiciones únicas por dept — el cargo viene en role.name
  const positionsByDept = new Map<string, Set<string>>() // deptCode → Set<title>
  for (const emp of bukEmployees) {
    const title = emp.role?.name
    if (!title) continue
    const deptCode = emp.department ? String(emp.department.id) : '__sin_area__'
    if (!positionsByDept.has(deptCode)) positionsByDept.set(deptCode, new Set())
    positionsByDept.get(deptCode)!.add(title)
  }

  // Fetch posiciones existentes en un solo query
  const deptIds = [...upsertedDepts.values()]
  const existingPositions = deptIds.length > 0
    ? await prisma.position.findMany({
        where:  { departmentId: { in: deptIds } },
        select: { id: true, title: true, departmentId: true },
      })
    : []
  const posMap = new Map<string, string>() // `${deptId}::${title}` → id
  for (const pos of existingPositions) posMap.set(`${pos.departmentId}::${pos.title}`, pos.id)

  // Crear posiciones faltantes en una sola transacción
  const missing: Array<{ title: string; departmentId: string }> = []
  for (const [deptCode, titles] of positionsByDept) {
    const deptId = upsertedDepts.get(deptCode)
    if (!deptId) continue
    for (const title of titles) {
      if (!posMap.has(`${deptId}::${title}`)) missing.push({ title, departmentId: deptId })
    }
  }
  if (missing.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const pos of missing) {
        const created = await tx.position.create({ data: pos })
        posMap.set(`${created.departmentId}::${created.title}`, created.id)
      }
    }, { timeout: 30_000 })
  }

  // Construir mapa final rut → { departmentId, positionId }
  const result = new Map<string, { departmentId?: string; positionId?: string }>()
  for (const emp of bukEmployees) {
    const rut     = normalizeRut(emp.rut)
    const hasDept = !!emp.department
    const title   = emp.role?.name   // cargo viene en role.name
    if (!hasDept && !title) { result.set(rut, {}); continue }

    const deptCode = hasDept ? String(emp.department!.id) : '__sin_area__'
    const deptId   = upsertedDepts.get(deptCode)
    const positionId = (title && deptId) ? posMap.get(`${deptId}::${title}`) : undefined
    result.set(rut, { departmentId: hasDept ? deptId : undefined, positionId })
  }
  return result
}

// ─── Sync completo de ambas empresas (punto de entrada principal) ─────────────

export async function syncBukAll(prisma: PrismaClient): Promise<SyncResult[]> {
  const [clientComunicaciones, clientConsultoria] = BukClient.fromEnv()

  // Descargar empleados de ambas empresas en paralelo; cada una falla de forma independiente
  const [resComunicaciones, resConsultoria] = await Promise.allSettled([
    clientComunicaciones.fetchAllEmployees(),
    clientConsultoria.fetchAllEmployees(),
  ])

  const empsComunicaciones = resComunicaciones.status === 'fulfilled' ? deduplicateWithinCompany(resComunicaciones.value) : []
  const empsConsultoria    = resConsultoria.status    === 'fulfilled' ? deduplicateWithinCompany(resConsultoria.value)    : []

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

  const empsComunicaciones = resComunicaciones.status === 'fulfilled' ? deduplicateWithinCompany(resComunicaciones.value) : []
  const empsConsultoria    = resConsultoria.status    === 'fulfilled' ? deduplicateWithinCompany(resConsultoria.value)    : []

  const allByEntity: Array<{ legalEntity: BukLegalEntity; employees: BukEmployee[] }> = [
    { legalEntity: 'COMUNICACIONES_SURMEDIA', employees: empsComunicaciones },
    { legalEntity: 'SURMEDIA_CONSULTORIA',   employees: empsConsultoria },
  ]

  const { skipSet } = buildDuplicateSet(allByEntity)

  // Fetch all existing RUTs in a single query to avoid N+1
  const allRutsToCheck = new Set<string>()
  for (const { legalEntity, employees } of allByEntity) {
    for (const bukEmp of employees) {
      const rut = normalizeRut(bukEmp.rut)
      if (!skipSet.has(`${rut}::${legalEntity}`)) allRutsToCheck.add(rut)
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
      if (skipSet.has(`${rut}::${legalEntity}`)) {
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
          position: bukEmp.role?.name,
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
  const [rawTargetEmps, rawOtherEmps] = await Promise.all([
    targetClient.fetchAllEmployees(),
    otherClient.fetchAllEmployees(),
  ])
  const targetEmps = deduplicateWithinCompany(rawTargetEmps)
  const otherEmps  = deduplicateWithinCompany(rawOtherEmps)

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

          const periodDate = new Date(period.month ?? period.start_date ?? '')
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
          result.errors.push({ period: period.month ?? period.start_date ?? String(period.id), error: String(err) })
        }
      }
    } catch (err) {
      result.errors.push({ period: '*', error: String(err) })
    }

    results.push(result)
  }

  return results
}
