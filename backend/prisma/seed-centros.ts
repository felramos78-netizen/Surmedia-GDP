import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Entity = 'COMUNICACIONES_SURMEDIA' | 'SURMEDIA_CONSULTORIA'
const COM: Entity = 'COMUNICACIONES_SURMEDIA'
const CON: Entity = 'SURMEDIA_CONSULTORIA'

interface Row { nombre: string; entity: Entity; centros: string[] }

// Fuente: planilla de asignación de centros
const DATA: Row[] = [
  { nombre: 'Abarca Mamani Ismael Maurice',             entity: COM, centros: ['AMSA (ZALDIVAR)'] },
  { nombre: 'Abello Navarro Cristian Eduardo',          entity: COM, centros: ['CANDELARIA'] },
  { nombre: 'Aguilar Damacase Jesús Enrique',           entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Alanís Pozo María José Del Pilar',         entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Alarcón Miño Sofia Esperanza',             entity: COM, centros: ['CODELCO DET', 'KINROSS COMUNICACIONES'] },
  { nombre: 'Alcayaga Chellew Alan Christian',          entity: COM, centros: ['AMSA (NCEN)'] },
  { nombre: 'Alcayaga Chellew Alan Christian',          entity: CON, centros: ['AMSA (NCEN)', 'PROVEEDORES Y FUTUROS LOCALES BHP', 'SALAR'] },
  { nombre: 'Álvarez Alarcón Felipe Martín',            entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Álvarez Espinoza Manuel Octavio',          entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Álvarez Ramírez Fernanda Patricia',        entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Andrónico Cangana Javier Enrique',         entity: COM, centros: ['GLENCORE'] },
  { nombre: 'Aramayo Fritis Víctor Marcos',             entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Aravena Arriagada Camilo Ernesto',         entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Aravena Arriagada Camilo Ernesto',         entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Araya Chanqueo Ignacio Isaac',             entity: CON, centros: ['PUERTO ANGAMOS', 'SALAR'] },
  { nombre: 'Arce Rojas Camilo Alfonso',                entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (NCEN)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Barraza Lamas Pía Noelia',                 entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Barreda Torres Felíx Wilson',              entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Bernales Magnere Tomas Augusto',           entity: COM, centros: ['CANDELARIA', 'CASERONES'] },
  { nombre: 'Beroiza Rodriguez Daniela Andrea',         entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Bracamonte Aballai Carlos Pascual',        entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Bugueño Solar Sergio Alberto',             entity: COM, centros: ['AMSA (ANTUCOYA)'] },
  { nombre: 'Campos Llanca Luis Humberto',              entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Cancino Toloza Daniel Andres',             entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Carrasco Rojas Erick Fernando',            entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Carvallo Sáez Micchelle Yamil',            entity: COM, centros: ['SQM'] },
  { nombre: 'Castillo Méndez Diego Antonio',            entity: COM, centros: ['FME'] },
  { nombre: 'Castro Rojas Katherina Fernanda',          entity: COM, centros: ['CANDELARIA'] },
  { nombre: 'Cataldo Leiva Paola Andrea',               entity: COM, centros: ['COSTOS DE SUBDIRECCIÓN'] },
  { nombre: 'Cataldo Leiva Paola Andrea',               entity: CON, centros: ['COSTOS DE SUBDIRECCIÓN'] },
  { nombre: 'Caucoto Meneses Carolina Angélica',        entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Cepeda Vivanco Pilar Victoria',            entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Cid Sandoval Nicolas Andre',               entity: COM, centros: ['AMSA (NCEN)'] },
  { nombre: 'Cruz Mora Mariela Concepcion',             entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Cuevas Cortés Fernanda Javiera',           entity: COM, centros: ['CMP'] },
  { nombre: 'Delgado Inostroza Paulina Alejandra',      entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Díaz Aguilar Gabriela Alexandra',          entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Díaz Herrera Nicolás Felipe',              entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Díaz Lara Camila',                         entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Echeverria Noton Loreto Cecilia',          entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Fernández Ortiz Hernán Felipe',            entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Freire Meza Graciela Constanza',           entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (NCEN)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Freire Meza Graciela Constanza',           entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Fuentes Rubio Lenka Camila',               entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Garrido Yáñez Héctor Manuel',              entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Garro Castaño Valentina',                  entity: COM, centros: ['AMSA (NCEN)'] },
  { nombre: 'Gómez Crawford Isidora Paz',               entity: COM, centros: ['CODELCO EO', 'CODELCO CORP'] },
  { nombre: 'Gomez Moyano Camila Javiera',              entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Gómez Sánchez Fernanda Javiera',           entity: COM, centros: ['FME'] },
  { nombre: 'González Gamboa Iris Lorena',              entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Guzmán Cortés Abdiel Alexis',              entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Harrison Necochea Benjamin',               entity: COM, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Harrison Necochea Victor Andres',          entity: CON, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Harrison Necochea Víctor Andrés',          entity: COM, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Heredia Duran Viviana Elizabeth',          entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Hernandez Suarez Valentina Paz',           entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Herrera Mauad Roberto Antonio',            entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Huidobro Maturana Fabiani Alejandro',      entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Huidobro Maturana Fabiani Alejandro',      entity: COM, centros: ['FME'] },
  { nombre: 'Illanes Caba Deborah Nicole',              entity: COM, centros: ['FME'] },
  { nombre: 'Iriarte Magadán Paula Amaya',              entity: COM, centros: ['CMP'] },
  { nombre: 'Jullian Roig Juan Francisco',              entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Kampf Roa Max Andreas',                    entity: COM, centros: ['CODELCO EO', 'CODELCO CORP'] },
  { nombre: 'Kovacic Madariaga Tonkiza Dayann',         entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Lanoy Molina Maglenis Carolina',           entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Ledezma Hidalgo Alejandro Esteban',        entity: COM, centros: ['AMSA (NCEN)'] },
  { nombre: 'Lingua Moreno Aldo Javier',                entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'López Matamala Marcelo Andrés',            entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Maluenda Acevedo Camila Alejandra',        entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Mancilla Órdenes Oscar Alonso',            entity: COM, centros: ['CMP'] },
  { nombre: 'Martínez Amenábar Eustaquio',              entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Maya González Javiera Nicole',             entity: COM, centros: ['CEIM'] },
  { nombre: 'Maya González Javiera Nicole',             entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Mella Cádiz Cristopher Andrés',            entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Mellado Salazar Luis',                     entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Meza Iriarte Edmundo Esteban Jesús',       entity: COM, centros: ['AMSA (ANTUCOYA)'] },
  { nombre: 'Middleton Bezanilla Javier Fernando',      entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Miranda Humeres Patricio Javier',          entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Molina Tapia Alexis Rodrigo',              entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Montoya López Diego Ignacio',              entity: COM, centros: ['CMP'] },
  { nombre: 'Moraga Morey Maria Jose',                  entity: COM, centros: ['CMP'] },
  { nombre: 'Moraga Morey Maria Jose',                  entity: CON, centros: ['CMP'] },
  { nombre: 'Morales Leiva David Eduardo',              entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Moreno Saavedra Juan Patricio',            entity: COM, centros: ['CASERONES', 'KINROSS LOBO MARTE'] },
  { nombre: 'Muñoz Baratta Maria Alejandra',            entity: COM, centros: ['CMP'] },
  { nombre: 'Muñoz Espinoza Ricardo Hernán',            entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Muñoz Vera Manuel Jesús',                  entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Mura Gonzalez Minelly Dannay',             entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Navarro López Javier Andrés',              entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Neder Acosta Ulises Patricio',             entity: COM, centros: ['AMSA (CENTINELA)'] },
  { nombre: 'Olivares Vega Alejandra Hortensia',        entity: COM, centros: ['AMSA (CENTINELA)'] },
  { nombre: 'Ortiz Aguilera Sebastian Ignacio',         entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Ovando Vergara Macarena Francisca',        entity: COM, centros: ['GLENCORE'] },
  { nombre: 'Palma Zepeda Nancy Anarella',              entity: COM, centros: ['AMSA (CENTINELA)'] },
  { nombre: 'Parra Espinosa Karen Andrea',              entity: CON, centros: ['SALAR'] },
  { nombre: 'Pereira Molina Lorena Antonieta',          entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Pérez Caro Gabriela Ximena',               entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Pérez Caro Gabriela Ximena',               entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Pizarro Bravo Mónica Isabel',              entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Pollmann Fleming Sibila Joaquina',         entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Ponce Vidal Claudia Ayleen',               entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Quintanilla Dominguez Sebastian Ignacio',  entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Quintanilla Dominguez Sebastian Ignacio',  entity: COM, centros: ['GLENCORE', 'CASERONES'] },
  { nombre: 'Ramírez Vega Jasmín Betsabé',              entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Ramos Galleguillos Javier Ignacio',        entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Ramos Valenzuela Felipe Antonio',          entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Reyes Guzman Mitzi Andrea',                entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Reyes Guzman Mitzi Andrea',                entity: COM, centros: ['PUERTO ANGAMOS', 'SQM'] },
  { nombre: 'Rivera Cerda Hernando Sebastián',          entity: COM, centros: ['AMSA (ANTUCOYA)'] },
  { nombre: 'Rivera Zarricueta Constanza Nicole',       entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Roa Abayay Marta Soledad',                 entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Rodas Araya Carlos Alejandro',             entity: COM, centros: ['CANDELARIA'] },
  { nombre: 'Rodriguez Correa Daniela',                 entity: COM, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Rodríguez González Alberto Antonio',       entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Rodríguez Varela María Paz',               entity: COM, centros: ['CMP'] },
  { nombre: 'Romero Moraga Fernanda María',             entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Ronda Ortiz Antonia Ester',                entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Salazar Guerrero Tamara José',             entity: COM, centros: ['CANDELARIA'] },
  { nombre: 'Salinas Valdivia Omar Andres',             entity: COM, centros: ['CMP'] },
  { nombre: 'Salles Sapag Maria Bernardita',            entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Sánchez Cortés-Monroy Javiera Pilar',      entity: COM, centros: ['CMP'] },
  { nombre: 'Sanchez Marin Maria Jose',                 entity: COM, centros: ['GLENCORE'] },
  { nombre: 'Silva Gatta Sebastian Andres',             entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Solar De La Maza Sofía Macarena',          entity: COM, centros: ['CODELCO EO', 'CODELCO CORP'] },
  { nombre: 'Solari Diaz Gino Guillermo',               entity: COM, centros: ['CEIM', 'FME'] },
  { nombre: 'Solari Diaz Gino Guillermo',               entity: CON, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Sotomayor Villarroel Mauricio Andres',     entity: COM, centros: ['CANDELARIA', 'CASERONES', 'INFORME SINDICAL BHP'] },
  { nombre: 'Toledo Andrade Carla Andrea',              entity: COM, centros: ['CODELCO DET', 'KINROSS COMUNICACIONES'] },
  { nombre: 'Torres Gómez Andrés Antonio',              entity: COM, centros: ['AMSA (ZALDIVAR)'] },
  { nombre: 'Trincado Huanchicay Rocío Abril',          entity: COM, centros: ['KINROSS COMUNICACIONES'] },
  { nombre: 'Valdés Tapia Josefa Antonieta',            entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Valenzuela Dellafiori Paula',              entity: COM, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Valenzuela Dellafiori Paula',              entity: CON, centros: ['COSTOS DE DIRECCIÓN'] },
  { nombre: 'Vallejos Opazo Matias',                    entity: COM, centros: ['COSTOS COORDINACIÓN OPERACIONAL'] },
  { nombre: 'Valverde Oñate Karla Stefanie',            entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Vargas Moya Exequiel Ananias',             entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Vega Chelme Claudio Andres',               entity: CON, centros: ['BHP ESCONDIDA', 'FME'] },
  { nombre: 'Vega Velozo Valeria Andrea',               entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Véliz Saavedra Joao Humberto',             entity: CON, centros: ['BHP ESCONDIDA'] },
  { nombre: 'Vergara Pinnola Vannia Silvana',           entity: COM, centros: ['CMP'] },
  { nombre: 'Vidal Díaz Mauricio Antonio',              entity: COM, centros: ['AMSA (ANTUCOYA)', 'AMSA (CENTINELA)', 'AMSA (ZALDIVAR)'] },
  { nombre: 'Vilches Vergara Andrea Makarena',          entity: COM, centros: ['COSTOS ADMINISTRATIVOS'] },
  { nombre: 'Villarroel Pérez Carmen Gloria',           entity: COM, centros: ['AMSA (NCEN)'] },
  { nombre: 'Worthington Ramírez Aída Constanza',       entity: COM, centros: ['CODELCO CORP'] },
  { nombre: 'Zamora Marchant Sebastian',                entity: COM, centros: ['CODELCO DET'] },
  { nombre: 'Zazzali Toledo Lorenzo Sebastian',         entity: COM, centros: ['COSTOS DE SUBDIRECCIÓN'] },
]

// Normaliza para comparación: minúsculas, sin acentos, espacios simples
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  // 1. Upsert todos los centros de trabajo únicos
  const allCentros = [...new Set(DATA.flatMap(r => r.centros))]
  const centroMap = new Map<string, string>()

  for (const name of allCentros) {
    const wc = await prisma.workCenter.upsert({
      where: { name },
      create: { name },
      update: {},
    })
    centroMap.set(name, wc.id)
  }
  console.log(`✓ ${allCentros.length} centros de trabajo listos`)

  // 2. Cargar todos los empleados y construir mapa nombre normalizado → id
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })

  const empMap = new Map<string, string>()
  for (const emp of employees) {
    const full = norm(`${emp.lastName} ${emp.firstName}`)
    empMap.set(full, emp.id)
  }
  console.log(`  ${employees.length} colaboradores cargados desde la DB`)

  // 3. Crear asignaciones
  let created = 0, skipped = 0, notFound: string[] = []

  for (const row of DATA) {
    const key = norm(row.nombre)
    const empId = empMap.get(key)

    if (!empId) {
      if (!notFound.includes(row.nombre)) notFound.push(row.nombre)
      continue
    }

    for (const centroName of row.centros) {
      const workCenterId = centroMap.get(centroName)
      if (!workCenterId) continue
      try {
        await prisma.employeeWorkCenter.create({
          data: { employeeId: empId, workCenterId, legalEntity: row.entity },
        })
        created++
      } catch (e: any) {
        if (e.code === 'P2002') skipped++
        else console.warn(`  ✗ ${row.nombre} → ${centroName}: ${e.message}`)
      }
    }
  }

  console.log(`\n✓ ${created} asignaciones creadas, ${skipped} ya existían`)
  if (notFound.length > 0) {
    console.log(`\n⚠ ${notFound.length} colaboradores no encontrados en GDP:`)
    notFound.forEach(n => console.log(`  - ${n}`))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
