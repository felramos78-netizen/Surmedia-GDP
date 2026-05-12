/**
 * Corrige el daysFromStart de subtareas Calendar que quedaron con valores incorrectos.
 * Ejecutar con: cd backend && npx tsx prisma/fix-subtask-days.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FIXES: { key: string; expectedDay: number }[] = [
  { key: 'eval_checkpoint30', expectedDay: 30 },
  { key: 'eval_checkpoint60', expectedDay: 60 },
  { key: 'eval_feedback90',   expectedDay: 90 },
]

async function main() {
  for (const { key, expectedDay } of FIXES) {
    const task = await prisma.onboardingTemplateTask.findUnique({
      where: { key },
      include: { subTasks: true },
    })
    if (!task) { console.log(`  ⚠  Tarea '${key}' no encontrada`); continue }

    let fixed = 0
    for (const st of task.subTasks) {
      if (st.tool !== 'CALENDAR' || !st.plantilla) continue
      let cfg: Record<string, any>
      try { cfg = JSON.parse(st.plantilla) } catch { continue }
      if (cfg.daysFromStart === expectedDay) continue
      const old = cfg.daysFromStart
      cfg.daysFromStart = expectedDay
      await prisma.onboardingTemplateSubTask.update({
        where: { id: st.id },
        data:  { plantilla: JSON.stringify(cfg) },
      })
      console.log(`  ✓  [${key}] subtarea '${st.name}': daysFromStart ${old} → ${expectedDay}`)
      fixed++
    }
    if (fixed === 0) console.log(`  –  [${key}] sin cambios necesarios`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
