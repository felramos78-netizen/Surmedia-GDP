import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5,
  junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const norm = (s: unknown) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const LE = (e: string) =>
  norm(e).startsWith("comunic") ? "COMUNICACIONES_SURMEDIA" : "SURMEDIA_CONSULTORIA";

type Ex = {
  emp: string; le: string; mes: string; mesN: number; nombre: string; folio: string;
  bruto: number; neto: number; tipo: string; centro: string; cat: string; clas: string; desc: string;
};

async function main() {
  const wb = XLSX.readFile("../Reporte ACT 2026.xlsx");
  const raw = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Detalle Completo"], {
    header: 1, raw: true, defval: null,
  }).slice(2).filter((r) => r[0] && r[0] !== "TOTAL GENERAL");

  const ex: Ex[] = raw.map((r) => ({
    emp: r[0], le: LE(r[0]), mes: r[1], mesN: MES[norm(r[1])], nombre: r[2], folio: String(r[3]),
    bruto: r[4] || 0, neto: r[5] || 0, tipo: r[6], centro: r[7], cat: r[8], clas: r[9], desc: r[10],
  }));

  const db = await prisma.smartDocument.findMany({
    where: { category: "HONORARIO" },
    include: { proveedor: { select: { razonSocial: true, rut: true } }, workCenter: { select: { name: true } } },
  });
  const dbm = db.map((d) => ({
    smartId: d.smartId, le: d.legalEntity, folio: String(d.folio), bruto: d.montoBruto,
    neto: d.montoNeto, fecha: d.fechaEmision, mesN: d.fechaEmision ? d.fechaEmision.getUTCMonth() + 1 : null,
    nombre: d.proveedor?.razonSocial, centro: d.workCenter?.name ?? null,
  }));

  const key = (x: { le: string; folio: string; bruto: number }) => `${x.le}|${x.folio}|${x.bruto}`;
  const dbByKey: Record<string, typeof dbm> = {};
  dbm.forEach((d) => { (dbByKey[key(d)] = dbByKey[key(d)] || []).push(d); });

  const used = new Set<string>();
  const matched: { e: Ex; d: typeof dbm[0] }[] = [];
  const exOnly: Ex[] = [];
  for (const e of ex) {
    const cand = (dbByKey[key(e)] || []).filter((d) => !used.has(d.smartId));
    if (cand.length) { matched.push({ e, d: cand[0] }); used.add(cand[0].smartId); }
    else exOnly.push(e);
  }
  const dbOnly = dbm.filter((d) => !used.has(d.smartId));

  console.log("================ RECONCILIACION HONORARIOS 2026 ================");
  console.log("Excel boletas:", ex.length, "| DB honorarios:", dbm.length);
  console.log("CALZAN (empresa+folio+bruto):", matched.length);
  console.log("SOLO EN EXCEL (no estan en DB):", exOnly.length);
  console.log("SOLO EN DB (no estan en Excel):", dbOnly.length);

  // diferencias en los que calzan
  const diffCentro = matched.filter((m) => norm(m.e.centro) !== norm(m.d.centro || ""));
  const diffNeto = matched.filter((m) => m.e.neto !== m.d.neto);
  console.log("\n  de los que CALZAN -> difieren en Centro de trabajo:", diffCentro.length);
  console.log("  de los que CALZAN -> difieren en Monto Neto:", diffNeto.length);

  console.log("\n--- SOLO EN EXCEL (" + exOnly.length + ") ---");
  exOnly.forEach((e) =>
    console.log(`  ${e.emp} | ${e.mes} | BH ${e.folio} | $${e.bruto} | ${e.nombre} | ${e.centro}`));

  console.log("\n--- SOLO EN DB (" + dbOnly.length + ") por mes ---");
  const g: Record<string, typeof dbm> = {};
  dbOnly.forEach((d) => {
    const k = (d.le.startsWith("COMUN") ? "Com" : "Cons") + "|" + (d.mesN ?? "?");
    (g[k] = g[k] || []).push(d);
  });
  Object.keys(g).sort().forEach((k) => {
    console.log(`  [${k}] ${g[k].length}`);
    g[k].forEach((d) => console.log(`      BH ${d.folio} | $${d.bruto} | ${d.nombre} | ${d.fecha ? d.fecha.toISOString().slice(0, 10) : "sin fecha"}`));
  });

  // diferencias de centro en los que calzan
  if (diffCentro.length) {
    console.log("\n--- DIFERENCIAS DE CENTRO (Excel -> DB) ---");
    diffCentro.forEach((m) =>
      console.log(`  ${m.e.emp} BH ${m.e.folio} $${m.e.bruto} ${m.e.nombre}: Excel="${m.e.centro}" vs DB="${m.d.centro}"`));
  }

  // resumen por mes Excel vs DB
  console.log("\n--- CONTEO POR EMPRESA+MES (Excel | DB) ---");
  const cnt = (arr: { le: string; mesN: number | null }[]) => {
    const c: Record<string, number> = {};
    arr.forEach((x) => { const k = (x.le.startsWith("COMUN") ? "Com" : "Cons") + "|" + (x.mesN ?? "?"); c[k] = (c[k] || 0) + 1; });
    return c;
  };
  const ce = cnt(ex), cd = cnt(dbm);
  const keys = [...new Set([...Object.keys(ce), ...Object.keys(cd)])].sort();
  keys.forEach((k) => console.log(`  ${k.padEnd(10)} Excel=${(ce[k] || 0).toString().padStart(3)}  DB=${(cd[k] || 0).toString().padStart(3)}`));

  await prisma.$disconnect();
}
main();
