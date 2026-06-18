import type { FastifyInstance } from 'fastify'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDS(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDaysUTC(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function chileNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
}

function interpolate(template: string, vars: Record<string, string>): string {
  // normaliza clave a minúsculas para que {{Nombre}} == {{nombre}}
  const lv = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]))
  return template
    .replace(/\{\{([\wáéíóúÁÉÍÓÚñÑ]+)\}\}/g, (_, k) => lv[k.toLowerCase()] ?? '')
    .replace(/\{([\wáéíóúÁÉÍÓÚñÑ]+)\}/g, (_, k) => lv[k.toLowerCase()] ?? '')
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .trim()
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yy = d.getUTCFullYear()
  return `${dd}/${mm}/${yy}`
}

function buildVars(emp: {
  firstName: string; lastName: string; email: string
  jobTitle: string | null; startDate?: Date; years?: number
  supervisorName?: string | null; supervisorTitle?: string | null
  manager?: { firstName: string; lastName: string; email: string } | null
}): Record<string, string> {
  const managerName = emp.manager
    ? `${emp.manager.firstName} ${emp.manager.lastName}`
    : (emp.supervisorName ?? '')
  return {
    nombre:           `${emp.firstName} ${emp.lastName}`,
    primerNombre:         emp.firstName.split(' ')[0],
    primerNombreCompleto: emp.firstName,
    apellido:             emp.lastName,
    cargo:            emp.jobTitle ?? '',
    empresa:          'Surmedia',
    emailColaborador: emp.email,
    fechaIngreso:     emp.startDate ? fmtDate(emp.startDate) : '',
    años:             String(emp.years ?? ''),
    nombreJefatura:   managerName.split(' ')[0],
    cargoJefatura:    emp.supervisorTitle ?? '',
    emailJefatura:    emp.manager?.email ?? '',
  }
}

// Resuelve emails CC de una plantilla (perfiles + custom)
async function resolveCcEmails(app: FastifyInstance, rule: any): Promise<string[]> {
  const cc: string[] = [...((rule.ccCustomEmails as string[]) ?? [])]
  const profileIds   = (rule.ccProfileIds as string[]) ?? []
  if (profileIds.length) {
    const profiles = await app.prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { email: true },
    })
    for (const p of profiles) cc.push(p.email)
  }
  return cc
}

// ── Upcoming helpers ──────────────────────────────────────────────────────────

async function upcomingBirthdays(app: FastifyInstance, rules: any[], daysAhead: number) {
  const today = chileNow(); today.setHours(0, 0, 0, 0)
  const end   = new Date(today); end.setDate(end.getDate() + daysAhead)
  const sy    = today.getFullYear(), ey = end.getFullYear()

  const birthRule = rules.find(r => r.eventType === 'CUMPLEANOS')
  if (!birthRule) return []

  const emps = await app.prisma.employee.findMany({
    where: { status: { in: ['ACTIVE', 'ON_LEAVE'] }, birthDate: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, birthDate: true,
      email: true, jobTitle: true, startDate: true,
      supervisorName: true, supervisorTitle: true,
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const results: any[] = []
  for (const emp of emps) {
    if (!emp.birthDate) continue
    const bm = emp.birthDate.getUTCMonth()
    const bd = emp.birthDate.getUTCDate()
    for (let y = sy; y <= ey; y++) {
      const bdate   = new Date(y, bm, bd)
      const trigger = new Date(bdate); trigger.setDate(bdate.getDate() - (birthRule.daysBeforeEvent ?? 0))
      if (trigger >= today && trigger <= end) {
        const vars = buildVars(emp)
        const subject = interpolate(birthRule.subject, vars)
        const body    = interpolate(birthRule.bodyHtml, vars)
        const toList  = [...(birthRule.toColaborador ? [emp.email] : []), ...(birthRule.toDirectEmails as string[])]
        const ccList  = await resolveCcEmails(app, birthRule)

        const triggerStr  = toDS(trigger)
        const alreadySent = birthRule.isActive
          ? !!(await app.prisma.emailLog.findFirst({
              where: {
                templateKey: `cal-rule-${birthRule.id}-${emp.id}`,
                status: 'SENT',
                sentAt: { gte: new Date(trigger.getFullYear(), trigger.getMonth(), trigger.getDate()),
                          lte: new Date(trigger.getFullYear(), trigger.getMonth(), trigger.getDate(), 23, 59, 59) },
              },
            }))
          : false

        results.push({
          ruleId: birthRule.id, ruleName: birthRule.name,
          ruleIsActive: birthRule.isActive, sendTime: birthRule.sendTime,
          eventType: 'CUMPLEANOS', employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          date: toDS(bdate), triggerDate: triggerStr,
          subject, body: htmlToPlain(body),
          toEmails: toList, ccEmails: ccList,
          alreadySent,
        })
      }
    }
  }
  return results
}

async function upcomingAnniversaries(app: FastifyInstance, rules: any[], daysAhead: number) {
  const today = chileNow(); today.setHours(0, 0, 0, 0)
  const end   = new Date(today); end.setDate(end.getDate() + daysAhead)
  const sy    = today.getFullYear(), ey = end.getFullYear()

  const annivRule = rules.find(r => r.eventType === 'ANIVERSARIO_LABORAL')
  if (!annivRule) return []

  const emps = await app.prisma.employee.findMany({
    where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: {
      id: true, firstName: true, lastName: true, startDate: true,
      email: true, jobTitle: true,
      supervisorName: true, supervisorTitle: true,
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const results: any[] = []
  for (const emp of emps) {
    const am = emp.startDate.getUTCMonth()
    const ad = emp.startDate.getUTCDate()
    const startYear = emp.startDate.getUTCFullYear()
    for (let y = sy; y <= ey; y++) {
      if (y <= startYear) continue
      const adate   = new Date(y, am, ad)
      const trigger = new Date(adate); trigger.setDate(adate.getDate() - (annivRule.daysBeforeEvent ?? 0))
      if (trigger >= today && trigger <= end) {
        const years   = y - startYear
        const vars    = buildVars({ ...emp, years })
        const subject = interpolate(annivRule.subject, vars)
        const body    = interpolate(annivRule.bodyHtml, vars)
        const toList  = [...(annivRule.toColaborador ? [emp.email] : []), ...(annivRule.toDirectEmails as string[])]
        const ccList  = await resolveCcEmails(app, annivRule)

        const alreadySent = annivRule.isActive
          ? !!(await app.prisma.emailLog.findFirst({
              where: {
                templateKey: `cal-rule-${annivRule.id}-${emp.id}`,
                status: 'SENT',
                sentAt: { gte: new Date(trigger.getFullYear(), trigger.getMonth(), trigger.getDate()),
                          lte: new Date(trigger.getFullYear(), trigger.getMonth(), trigger.getDate(), 23, 59, 59) },
              },
            }))
          : false

        results.push({
          ruleId: annivRule.id, ruleName: annivRule.name,
          ruleIsActive: annivRule.isActive, sendTime: annivRule.sendTime,
          eventType: 'ANIVERSARIO_LABORAL', employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`, years,
          date: toDS(adate), triggerDate: toDS(trigger),
          subject, body: htmlToPlain(body),
          toEmails: toList, ccEmails: ccList,
          alreadySent,
        })
      }
    }
  }
  return results
}

// ── Routes ────────────────────────────────────────────────────────────────────

export default async function calendarEmailRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (_req, reply) => {
    const rules = await app.prisma.calendarEmailRule.findMany({
      orderBy: [{ eventType: 'asc' }, { createdAt: 'asc' }],
    })
    // Enriquecer con datos del perfil remitente
    const rulesAny   = rules as any[]
    const profileIds = rulesAny.map(r => r.fromProfileId).filter(Boolean) as string[]
    const profiles   = profileIds.length
      ? await app.prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, name: true, email: true } })
      : []
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
    const enriched   = rulesAny.map(r => ({
      ...r,
      fromProfile: r.fromProfileId ? (profileMap[r.fromProfileId] ?? null) : null,
    }))
    return reply.send(enriched)
  })

  app.post('/', auth, async (req, reply) => {
    const body = req.body as any
    const rule = await (app.prisma.calendarEmailRule as any).create({
      data: {
        name:            body.name,
        eventType:       body.eventType,
        fromProfileId:   body.fromProfileId || null,
        subject:         body.subject,
        bodyHtml:        body.bodyHtml,
        daysBeforeEvent: body.daysBeforeEvent ?? 0,
        sendTime:        body.sendTime ?? '09:00',
        toColaborador:   body.toColaborador ?? true,
        toDirectEmails:  body.toDirectEmails ?? [],
        ccProfileIds:    body.ccProfileIds ?? [],
        ccCustomEmails:  body.ccCustomEmails ?? [],
        isActive:        body.isActive ?? false,
      },
    })
    return reply.status(201).send(rule)
  })

  app.put('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body   = req.body as any
    try {
      const rule = await (app.prisma.calendarEmailRule as any).update({
        where: { id },
        data: {
          name:            body.name,
          eventType:       body.eventType,
          fromProfileId:   body.fromProfileId || null,
          subject:         body.subject,
          bodyHtml:        body.bodyHtml,
          daysBeforeEvent: body.daysBeforeEvent ?? 0,
          sendTime:        body.sendTime ?? '09:00',
          toColaborador:   body.toColaborador ?? true,
          toDirectEmails:  body.toDirectEmails ?? [],
          ccProfileIds:    body.ccProfileIds ?? [],
          ccCustomEmails:  body.ccCustomEmails ?? [],
          isActive:        body.isActive ?? false,
        },
      })
      return reply.send(rule)
    } catch {
      return reply.status(404).send({ error: 'Plantilla no encontrada' })
    }
  })

  app.delete('/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await app.prisma.calendarEmailRule.delete({ where: { id } })
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Plantilla no encontrada' })
    }
  })

  app.get('/upcoming', auth, async (req, reply) => {
    const { days = '30' } = req.query as { days?: string }
    const daysAhead = Math.min(parseInt(days, 10) || 30, 400)

    const rules = await app.prisma.calendarEmailRule.findMany()

    const [birthdays, anniversaries] = await Promise.all([
      upcomingBirthdays(app, rules, daysAhead),
      upcomingAnniversaries(app, rules, daysAhead),
    ])

    const all = [...birthdays, ...anniversaries].sort(
      (a, b) => a.triggerDate.localeCompare(b.triggerDate),
    )
    return reply.send(all)
  })
}
