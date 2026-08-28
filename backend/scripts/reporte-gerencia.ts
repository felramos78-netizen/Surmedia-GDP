// Reporte flash (one-off): nómina de Gerentes, Subdirectores y Directores.
// Filtra por Employee.jobTitle conteniendo "gerente" o "director" (cubre
// "Sub directora..." porque "director" es substring de "directora").
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const YEAR = 2026;
const MONTH = 7;

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      OR: [
        { jobTitle: { contains: "gerente", mode: "insensitive" } },
        { jobTitle: { contains: "director", mode: "insensitive" } },
      ],
    },
    select: {
      firstName: true,
      lastName: true,
      jobTitle: true,
      payrollEntries: {
        where: { year: YEAR, month: MONTH },
        select: { grossSalary: true, liquidSalary: true },
      },
    },
  });

  const rows = employees
    .filter(e => e.payrollEntries.length > 0)
    .map(e => ({
      nombre: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
      cargo: e.jobTitle ?? "",
      liquida: e.payrollEntries[0].liquidSalary,
      bruta: e.payrollEntries[0].grossSalary,
    }))
    .sort((a, b) => b.bruta - a.bruta);

  const sinSueldo = employees.filter(e => e.payrollEntries.length === 0);
  if (sinSueldo.length) {
    console.log(`Sin liquidación en ${MONTH}/${YEAR} (excluidos):`);
    sinSueldo.forEach(e => console.log(`  - ${e.jobTitle} — ${e.firstName} ${e.lastName}`));
  }

  const HEADERS = ["Nombre", "Cargo", "Renta Líquida", "Renta Bruta"];
  const aoa: (string | number)[][] = [
    HEADERS,
    ...rows.map(r => [r.nombre, r.cargo, r.liquida, r.bruta]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 16 }, { wch: 16 }];
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let R = 1; R <= range.e.r; R++) {
    for (const col of [2, 3]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: col })];
      if (cell) cell.z = "$#,##0";
    }
  }
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 3 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gerencia");
  const outPath = process.argv[2] ?? "reporte-gerencia.xlsx";
  XLSX.writeFile(wb, outPath);

  console.log(`\n${rows.length} personas incluidas (período ${MONTH}/${YEAR}). Archivo: ${outPath}`);
}

main().finally(() => prisma.$disconnect());
