import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // ─── Sheet Templates ───────────────────────────────────────────────────────

  await prisma.onboardingSheetTemplate.upsert({
    where: { key: 'ficha-personal' },
    update: {},
    create: {
      key:          'ficha-personal',
      name:         'Ficha Personal del Ingresante',
      url:          'https://docs.google.com/spreadsheets/d/1Y08GbGyu5B0incj7MaX9-Rd047tAxvkq5phAm6euvvI/edit?usp=sharing',
      rutColumn:    'RUT',
      sheetName:    'Respuestas de formulario 1',
      description:  'Formulario con datos personales: dirección, previsión, banco, documentos.',
      columnMappings: {
        'Nombres':                               'firstName',
        'Apellido paterno':                      '_apellidoPaterno',
        'Apellido materno':                      '_apellidoMaterno',
        'Sexo':                                  'gender',
        'Fecha de Nacimiento':                   'birthDate',
        'Nacionalidad':                          'nationality',
        'Email Personal':                        'personalEmail',
        'Celular':                               'phone',
        'Dirección calle':                       '_direccionCalle',
        'Dirección numero':                      '_direccionNumero',
        'Dirección departamento':                '_direccionDepto',
        'Dirección comuna':                      'commune',
        'Dirección ciudad':                      'city',
        'Información Previsional (AFP)':         'afp',
        'Sistema de salud (Isapre o Fonasa)':    'isapre',
      },
    },
  })

  await prisma.onboardingSheetTemplate.upsert({
    where: { key: 'datos-contractuales' },
    update: {},
    create: {
      key:          'datos-contractuales',
      name:         'Datos Contractuales',
      url:          'https://docs.google.com/spreadsheets/d/1sFjwX1aUNgrgszItuXGw7_mIcejQh7JgjiGWQZxLA_8/edit?usp=sharing',
      rutColumn:    'RUT del empleado',
      description:  'Formulario con cargo, jornada, jefe, sueldo y datos contractuales.',
      columnMappings: {
        'Correo del empleado Empresa': 'email',
        'Cargo':                       'jobTitle',
        'Jornada':                     'workSchedule',
        'Jefe':                        'supervisorName',
      },
    },
  })

  console.log('✓ Sheet templates sembrados correctamente')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
