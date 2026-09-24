import type { FastifyPluginAsync } from 'fastify'
import * as fs from 'fs'
import { requireRole } from '../middleware/requireRole'
import {
  REPORTES_DIR, rutVariants, upRut,
  parseSueldos, parseDotacion, parseVacaciones, parseVacLicencia, parseVacacionAprobada,
  type LegalEntityKey, type SueldosRow, type DotacionRow, type VacRow, type VacLicRow, type VacAprobadaRaw,
} from '../services/bukExcelImport.service'
import { loadBukApiSnapshot, type BukApiSnapshot } from '../services/bukApiImport.service'

// ── Fuente de datos: API de BUK (por defecto) o reportes Excel (respaldo) ─────

type BukSource = 'api' | 'excel'

interface BukRows {
  sueldos:          SueldosRow[]
  dotacion:         DotacionRow[]
  vacaciones:       VacRow[]
  vacLicencia:      VacLicRow[]
  vacacionAprobada: VacAprobadaRaw[]
}

// La lectura desde la API toma ~40 s: /preview la guarda y /apply la reutiliza
// para aplicar exactamente lo que RRHH revisó.
const API_CACHE_MS = 30 * 60_000
let apiSnapshot: BukApiSnapshot | null = null

async function loadRows(source: BukSource, year: number | undefined, fresh: boolean): Promise<BukRows> {
  if (source === 'excel') {
    return {
      sueldos:          parseSueldos(year),
      dotacion:         parseDotacion(),
      vacaciones:       parseVacaciones(),
      vacLicencia:      parseVacLicencia(year),
      vacacionAprobada: parseVacacionAprobada(),
    }
  }
  const y = year ?? new Date().getFullYear()
  if (fresh || !apiSnapshot || apiSnapshot.year !== y || Date.now() - apiSnapshot.at > API_CACHE_MS) {
    apiSnapshot = await loadBukApiSnapshot(y)
  }
  return apiSnapshot
}

const parseSource = (raw: unknown): BukSource => (raw === 'excel' ? 'excel' : 'api')

// ── Routes ────────────────────────────────────────────────────────────────────

const bukRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/buk/preview?source=api|excel — lee BUK y devuelve diff vs DB
  fastify.get<{ Querystring: { year?: string; source?: string } }>('/preview', async (req, reply) => {
    const yearOverride = req.query.year ? Number(req.query.year) : undefined
    const source       = parseSource(req.query.source)
    const rows         = await loadRows(source, yearOverride, true)
    const sueldosRows  = rows.sueldos
    const dotacionRows = rows.dotacion
    const vacRows      = rows.vacaciones
    const vacLicRows   = rows.vacLicencia

    // ── Sueldos diff ──────────────────────────────────────────────────────
    const sueldosRuts = [...new Set(sueldosRows.map(r => r.rut))]
    const [dbEmpsSueldos, dbPayroll] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(sueldosRuts) } },
        select: { id: true, rut: true },
      }),
      fastify.prisma.payrollEntry.findMany({
        where: { employee: { rut: { in: rutVariants(sueldosRuts) } } },
        select: { legalEntity: true, year: true, month: true, grossSalary: true, liquidSalary: true, employee: { select: { rut: true } } },
      }),
    ])
    const rutSetSueldos  = new Set(dbEmpsSueldos.map(e => upRut(e.rut)))
    const existingPayroll = new Map(dbPayroll.map(e => [`${e.legalEntity}|${upRut(e.employee.rut)}|${e.year}|${e.month}`, e]))

    const sueldosNuevos: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; grossSalary: number; liquidSalary: number }> = []
    const sueldosCambios: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; antes: { grossSalary: number; liquidSalary: number }; despues: { grossSalary: number; liquidSalary: number } }> = []
    const sueldosSincronizados: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; grossSalary: number; liquidSalary: number }> = []
    const sueldosSinEmpleado: string[] = []

    for (const row of sueldosRows) {
      if (!rutSetSueldos.has(row.rut)) { sueldosSinEmpleado.push(row.rut); continue }
      const existing = existingPayroll.get(row.key)
      if (!existing) {
        sueldosNuevos.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: row.grossSalary, liquidSalary: row.liquidSalary })
      } else if (existing.grossSalary !== row.grossSalary || existing.liquidSalary !== row.liquidSalary) {
        sueldosCambios.push({
          key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month,
          antes:   { grossSalary: existing.grossSalary, liquidSalary: existing.liquidSalary },
          despues: { grossSalary: row.grossSalary,      liquidSalary: row.liquidSalary      },
        })
      } else {
        sueldosSincronizados.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: row.grossSalary, liquidSalary: row.liquidSalary })
      }
    }

    // ── Dotación diff ─────────────────────────────────────────────────────
    const dotRuts = [...new Set(dotacionRows.map(r => r.rut))]
    const [dbEmpsDot, dbContracts] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(dotRuts) } },
        select: {
          id: true, rut: true, status: true, afp: true, isapre: true,
          jobTitle: true, jobFamily: true, supervisorName: true, supervisorTitle: true,
          city: true, commune: true, address: true, email: true, personalEmail: true,
          birthDate: true, gender: true, nationality: true, phone: true, workSchedule: true,
        },
      }),
      fastify.prisma.contract.findMany({
        where: { employee: { rut: { in: rutVariants(dotRuts) } }, isActive: true, deletedAt: null },
        select: { employeeId: true, type: true, endDate: true, employee: { select: { rut: true } } },
        orderBy: { startDate: 'desc' },
      }),
    ])
    const rutToEmpDot    = new Map(dbEmpsDot.map(e => [upRut(e.rut), e]))
    const rutToContract  = new Map<string, typeof dbContracts[0]>()
    for (const c of dbContracts) if (!rutToContract.has(upRut(c.employee.rut))) rutToContract.set(upRut(c.employee.rut), c)

    const dotNuevos:  Array<{ rut: string; nombre: string; legalEntity: LegalEntityKey; estado: string; cargo: string | null; afp: string | null; isapre: string | null; tipoContrato: string | null; fechaIngreso: string | null; supervisorNombre: string | null; jornada: string | null }> = []
    const dotCambios: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; campos: Array<{ campo: string; antes: string | null; despues: string | null }> }> = []
    const seenDotRuts = new Set<string>()

    for (const row of dotacionRows) {
      if (seenDotRuts.has(row.rut)) continue
      seenDotRuts.add(row.rut)
      const dbEmp = rutToEmpDot.get(row.rut)
      if (!dbEmp) {
        dotNuevos.push({
          rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, estado: row.estado,
          cargo:           row.cargo            || null,
          afp:             row.afp              || null,
          isapre:          row.isapre           || null,
          tipoContrato:    row.tipoContrato     || null,
          fechaIngreso:    row.fechaIngreso ? row.fechaIngreso.toISOString().slice(0, 10) : null,
          supervisorNombre:row.supervisorNombre || null,
          jornada:         row.jornada          || null,
        })
        continue
      }

      const campos: Array<{ campo: string; antes: string | null; despues: string | null }> = []
      const addCampo = (campo: string, antes: string | null | undefined, despues: string) => {
        const a = (antes ?? '').trim().toLowerCase()
        const d = despues.trim().toLowerCase()
        if (d && a !== d) campos.push({ campo, antes: antes ?? null, despues })
      }
      const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
      if (dbEmp.status !== excelStatus) campos.push({ campo: 'Estado', antes: dbEmp.status, despues: excelStatus })
      addCampo('AFP',            dbEmp.afp,            row.afp)
      addCampo('Isapre',         dbEmp.isapre,          row.isapre)
      addCampo('Cargo',          dbEmp.jobTitle,        row.cargo)
      addCampo('Familia',        dbEmp.jobFamily,       row.familaCargo)
      addCampo('Supervisor',     dbEmp.supervisorName,  row.supervisorNombre)
      addCampo('Ciudad',         dbEmp.city,            row.city)
      addCampo('Comuna',         dbEmp.commune,         row.commune)
      addCampo('Dirección',      dbEmp.address,         row.address)
      addCampo('Email Personal', dbEmp.personalEmail,   row.personalEmail)
      addCampo('Género',         dbEmp.gender,          row.gender)
      addCampo('Nacionalidad',   dbEmp.nationality,     row.nationality)
      addCampo('Teléfono',       dbEmp.phone,           row.phone)
      addCampo('Jornada',        dbEmp.workSchedule,    row.jornada)
      if (row.excelEmail && dbEmp.email.endsWith('@buk.import'))
        addCampo('Email', dbEmp.email, row.excelEmail)
      const excelBirth = row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null
      const dbBirth    = dbEmp.birthDate ? dbEmp.birthDate.toISOString().slice(0, 10) : null
      if (excelBirth && excelBirth !== dbBirth) campos.push({ campo: 'Fecha nacimiento', antes: dbBirth, despues: excelBirth })

      const contract = rutToContract.get(row.rut)
      if (contract) {
        const excelType = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        if (contract.type !== excelType) campos.push({ campo: 'Tipo contrato', antes: contract.type, despues: excelType })
        const excelEnd = row.fechaVencimiento ? row.fechaVencimiento.toISOString().slice(0, 10) : null
        const dbEnd    = contract.endDate    ? contract.endDate.toISOString().slice(0, 10)    : null
        if (dbEnd !== excelEnd) campos.push({ campo: 'Venc. contrato', antes: dbEnd, despues: excelEnd })
      }
      if (campos.length > 0) dotCambios.push({ key: `dotacion|${row.rut}`, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, campos })
    }

    // ── Vacación (aprobadas) — por RUT (API) o por nombre (libro Excel sin RUT) ─
    const vacAprobadaRaw = rows.vacacionAprobada
    const allEmpsForMatch = await fastify.prisma.employee.findMany({
      select: { id: true, rut: true, firstName: true, lastName: true },
    })
    const nameKey = (apellido: string, nombre: string) => `${apellido.trim().toLowerCase()}|${nombre.trim().toLowerCase()}`
    const empByNameKey = new Map(allEmpsForMatch.map(e => [nameKey(e.lastName.split(/\s+/)[0] ?? '', e.firstName), e]))
    const empByRut     = new Map(allEmpsForMatch.map(e => [upRut(e.rut), e]))

    type VacAprobadaItem = { key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; startDate: string; endDate: string; days: number; tipo: string; aprobadoPor: string; fechaAprobacion: string | null; periodo: string }
    const vacAprobadaResolved: VacAprobadaItem[] = []
    const vacAprobadaSinMatch: string[] = []
    for (const row of vacAprobadaRaw) {
      const emp = row.rut ? empByRut.get(row.rut) : empByNameKey.get(nameKey(row.apellido, row.nombre))
      if (!emp) { vacAprobadaSinMatch.push(`${row.apellido}, ${row.nombre}`); continue }
      vacAprobadaResolved.push({
        key: `vac|${upRut(emp.rut)}|${row.startDate.toISOString().slice(0, 10)}`,
        rut: upRut(emp.rut), nombre: `${row.apellido}, ${row.nombre}`, legalEntity: row.legalEntity,
        startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate.toISOString().slice(0, 10), days: row.days,
        tipo: row.tipo, aprobadoPor: row.aprobadoPor,
        fechaAprobacion: row.fechaAprobacion ? row.fechaAprobacion.toISOString().slice(0, 10) : null,
        periodo: row.periodo,
      })
    }

    // ── Vacaciones diff (tomadas + aprobadas, comparten el mismo pool de Leave) ─
    const vacRuts = [...new Set([...vacRows.map(r => r.rut), ...vacAprobadaResolved.map(r => r.rut)])]
    const [dbEmpsVac, dbLeaves] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(vacRuts) } },
        select: { id: true, rut: true },
      }),
      fastify.prisma.leave.findMany({
        where: { type: 'VACACIONES' as any, employee: { rut: { in: rutVariants(vacRuts) } } },
        select: { startDate: true, employee: { select: { rut: true } } },
      }),
    ])
    const rutSetVac      = new Set(dbEmpsVac.map(e => upRut(e.rut)))
    const existingLeaves = new Set(dbLeaves.map(l => `vac|${upRut(l.employee.rut)}|${l.startDate.toISOString().slice(0, 10)}`))

    const vacNuevas: Array<{ key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; startDate: string; endDate: string; days: number }> = []
    const vacSinEmpleado: string[] = []

    for (const row of vacRows) {
      if (!rutSetVac.has(row.rut)) { vacSinEmpleado.push(row.rut); continue }
      if (!existingLeaves.has(row.key))
        vacNuevas.push({ key: row.key, rut: row.rut, nombre: row.nombre, legalEntity: row.legalEntity, startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate.toISOString().slice(0, 10), days: row.days })
    }

    // vacacionAprobada nuevas: no ya en DB y no propuestas ya por "tomadas" en este mismo preview
    const vacNuevasKeySet = new Set(vacNuevas.map(v => v.key))
    const vacAprobadaNuevas = vacAprobadaResolved.filter(r => !existingLeaves.has(r.key) && !vacNuevasKeySet.has(r.key))

    // ── Vacaciones y licencia diff ─────────────────────────────────────────
    const vacLicRuts = [...new Set(vacLicRows.map(r => r.rut))]
    const dbEmpsVacLic = await fastify.prisma.employee.findMany({
      where: { rut: { in: rutVariants(vacLicRuts) } },
      select: { id: true, rut: true },
    })
    const rutToIdVacLic   = new Map(dbEmpsVacLic.map(e => [upRut(e.rut), e.id]))
    const rutSetVacLic    = new Set(dbEmpsVacLic.map(e => upRut(e.rut)))
    const empIdsVacLic    = dbEmpsVacLic.map(e => e.id)
    const dbVacBalances   = await fastify.prisma.vacationBalance.findMany({
      where: { employeeId: { in: empIdsVacLic } },
      select: { employeeId: true, legalEntity: true, year: true, month: true,
                saldoLegal: true, saldoProgresivas: true, saldoAdministrativos: true,
                diasLicencias: true, vacacionesTomadas: true, source: true },
    })
    const existingVacBal  = new Map(
      dbVacBalances.map(b => [`${b.employeeId}|${b.legalEntity}|${b.year}|${b.month}`, b])
    )

    type VacLicItem = { key: string; rut: string; nombre: string; legalEntity: LegalEntityKey; year: number; month: number; saldoLegal: number; saldoProgresivas: number; saldoAdministrativos: number; diasLicencias: number; vacacionesTomadas: number }
    const vacLicNuevos:        VacLicItem[] = []
    const vacLicCambios:       VacLicItem[] = []
    const vacLicSincronizados: VacLicItem[] = []

    for (const r of vacLicRows) {
      if (!rutSetVacLic.has(r.rut)) continue
      const empId = rutToIdVacLic.get(r.rut)
      if (!empId) continue
      const item: VacLicItem = {
        key: r.key, rut: r.rut, nombre: r.nombre, legalEntity: r.legalEntity,
        year: r.year, month: r.month,
        saldoLegal: r.saldoLegal, saldoProgresivas: r.saldoProgresivas,
        saldoAdministrativos: r.saldoAdministrativos, diasLicencias: r.diasLicencias,
        vacacionesTomadas: r.vacacionesTomadas,
      }
      const dbKey = `${empId}|${r.legalEntity}|${r.year}|${r.month}`
      const existing = existingVacBal.get(dbKey)
      if (!existing) {
        vacLicNuevos.push(item)
      } else if (
        existing.saldoLegal           !== r.saldoLegal  ||
        existing.saldoProgresivas     !== r.saldoProgresivas ||
        existing.saldoAdministrativos !== r.saldoAdministrativos ||
        existing.diasLicencias        !== r.diasLicencias ||
        existing.vacacionesTomadas    !== r.vacacionesTomadas ||
        existing.source               !== r.source
      ) {
        vacLicCambios.push(item)
      } else {
        vacLicSincronizados.push(item)
      }
    }
    const vacLicSinEmpleado = [...new Set(vacLicRows.filter(r => !rutSetVacLic.has(r.rut)).map(r => r.rut))]

    return reply.send({
      _debug: { source, reportesDir: REPORTES_DIR, exists: fs.existsSync(REPORTES_DIR), sueldosRowsCount: sueldosRows.length },
      data: {
        sueldos:    { nuevos: sueldosNuevos, cambios: sueldosCambios, sincronizados: sueldosSincronizados, sinEmpleado: [...new Set(sueldosSinEmpleado)] },
        dotacion:   { nuevos: dotNuevos,     cambios: dotCambios },
        vacaciones: { nuevas: vacNuevas,     sinEmpleado: [...new Set(vacSinEmpleado)] },
        vacLicencia:{ nuevos: vacLicNuevos, cambios: vacLicCambios, sincronizados: vacLicSincronizados, sinEmpleado: vacLicSinEmpleado },
        vacacionAprobada: { nuevas: vacAprobadaNuevas, sinMatch: [...new Set(vacAprobadaSinMatch)] },
      },
    })
  })

  // POST /api/buk/apply — aplica los cambios aprobados
  fastify.post<{
    Body: {
      year?: number
      source?: BukSource
      sueldos?:    {
        nuevosKeys?: string[]; cambiosKeys?: string[]; sincronizadosKeys?: string[]
        overrides?: Record<string, { grossSalary?: number; liquidSalary?: number }>
      }
      dotacion?:    { cambiosKeys?: string[]; nuevosKeys?: string[] }
      vacaciones?:  { nuevasKeys?: string[] }
      vacLicencia?: { keys?: string[] }
      vacacionAprobada?: { nuevasKeys?: string[] }
    }
  }>('/apply', { bodyLimit: 1_000_000, preHandler: requireRole('ADMIN', 'RRHH_MANAGER') }, async (req, reply) => {
    const { sueldos, dotacion, vacaciones, vacLicencia, vacacionAprobada, year: yearOverride } = req.body
    const src = await loadRows(parseSource(req.body.source), yearOverride, false)
    const sueldosAllKeys = new Set([
      ...(sueldos?.nuevosKeys       ?? []),
      ...(sueldos?.cambiosKeys      ?? []),
      ...(sueldos?.sincronizadosKeys ?? []),
    ])
    const dotCambiosKeys  = new Set(dotacion?.cambiosKeys ?? [])
    const dotNuevosKeys   = new Set(dotacion?.nuevosKeys  ?? [])
    const vacNuevasKeys   = new Set(vacaciones?.nuevasKeys ?? [])
    const vacLicKeys   = new Set(vacLicencia?.keys ?? [])
    const vacAprobadaKeys = new Set(vacacionAprobada?.nuevasKeys ?? [])
    const applied = { sueldos: 0, dotacion: 0, vacaciones: 0, vacLicencia: 0 }

    // ── Sueldos (batch con $transaction) ─────────────────────────────────
    if (sueldosAllKeys.size > 0) {
      const rows = src.sueldos.filter(r => sueldosAllKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const ops = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        const ov = sueldos?.overrides?.[row.key]
        const validOverride = (v: number | undefined) => Number.isFinite(v) && (v as number) >= 0
        const gross  = validOverride(ov?.grossSalary)  ? (ov!.grossSalary as number)  : row.grossSalary
        const liquid = validOverride(ov?.liquidSalary) ? (ov!.liquidSalary as number) : row.liquidSalary
        return [fastify.prisma.payrollEntry.upsert({
          where: { employeeId_legalEntity_year_month: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month } },
          create: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month, grossSalary: gross, liquidSalary: liquid, items: row.items as any },
          update: { grossSalary: gross, liquidSalary: liquid, items: row.items as any },
        })]
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops)
        applied.sueldos = ops.length
      }
    }

    // ── Dotación cambios (batch con $transaction) ─────────────────────────
    if (dotCambiosKeys.size > 0) {
      const relevantRuts = [...dotCambiosKeys].map(k => k.replace('dotacion|', ''))
      const rows = src.dotacion.filter(r => relevantRuts.includes(r.rut))
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: relevantRuts } }, select: { id: true, rut: true, email: true } })
      const contracts = await fastify.prisma.contract.findMany({
        where: { employeeId: { in: emps.map(e => e.id) }, isActive: true, deletedAt: null },
        select: { id: true, employeeId: true },
        orderBy: { startDate: 'desc' },
      })
      const empByRut        = new Map(emps.map(e => [upRut(e.rut), e]))
      const contractByEmpId = new Map<string, string>()
      for (const c of contracts) if (!contractByEmpId.has(c.employeeId)) contractByEmpId.set(c.employeeId, c.id)

      const emailUpdates: Array<{ id: string; email: string }> = []
      const ops = rows.flatMap(row => {
        const emp = empByRut.get(row.rut)
        if (!emp) return []
        const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
        const excelType   = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        if (row.excelEmail && emp.email.endsWith('@buk.import'))
          emailUpdates.push({ id: emp.id, email: row.excelEmail })
        const updates = [fastify.prisma.employee.update({
          where: { id: emp.id },
          data: {
            status:          excelStatus as any,
            afp:             row.afp              || undefined,
            isapre:          row.isapre           || undefined,
            jobTitle:        row.cargo            || undefined,
            jobFamily:       row.familaCargo      || undefined,
            supervisorName:  row.supervisorNombre || undefined,
            supervisorTitle: row.supervisorCargo  || undefined,
            workSchedule:    row.jornada          || undefined,
            city:            row.city             || undefined,
            commune:         row.commune          || undefined,
            address:         row.address          || undefined,
            personalEmail:   row.personalEmail    || undefined,
            gender:          row.gender           || undefined,
            nationality:     row.nationality      || undefined,
            phone:           row.phone            || undefined,
            birthDate:       row.birthDate        ?? undefined,
          },
        })]
        const contractId = contractByEmpId.get(emp.id)
        if (contractId) updates.push(fastify.prisma.contract.update({
          where: { id: contractId },
          data: { type: excelType as any, endDate: row.fechaVencimiento ?? null },
        }) as any)
        return updates
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops as any[])
        applied.dotacion += rows.filter(r => empByRut.has(r.rut)).length
      }
      // Email updates fuera de la transacción para evitar fallo por uniqueness
      for (const eu of emailUpdates) {
        try {
          await fastify.prisma.employee.update({ where: { id: eu.id }, data: { email: eu.email } })
        } catch (err: any) {
          if (err?.code !== 'P2002') fastify.log.error({ err, employeeId: eu.id }, 'Error al actualizar email desde BUK')
          // P2002 = email ya en uso por otro colaborador, se ignora intencionalmente
        }
      }
    }

    // ── Dotación nuevos → createMany + contratos (3 queries en total) ────
    if (dotNuevosKeys.size > 0) {
      const nuevosRuts = [...dotNuevosKeys].map(k => k.replace('dot-nuevo|', ''))
      const rows = src.dotacion.filter(r => nuevosRuts.includes(r.rut))
      await fastify.prisma.employee.createMany({
        data: rows.map(row => {
          const parts     = row.nombre.trim().split(/\s+/)
          const firstName = parts.length > 2 ? parts.slice(2).join(' ') : parts[0] ?? row.nombre
          const lastName  = parts.length > 2 ? parts.slice(0, 2).join(' ') : parts.slice(1).join(' ') || '-'
          const excelStatus = row.estado.toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE'
          return {
            rut:             row.rut,
            firstName,
            lastName,
            email:           row.excelEmail || `${row.rut.replace(/[^0-9]/g, '')}@buk.import`,
            status:          excelStatus as any,
            startDate:       row.fechaIngreso ?? new Date(),
            afp:             row.afp              || undefined,
            isapre:          row.isapre           || undefined,
            jobTitle:        row.cargo            || undefined,
            jobFamily:       row.familaCargo      || undefined,
            supervisorName:  row.supervisorNombre || undefined,
            supervisorTitle: row.supervisorCargo  || undefined,
            workSchedule:    row.jornada          || undefined,
            city:            row.city             || undefined,
            commune:         row.commune          || undefined,
            address:         row.address          || undefined,
            personalEmail:   row.personalEmail    || undefined,
            gender:          row.gender           || undefined,
            nationality:     row.nationality      || undefined,
            phone:           row.phone            || undefined,
            birthDate:       row.birthDate        ?? undefined,
          }
        }),
        skipDuplicates: true,
      })
      const createdEmps = await fastify.prisma.employee.findMany({
        where: { rut: { in: rutVariants(rows.map(r => r.rut)) } },
        select: { id: true, rut: true },
      })
      const rutToId = new Map(createdEmps.map(e => [upRut(e.rut), e.id]))
      const contractData = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        const excelType = row.tipoContrato.toLowerCase().includes('plazo') ? 'PLAZO_FIJO' : 'INDEFINIDO'
        return [{ employeeId: empId, type: excelType as any, startDate: row.fechaIngreso ?? new Date(), endDate: row.fechaVencimiento ?? null, salary: 0, legalEntity: row.legalEntity as any }]
      })
      if (contractData.length > 0) {
        await fastify.prisma.contract.createMany({ data: contractData, skipDuplicates: true })
      }
      applied.dotacion += rows.length
    }

    // ── Vacaciones (createMany — las keys ya vienen filtradas como nuevas) ──
    if (vacNuevasKeys.size > 0) {
      const rows = src.vacaciones.filter(r => vacNuevasKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const leaveData = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        return [{
          employeeId: empId, type: 'VACACIONES' as any, startDate: row.startDate, endDate: row.endDate, days: row.days, status: 'APPROVED' as any,
          reason: row.tipo ? `${row.tipo} · Importado desde BUK (API)` : 'Importado desde BUK',
          approvedBy: row.aprobadoPor || null, approvedAt: row.fechaAprobacion ?? null,
        }]
      })
      if (leaveData.length > 0) {
        await fastify.prisma.leave.createMany({ data: leaveData, skipDuplicates: true })
        applied.vacaciones = leaveData.length
      }
    }

    // ── Vacación (aprobadas, match por nombre) — createMany ─────────────────
    if (vacAprobadaKeys.size > 0) {
      const raw = src.vacacionAprobada
      const allEmps = await fastify.prisma.employee.findMany({
        select: { id: true, rut: true, firstName: true, lastName: true },
      })
      const nameKey = (apellido: string, nombre: string) => `${apellido.trim().toLowerCase()}|${nombre.trim().toLowerCase()}`
      const empByNameKey = new Map(allEmps.map(e => [nameKey(e.lastName.split(/\s+/)[0] ?? '', e.firstName), e]))
      const empByRut     = new Map(allEmps.map(e => [upRut(e.rut), e]))

      const leaveData = raw.flatMap(row => {
        const emp = row.rut ? empByRut.get(row.rut) : empByNameKey.get(nameKey(row.apellido, row.nombre))
        if (!emp) return []
        const key = `vac|${upRut(emp.rut)}|${row.startDate.toISOString().slice(0, 10)}`
        if (!vacAprobadaKeys.has(key)) return []
        const tipo = row.tipo.toLowerCase()
        const tipoCorto = tipo.includes('administrativ') ? 'Administrativos' : tipo.includes('progresiv') ? 'Progresivas' : 'Legales'
        return [{
          employeeId: emp.id, type: 'VACACIONES' as any, startDate: row.startDate, endDate: row.endDate,
          days: row.days, status: 'APPROVED' as any,
          reason: row.rut
            ? `${tipoCorto} · Importado desde BUK (API)`
            : `${tipoCorto} · Periodo ${row.periodo || 's/i'} · Importado desde BUK (Libro Vacación)`,
          approvedBy: row.aprobadoPor || null, approvedAt: row.fechaAprobacion,
        }]
      })
      if (leaveData.length > 0) {
        await fastify.prisma.leave.createMany({ data: leaveData, skipDuplicates: true })
        applied.vacaciones += leaveData.length
      }
    }

    // ── Vacaciones y licencia (upsert batch) ──────────────────────────────
    if (vacLicKeys.size > 0) {
      const rows = src.vacLicencia.filter(r => vacLicKeys.has(r.key))
      const ruts = [...new Set(rows.map(r => r.rut))]
      const emps = await fastify.prisma.employee.findMany({ where: { rut: { in: rutVariants(ruts) } }, select: { id: true, rut: true } })
      const rutToId = new Map(emps.map(e => [upRut(e.rut), e.id]))
      const ops = rows.flatMap(row => {
        const empId = rutToId.get(row.rut)
        if (!empId) return []
        return [fastify.prisma.vacationBalance.upsert({
          where: { employeeId_legalEntity_year_month: { employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month } },
          create: {
            employeeId: empId, legalEntity: row.legalEntity, year: row.year, month: row.month,
            saldoLegal: row.saldoLegal, saldoProgresivas: row.saldoProgresivas,
            saldoAdministrativos: row.saldoAdministrativos, diasLicencias: row.diasLicencias,
            vacacionesTomadas: row.vacacionesTomadas, source: row.source,
          },
          update: {
            saldoLegal: row.saldoLegal, saldoProgresivas: row.saldoProgresivas,
            saldoAdministrativos: row.saldoAdministrativos, diasLicencias: row.diasLicencias,
            vacacionesTomadas: row.vacacionesTomadas, source: row.source,
          },
        })]
      })
      if (ops.length > 0) {
        await fastify.prisma.$transaction(ops)
        applied.vacLicencia = ops.length
      }
    }

    return reply.send({ ok: true, applied })
  })
}

export default bukRoutes
