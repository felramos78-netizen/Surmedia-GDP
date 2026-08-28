// One-off: aplica a la DB las filas del Libro "Vacación" (aprobadas) que aún
// no existen como Leave, usando la misma lógica de matching por nombre y la
// misma dedup key (`vac|rut|fecha`) que /api/buk/apply. Ver backend/src/routes/buk.ts.
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const REPORTES_DIR = path.resolve(__dirname, "../../reportes");
const FOLDERS = [
  { dir: "Comunicaciones", entity: "COMUNICACIONES_SURMEDIA" as const },
  { dir: "Consultoría", entity: "SURMEDIA_CONSULTORIA" as const },
];

function latestFile(folder: string, keyword: string): string | null {
  if (!fs.existsSync(folder)) return null;
  const f = fs.readdirSync(folder).filter(n => n.includes(keyword)).sort().reverse()[0];
  return f ? path.join(folder, f) : null;
}
function parseFlexDate(val: unknown): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  const n = Number(val);
  if (!n || isNaN(n)) return null;
  return new Date((n - 25569) * 86400 * 1000);
}
function parseComaNum(val: unknown): number {
  const n = parseFloat(String(val ?? "").trim().replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function upRut(r: string) { return r.replace(/-([a-z])$/, (_, dv: string) => `-${dv.toUpperCase()}`) }

interface Row {
  apellido: string; nombre: string; startDate: Date; endDate: Date; days: number
  tipo: string; aprobadoPor: string; fechaAprobacion: Date | null; periodo: string
}

function parseVacacionAprobada(): Row[] {
  const out: Row[] = [];
  for (const { dir } of FOLDERS) {
    const fp = latestFile(path.join(REPORTES_DIR, dir), "Vacación");
    if (!fp) continue;
    const wb = XLSX.readFile(fp);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
    const hdrIdx = raw.findIndex(r => r.some((c: any) => String(c).toLowerCase().includes("empleado")) &&
      r.some((c: any) => String(c).toLowerCase().includes("inicio")));
    if (hdrIdx === -1) continue;
    const headers = raw[hdrIdx].map((h: any) => String(h).trim());
    const cc = (t: string) => headers.findIndex(h => h.toLowerCase().includes(t.toLowerCase()));
    const EMP_COL = cc("empleado"), INI_COL = cc("inicio"), TER_COL = cc("término");
    const DIA_COL = cc("días solicitados"), TIP_COL = cc("tipo de vacación");
    const APR_COL = cc("aprobado por"), FAP_COL = cc("fecha de aprobación"), PER_COL = cc("período");
    for (let i = hdrIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      const empleado = String(r[EMP_COL] ?? "").trim();
      if (!empleado) continue;
      const [apellido, nombre] = empleado.split(",").map((s: string) => s?.trim() ?? "");
      if (!apellido || !nombre) continue;
      const sd = parseFlexDate(r[INI_COL]), ed = parseFlexDate(r[TER_COL]);
      if (!sd || !ed) continue;
      out.push({
        apellido, nombre, startDate: sd, endDate: ed,
        days: Math.round(parseComaNum(r[DIA_COL])) || (Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1),
        tipo: String(r[TIP_COL] ?? "").trim() || "Legales",
        aprobadoPor: String(r[APR_COL] ?? "").trim(),
        fechaAprobacion: FAP_COL !== -1 ? parseFlexDate(r[FAP_COL]) : null,
        periodo: String(r[PER_COL] ?? "").trim(),
      });
    }
  }
  return out;
}

async function main() {
  const today = new Date();
  const allRows = parseVacacionAprobada();
  // Alcance acordado: solo las vacaciones aprobadas que todavía no ocurren
  // (fecha de inicio en el futuro). El resto del historial (2019-presente)
  // queda pendiente de revisión manual vía /buk cuando se decida importarlo.
  const rows = allRows.filter(r => r.startDate.getTime() > today.getTime());
  console.log(`Filas totales en el libro: ${allRows.length} | futuras (a cargar): ${rows.length}`);

  const allEmps = await prisma.employee.findMany({ select: { id: true, rut: true, firstName: true, lastName: true } });
  const nameKey = (a: string, n: string) => `${a.trim().toLowerCase()}|${n.trim().toLowerCase()}`;
  const empByNameKey = new Map(allEmps.map(e => [nameKey(e.lastName.split(/\s+/)[0] ?? "", e.firstName), e]));

  const matchedRuts = [...new Set(rows.map(r => empByNameKey.get(nameKey(r.apellido, r.nombre))?.rut).filter((r): r is string => !!r))];
  const existingLeaves = await prisma.leave.findMany({
    where: { type: "VACACIONES" as any, employee: { rut: { in: matchedRuts } } },
    select: { startDate: true, employee: { select: { rut: true } } },
  });
  const existingKeys = new Set(existingLeaves.map(l => `vac|${upRut(l.employee.rut)}|${l.startDate.toISOString().slice(0, 10)}`));

  const seen = new Set<string>();
  const toCreate: any[] = [];
  let noMatch = 0;
  for (const row of rows) {
    const emp = empByNameKey.get(nameKey(row.apellido, row.nombre));
    if (!emp) { noMatch++; continue; }
    const key = `vac|${upRut(emp.rut)}|${row.startDate.toISOString().slice(0, 10)}`;
    if (existingKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    const tipoCorto = row.tipo.toLowerCase().includes("administrativ") ? "Administrativos" : "Legales";
    toCreate.push({
      employeeId: emp.id, type: "VACACIONES", startDate: row.startDate, endDate: row.endDate,
      days: row.days, status: "APPROVED",
      reason: `${tipoCorto} · Periodo ${row.periodo || "s/i"} · Importado desde BUK (Libro Vacación)`,
      approvedBy: row.aprobadoPor || null, approvedAt: row.fechaAprobacion,
    });
  }

  console.log(`Filas en Excel: ${rows.length} | sin match por nombre: ${noMatch} | ya existentes: ${rows.length - noMatch - toCreate.length} | a crear: ${toCreate.length}`);

  if (toCreate.length > 0) {
    const res = await prisma.leave.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`Creadas: ${res.count} filas Leave (VACACIONES, APPROVED).`);
  }
}

main().finally(() => prisma.$disconnect());
