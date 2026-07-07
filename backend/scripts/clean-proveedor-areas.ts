/**
 * Normaliza el campo `area` de los proveedores Smart: elimina el sufijo entre
 * paréntesis (ej: "Administración (NCEN)" -> "Administración").
 *
 * Solo deben existir tres áreas: Administración, Personas, Operaciones.
 * Cualquier valor que tras la limpieza no caiga en esas tres se reporta y NO se toca.
 *
 * DRY-RUN por defecto. Para aplicar:
 *   npx tsx --env-file=.env scripts/clean-proveedor-areas.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const VALID = new Set(["Administración", "Personas", "Operaciones"]);
const clean = (a: string) => a.replace(/\s*\(.*$/, "").trim();

async function main() {
  console.log(`=== ${APPLY ? "APLICANDO" : "DRY-RUN (no escribe)"} ===\n`);

  const provs = await prisma.smartProveedor.findMany({
    where: { area: { not: null } },
    select: { id: true, razonSocial: true, area: true },
  });

  const plan: { id: string; from: string; to: string }[] = [];
  const invalid: { razonSocial: string; area: string; cleaned: string }[] = [];

  for (const p of provs) {
    const from = p.area as string;
    const to = clean(from);
    if (to === from) continue;                 // sin paréntesis, nada que hacer
    if (!VALID.has(to)) {                        // resultado fuera de las 3 áreas válidas
      invalid.push({ razonSocial: p.razonSocial, area: from, cleaned: to });
      continue;
    }
    plan.push({ id: p.id, from, to });
  }

  // Resumen de cambios agrupado
  const byChange: Record<string, number> = {};
  plan.forEach((c) => { const k = `${c.from}  ->  ${c.to}`; byChange[k] = (byChange[k] ?? 0) + 1; });
  console.log("── Cambios de área ──");
  Object.entries(byChange).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
  console.log(`  TOTAL proveedores que cambian: ${plan.length}`);

  if (invalid.length) {
    console.log(`\n⚠️  Áreas que NO quedan en {Administración, Personas, Operaciones} (revisar manualmente):`);
    invalid.forEach((i) => console.log(`     "${i.area}" -> "${i.cleaned}"  ::  ${i.razonSocial}`));
  }

  if (APPLY) {
    for (const c of plan) await prisma.smartProveedor.update({ where: { id: c.id }, data: { area: c.to } });
    console.log(`\n✅ Aplicado: ${plan.length} áreas normalizadas.`);
  } else {
    console.log("\n(DRY-RUN: nada se escribió. Re-ejecutar con --apply para confirmar.)");
  }

  await prisma.$disconnect();
}
main();
