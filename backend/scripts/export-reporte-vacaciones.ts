// Genera el .xlsx de Saldo de Vacaciones para compartirlo directamente (mismas
// columnas y estilo que el export de /reportes en el frontend, ver
// frontend/src/pages/reportes/vacacionesExcel.ts).
import ExcelJS from "exceljs";
import { PrismaClient, LegalEntity } from "@prisma/client";

const prisma = new PrismaClient();

const ENTITY_LABEL_LARGO: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: "Comunicaciones Surmedia",
  SURMEDIA_CONSULTORIA:    "Surmedia Consultoría",
};

const HEADERS = [
  "RUT", "Nombre", "Razón Social", "Cargo", "Período",
  "Días Vacaciones Disponibles", "Días Administrativos",
  "Vacaciones Aprobadas Pendientes", "Administrativos Aprobados Pendientes",
  "Vacaciones Disponibles (Ajustado)", "Días Administrativos (Ajustado)",
];
const COL_WIDTHS = [14, 28, 24, 28, 10, 14, 14, 16, 18, 16, 16];
const COLS_NUM = [6, 7, 8, 9, 10, 11];

async function main() {
  const today = new Date();

  const employees = await prisma.employee.findMany({
    where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: {
      firstName: true, lastName: true, rut: true, jobTitle: true,
      vacationBalances: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { legalEntity: true, year: true, month: true, saldoLegal: true, saldoProgresivas: true, saldoAdministrativos: true },
      },
      leaves: {
        where: { type: "VACACIONES" as any, status: "APPROVED" as any, startDate: { gt: today } },
        select: { days: true, reason: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = employees.flatMap(e => {
    const latestByEntity = new Map<string, typeof e.vacationBalances[0]>();
    for (const b of e.vacationBalances) if (!latestByEntity.has(b.legalEntity)) latestByEntity.set(b.legalEntity, b);
    if (latestByEntity.size === 0) return [];

    let pendienteVacaciones = 0, pendienteAdmin = 0;
    for (const l of e.leaves) {
      if ((l.reason ?? "").toLowerCase().includes("administrativ")) pendienteAdmin += l.days;
      else pendienteVacaciones += l.days;
    }

    return [...latestByEntity.entries()].map(([legalEntity, b]) => {
      const diasVacacionesDisponibles = b.saldoLegal + b.saldoProgresivas;
      const diasAdministrativos = b.saldoAdministrativos;
      return [
        e.rut ?? "", `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
        ENTITY_LABEL_LARGO[legalEntity as LegalEntity], e.jobTitle ?? "", `${b.month}/${b.year}`,
        diasVacacionesDisponibles, diasAdministrativos,
        pendienteVacaciones, pendienteAdmin,
        diasVacacionesDisponibles - pendienteVacaciones, diasAdministrativos - pendienteAdmin,
      ];
    });
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Saldos de Vacaciones");
  ws.properties.defaultRowHeight = 15;
  ws.columns = COL_WIDTHS.map(width => ({ width }));

  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" }, name: "Roboto" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  for (const r of rows) {
    const row = ws.addRow(r);
    row.eachCell({ includeEmpty: true }, cell => { cell.font = { size: 12, color: { argb: "FF000000" }, name: "Roboto" }; });
    for (const c of COLS_NUM) row.getCell(c).numFmt = "0.0";
  }
  ws.autoFilter = `A1:K${rows.length + 1}`;

  const outPath = process.argv[2] ?? "reporte-vacaciones.xlsx";
  await wb.xlsx.writeFile(outPath);
  console.log(`${rows.length} filas. Archivo: ${outPath}`);
}

main().finally(() => prisma.$disconnect());
