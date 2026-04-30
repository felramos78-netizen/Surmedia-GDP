import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const REPORTES_DIR = path.join(process.cwd(), 'reportes')

// Normaliza a medianoche UTC para evitar desfases de zona horaria
const toUTCDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

function readVacacionesExcel(legalEntityFilter?: string) {
  const folders: Array<{ dir: string; entity: string }> = [
    { dir: 'Comunicaciones', entity: 'COMUNICACIONES_SURMEDIA' },
    { dir: 'Consultoría',    entity: 'SURMEDIA_CONSULTORIA' },
  ]
  const result: Array<{ id: string; rut: string; nombre: string; startDate: Date; endDate: Date; legalEntity: string }> = []

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
      result.push({
        id:        `${entity}-${rut}-${i}`,
        rut:       rut as string,
        nombre:    nombre as string,
        startDate: toUTCDay(new Date(inicio)),
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
    const [ingresos, salidas, empByRut] = await Promise.all([
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
        select: { rut: true, firstName: true, lastName: true },
      }),
    ])

    const empMap = new Map(empByRut.map(e => [e.rut, e]))
    const vacaciones = rawVacaciones.map(v => {
      const emp = empMap.get(v.rut)
      const days = Math.round((v.endDate.getTime() - v.startDate.getTime()) / 86400000) + 1
      return {
        id:         v.id,
        employee:   emp ? { firstName: emp.firstName, lastName: emp.lastName } : { firstName: v.nombre, lastName: '' },
        startDate:  v.startDate,
        endDate:    v.endDate,
        days,
        legalEntity: v.legalEntity,
      }
    })

    return reply.send({ data: { ingresos, salidas, vacaciones } })
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

  fastify.patch<{ Params: { id: string }; Body: { vinculo?: string | null; reemplazaA?: string | null } }>('/:id', async (req, reply) => {
    const { id } = req.params
    const { vinculo, reemplazaA } = req.body
    const data: Record<string, unknown> = {}
    if ('vinculo'    in req.body) data.vinculo    = vinculo    ?? null
    if ('reemplazaA' in req.body) data.reemplazaA = reemplazaA ?? null
    const emp = await fastify.prisma.employee.update({ where: { id }, data, select: { id: true, vinculo: true, reemplazaA: true } })
    return reply.send({ data: emp })
  })

  fastify.get<{ Params: { id: string } }>('/:id/payroll', async (req, reply) => {
    const entries = await fastify.prisma.$queryRaw<Array<{
      id: string; year: number; month: number; legalEntity: string;
      grossSalary: number; liquidSalary: number; items: unknown
    }>>`
      SELECT id, year, month, "legalEntity", "grossSalary", "liquidSalary", items
      FROM payroll_entries
      WHERE "employeeId" = ${req.params.id}::uuid
      ORDER BY year DESC, month DESC
    `
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
          take: 10,
        },
        documents: true,
      },
    })

    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })
    return reply.send({ data: employee })
  })
}

export default employeeRoutes
