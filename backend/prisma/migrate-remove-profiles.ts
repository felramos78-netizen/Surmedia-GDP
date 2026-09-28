// Elimina el módulo Perfiles dejando como texto libre los datos que apuntaban a un perfil.
// Ver prisma/migrations/20260928_remove_profiles/migration.sql.
//
//   npx tsx --env-file=.env prisma/migrate-remove-profiles.ts           → simulación (rollback)
//   npx tsx --env-file=.env prisma/migrate-remove-profiles.ts --apply   → aplica
//
// Antes de tocar nada guarda un respaldo en prisma/backups/ (ignorado por git).
// Usa solo SQL crudo para no depender del cliente Prisma generado.
import { PrismaClient, Prisma } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// Conexión directa (no el pooler) para la transacción con DDL
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } } })
const APPLY  = process.argv.includes('--apply')

type Profile = { id: string; name: string; email: string }

// Convierte recursivamente attendeeProfileIds → attendeeEmails y responsableProfileId → responsableName,
// conservando el orden de las claves. `plantilla` puede ser un JSON serializado.
function convert(v: any, byId: Map<string, Profile>): any {
  if (Array.isArray(v)) return v.map(x => convert(x, byId))
  if (v === null || typeof v !== 'object') return v
  const out: Record<string, any> = {}
  for (const [k, val] of Object.entries(v)) {
    if (k === 'attendeeProfileIds') {
      out.attendeeEmails = (Array.isArray(val) ? val : [])
        .map((id: string) => byId.get(id)?.email)
        .filter(Boolean)
    } else if (k === 'responsableProfileId') {
      out.responsableName = (val && byId.get(val as string)?.name) || null
    } else if (k === 'plantilla' && typeof val === 'string') {
      out.plantilla = convertJsonString(val, byId)
    } else {
      out[k] = convert(val, byId)
    }
  }
  return out
}

function convertJsonString(s: string | null, byId: Map<string, Profile>): string | null {
  if (!s || !/attendeeProfileIds|responsableProfileId/.test(s)) return s
  try { return JSON.stringify(convert(JSON.parse(s), byId)) } catch { return s }
}

const json = (v: any) => (v === null || v === undefined ? null : JSON.stringify(v))

async function main() {
  const profiles = await prisma.$queryRaw<Profile[]>`SELECT id, name, email FROM profiles`
  const byId     = new Map(profiles.map(p => [p.id, p]))

  // ── Respaldo ────────────────────────────────────────────────────────────────
  const backup = {
    createdAt:     new Date().toISOString(),
    profiles:      await prisma.$queryRaw`SELECT * FROM profiles`,
    profileRoles:  await prisma.$queryRaw`SELECT * FROM profile_roles`,
    assignments:   await prisma.$queryRaw`SELECT * FROM onboarding_task_assignments`,
    templateTasks: await prisma.$queryRaw`SELECT id, key, "responsableProfileId", "automationConfig" FROM onboarding_template_tasks`,
    subTasks:      await prisma.$queryRaw`SELECT id, "responsableProfileId", plantilla FROM onboarding_template_subtasks`,
    processTasks:  await prisma.$queryRaw`SELECT id, "automationConfig", "subTasks", "templateSnapshot" FROM onboarding_tasks`,
    emailRules:    await prisma.$queryRaw`SELECT id, name, "fromProfileId", "ccProfileIds", "ccCustomEmails" FROM calendar_email_rules`,
  }
  const dir = join(__dirname, 'backups')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `profiles-backup-${Date.now()}.json`)
  writeFileSync(file, JSON.stringify(backup, null, 2))
  console.log(`Respaldo: ${file}`)

  const stats = { templateResp: 0, subResp: 0, templateCfg: 0, subPlantilla: 0, processTasks: 0, rules: 0 }

  try {
    await prisma.$transaction(async tx => {
      // (1) Columnas nuevas
      await tx.$executeRawUnsafe(`ALTER TABLE "calendar_email_rules" ADD COLUMN "fromName" TEXT`)
      await tx.$executeRawUnsafe(`ALTER TABLE "onboarding_template_subtasks" ADD COLUMN "responsableName" TEXT`)
      await tx.$executeRawUnsafe(`ALTER TABLE "onboarding_template_tasks" ADD COLUMN "responsableName" TEXT`)

      // (2a) Responsable → nombre
      stats.templateResp = await tx.$executeRawUnsafe(`
        UPDATE onboarding_template_tasks t SET "responsableName" = p.name
        FROM profiles p WHERE t."responsableProfileId" = p.id`)
      stats.subResp = await tx.$executeRawUnsafe(`
        UPDATE onboarding_template_subtasks s SET "responsableName" = p.name
        FROM profiles p WHERE s."responsableProfileId" = p.id`)

      // (2b) Invitados de Calendar en la plantilla
      for (const t of backup.templateTasks as any[]) {
        if (!t.automationConfig || !/attendeeProfileIds/.test(JSON.stringify(t.automationConfig))) continue
        await tx.$executeRaw`UPDATE onboarding_template_tasks SET "automationConfig" = ${json(convert(t.automationConfig, byId))}::jsonb WHERE id = ${t.id}`
        stats.templateCfg++
      }
      for (const s of backup.subTasks as any[]) {
        const next = convertJsonString(s.plantilla, byId)
        if (next === s.plantilla) continue
        await tx.$executeRaw`UPDATE onboarding_template_subtasks SET plantilla = ${next} WHERE id = ${s.id}`
        stats.subPlantilla++
      }

      // (2c) Tareas de procesos: config, subtareas y snapshot de la plantilla
      for (const t of backup.processTasks as any[]) {
        const before = JSON.stringify([t.automationConfig, t.subTasks, t.templateSnapshot])
        if (!/attendeeProfileIds|responsableProfileId/.test(before)) continue
        await tx.$executeRaw`
          UPDATE onboarding_tasks SET
            "automationConfig" = ${json(convert(t.automationConfig, byId))}::jsonb,
            "subTasks"         = ${json(convert(t.subTasks, byId))}::jsonb,
            "templateSnapshot" = ${json(convert(t.templateSnapshot, byId))}::jsonb
          WHERE id = ${t.id}`
        stats.processTasks++
      }

      // (2d) Reglas de correo: remitente → nombre; CC de perfiles → emails
      for (const r of backup.emailRules as any[]) {
        const fromName = r.fromProfileId ? byId.get(r.fromProfileId)?.name ?? null : null
        const ccEmails = ((r.ccProfileIds ?? []) as string[]).map(id => byId.get(id)?.email).filter(Boolean) as string[]
        if (!fromName && ccEmails.length === 0) continue
        const cc = [...new Set([...((r.ccCustomEmails ?? []) as string[]), ...ccEmails])]
        await tx.$executeRaw`UPDATE calendar_email_rules SET "fromName" = ${fromName}, "ccCustomEmails" = ${JSON.stringify(cc)}::jsonb WHERE id = ${r.id}`
        stats.rules++
      }

      // (3) Borrar columnas y tablas de perfiles
      for (const sql of [
        `ALTER TABLE "onboarding_task_assignments" DROP CONSTRAINT "onboarding_task_assignments_profileId_fkey"`,
        `ALTER TABLE "onboarding_task_assignments" DROP CONSTRAINT "onboarding_task_assignments_taskId_fkey"`,
        `ALTER TABLE "onboarding_template_subtasks" DROP CONSTRAINT "onboarding_template_subtasks_responsableProfileId_fkey"`,
        `ALTER TABLE "onboarding_template_tasks" DROP CONSTRAINT "onboarding_template_tasks_responsableProfileId_fkey"`,
        `ALTER TABLE "profile_roles" DROP CONSTRAINT "profile_roles_profileId_fkey"`,
        `ALTER TABLE "calendar_email_rules" DROP COLUMN "ccProfileIds", DROP COLUMN "fromProfileId"`,
        `ALTER TABLE "onboarding_template_subtasks" DROP COLUMN "responsableProfileId"`,
        `ALTER TABLE "onboarding_template_tasks" DROP COLUMN "responsableProfileId"`,
        `DROP TABLE "onboarding_task_assignments"`,
        `DROP TABLE "profile_roles"`,
        `DROP TABLE "profiles"`,
      ]) await tx.$executeRawUnsafe(sql)

      // Verificación dentro de la transacción
      const left = await tx.$queryRawUnsafe<{ n: bigint }[]>(`
        SELECT (SELECT count(*) FROM onboarding_template_tasks WHERE "automationConfig"::text LIKE '%attendeeProfileIds%')
             + (SELECT count(*) FROM onboarding_template_subtasks WHERE plantilla LIKE '%attendeeProfileIds%' OR plantilla LIKE '%responsableProfileId%')
             + (SELECT count(*) FROM onboarding_tasks WHERE "automationConfig"::text LIKE '%attendeeProfileIds%'
                  OR "subTasks"::text LIKE '%ProfileId%' OR "templateSnapshot"::text LIKE '%ProfileId%') AS n`)
      console.log('Cambios:', stats)
      console.log('Referencias a perfiles restantes:', Number(left[0].n))
      if (Number(left[0].n) !== 0) throw new Error('Quedaron referencias a perfiles; se revierte')

      if (!APPLY) throw new Prisma.PrismaClientKnownRequestError('SIMULACION', { code: 'DRYRUN', clientVersion: '' })
    }, { timeout: 120_000, maxWait: 20_000 })
    console.log('✔ Migración aplicada')
  } catch (err: any) {
    if (err?.code === 'DRYRUN') console.log('Simulación OK — nada se guardó. Ejecutar con --apply para aplicar.')
    else throw err
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
