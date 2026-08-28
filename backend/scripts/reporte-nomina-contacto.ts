// Reporte flash (one-off): listado de colaboradores activos de ambas razones
// sociales con datos de contacto y jefatura directa.
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGAL_ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: "Comunicaciones Surmedia",
  SURMEDIA_CONSULTORIA: "Surmedia Consultoría",
};

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    select: {
      firstName: true,
      lastName: true,
      rut: true,
      address: true,
      city: true,
      commune: true,
      phone: true,
      email: true,
      supervisorName: true,
      contracts: {
        where: { isActive: true },
        orderBy: { startDate: "desc" },
        select: { legalEntity: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = employees.map(e => {
    const direccionPartes = [e.address, e.commune, e.city].filter(Boolean);
    return {
      nombre: e.firstName ?? "",
      apellido: e.lastName ?? "",
      rut: e.rut ?? "",
      direccion: direccionPartes.join(", "),
      telefono: e.phone ?? "",
      correo: e.email ?? "",
      jefatura: e.supervisorName ?? "",
      razonSocial: LEGAL_ENTITY_LABEL[e.contracts[0]?.legalEntity ?? ""] ?? "",
    };
  });

  const HEADERS = ["Nombre", "Apellido", "RUT", "Dirección", "Teléfono", "Correo", "Jefatura", "Razón Social"];
  const aoa: string[][] = [
    HEADERS,
    ...rows.map(r => [r.nombre, r.apellido, r.rut, r.direccion, r.telefono, r.correo, r.jefatura, r.razonSocial]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 24 },
  ];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: HEADERS.length - 1 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nómina");
  const outPath = process.argv[2] ?? "reporte-nomina-contacto.xlsx";
  XLSX.writeFile(wb, outPath);

  console.log(`${rows.length} colaboradores incluidos (ACTIVE + ON_LEAVE, ambas razones sociales). Archivo: ${outPath}`);
}

main().finally(() => prisma.$disconnect());
