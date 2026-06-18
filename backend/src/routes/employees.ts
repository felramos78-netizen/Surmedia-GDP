import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { requireRole } from '../middleware/requireRole'

function resolveReportesDir(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'reportes'),
    path.join(process.cwd(), 'reportes'),
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  return candidates[0]
}
const REPORTES_DIR = resolveReportesDir()

// Normaliza a medianoche UTC para evitar desfases de zona horaria
const toUTCDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

function readVacacionesExcel(legalEntityFilter?: string) {
  const folders: Array<{ dir: string; entity: string }> = [
    { dir: 'Comunicaciones', entity: 'COMUNICACIONES_SURMEDIA' },
    { dir: 'Consultoría',    entity: 'SURMEDIA_CONSULTORIA' },
  ]
  const result: Array<{ id: string; rut: string; nombre: string; startDate: Date; endDate: Date; legalEntity: string }> = []
  const seenKeys = new Set<string>()

  for (const { dir, entity } of folders) {
    if (legalEntityFilter && legalEntityFilter !== entity) continue
    const folderPath = path.join(REPORTES_DIR, dir)
    if (!fs.existsSync(folderPath)) continue

    const file = fs.readdirSync(folderPath).filter(f => f.includes('Vacaciones tomadas')).sort().reverse()[0]
    if (!file) continue

    const wb = XLSX.readFile(path.join(folderPath, file), { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })

    for (let i = 6; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 5) continue
      const [, rut, nombre, inicio, termino] = row
      if (!rut || !inicio || !termino) continue
      const sd = toUTCDay(new Date(inicio))
      const dedupeKey = `${rut}|${sd.toISOString().slice(0, 10)}`
      if (seenKeys.has(dedupeKey)) continue
      seenKeys.add(dedupeKey)
      result.push({
        id:        `${entity}-${rut}-${i}`,
        rut:       rut as string,
        nombre:    nombre as string,
        startDate: sd,
        endDate:   toUTCDay(new Date(termino)),
        legalEntity: entity,
      })
    }
  }
  return result
}

interface EmployeeListQuery {
  search?: string
  status?: string
  legalEntity?: string
  contractType?: string
  departmentId?: string
  activeYear?: string
  activeMonth?: string
  page?: string
  limit?: string
}

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/stats', async (_req, reply) => {
    const now = new Date()
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [total, active, inactive, duplicate, expiring, inBoth,
           activeComunicaciones, inactiveComunicaciones,
           activeConsultoria, inactiveConsultoria] = await Promise.all([
      fastify.prisma.employee.count({ where: { deletedAt: null } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE' } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'DUPLICATE' } }),
      fastify.prisma.contract.count({
        where: { deletedAt: null, isActive: true, endDate: { gte: now, lte: thirtyDays } },
      }),
      fastify.prisma.employee.count({
        where: {
          deletedAt: null,
          AND: [
            { contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } },
            { contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA', deletedAt: null } } },
          ],
        },
      }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE',   contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE', contracts: { some: { legalEntity: 'COMUNICACIONES_SURMEDIA', deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'ACTIVE',   contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA',    deletedAt: null } } } }),
      fastify.prisma.employee.count({ where: { deletedAt: null, status: 'INACTIVE', contracts: { some: { legalEntity: 'SURMEDIA_CONSULTORIA',    deletedAt: null } } } }),
    ])

    return reply.send({ data: {
      total, active, inactive, duplicate, expiring, inBoth,
      activeComunicaciones, inactiveComunicaciones,
      activeConsultoria, inactiveConsultoria,
    } })
  })

  // GET /api/employees/job-titles — lista única de cargos existentes
  fastify.get('/job-titles', async (_req, reply) => {
    const rows = await fastify.prisma.employee.findMany({
      where: { deletedAt: null, jobTitle: { not: null } },
      select: { jobTitle: true },
      distinct: ['jobTitle'],
      orderBy: { jobTitle: 'asc' },
    })
    return reply.send({ data: rows.map(r => r.jobTitle as string) })
  })

  // GET /api/employees/job-families — lista única de familias de cargo existentes
  fastify.get('/job-families', async (_req, reply) => {
    const rows = await fastify.prisma.employee.findMany({
      where: { deletedAt: null, jobFamily: { not: null } },
      select: { jobFamily: true },
      distinct: ['jobFamily'],
      orderBy: { jobFamily: 'asc' },
    })
    return reply.send({ data: rows.map(r => r.jobFamily as string).filter(v => v.trim()) })
  })

  // GET /api/employees/work-schedules — lista única de horarios de trabajo existentes
  fastify.get('/work-schedules', async (_req, reply) => {
    const rows = await fastify.prisma.employee.findMany({
      where: { deletedAt: null, workSchedule: { not: null } },
      select: { workSchedule: true },
      distinct: ['workSchedule'],
      orderBy: { workSchedule: 'asc' },
    })
    return reply.send({ data: rows.map(r => r.workSchedule as string).filter(v => v.trim()) })
  })

  // GET /api/employees/expiring-contracts — PLAZO_FIJO contracts expiring in next 3 months
  fastify.get('/expiring-contracts', async (_req, reply) => {
    const today  = new Date()
    const future = new Date(today)
    future.setMonth(future.getMonth() + 3)

    const contracts = await fastify.prisma.contract.findMany({
      where: {
        deletedAt: null,
        isActive:  true,
        type:      'PLAZO_FIJO',
        endDate:   { gte: today, lte: future },
        employee:  { deletedAt: null },
      },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true,
            workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    })

    return reply.send({ data: contracts })
  })

  // GET /api/employees/movements?year=2026&month=4&legalEntity=
  fastify.get<{ Querystring: { year: string; month?: string; legalEntity?: string } }>('/movements', async (req, reply) => {
    const { year, month, legalEntity } = req.query
    if (!year) return reply.status(400).send({ message: 'year es requerido' })

    const y = Number(year)
    const m = month ? Number(month) : null
    const startOfPeriod = m ? new Date(y, m - 1, 1)              : new Date(y, 0, 1)
    const endOfPeriod   = m ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999)

    const entityContractFilter = legalEntity
      ? { contracts: { some: { legalEntity: legalEntity as any, deletedAt: null } } }
      : {}

    const empSelect = {
      id: true, firstName: true, lastName: true, rut: true, startDate: true, endDate: true, status: true,
      contracts: { where: { deletedAt: null, isActive: true }, select: { legalEntity: true } },
      workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
    } as const

    const rawVacaciones = readVacacionesExcel(legalEntity)
      .filter(v => v.startDate >= startOfPeriod && v.startDate <= endOfPeriod)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    const ruts = [...new Set(rawVacaciones.map(v => v.rut))]
    const leaveEntityFilter = legalEntity
      ? { contracts: { some: { legalEntity: legalEntity as any, deletedAt: null } } }
      : {}

    const [ingresos, salidas, empByRut, licencias, reemplazos] = await Promise.all([
      fastify.prisma.employee.findMany({
        where: { deletedAt: null, startDate: { gte: startOfPeriod, lte: endOfPeriod }, ...entityContractFilter },
        select: empSelect,
        orderBy: { startDate: 'asc' },
      }),
      fastify.prisma.employee.findMany({
        where: { deletedAt: null, endDate: { gte: startOfPeriod, lte: endOfPeriod }, ...entityContractFilter },
        select: empSelect,
        orderBy: { endDate: 'asc' },
      }),
      fastify.prisma.employee.findMany({
        where: { rut: { in: ruts } },
        select: {
          rut: true, firstName: true, lastName: true,
          workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
        },
      }),
      fastify.prisma.leave.findMany({
        where: {
          type:      { in: ['LICENCIA_MEDICA', 'LICENCIA_MATERNIDAD', 'LICENCIA_PATERNIDAD'] as any },
          status:    'APPROVED' as any,
          startDate: { lte: endOfPeriod },
          endDate:   { gte: startOfPeriod },
          employee:  { deletedAt: null, ...leaveEntityFilter },
        },
        select: {
          id: true, type: true, startDate: true, endDate: true, days: true,
          employee: { select: empSelect },
        },
        orderBy: { startDate: 'asc' },
      }),
      fastify.prisma.employee.findMany({
        where: { deletedAt: null, vinculo: 'Reemplazo', ...entityContractFilter },
        select: {
          id: true, firstName: true, lastName: true, rut: true,
          startDate: true, endDate: true, status: true, reemplazaA: true,
          contracts:   { where: { deletedAt: null, isActive: true }, select: { legalEntity: true } },
          workCenters: { select: { legalEntity: true, workCenter: { select: { name: true } } } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ])

    const empMap = new Map(empByRut.map(e => [e.rut, e]))
    const vacaciones = rawVacaciones.map(v => {
      const emp = empMap.get(v.rut)
      const days = Math.round((v.endDate.getTime() - v.startDate.getTime()) / 86400000) + 1
      return {
        id:         v.id,
        employee:   emp
          ? { firstName: emp.firstName, lastName: emp.lastName, workCenters: emp.workCenters }
          : { firstName: v.nombre, lastName: '', workCenters: [] },
        startDate:  v.startDate,
        endDate:    v.endDate,
        days,
        legalEntity: v.legalEntity,
      }
    })

    return reply.send({ data: { ingresos, salidas, vacaciones, licencias, reemplazos } })
  })

  fastify.get<{ Querystring: EmployeeListQuery }>('/', async (req, reply) => {
    const { search, status, legalEntity, contractType, departmentId, activeYear, activeMonth, page = '1', limit = '100' } = req.query

    const where: Prisma.EmployeeWhereInput = { deletedAt: null }

    if (status) {
      const statuses = status.split(',').filter(Boolean)
      if (statuses.length === 1) where.status = statuses[0] as any
      else if (statuses.length > 1) where.status = { in: statuses as any }
    }

    if (departmentId) where.departmentId = departmentId

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { rut:       { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { position:  { title: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filtros que aplican sobre contratos
    const contractWhere: Prisma.ContractWhereInput = { deletedAt: null }
    if (legalEntity) {
      const entities = legalEntity.split(',').filter(Boolean)
      contractWhere.legalEntity = entities.length === 1 ? entities[0] as any : { in: entities as any }
    }
    if (contractType) {
      const types = contractType.split(',').filter(Boolean)
      contractWhere.type = types.length === 1 ? types[0] as any : { in: types as any }
    }

    if (legalEntity || contractType) {
      where.contracts = { some: contractWhere }
    }

    // Filtro de período activo: muestra empleados que estaban activos durante el año/mes indicado
    if (activeYear) {
      const y = Number(activeYear)
      const m = activeMonth ? Number(activeMonth) : null
      const periodStart = m ? new Date(y, m - 1, 1)              : new Date(y, 0, 1)
      const periodEnd   = m ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999)
      where.AND = [
        { startDate: { lte: periodEnd } },
        { OR: [{ endDate: null }, { endDate: { gte: periodStart } }] },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [employees, total] = await Promise.all([
      fastify.prisma.employee.findMany({
        where,
        include: {
          position:   true,
          department: true,
          contracts: {
            where:   { deletedAt: null, isActive: true },
            orderBy: { startDate: 'desc' },
            take:    5,
          },
          workCenters: {
            include: { workCenter: { select: { id: true, name: true, costType: true } } },
          },
        },
        orderBy: { lastName: 'asc' },
        skip,
        take: Number(limit),
      }),
      fastify.prisma.employee.count({ where }),
    ])

    return reply.send({ data: employees, total, page: Number(page), limit: Number(limit) })
  })

  fastify.post<{
    Body: {
      rut: string; firstName: string; lastName: string; startDate: string
      email?: string; phone?: string; personalEmail?: string; legalEntity?: string
      jobTitle?: string; jobFamily?: string; costCenter?: string
      city?: string; commune?: string; address?: string
      birthDate?: string; gender?: string; nationality?: string
      afp?: string; isapre?: string; workSchedule?: string
      supervisorName?: string; supervisorTitle?: string
      segundoApellido?: string; distribucionJornada?: string
      banco?: string; tipoCuenta?: string; numeroCuenta?: string
      vinculo?: string; contractType?: string; endDate?: string
    }
  }>('/', async (req, reply) => {
    const { rut, firstName, lastName, startDate, email, legalEntity, ...rest } = req.body
    if (!rut?.trim() || !firstName?.trim() || !lastName?.trim() || !startDate)
      return reply.status(400).send({ message: 'rut, firstName, lastName y startDate son requeridos' })

    const existing = await fastify.prisma.employee.findUnique({ where: { rut: rut.trim() } })
    if (existing) return reply.status(409).send({ message: 'Ya existe un colaborador con ese RUT', code: 'DUPLICATE_RUT' })

    const digits    = rut.replace(/\D/g, '')
    let resolvedEmail = email?.trim() || `${digits}@buk.import`
    const emailTaken  = await fastify.prisma.employee.findUnique({ where: { email: resolvedEmail } })
    if (emailTaken) resolvedEmail = `${digits}_${Date.now()}@buk.import`

    const emp = await fastify.prisma.employee.create({
      data: {
        rut:          rut.trim(),
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        email:        resolvedEmail,
        startDate:    new Date(startDate),
        status:       'ACTIVE',
        phone:            rest.phone            || null,
        personalEmail:    rest.personalEmail    || null,
        city:             rest.city             || null,
        commune:          rest.commune          || null,
        address:          rest.address          || null,
        birthDate:        rest.birthDate        ? new Date(rest.birthDate) : null,
        gender:           rest.gender           || null,
        nationality:      rest.nationality      || 'Chilena',
        afp:              rest.afp              || null,
        isapre:           rest.isapre           || null,
        jobTitle:         rest.jobTitle         || null,
        jobFamily:        rest.jobFamily        || null,
        costCenter:       rest.costCenter       || null,
        workSchedule:     rest.workSchedule     || null,
        supervisorName:   rest.supervisorName   || null,
        supervisorTitle:  rest.supervisorTitle  || null,
        segundoApellido:  rest.segundoApellido  || null,
        distribucionJornada: rest.distribucionJornada || null,
        banco:            rest.banco            || null,
        tipoCuenta:       rest.tipoCuenta       || null,
        numeroCuenta:     rest.numeroCuenta     || null,
        vinculo:          rest.vinculo          || null,
      },
    })

    const endDateVal   = rest.endDate ? new Date(rest.endDate as string) : null
    const contractType = (rest.contractType as any) || (endDateVal ? 'PLAZO_FIJO' : 'INDEFINIDO')
    if (legalEntity) {
      await fastify.prisma.contract.create({
        data: {
          employeeId:  emp.id,
          type:        contractType,
          legalEntity: legalEntity as any,
          startDate:   new Date(startDate),
          endDate:     endDateVal,
          isActive:    true,
          salary:      0,
        },
      })
    }

    if (rest.costCenter && legalEntity) {
      const wc = await fastify.prisma.workCenter.findFirst({ where: { name: rest.costCenter } })
      if (wc) {
        await fastify.prisma.employeeWorkCenter.create({
          data: {
            employeeId:   emp.id,
            workCenterId: wc.id,
            legalEntity:  legalEntity as any,
          },
        })
      }
    }

    return reply.status(201).send({ data: emp })
  })

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/:id', async (req, reply) => {
    const { id } = req.params
    const TEXT_FIELDS    = ['rut','firstName','lastName','email','personalEmail','phone','address','city','commune',
                            'nationality','gender','afp','isapre','jobTitle','jobFamily','costCenter',
                            'supervisorName','supervisorTitle','workSchedule','vinculo','reemplazaA','status',
                            'segundoApellido','distribucionJornada','banco','tipoCuenta','numeroCuenta']
    const DATE_FIELDS    = ['birthDate','startDate','endDate']
    const BOOLEAN_FIELDS = ['exclusive']

    const data: Record<string, unknown> = {}
    for (const f of TEXT_FIELDS)    if (f in req.body) data[f] = req.body[f] ?? null
    for (const f of DATE_FIELDS)    if (f in req.body) data[f] = req.body[f] ? new Date(req.body[f] as string) : null
    for (const f of BOOLEAN_FIELDS) if (f in req.body) data[f] = req.body[f] ?? null

    // rut y email son campos requeridos — no se pueden vaciar
    if ('rut'   in data && !data.rut)   return reply.status(400).send({ message: 'El RUT no puede estar vacío' })
    if ('email' in data && !data.email) return reply.status(400).send({ message: 'El correo corporativo no puede estar vacío' })

    try {
      const emp = await fastify.prisma.employee.update({ where: { id }, data })

      // Sincronizar contrato activo con endDate del colaborador
      if ('endDate' in data) {
        const newEndDate = data.endDate as Date | null
        if (newEndDate) {
          // Si hay fecha de término → el contrato activo pasa a PLAZO_FIJO
          await fastify.prisma.contract.updateMany({
            where: { employeeId: id, isActive: true, type: 'INDEFINIDO', deletedAt: null },
            data:  { type: 'PLAZO_FIJO', endDate: newEndDate },
          })
        } else {
          // Si se borra la fecha de término → el contrato activo vuelve a INDEFINIDO
          await fastify.prisma.contract.updateMany({
            where: { employeeId: id, isActive: true, type: 'PLAZO_FIJO', deletedAt: null },
            data:  { type: 'INDEFINIDO', endDate: null },
          })
        }
      }

      // Sync to IN_PROGRESS onboarding processes linked to this employee
      const procSyncFields: Record<string, unknown> = {}
      const procDataFields: Record<string, unknown> = {}
      if ('rut'           in data && data.rut)   procSyncFields.collaboratorRut           = data.rut
      if ('email'         in data)               procSyncFields.collaboratorEmail          = data.email || null
      if ('personalEmail' in data)               procSyncFields.collaboratorPersonalEmail  = data.personalEmail || null
      if ('phone'         in data)               procSyncFields.collaboratorPhone          = data.phone || null
      if ('jobTitle'      in data)               procSyncFields.collaboratorPosition       = data.jobTitle || null
      if ('supervisorName'  in data) procDataFields.supervisorName  = data.supervisorName  || null
      if ('supervisorTitle' in data) procDataFields.supervisorTitle = data.supervisorTitle || null
      if ('vinculo'         in data) procDataFields.vinculo         = data.vinculo         || null
      if ('endDate'         in data) procDataFields.contractEndDate = data.endDate
        ? (data.endDate as Date).toISOString().slice(0, 10) : null

      if (Object.keys(procSyncFields).length > 0 || Object.keys(procDataFields).length > 0) {
        const procs = await fastify.prisma.onboardingProcess.findMany({
          where: { employeeId: id, status: 'IN_PROGRESS' },
          select: { id: true, collaboratorData: true },
        })
        for (const proc of procs) {
          const existing = (proc.collaboratorData as Record<string, any>) ?? {}
          await fastify.prisma.onboardingProcess.update({
            where: { id: proc.id },
            data: {
              ...procSyncFields,
              ...(Object.keys(procDataFields).length > 0
                ? { collaboratorData: { ...existing, ...procDataFields } }
                : {}),
            },
          })
        }
      }

      return reply.send({ data: emp })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? 'campo'
        return reply.status(409).send({ message: `Ya existe otro colaborador con ese valor en el campo "${field}"` })
      }
      throw err
    }
  })

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('ADMIN', 'RRHH_MANAGER') }, async (req, reply) => {
    const { id } = req.params
    await fastify.prisma.employee.update({
      where: { id },
      data:  { deletedAt: new Date() },
    })
    return reply.send({ ok: true })
  })

  // PATCH /api/employees/:id/contracts/:contractId — editar tipo y fecha de vencimiento
  fastify.patch<{
    Params: { id: string; contractId: string }
    Body: { type?: string; endDate?: string | null; isActive?: boolean }
  }>('/:id/contracts/:contractId', async (req, reply) => {
    const { contractId } = req.params
    const { type, endDate, isActive } = req.body
    const data: Record<string, unknown> = {}
    if (type)              data.type    = type
    if ('endDate' in req.body) data.endDate = endDate ? new Date(endDate) : null
    if ('isActive' in req.body) data.isActive = isActive
    const contract = await fastify.prisma.contract.update({ where: { id: contractId }, data })
    return reply.send({ data: contract })
  })

  // GET /api/employees/cost-centers — valores únicos de centro de costos
  fastify.get('/cost-centers', async (_req, reply) => {
    const rows = await fastify.prisma.employee.findMany({
      where:   { deletedAt: null, costCenter: { not: null } },
      select:  { costCenter: true },
      distinct: ['costCenter'],
      orderBy: { costCenter: 'asc' },
    })
    return reply.send({ data: rows.map(r => r.costCenter as string) })
  })

  fastify.get<{ Params: { id: string } }>('/:id/payroll', async (req, reply) => {
    const entries = await fastify.prisma.payrollEntry.findMany({
      where: { employeeId: req.params.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { id: true, year: true, month: true, legalEntity: true, grossSalary: true, liquidSalary: true, items: true },
    })
    return reply.send({ data: entries })
  })

  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const employee = await fastify.prisma.employee.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        position:   true,
        department: true,
        contracts: {
          where:   { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
        leaves: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        documents: true,
        workCenters: {
          include: { workCenter: { select: { id: true, name: true, costType: true } } },
        },
        vacationBalances: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 12,
        },
      },
    })

    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    // Auto-corregir tipo de contrato según endDate del colaborador
    if (employee.endDate) {
      await fastify.prisma.contract.updateMany({
        where: { employeeId: employee.id, isActive: true, type: 'INDEFINIDO', deletedAt: null },
        data:  { type: 'PLAZO_FIJO', endDate: employee.endDate },
      })
    } else {
      await fastify.prisma.contract.updateMany({
        where: { employeeId: employee.id, isActive: true, type: 'PLAZO_FIJO', endDate: null, deletedAt: null },
        data:  { type: 'INDEFINIDO' },
      })
    }

    // Re-fetch para devolver el estado corregido
    const fresh = await fastify.prisma.employee.findFirst({
      where: { id: employee.id, deletedAt: null },
      include: {
        position: true, department: true,
        contracts:        { where: { deletedAt: null }, orderBy: { startDate: 'desc' } },
        leaves:           { orderBy: { createdAt: 'desc' }, take: 20 },
        documents:        true,
        workCenters:      { include: { workCenter: { select: { id: true, name: true, costType: true } } } },
        vacationBalances: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
      },
    })
    return reply.send({ data: fresh })
  })
}

export default employeeRoutes
