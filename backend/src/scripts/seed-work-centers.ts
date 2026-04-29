import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CENTERS: { name: string; costType: 'DIRECTO' | 'INDIRECTO' }[] = [
  { name: 'AMSA (ANTUCOYA)',                   costType: 'DIRECTO'   },
  { name: 'AMSA (CENTINELA)',                  costType: 'DIRECTO'   },
  { name: 'AMSA (NCEN)',                       costType: 'DIRECTO'   },
  { name: 'AMSA (ZALDIVAR)',                   costType: 'DIRECTO'   },
  { name: 'BHP ESCONDIDA',                     costType: 'DIRECTO'   },
  { name: 'CANDELARIA',                        costType: 'DIRECTO'   },
  { name: 'CASERONES',                         costType: 'DIRECTO'   },
  { name: 'CEIM',                              costType: 'DIRECTO'   },
  { name: 'CMP',                               costType: 'DIRECTO'   },
  { name: 'CODELCO CORP',                      costType: 'DIRECTO'   },
  { name: 'CODELCO DET',                       costType: 'DIRECTO'   },
  { name: 'CODELCO EO',                        costType: 'DIRECTO'   },
  { name: 'FME',                               costType: 'DIRECTO'   },
  { name: 'GLENCORE',                          costType: 'DIRECTO'   },
  { name: 'INFORME SINDICAL BHP',              costType: 'DIRECTO'   },
  { name: 'KINROSS COMUNICACIONES',            costType: 'DIRECTO'   },
  { name: 'KINROSS LOBO MARTE',               costType: 'DIRECTO'   },
  { name: 'PROVEEDORES Y FUTUROS LOCALES BHP', costType: 'DIRECTO'   },
  { name: 'PUERTO ANGAMOS',                    costType: 'DIRECTO'   },
  { name: 'SALAR',                             costType: 'DIRECTO'   },
  { name: 'SQM',                               costType: 'DIRECTO'   },
  { name: 'COSTOS ADMINISTRATIVOS',            costType: 'INDIRECTO' },
  { name: 'COSTOS COORDINACION OPERACIONAL',   costType: 'INDIRECTO' },
  { name: 'COSTOS DE DIRECCION',               costType: 'INDIRECTO' },
  { name: 'COSTOS DE SUBDIRECCION',            costType: 'INDIRECTO' },
]

type Row = { name: string; entity: 'COM' | 'CON'; centers: string[] }

const ASSIGNMENTS: Row[] = [
  { name: 'Abarca Mamani Ismael Maurice',          entity: 'COM', centers: ['AMSA (ZALDIVAR)'] },
  { name: 'Abello Navarro Cristian Eduardo',        entity: 'COM', centers: ['CANDELARIA'] },
  { name: 'Aguilar Damacase Jesus Enrique',        entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Alanis Pozo Maria Jose Del Pilar',      entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Alarcon Mino Sofia Esperanza',          entity: 'COM', centers: ['CODELCO DET', 'KINROSS COMUNICACIONES'] },
  { name: 'Alcayaga Chellew Alan Christian',        entity: 'COM', centers: ['AMSA (NCEN)'] },
  { name: 'Alcayaga Chellew Alan Christian',        entity: 'CON', centers: ['AMSA (NCEN)', 'PROVEEDORES Y FUTUROS LOCALES BHP', 'SALAR'] },
  { name: 'Alvarez Alarcon Felipe Martin',         entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Alvarez Espinoza Manuel Octavio',       entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Alvarez Ramirez Fernanda Patricia',     entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Andronico Cangana Javier Enrique',      entity: 'COM', centers: ['GLENCORE'] },
  { name: 'Aramayo Fritis Victor Marcos',          entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Aravena Arriagada Camilo Ernesto',      entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Aravena Arriagada Camilo Ernesto',      entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Araya Chanqueo Ignacio Isaac',          entity: 'CON', centers: ['PUERTO ANGAMOS', 'SALAR'] },
  { name: 'Arce Rojas Camilo Alfonso',             entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (NCEN)', 'AMSA (ZALDIVAR)'] },
  { name: 'Barraza Lamas Pia Noelia',              entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Barreda Torres Felix Wilson',           entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Bernales Magnere Tomas Augusto',        entity: 'COM', centers: ['CANDELARIA', 'CASERONES'] },
  { name: 'Beroiza Rodriguez Daniela Andrea',      entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Bracamonte Aballai Carlos Pascual',     entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Bugueno Solar Sergio Alberto',          entity: 'COM', centers: ['AMSA (ANTUCOYA)'] },
  { name: 'Campos Llanca Luis Humberto',           entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Cancino Toloza Daniel Andres',          entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Carrasco Rojas Erick Fernando',         entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Carvallo Saez Micchelle Yamil',         entity: 'COM', centers: ['SQM'] },
  { name: 'Castillo Mendez Diego Antonio',         entity: 'COM', centers: ['FME'] },
  { name: 'Castro Rojas Katherina Fernanda',       entity: 'COM', centers: ['CANDELARIA'] },
  { name: 'Cataldo Leiva Paola Andrea',            entity: 'COM', centers: ['COSTOS DE SUBDIRECCION'] },
  { name: 'Cataldo Leiva Paola Andrea',            entity: 'CON', centers: ['COSTOS DE SUBDIRECCION'] },
  { name: 'Caucoto Meneses Carolina Angelica',     entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Cepeda Vivanco Pilar Victoria',         entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Cid Sandoval Nicolas Andre',            entity: 'COM', centers: ['AMSA (NCEN)'] },
  { name: 'Cruz Mora Mariela Concepcion',          entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Cuevas Cortes Fernanda Javiera',        entity: 'COM', centers: ['CMP'] },
  { name: 'Delgado Inostroza Paulina Alejandra',   entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Diaz Aguilar Gabriela Alexandra',       entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Diaz Herrera Nicolas Felipe',           entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Diaz Lara Camila',                      entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Echeverria Noton Loreto Cecilia',       entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Fernandez Ortiz Hernan Felipe',         entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Freire Meza Graciela Constanza',        entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (NCEN)', 'AMSA (ZALDIVAR)'] },
  { name: 'Freire Meza Graciela Constanza',        entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Fuentes Rubio Lenka Camila',            entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Garrido Yanez Hector Manuel',           entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Garro Castano Valentina',               entity: 'COM', centers: ['AMSA (NCEN)'] },
  { name: 'Gomez Crawford Isidora Paz',            entity: 'COM', centers: ['CODELCO EO', 'CODELCO CORP'] },
  { name: 'Gomez Moyano Camila Javiera',           entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Gomez Sanchez Fernanda Javiera',        entity: 'COM', centers: ['FME'] },
  { name: 'Gonzalez Gamboa Iris Lorena',           entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { name: 'Guzman Cortes Abdiel Alexis',           entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Harrison Necochea Benjamin',             entity: 'COM', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Harrison Necochea Victor Andres',        entity: 'CON', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Harrison Necochea Victor Andres',        entity: 'COM', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Heredia Duran Viviana Elizabeth',        entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Hernandez Suarez Valentina Paz',         entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Herrera Mauad Roberto Antonio',          entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Huidobro Maturana Fabiani Alejandro',   entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Huidobro Maturana Fabiani Alejandro',   entity: 'COM', centers: ['FME'] },
  { name: 'Illanes Caba Deborah Nicole',            entity: 'COM', centers: ['FME'] },
  { name: 'Iriarte Magadan Paula Amaya',            entity: 'COM', centers: ['CMP'] },
  { name: 'Jullian Roig Juan Francisco',            entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Kampf Roa Max Andreas',                  entity: 'COM', centers: ['CODELCO EO', 'CODELCO CORP'] },
  { name: 'Kovacic Madariaga Tonkiza Dayann',       entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Lanoy Molina Maglenis Carolina',         entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Ledezma Hidalgo Alejandro Esteban',      entity: 'COM', centers: ['AMSA (NCEN)'] },
  { name: 'Lingua Moreno Aldo Javier',              entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Lopez Matamala Marcelo Andres',          entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Maluenda Acevedo Camila Alejandra',      entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Mancilla Ordenes Oscar Alonso',          entity: 'COM', centers: ['CMP'] },
  { name: 'Martinez Amenabar Eustaquio',            entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Maya Gonzalez Javiera Nicole',           entity: 'COM', centers: ['CEIM'] },
  { name: 'Maya Gonzalez Javiera Nicole',           entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Mella Cadiz Cristopher Andres',          entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Mellado Salazar Luis',                   entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Meza Iriarte Edmundo Esteban Jesus',     entity: 'COM', centers: ['AMSA (ANTUCOYA)'] },
  { name: 'Middleton Bezanilla Javier Fernando',    entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Miranda Humeres Patricio Javier',        entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Molina Tapia Alexis Rodrigo',            entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Montoya Lopez Diego Ignacio',            entity: 'COM', centers: ['CMP'] },
  { name: 'Moraga Morey Maria Jose',                entity: 'COM', centers: ['CMP'] },
  { name: 'Moraga Morey Maria Jose',                entity: 'CON', centers: ['CMP'] },
  { name: 'Morales Leiva David Eduardo',            entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Moreno Saavedra Juan Patricio',          entity: 'COM', centers: ['CASERONES', 'KINROSS LOBO MARTE'] },
  { name: 'Munoz Baratta Maria Alejandra',          entity: 'COM', centers: ['CMP'] },
  { name: 'Munoz Espinoza Ricardo Hernan',          entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Munoz Vera Manuel Jesus',                entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Mura Gonzalez Minelly Dannay',           entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Navarro Lopez Javier Andres',            entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Neder Acosta Ulises Patricio',           entity: 'COM', centers: ['AMSA (CENTINELA)'] },
  { name: 'Olivares Vega Alejandra Hortensia',      entity: 'COM', centers: ['AMSA (CENTINELA)'] },
  { name: 'Ortiz Aguilera Sebastian Ignacio',       entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Ovando Vergara Macarena Francisca',      entity: 'COM', centers: ['GLENCORE'] },
  { name: 'Palma Zepeda Nancy Anarella',            entity: 'COM', centers: ['AMSA (CENTINELA)'] },
  { name: 'Parra Espinosa Karen Andrea',            entity: 'CON', centers: ['SALAR'] },
  { name: 'Pereira Molina Lorena Antonieta',        entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { name: 'Perez Caro Gabriela Ximena',             entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Perez Caro Gabriela Ximena',             entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Pizarro Bravo Monica Isabel',            entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Pollmann Fleming Sibila Joaquina',       entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Ponce Vidal Claudia Ayleen',             entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Quintanilla Dominguez Sebastian Ignacio', entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Quintanilla Dominguez Sebastian Ignacio', entity: 'COM', centers: ['GLENCORE', 'CASERONES'] },
  { name: 'Ramirez Vega Jasmin Betsabe',            entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Ramos Galleguillos Javier Ignacio',      entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Ramos Valenzuela Felipe Antonio',        entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Reyes Guzman Mitzi Andrea',              entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Reyes Guzman Mitzi Andrea',              entity: 'COM', centers: ['PUERTO ANGAMOS', 'SQM'] },
  { name: 'Rivera Cerda Hernando Sebastian',        entity: 'COM', centers: ['AMSA (ANTUCOYA)'] },
  { name: 'Rivera Zarricueta Constanza Nicole',     entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Roa Abayay Marta Soledad',               entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Rodas Araya Carlos Alejandro',           entity: 'COM', centers: ['CANDELARIA'] },
  { name: 'Rodriguez Correa Daniela',               entity: 'COM', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Rodriguez Gonzalez Alberto Antonio',     entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Rodriguez Varela Maria Paz',             entity: 'COM', centers: ['CMP'] },
  { name: 'Romero Moraga Fernanda Maria',           entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Ronda Ortiz Antonia Ester',              entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Salazar Guerrero Tamara Jose',           entity: 'COM', centers: ['CANDELARIA'] },
  { name: 'Salinas Valdivia Omar Andres',           entity: 'COM', centers: ['CMP'] },
  { name: 'Salles Sapag Maria Bernardita',          entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Sanchez Cortes-Monroy Javiera Pilar',   entity: 'COM', centers: ['CMP'] },
  { name: 'Sanchez Marin Maria Jose',               entity: 'COM', centers: ['GLENCORE'] },
  { name: 'Silva Gatta Sebastian Andres',           entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Solar De La Maza Sofia Macarena',        entity: 'COM', centers: ['CODELCO EO', 'CODELCO CORP'] },
  { name: 'Solari Diaz Gino Guillermo',             entity: 'COM', centers: ['CEIM', 'FME'] },
  { name: 'Solari Diaz Gino Guillermo',             entity: 'CON', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Sotomayor Villarroel Mauricio Andres',   entity: 'COM', centers: ['CANDELARIA', 'CASERONES', 'INFORME SINDICAL BHP'] },
  { name: 'Toledo Andrade Carla Andrea',            entity: 'COM', centers: ['CODELCO DET', 'KINROSS COMUNICACIONES'] },
  { name: 'Torres Gomez Andres Antonio',            entity: 'COM', centers: ['AMSA (ZALDIVAR)'] },
  { name: 'Trincado Huanchicay Rocio Abril',        entity: 'COM', centers: ['KINROSS COMUNICACIONES'] },
  { name: 'Valdes Tapia Josefa Antonieta',          entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { name: 'Valenzuela Dellafiori Paula',            entity: 'COM', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Valenzuela Dellafiori Paula',            entity: 'CON', centers: ['COSTOS DE DIRECCION'] },
  { name: 'Vallejos Opazo Matias',                  entity: 'COM', centers: ['COSTOS COORDINACION OPERACIONAL'] },
  { name: 'Valverde Onate Karla Stefanie',          entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Vargas Moya Exequiel Ananias',           entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Vega Chelme Claudio Andres',             entity: 'CON', centers: ['BHP ESCONDIDA', 'FME'] },
  { name: 'Vega Velozo Valeria Andrea',             entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { name: 'Veliz Saavedra Joao Humberto',           entity: 'CON', centers: ['BHP ESCONDIDA'] },
  { name: 'Vergara Pinnola Vannia Silvana',         entity: 'COM', centers: ['CMP'] },
  { name: 'Vidal Diaz Mauricio Antonio',            entity: 'COM', centers: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { name: 'Vilches Vergara Andrea Makarena',        entity: 'COM', centers: ['COSTOS ADMINISTRATIVOS'] },
  { name: 'Villarroel Perez Carmen Gloria',         entity: 'COM', centers: ['AMSA (NCEN)'] },
  { name: 'Worthington Ramirez Aida Constanza',     entity: 'COM', centers: ['CODELCO CORP'] },
  { name: 'Zamora Marchant Sebastian',              entity: 'COM', centers: ['CODELCO DET'] },
  { name: 'Zazzali Toledo Lorenzo Sebastian',       entity: 'COM', centers: ['COSTOS DE SUBDIRECCION'] },
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim()
}

async function main() {
  // Upsert centros
  for (const c of CENTERS) {
    await prisma.workCenter.upsert({
      where: { name: c.name },
      update: { costType: c.costType },
      create: { name: c.name, costType: c.costType },
    })
  }
  console.log(`✓ ${CENTERS.length} centros listos`)

  // Mapa de empleados por nombre normalizado
  const allEmployees = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true },
  })
  const byName = new Map<string, string>()
  for (const e of allEmployees) {
    byName.set(normalize(`${e.lastName} ${e.firstName}`), e.id)
  }

  // Mapa de centros por nombre
  const allCenters = await prisma.workCenter.findMany()
  const byCenter = new Map<string, string>()
  for (const wc of allCenters) {
    byCenter.set(wc.name, wc.id)
  }

  let assigned = 0
  let notFound = 0

  for (const row of ASSIGNMENTS) {
    const empId = byName.get(normalize(row.name))
    if (!empId) {
      console.warn(`  ⚠ No encontrado: ${row.name}`)
      notFound++
      continue
    }
    const legalEntity = row.entity === 'COM'
      ? 'COMUNICACIONES_SURMEDIA'
      : 'SURMEDIA_CONSULTORIA'

    for (const centerName of row.centers) {
      const wcId = byCenter.get(centerName)
      if (!wcId) { console.warn(`  ⚠ Centro inexistente: ${centerName}`); continue }
      try {
        await prisma.employeeWorkCenter.upsert({
          where: {
            employeeId_workCenterId_legalEntity: { employeeId: empId, workCenterId: wcId, legalEntity: legalEntity as any },
          },
          update: {},
          create: { employeeId: empId, workCenterId: wcId, legalEntity: legalEntity as any },
        })
        assigned++
      } catch (e: any) {
        console.error(`  ✗ Error ${row.name} → ${centerName}: ${e.message}`)
      }
    }
  }

  console.log(`✓ ${assigned} asignaciones cargadas`)
  if (notFound > 0) console.log(`⚠ ${notFound} nombres no encontrados`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
