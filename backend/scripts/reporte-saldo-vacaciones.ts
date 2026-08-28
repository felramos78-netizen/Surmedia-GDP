// Reporte flash (one-off): saldo de vacaciones por colaborador × razón social,
// descontando los días de vacaciones ya APROBADAS (Libro "Vacación" de BUK)
// cuyo período todavía no ocurre a la fecha de generación del reporte.
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGAL_ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: "Comunicaciones Surmedia",
  SURMEDIA_CONSULTORIA: "Surmedia Consultoría",
};

async function main() {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  const employees = await prisma.employee.findMany({
    where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: {
      id: true, firstName: true, lastName: true, rut: true,
      vacationBalances: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: {
          legalEntity: true, year: true, month: true,
          saldoLegal: true, saldoProgresivas: true, saldoAdministrativos: true,
        },
      },
      leaves: {
        where: { type: "VACACIONES" as any, status: "APPROVED" as any, startDate: { gt: today } },
        select: { startDate: true, days: true, reason: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const HEADERS = [
    "Nombre", "Apellido", "RUT", "Razón Social", "Período saldo BUK",
    "Saldo Legal (BUK)", "Saldo Progresivas (BUK)", "Saldo Administrativos (BUK)",
    "Días aprobados pendientes — Legal", "Días aprobados pendientes — Adm.",
    "Saldo Legal ajustado", "Saldo Administrativos ajustado", "Saldo Total ajustado",
  ]
  const rows: (string | number)[][] = []

  for (const e of employees) {
    // Última entrada de saldo por razón social (puede tener 1 o 2, si tiene contrato en ambas)
    const latestByEntity = new Map<string, typeof e.vacationBalances[0]>()
    for (const b of e.vacationBalances) {
      if (!latestByEntity.has(b.legalEntity)) latestByEntity.set(b.legalEntity, b)
    }
    if (latestByEntity.size === 0) continue

    let pendLegal = 0, pendAdmin = 0
    for (const l of e.leaves) {
      const esAdmin = (l.reason ?? "").toLowerCase().includes("administrativ")
      if (esAdmin) pendAdmin += l.days; else pendLegal += l.days
    }

    for (const [legalEntity, b] of latestByEntity) {
      const saldoLegalAdj = b.saldoLegal - pendLegal
      const saldoAdminAdj = b.saldoAdministrativos - pendAdmin
      rows.push([
        e.firstName ?? "", e.lastName ?? "", e.rut ?? "",
        LEGAL_ENTITY_LABEL[legalEntity] ?? legalEntity,
        `${String(b.month).padStart(2, "0")}/${b.year}`,
        b.saldoLegal, b.saldoProgresivas, b.saldoAdministrativos,
        pendLegal, pendAdmin,
        saldoLegalAdj, saldoAdminAdj,
        saldoLegalAdj + b.saldoProgresivas + saldoAdminAdj,
      ])
    }
  }

  const aoa: (string | number)[][] = [HEADERS, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 14 },
  ]
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: HEADERS.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Saldo Vacaciones")
  const outPath = process.argv[2] ?? "reporte-saldo-vacaciones.xlsx"
  XLSX.writeFile(wb, outPath)

  console.log(`${rows.length} filas (colaborador × razón social). Fecha de corte: ${todayIso}. Archivo: ${outPath}`)
}

main().finally(() => prisma.$disconnect())
