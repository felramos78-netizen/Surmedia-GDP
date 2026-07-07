/**
 * Carga Tipo (Reembolsable/No Reembolsable) y Categoría Surmedia a los honorarios 2026
 * desde "Reporte ACT 2026.xlsx", cruzando por empresa+folio+montoBruto.
 *
 * DRY-RUN por defecto. Aplicar:  npx tsx --env-file=.env scripts/apply-honorarios-tipo-cat.ts --apply
 */
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const norm = (s: unknown) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const LE = (e: string) =>
  norm(e).startsWith("comunic") ? "COMUNICACIONES_SURMEDIA" : "SURMEDIA_CONSULTORIA";

async function main() {
  console.log(`=== ${APPLY ? "APLICANDO" : "DRY-RUN (no escribe)"} ===\n`);
  const wb = XLSX.readFile("../Reporte ACT 2026.xlsx");
  const raw = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Detalle Completo"], {
    header: 1, raw: true, defval: null,
  }).slice(2).filter((r) => r[0] && r[0] !== "TOTAL GENERAL");
  const ex = raw.map((r) => ({
    le: LE(r[0]), folio: String(r[3]), bruto: r[4] || 0,
    tipo: (r[6] as string) || null, categoria: (r[8] as string) || null,
  }));

  const db = await prisma.smartDocument.findMany({
    where: { category: "HONORARIO" },
    select: { id: true, smartId: true, legalEntity: true, folio: true, montoBruto: true, tipo: true, categoria: true },
  });
  const key = (le: string, folio: string | null, bruto: number) => `${le}|${folio}|${bruto}`;
  const dbByKey: Record<string, typeof db> = {};
  db.forEach((d) => { (dbByKey[key(d.legalEntity, d.folio, d.montoBruto)] = dbByKey[key(d.legalEntity, d.folio, d.montoBruto)] || []).push(d); });

  const used = new Set<string>();
  const plan: { id: string; tipo: string | null; categoria: string | null }[] = [];
  const tipoCount: Record<string, number> = {};
  const catCount: Record<string, number> = {};
  let noMatch = 0;

  for (const e of ex) {
    const cand = (dbByKey[key(e.le, e.folio, e.bruto)] || []).filter((d) => !used.has(d.smartId));
    if (!cand.length) { noMatch++; continue; }
    const d = cand[0]; used.add(d.smartId);
    if (e.tipo !== d.tipo || e.categoria !== d.categoria) {
      plan.push({ id: d.id, tipo: e.tipo, categoria: e.categoria });
      tipoCount[e.tipo ?? "(null)"] = (tipoCount[e.tipo ?? "(null)"] || 0) + 1;
      catCount[e.categoria ?? "(null)"] = (catCount[e.categoria ?? "(null)"] || 0) + 1;
    }
  }

  console.log(`Boletas que reciben Tipo+Categoría: ${plan.length}  (sin match: ${noMatch})`);
  console.log("\nTipo:");
  Object.entries(tipoCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
  console.log("\nCategoría Surmedia:");
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));

  if (APPLY) {
    for (const p of plan) await prisma.smartDocument.update({ where: { id: p.id }, data: { tipo: p.tipo, categoria: p.categoria } });
    console.log(`\n✅ Aplicado a ${plan.length} honorarios.`);
  } else {
    console.log("\n(DRY-RUN: nada se escribió. Re-ejecutar con --apply.)");
  }
  await prisma.$disconnect();
}
main();
