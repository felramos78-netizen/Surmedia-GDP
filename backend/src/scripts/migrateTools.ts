/**
 * Migración one-time: actualiza el campo `tool` de todos los hitos existentes
 * según la nueva nomenclatura de herramientas.
 * Ejecutar con: npx tsx src/scripts/migrateTools.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOOL_MAP: Record<string, string> = {
  pre_carta_oferta:          'Correo, Google Calendar',
  pre_documentos:            'Google Sheets API',
  pre_coordinacion:          'Correo, Google Calendar',
  pre_contratos_buk:         'BUK API, Correo, Google Calendar',
  pre_correo_empresa:        'Google Workspace API',
  pre_buk_asistencia:        'BUK API',
  pre_buk_perfil:            'BUK API',
  day1_bienvenida:           'Correo, Google Calendar',
  day1_epp:                  'BUK API',
  day1_induccion_jefatura:   'Google Calendar',
  day1_enrolamiento:         'Físico/Manual, Google Calendar',
  day1_kit:                  'Físico/Manual, Google Calendar',
  day1_adobe:                'Correo, Google Calendar',
  day1_induccion_corporativa:'Google Calendar',
  day1_firmas:               'BUK API',
  day1_computador:           'Físico/Manual, BUK API, Google Calendar',
  semana_foto:               'Físico/Manual, Google Calendar',
  semana_sso:                'Google Calendar',
  semana_presentacion:       'Correo, Google Calendar',
  semana_seguro:             'Correo, Google Calendar',
  semana_pluxee:             'Físico/Manual, Correo, Google Calendar',
  semana_foto_web:           'Correo, Google Calendar',
  mes_cafe:                  'Correo, Google Calendar',
  mes_mentor:                'Correo, Google Calendar',
  eval_checkpoint30:         'Google Calendar',
  eval_checkpoint60:         'Google Calendar',
  eval_feedback90:           'Correo, Google Calendar',
}

async function main() {
  console.log('Iniciando migración de herramientas...\n')

  let updated = 0
  let skipped = 0

  for (const [templateId, newTool] of Object.entries(TOOL_MAP)) {
    const result = await prisma.onboardingTask.updateMany({
      where: { templateId },
      data:  { tool: newTool },
    })
    if (result.count > 0) {
      console.log(`  ✓ ${templateId}: ${result.count} tarea(s) → "${newTool}"`)
      updated += result.count
    } else {
      skipped++
    }
  }

  console.log(`\nListo: ${updated} tareas actualizadas, ${skipped} plantillas sin tareas en DB.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
