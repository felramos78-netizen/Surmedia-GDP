import type { FastifyPluginAsync } from 'fastify'

// ─── Plantilla de tareas (workflow oficial Surmedia) ──────────────────────────

const TASK_TEMPLATE = [
  // PRE_INGRESO — Día -7 a Día 0
  { period: 'PRE_INGRESO', name: 'Carta oferta recibida y aceptada',                                          tool: 'Correo a ingresante',     sortOrder: 1 },
  { period: 'PRE_INGRESO', name: 'Documentos personales revisados, validados y enviados al proveedor',        tool: 'IA + correo',             sortOrder: 2 },
  { period: 'PRE_INGRESO', name: 'Coordinación interna con administración y SSO',                             tool: 'Correo interno',          sortOrder: 3 },
  { period: 'PRE_INGRESO', name: 'Generación de documentos contractuales en BUK',                             tool: 'BUK + correo proveedor',  sortOrder: 4 },
  { period: 'PRE_INGRESO', name: 'Correo empresa creado',                                                     tool: 'Google Workspace',        sortOrder: 5 },
  { period: 'PRE_INGRESO', name: 'Perfil BUK marcaje asistencia creado',                                      tool: 'BUK (vía proveedor)',     sortOrder: 6 },
  { period: 'PRE_INGRESO', name: 'Perfil BUK creado',                                                         tool: 'BUK (vía proveedor)',     sortOrder: 7 },
  // DIA_1 — Fecha de ingreso
  { period: 'DIA_1', name: 'Correo de bienvenida',                             tool: 'Correo interno',            sortOrder: 1 },
  { period: 'DIA_1', name: 'Entrega de EPP y firma',                           tool: 'SSO + BUK',                 sortOrder: 2, appliesWhen: 'si aplica' },
  { period: 'DIA_1', name: 'Inducción de jefatura realizada',                  tool: 'Google Calendar',           sortOrder: 3 },
  { period: 'DIA_1', name: 'Enrolamiento de ingreso a oficina',                tool: 'Adm. física',               sortOrder: 4, appliesWhen: 'si aplica' },
  { period: 'DIA_1', name: 'Entrega de kit de bienvenida',                     tool: 'Adm. física',               sortOrder: 5 },
  { period: 'DIA_1', name: 'Licencia de Adobe habilitada',                     tool: 'Correo interno',            sortOrder: 6, appliesWhen: 'solo Diseño' },
  { period: 'DIA_1', name: 'Inducción corporativa realizada',                  tool: 'Google Calendar',           sortOrder: 7 },
  { period: 'DIA_1', name: 'Contrato · RIOHS · IRL firmados',                 tool: 'BUK firma electrónica',     sortOrder: 8 },
  { period: 'DIA_1', name: 'Entrega de computador y recepción firmada',        tool: 'Adm. física + BUK',         sortOrder: 9 },
  // SEMANA_1 — Días 1–7
  { period: 'SEMANA_1', name: 'Foto individual corporativa',                                        tool: 'Coordinación jefatura',  sortOrder: 1 },
  { period: 'SEMANA_1', name: 'Inducción de SSO realizada',                                         tool: 'Google Calendar',        sortOrder: 2 },
  { period: 'SEMANA_1', name: 'Presentación a la empresa y círculo de especialistas',               tool: 'WhatsApp',               sortOrder: 3 },
  { period: 'SEMANA_1', name: 'Formulario seguro complementario completo y enviado',                tool: 'Correo interno',         sortOrder: 4 },
  { period: 'SEMANA_1', name: 'Tarjeta Pluxee entregada',                                           tool: 'Adm. física + BUK',      sortOrder: 5 },
  { period: 'SEMANA_1', name: 'Foto individual cargada en web',                                     tool: 'WordPress',              sortOrder: 6 },
  // MES_1 — Días 7–30
  { period: 'MES_1', name: 'Café virtual con directores', tool: 'Correo + Calendar', sortOrder: 1 },
  { period: 'MES_1', name: 'Mentor asignado',             tool: 'Correo interno',    sortOrder: 2 },
  { period: 'MES_1', name: 'Checkpoint 1 · Día 30',       tool: 'Google Calendar',   sortOrder: 3 },
  // EVALUACION — Días 60–90
  { period: 'EVALUACION', name: 'Checkpoint 2 · Día 60',    tool: 'Google Calendar',               sortOrder: 1 },
  { period: 'EVALUACION', name: 'Feedback 3 meses · Día 90', tool: 'Calendar + correo con pauta',  sortOrder: 2 },
] as const

// ─── Rutas ─────────────────────────────────────────────────────────────────────

const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  const prisma = fastify.prisma as any

  // GET / — lista todos los procesos
  fastify.get('/', async (_req, reply) => {
    const processes = await prisma.onboardingProcess.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        employee: {
          include: {
            position: true,
            contracts: { where: { isActive: true, deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 },
          },
        },
        tasks: { select: { id: true, completedAt: true } },
      },
    })
    return reply.send({ data: processes })
  })

  // GET /stats — conteos para el dashboard
  fastify.get('/stats', async (_req, reply) => {
    const [inProgress, completed, cancelled] = await Promise.all([
      prisma.onboardingProcess.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.onboardingProcess.count({ where: { status: 'COMPLETED' } }),
      prisma.onboardingProcess.count({ where: { status: 'CANCELLED' } }),
    ])
    const soon = await prisma.onboardingProcess.count({
      where: {
        status: 'IN_PROGRESS',
        expectedEndDate: { lte: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      },
    })
    return reply.send({ data: { inProgress, completed, cancelled, finalizingSoon: soon } })
  })

  // POST / — crear nuevo proceso para un colaborador
  fastify.post<{ Body: { employeeId: string; startDate?: string } }>('/', async (req, reply) => {
    const { employeeId, startDate } = req.body

    const employee = await fastify.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
    })
    if (!employee) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const existing = await prisma.onboardingProcess.findFirst({
      where: { employeeId, status: 'IN_PROGRESS' },
    })
    if (existing) {
      return reply.status(409).send({ message: 'Este colaborador ya tiene un proceso de onboarding activo' })
    }

    const start = startDate ? new Date(startDate) : new Date(employee.startDate)
    const expectedEndDate = new Date(start)
    expectedEndDate.setDate(expectedEndDate.getDate() + 90)

    const process = await prisma.onboardingProcess.create({
      data: {
        employeeId,
        startDate: start,
        expectedEndDate,
        tasks: {
          create: TASK_TEMPLATE.map(t => ({
            period:      t.period,
            name:        t.name,
            tool:        t.tool ?? null,
            appliesWhen: (t as any).appliesWhen ?? null,
            sortOrder:   t.sortOrder,
          })),
        },
      },
      include: {
        employee: { include: { position: true } },
        tasks:    { orderBy: [{ sortOrder: 'asc' }] },
      },
    })

    return reply.status(201).send({ data: process })
  })

  // GET /:id — detalle completo
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const process = await prisma.onboardingProcess.findFirst({
      where: { id: req.params.id },
      include: {
        employee: {
          include: {
            position: true,
            department: true,
            contracts: { where: { isActive: true, deletedAt: null }, orderBy: { startDate: 'desc' }, take: 1 },
          },
        },
        tasks: { orderBy: [{ period: 'asc' }, { sortOrder: 'asc' }] },
      },
    })
    if (!process) return reply.status(404).send({ message: 'Proceso no encontrado' })
    return reply.send({ data: process })
  })

  // PATCH /:id/tasks/:taskId — marcar tarea completada / pendiente
  fastify.patch<{
    Params: { id: string; taskId: string }
    Body: { completed: boolean; notes?: string }
  }>('/:id/tasks/:taskId', async (req, reply) => {
    const { completed, notes } = req.body
    const userId = (req.user as any)?.id ?? 'system'

    const task = await prisma.onboardingTask.update({
      where: { id: req.params.taskId },
      data: {
        completedAt: completed ? new Date() : null,
        completedBy: completed ? userId : null,
        notes:       notes ?? undefined,
      },
    })

    // Auto-completar proceso cuando todas las tareas estén listas
    const allTasks = await prisma.onboardingTask.findMany({
      where:  { processId: req.params.id },
      select: { completedAt: true },
    })
    if (allTasks.every((t: any) => t.completedAt !== null)) {
      await prisma.onboardingProcess.update({
        where: { id: req.params.id },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    return reply.send({ data: task })
  })

  // PATCH /:id — cambiar estado del proceso (cancelar, reabrir)
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>('/:id', async (req, reply) => {
    const process = await prisma.onboardingProcess.update({
      where: { id: req.params.id },
      data:  {
        status:      req.body.status,
        completedAt: req.body.status === 'COMPLETED' ? new Date() : null,
      },
    })
    return reply.send({ data: process })
  })
}

export default onboardingRoutes
