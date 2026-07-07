/**
 * Asigna Centro de Trabajo (workCenter) y clasificacion a los honorarios 2026
 * cruzando el "Reporte ACT 2026.xlsx" contra la DB por empresa+folio+montoBruto.
 *
 * DRY-RUN por defecto. Para aplicar:  npx tsx --env-file=.env scripts/apply-honorarios-centros.ts --apply
 */
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const MES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const norm = (s: unknown) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const LE = (e: string) =>
  norm(e).startsWith("comunic") ? "COMUNICACIONES_SURMEDIA" : "SURMEDIA_CONSULTORIA";

// ── Operaciones sobre WorkCenter ──────────────────────────────
const RENAMES: [string, string][] = [
  ["COSTOS ADMINISTRATIVOS", "Administración"],
  ["CODELCO CORP", "Codelco GCOM"],
  ["KINROSS (COMUNICACIONES Y LOBO MARTE)", "KINROSS COMUNICACIONES Y LOBO MARTE"],
];
const CREATES: { name: string; costType: "DIRECTO" | "INDIRECTO" }[] = [
  { name: "Personas", costType: "INDIRECTO" },           // división de Administración
  { name: "Operaciones Varios", costType: "DIRECTO" },
  { name: "CODELCO EO", costType: "DIRECTO" },           // centro antiguo
];

// ── Mapeo: centro Excel (normalizado) -> nombre WC destino | null=no tocar ──
const SKIP_CONSERVE = "__CONSERVE__"; // Sin definir: conservar el de la DB
const SKIP_AMBIG = "__AMBIG__";       // AMSA: faena indeterminada
const CENTRO_MAP: Record<string, string> = {
  "administracion": "Administración",
  "personas": "Personas",
  "cmp": "CMP",
  "bhp escondida": "BHP ESCONDIDA",
  "codelco gcom": "Codelco GCOM",
  "codelco det": "CODELCO DET",
  "operaciones varios": "Operaciones Varios",
  "spn": "SALAR",
  "fme": "FME",
  "candelaria": "CANDELARIA",
  "kinross": "KINROSS COMUNICACIONES Y LOBO MARTE",
  "codelco eo": "CODELCO EO",
  "amsa": SKIP_AMBIG,
  "sin definir": SKIP_CONSERVE,
};

async function main() {
  console.log(`=== ${APPLY ? "APLICANDO" : "DRY-RUN (no escribe)"} ===\n`);

  // 1) Leer Excel
  const wb = XLSX.readFile("../Reporte ACT 2026.xlsx");
  const raw = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Detalle Completo"], {
    header: 1, raw: true, defval: null,
  }).slice(2).filter((r) => r[0] && r[0] !== "TOTAL GENERAL");
  const ex = raw.map((r) => ({
    le: LE(r[0]), folio: String(r[3]), bruto: r[4] || 0, nombre: r[2],
    centro: r[7] as string, clas: r[9] as string,
  }));

  // 2) WorkCenter: renombres + creates
  console.log("── Cambios en WorkCenter ──");
  for (const [oldN, newN] of RENAMES) {
    const old = await prisma.workCenter.findUnique({ where: { name: oldN } });
    if (old) {
      console.log(`  RENOMBRAR  "${oldN}"  ->  "${newN}"`);
      if (APPLY) await prisma.workCenter.update({ where: { id: old.id }, data: { name: newN } });
    } else {
      const already = await prisma.workCenter.findUnique({ where: { name: newN } });
      console.log(already ? `  (ya renombrado: "${newN}")` : `  ⚠️ no existe "${oldN}" ni "${newN}"`);
    }
  }
  for (const c of CREATES) {
    const exists = await prisma.workCenter.findUnique({ where: { name: c.name } });
    console.log(exists ? `  (ya existe: "${c.name}")` : `  CREAR      "${c.name}" (${c.costType})`);
    if (APPLY && !exists) await prisma.workCenter.create({ data: { name: c.name, costType: c.costType } });
  }

  // 3) Mapa nombre WC -> id (tras crear/renombrar en modo apply)
  const wcs = await prisma.workCenter.findMany({ select: { id: true, name: true } });
  const wcId: Record<string, string> = {};
  wcs.forEach((w) => { wcId[w.name] = w.id; });
  if (!APPLY) {
    // simular el estado post rename/create para que el conteo sea real
    for (const [oldN, newN] of RENAMES) if (wcId[oldN]) wcId[newN] = wcId[oldN];
    for (const c of CREATES) wcId[c.name] = wcId[c.name] || `DRYRUN-${c.name}`;
  }

  // 4) Honorarios DB
  const db = await prisma.smartDocument.findMany({
    where: { category: "HONORARIO" },
    select: { id: true, smartId: true, legalEntity: true, folio: true, montoBruto: true, workCenterId: true, clasificacion: true },
  });
  const key = (x: { legalEntity?: string; le?: string; folio: string | null; montoBruto?: number; bruto?: number }) =>
    `${x.legalEntity ?? x.le}|${x.folio}|${x.montoBruto ?? x.bruto}`;
  const dbByKey: Record<string, typeof db> = {};
  db.forEach((d) => { (dbByKey[key(d)] = dbByKey[key(d)] || []).push(d); });

  // 5) Construir plan de asignación
  const used = new Set<string>();
  const planWC: { id: string; from: string | null; to: string }[] = [];
  const planClas: { id: string; from: string | null; to: string }[] = [];
  const conserve: string[] = [];   // Sin definir con centro en DB -> se conserva
  const ambig: string[] = [];      // AMSA
  const noTarget: string[] = [];   // centro Excel sin WC destino
  let noMatch = 0;

  for (const e of ex) {
    const cand = (dbByKey[key(e)] || []).filter((d) => !used.has(d.smartId));
    if (!cand.length) { noMatch++; continue; }
    const d = cand[0]; used.add(d.smartId);

    // clasificacion
    if (e.clas && e.clas !== d.clasificacion) planClas.push({ id: d.id, from: d.clasificacion, to: e.clas });

    // centro
    const mapped = CENTRO_MAP[norm(e.centro)];
    if (mapped === SKIP_CONSERVE) { if (d.workCenterId) conserve.push(e.nombre); continue; }
    if (mapped === SKIP_AMBIG) { ambig.push(`${e.nombre} (BH ${e.folio} $${e.bruto})`); continue; }
    if (!mapped) { noTarget.push(`${e.centro} :: ${e.nombre}`); continue; }
    const targetId = wcId[mapped];
    if (!targetId) { noTarget.push(`${mapped} (WC inexistente) :: ${e.nombre}`); continue; }
    if (d.workCenterId !== targetId) planWC.push({ id: d.id, from: d.workCenterId, to: mapped });
  }

  // 6) Resumen
  const byTarget: Record<string, number> = {};
  planWC.forEach((p) => { byTarget[p.to] = (byTarget[p.to] || 0) + 1; });
  console.log("\n── Asignaciones de Centro de Trabajo (cambian) ──");
  Object.entries(byTarget).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  -> ${k}`));
  console.log(`  TOTAL boletas que cambian de centro: ${planWC.length}`);
  console.log(`\n  Conservadas (Excel 'Sin definir' pero DB ya tenía centro): ${conserve.length}`);
  console.log(`  AMSA sin faena (NO asignadas, requieren decisión manual): ${ambig.length}`);
  ambig.forEach((a) => console.log(`     - ${a}`));
  if (noTarget.length) { console.log(`  ⚠️ Sin WC destino: ${noTarget.length}`); noTarget.forEach((n) => console.log(`     - ${n}`)); }
  console.log(`\n── Cambios de clasificacion ── ${planClas.length}`);
  planClas.slice(0, 50).forEach((p) => console.log(`     "${p.from}" -> "${p.to}"`));
  console.log(`\n  Boletas del Excel sin match en DB: ${noMatch}`);

  // 7) Aplicar asignaciones
  if (APPLY) {
    for (const p of planWC) await prisma.smartDocument.update({ where: { id: p.id }, data: { workCenterId: wcId[p.to] } });
    for (const p of planClas) await prisma.smartDocument.update({ where: { id: p.id }, data: { clasificacion: p.to } });
    console.log(`\n✅ Aplicado: ${planWC.length} centros, ${planClas.length} clasificaciones.`);
  } else {
    console.log("\n(DRY-RUN: nada se escribió. Re-ejecutar con --apply para confirmar.)");
  }

  await prisma.$disconnect();
}
main();
