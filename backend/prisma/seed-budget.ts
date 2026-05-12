import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PARTIDAS = [
  {
    name: 'Reclutamiento y Selección',
    sortOrder: 1,
    items: [
      { name: 'Linkedin/otras plataformas', annualAmount: 300_000, sortOrder: 1 },
      { name: 'Plataforma test', annualAmount: 150_000, sortOrder: 2 },
    ],
  },
  {
    name: 'Formación/capacitación',
    sortOrder: 2,
    items: [
      { name: 'Curso Dron', annualAmount: 1_500_000, sortOrder: 1 },
      { name: 'Co financiamiento estudios', annualAmount: 2_000_000, sortOrder: 2 },
      { name: 'Co pago Sence', annualAmount: 1_000_000, sortOrder: 3 },
      { name: 'Cursos internos (costo por relator + logística)', annualAmount: 2_400_000, sortOrder: 4 },
    ],
  },
  {
    name: 'Prácticas (8 al año x 3 meses)',
    sortOrder: 3,
    items: [
      { name: 'Prácticas (8 al año x 3 meses)', annualAmount: 2_880_000, sortOrder: 1 },
    ],
  },
  {
    name: 'Cultura/Integración',
    sortOrder: 4,
    items: [
      { name: 'Kit Bienvenida (20×40.000)', annualAmount: 800_000, sortOrder: 1 },
      { name: 'Talleres/jornadas de equipo (una por región)', annualAmount: 3_200_000, sortOrder: 2 },
      { name: 'Celebración 18/09', annualAmount: 8_000_000, sortOrder: 3 },
      { name: 'Jornada de Líderes en Stgo (no incluye pasajes de gerentes)', annualAmount: 2_500_000, sortOrder: 4 },
      { name: 'Celebraciones de cumpleaños', annualAmount: 1_440_000, sortOrder: 5 },
      { name: 'Desayuno día del trabajo', annualAmount: 750_000, sortOrder: 6 },
      { name: 'Almuerzos/café camaradería', annualAmount: 200_000, sortOrder: 7 },
      { name: 'Punto de Encuentro', annualAmount: 500_000, sortOrder: 8 },
      { name: 'Ropa Corporativa', annualAmount: 5_000_000, sortOrder: 9 },
    ],
  },
  {
    name: 'Prevención Riesgo',
    sortOrder: 5,
    items: [
      { name: 'EPP', annualAmount: 20_400_000, sortOrder: 1 },
      { name: 'Exámenes ocupacionales', annualAmount: 12_000_000, sortOrder: 2 },
      { name: 'Exámenes de droga aleatorios', annualAmount: 9_600_000, sortOrder: 3 },
    ],
  },
]

const BENEFICIOS = [
  {
    name: 'Beneficios',
    sortOrder: 1,
    items: [
      { name: 'Seguro complementario', annualAmount: 0, sortOrder: 1 },
      { name: 'Tarjeta Pluxee', annualAmount: 0, sortOrder: 2 },
    ],
  },
]

async function main() {
  console.log('Sembrando presupuesto DPDO...')

  await prisma.budgetItem.deleteMany()
  await prisma.budgetCategory.deleteMany()

  for (const cat of PARTIDAS) {
    await prisma.budgetCategory.create({
      data: {
        section: 'PARTIDAS',
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: { create: cat.items },
      },
    })
  }

  for (const cat of BENEFICIOS) {
    await prisma.budgetCategory.create({
      data: {
        section: 'BENEFICIOS',
        name: cat.name,
        sortOrder: cat.sortOrder,
        items: { create: cat.items },
      },
    })
  }

  console.log('Presupuesto DPDO sembrado correctamente.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
