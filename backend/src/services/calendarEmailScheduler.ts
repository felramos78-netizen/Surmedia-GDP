import { PrismaClient } from '@prisma/client'
import { sendEmail } from './email.service'

// ── Helpers ───────────────────────────────────────────────────────────────────

function chileNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
}

function chileHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function toDS(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function interpolate(template: string, vars: Record<string, string>): string {
  const lv = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.toLowerCase(), v]))
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, k) => lv[k.toLowerCase()] ?? '')
    .replace(/\{(\w+)\}/g, (_, k) => lv[k.toLowerCase()] ?? '')
}

function htmlToText(html: string): string {
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
  return `${dd}/${mm}/${d.getUTCFullYear()}`
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

// Verifica si ya se envió el correo hoy para evitar duplicados
async function alreadySentToday(
  prisma: PrismaClient, ruleId: string, employeeId: string,
): Promise<boolean> {
  const todayStart = chileNow()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  const log = await prisma.emailLog.findFirst({
    where: {
      templateKey: `cal-rule-${ruleId}-${employeeId}`,
      sentAt: { gte: todayStart, lte: todayEnd },
      status: 'SENT',
    },
  })
  return !!log
}

// ── Lógica por tipo de evento ─────────────────────────────────────────────────

async function processBirthdayRule(
  prisma: PrismaClient,
  rule: any,
  today: Date,
  fromDisplay: string,
) {
  const emps = await prisma.employee.findMany({
    where: { status: { in: ['ACTIVE', 'ON_LEAVE'] }, birthDate: { not: null } },
    select: {
      id: true, firstName: true, lastName: true, birthDate: true,
      email: true, jobTitle: true, startDate: true,
      supervisorName: true, supervisorTitle: true,
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const targetDate = new Date(today)
  targetDate.setDate(targetDate.getDate() + (rule.daysBeforeEvent ?? 0))
  const tm = targetDate.getMonth()
  const td = targetDate.getDate()

  for (const emp of emps) {
    if (!emp.birthDate) continue
    const bm = emp.birthDate.getUTCMonth()
    const bd = emp.birthDate.getUTCDate()
    if (bm !== tm || bd !== td) continue

    if (await alreadySentToday(prisma, rule.id, emp.id)) continue

    const vars = buildVars(emp)
    const subject = interpolate(rule.subject, vars)
    const html    = interpolate(rule.bodyHtml, vars)
    const toList: string[] = []
    if (rule.toColaborador) toList.push(emp.email)
    for (const direct of (rule.toDirectEmails as string[])) toList.push(direct)

    // CC
    const ccEmails: string[] = [...(rule.ccCustomEmails as string[])]
    if ((rule.ccProfileIds as string[]).length > 0) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: rule.ccProfileIds as string[] } },
        select: { email: true },
      })
      for (const p of profiles) ccEmails.push(p.email)
    }

    for (const to of toList) {
      try {
        await sendEmail({
          from: fromDisplay,
          to,
          cc: ccEmails.join(', ') || undefined,
          subject,
          html: html.replace(/\n/g, '<br>'),
        })
        await prisma.emailLog.create({
          data: {
            templateKey: `cal-rule-${rule.id}-${emp.id}`,
            toEmail: to, subject, status: 'SENT',
          },
        })
      } catch (err: any) {
        await prisma.emailLog.create({
          data: {
            templateKey: `cal-rule-${rule.id}-${emp.id}`,
            toEmail: to, subject, status: 'ERROR', error: err.message,
          },
        })
      }
    }
  }
}

async function processAnniversaryRule(
  prisma: PrismaClient,
  rule: any,
  today: Date,
  fromDisplay: string,
) {
  const emps = await prisma.employee.findMany({
    where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    select: {
      id: true, firstName: true, lastName: true, startDate: true,
      email: true, jobTitle: true,
      supervisorName: true, supervisorTitle: true,
      manager: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const targetDate = new Date(today)
  targetDate.setDate(targetDate.getDate() + (rule.daysBeforeEvent ?? 0))
  const tm = targetDate.getMonth()
  const td = targetDate.getDate()
  const ty = targetDate.getFullYear()

  for (const emp of emps) {
    const sm = emp.startDate.getMonth()
    const sd = emp.startDate.getDate()
    const sy = emp.startDate.getFullYear()
    if (sm !== tm || sd !== td || ty <= sy) continue

    const years = ty - sy
    if (await alreadySentToday(prisma, rule.id, emp.id)) continue

    const vars = buildVars({ ...emp, years })
    const subject = interpolate(rule.subject, vars)
    const html    = interpolate(rule.bodyHtml, vars)

    const toList: string[] = []
    if (rule.toColaborador) toList.push(emp.email)
    for (const direct of (rule.toDirectEmails as string[])) toList.push(direct)

    const ccEmails: string[] = [...(rule.ccCustomEmails as string[])]
    if ((rule.ccProfileIds as string[]).length > 0) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: rule.ccProfileIds as string[] } },
        select: { email: true },
      })
      for (const p of profiles) ccEmails.push(p.email)
    }

    for (const to of toList) {
      try {
        await sendEmail({
          from: fromDisplay,
          to,
          cc: ccEmails.join(', ') || undefined,
          subject,
          html: html.replace(/\n/g, '<br>'),
        })
        await prisma.emailLog.create({
          data: {
            templateKey: `cal-rule-${rule.id}-${emp.id}`,
            toEmail: to, subject, status: 'SENT',
          },
        })
      } catch (err: any) {
        await prisma.emailLog.create({
          data: {
            templateKey: `cal-rule-${rule.id}-${emp.id}`,
            toEmail: to, subject, status: 'ERROR', error: err.message,
          },
        })
      }
    }
  }
}

// ── Tick principal ────────────────────────────────────────────────────────────

async function tick(prisma: PrismaClient) {
  const now  = chileNow()
  const hhmm = chileHHMM(now)

  const rules = await (prisma.calendarEmailRule as any).findMany({
    where: { isActive: true, sendTime: hhmm, eventType: { in: ['CUMPLEANOS', 'ANIVERSARIO_LABORAL'] } },
  })
  if (rules.length === 0) return

  for (const rule of rules) {
    let fromDisplay = process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? ''
    if (rule.fromProfileId) {
      const profile = await prisma.profile.findUnique({
        where: { id: rule.fromProfileId },
        select: { name: true, email: true },
      })
      if (profile) {
        fromDisplay = `"${profile.name}" <${process.env.SMTP_USER ?? profile.email}>`
      }
    }

    if (rule.eventType === 'CUMPLEANOS') {
      await processBirthdayRule(prisma, rule, now, fromDisplay)
    } else if (rule.eventType === 'ANIVERSARIO_LABORAL') {
      await processAnniversaryRule(prisma, rule, now, fromDisplay)
    }
  }
}

// ── Inicio del scheduler ──────────────────────────────────────────────────────

export function startCalendarEmailScheduler(prisma: PrismaClient) {
  // Ejecuta cada 60 segundos
  setInterval(async () => {
    try {
      await tick(prisma)
    } catch (err) {
      console.error('[CalendarEmailScheduler] Error en tick:', err)
    }
  }, 60_000)

  console.log('[CalendarEmailScheduler] Iniciado — revisión cada minuto (hora Chile)')
}
