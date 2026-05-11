import type { FastifyInstance } from 'fastify'

// ── Fechas relevantes recurrentes (hardcoded) ─────────────────────────────────

const RECURRING: { key: string; title: string; day: number; color: string }[] = [
  { key: 'pagos-ant',  title: 'Pagos Antofagasta',     day: 31, color: '#0891b2' },
  { key: 'pagos-stgo', title: 'Pagos Santiago',         day:  5, color: '#0891b2' },
  { key: 'rev-hon',    title: 'Revisión Honorarios',    day: 20, color: '#7c3aed' },
  { key: 'pagos-svc',  title: 'Pagos Servicios Prov.',  day: 25, color: '#0891b2' },
]

// ── Config de onboarding ──────────────────────────────────────────────────────

const PERIOD_OFFSETS: Record<string, number> = {
  PRE_INGRESO: -7, DIA_1: 0, SEMANA_1: 1, MES_1: 8, EVALUACION: 60,
}

const PERIOD_COLORS: Record<string, string> = {
  PRE_INGRESO: '#64748b', DIA_1: '#0284c7',
  SEMANA_1: '#4f46e5', MES_1: '#7c3aed', EVALUACION: '#9333ea',
}

const PERIOD_LABELS: Record<string, string> = {
  PRE_INGRESO: 'Pre-ingreso', DIA_1: 'Ingreso',
  SEMANA_1: 'Semana 1', MES_1: 'Mes 1', EVALUACION: 'Evaluación',
}

const LEAVE_COLORS: Record<string, string> = {
  VACACIONES:          '#16a34a',
  LICENCIA_MEDICA:     '#ea580c',
  LICENCIA_MATERNIDAD: '#db2777',
  LICENCIA_PATERNIDAD: '#7c3aed',
  PERMISO:             '#ca8a04',
  OTRO:                '#64748b',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDS(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

// ── Route ─────────────────────────────────────────────────────────────────────

export default async function calendarRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { start, end } = req.query as { start?: string; end?: string }
    if (!start || !end) {
      return reply.status(400).send({ error: 'Parámetros start y end requeridos (YYYY-MM-DD)' })
    }

    const s = new Date(start + 'T00:00:00.000Z')
    const e = new Date(end   + 'T23:59:59.999Z')
    const ev: any[] = []

    // ── 1. Ausencias ──────────────────────────────────────────────────────────
    const leaves = await app.prisma.leave.findMany({
      where: {
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: e },
        endDate:   { gte: s },
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    })
    for (const l of leaves) {
      ev.push({
        id:    `leave-${l.id}`,
        type:  l.type,
        title: `${l.employee.firstName} ${l.employee.lastName}`,
        start: toDS(l.startDate),
        end:   toDS(l.endDate),
        color: LEAVE_COLORS[l.type] ?? '#64748b',
        meta:  { employeeId: l.employee.id, days: l.days, status: l.status },
      })
    }

    // ── 2. Ingresos ───────────────────────────────────────────────────────────
    const ingresos = await app.prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] }, startDate: { gte: s, lte: e } },
      select: { id: true, firstName: true, lastName: true, startDate: true, jobTitle: true },
    })
    for (const emp of ingresos) {
      const d = toDS(emp.startDate)
      ev.push({
        id: `ing-${emp.id}`, type: 'INGRESO',
        title: `${emp.firstName} ${emp.lastName}`, start: d, end: d,
        color: '#2563eb', meta: { employeeId: emp.id, jobTitle: emp.jobTitle },
      })
    }

    // ── 3. Salidas ────────────────────────────────────────────────────────────
    const salidas = await app.prisma.employee.findMany({
      where: { endDate: { gte: s, lte: e } },
      select: { id: true, firstName: true, lastName: true, endDate: true, jobTitle: true },
    })
    for (const emp of salidas) {
      if (!emp.endDate) continue
      const d = toDS(emp.endDate)
      ev.push({
        id: `sal-${emp.id}`, type: 'SALIDA',
        title: `${emp.firstName} ${emp.lastName}`, start: d, end: d,
        color: '#dc2626', meta: { employeeId: emp.id, jobTitle: emp.jobTitle },
      })
    }

    // ── 4. Vencimientos de contrato ───────────────────────────────────────────
    const vctos = await app.prisma.contract.findMany({
      where: { endDate: { gte: s, lte: e }, isActive: true },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    })
    for (const c of vctos) {
      if (!c.endDate) continue
      const d = toDS(c.endDate)
      ev.push({
        id: `vcto-${c.id}`, type: 'VENCIMIENTO',
        title: `Vcto. ${c.employee.firstName} ${c.employee.lastName}`, start: d, end: d,
        color: '#d97706', meta: { employeeId: c.employee.id, contractType: c.type },
      })
    }

    // ── 5. Hitos de onboarding ────────────────────────────────────────────────
    const procs = await app.prisma.onboardingProcess.findMany({
      where: { status: 'IN_PROGRESS' },
      select: {
        id: true, collaboratorName: true, startDate: true,
        tasks: {
          select: {
            id: true, name: true, period: true,
            automationType: true, automationConfig: true, completedAt: true,
          },
        },
      },
    })
    for (const p of procs) {
      const base = new Date(p.startDate)

      // Milestone por período
      for (const [period, offset] of Object.entries(PERIOD_OFFSETS)) {
        const d = addDays(base, offset)
        if (d >= s && d <= e) {
          ev.push({
            id: `ob-${p.id}-${period}`, type: 'ONBOARDING',
            title: `${PERIOD_LABELS[period]}: ${p.collaboratorName}`,
            start: toDS(d), end: toDS(d),
            color: PERIOD_COLORS[period],
            meta: { processId: p.id, period, name: p.collaboratorName },
          })
        }
      }

      // Tareas tipo CALENDAR
      for (const t of p.tasks) {
        if (t.automationType !== 'CALENDAR' || !t.automationConfig) continue
        const cfg = t.automationConfig as any
        const offset = typeof cfg.daysFromStart === 'number'
          ? cfg.daysFromStart
          : (PERIOD_OFFSETS[t.period] ?? 0)
        const d = addDays(base, offset)
        if (d >= s && d <= e) {
          const title = (cfg.title as string ?? t.name).replace('{collaboratorName}', p.collaboratorName)
          ev.push({
            id: `ob-task-${t.id}`, type: 'ONBOARDING_TASK',
            title, start: toDS(d), end: toDS(d),
            color: '#8b5cf6',
            meta: { processId: p.id, taskId: t.id, completed: !!t.completedAt },
          })
        }
      }
    }

    // ── 6. Fechas relevantes (recurrentes mensuales) ──────────────────────────
    const sy = s.getUTCFullYear(), sm = s.getUTCMonth()
    const ey = e.getUTCFullYear(), em = e.getUTCMonth()
    for (let y = sy; y <= ey; y++) {
      const mf = y === sy ? sm : 0
      const mt = y === ey ? em : 11
      for (let m = mf; m <= mt; m++) {
        for (const r of RECURRING) {
          const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
          const day     = Math.min(r.day, lastDay)
          const d       = new Date(Date.UTC(y, m, day))
          if (d >= s && d <= e) {
            ev.push({
              id: `recur-${r.key}-${y}-${m}`, type: 'FECHA_RELEVANTE',
              title: r.title, start: toDS(d), end: toDS(d),
              color: r.color, meta: {},
            })
          }
        }
      }
    }

    return reply.send(ev)
  })
}
