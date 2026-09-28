import { FastifyInstance } from 'fastify'

// Fuentes de gasto imputadas al Presupuesto DPDO:
//  - BH y facturas de Smart con partida (`SmartDocument.budgetItemId`). Al importar, un documento
//    nuevo hereda la partida por defecto de su proveedor (ver smart.ts).
//  - Rendiciones: suman a su partida por id.
// Las boletas anuladas quedan fuera; las notas de crédito restan porque se guardan con monto
// negativo (ver parseSmartFile en smart.ts), salvo las que corrigen una factura que no está en
// GDP (p. ej. de un año anterior): esas no cuentan.
const NOTA_CREDITO = '61' // código SII de nota de crédito electrónica

// Determina el trimestre (0..3) y año de un documento a partir del periodo tributario
// ("YYYYMM") o, en su defecto, de la fecha de emisión. Devuelve null si no se puede.
function docYearQuarter(periodo: string | null, fecha: Date | null): { year: number; q: number } | null {
  const p = periodo?.trim()
  if (p && /^\d{6}$/.test(p)) {
    const year = Number(p.slice(0, 4))
    const month = Number(p.slice(4, 6))
    if (month >= 1 && month <= 12) return { year, q: Math.floor((month - 1) / 3) }
  }
  if (fecha) {
    const d = new Date(fecha)
    return { year: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) }
  }
  return null
}

export default async function budgetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (_req, reply) => {
    const categories = await app.prisma.budgetCategory.findMany({
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })

    const docs = await app.prisma.smartDocument.findMany({
      where: { budgetItemId: { not: null }, vigente: true },
      select: {
        budgetItemId: true, montoTotal: true, periodoTributario: true, fechaEmision: true,
        codigoTributario: true, folioReferencia: true, proveedorId: true, legalEntity: true,
      },
    })

    // Notas de crédito cuya factura de referencia no existe en GDP → se ignoran.
    const docKey = (proveedorId: string, legalEntity: string, folio: string) => `${proveedorId}|${legalEntity}|${folio}`
    const notas = docs.filter(d => d.codigoTributario === NOTA_CREDITO)
    const referenced = notas.length
      ? await app.prisma.smartDocument.findMany({
          where: { proveedorId: { in: [...new Set(notas.map(n => n.proveedorId))] }, codigoTributario: { not: NOTA_CREDITO } },
          select: { proveedorId: true, legalEntity: true, folio: true },
        })
      : []
    const existingDocs = new Set(referenced.map(r => docKey(r.proveedorId, r.legalEntity, r.folio ?? '')))
    const counts = (d: (typeof docs)[number]) =>
      d.codigoTributario !== NOTA_CREDITO ||
      (!!d.folioReferencia && existingDocs.has(docKey(d.proveedorId, d.legalEntity, d.folioReferencia)))

    // Gasto acotado al año presupuestario en curso, desglosado por trimestre.
    const budgetYear = new Date().getFullYear()
    const spendByItem = new Map<string, { total: number; quarters: number[] }>()
    const addToItem = (itemId: string, yq: { year: number; q: number } | null, amount: number) => {
      if (!yq || yq.year !== budgetYear) return
      const cur = spendByItem.get(itemId) ?? { total: 0, quarters: [0, 0, 0, 0] }
      cur.total += amount
      cur.quarters[yq.q] += amount
      spendByItem.set(itemId, cur)
    }
    for (const d of docs.filter(counts)) addToItem(d.budgetItemId!, docYearQuarter(d.periodoTributario, d.fechaEmision), d.montoTotal)

    const rendiciones = await app.prisma.budgetRendicion.findMany({ select: { itemId: true, amount: true, date: true } })
    for (const r of rendiciones) addToItem(r.itemId, docYearQuarter(null, r.date), r.amount)

    const withSpent = categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => {
        const spent = spendByItem.get(item.id)
        return {
          ...item,
          spentAmount: spent?.total ?? 0,
          spentByQuarter: spent?.quarters ?? [0, 0, 0, 0],
          virtual: false,
        }
      }),
    }))

    return reply.send({ data: withSpent })
  })

  // ── Rendiciones ───────────────────────────────────────────────────────────

  const rendicionInclude = { item: { select: { id: true, name: true, category: { select: { name: true } } } } }

  app.get('/rendiciones', async (_req, reply) => {
    const data = await app.prisma.budgetRendicion.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], include: rendicionInclude })
    return reply.send({ data })
  })

  app.post('/rendiciones', async (req, reply) => {
    const b = req.body as { itemId?: string; description?: string; amount?: number; date?: string; notes?: string | null }
    if (!b.itemId || !b.description?.trim() || typeof b.amount !== 'number' || !b.date) {
      return reply.status(400).send({ message: 'itemId, description, amount y date son requeridos' })
    }
    const data = await app.prisma.budgetRendicion.create({
      data: { itemId: b.itemId, description: b.description.trim(), amount: Math.round(b.amount), date: new Date(b.date), notes: b.notes?.trim() || null },
      include: rendicionInclude,
    })
    return reply.send({ data })
  })

  app.patch('/rendiciones/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = req.body as { itemId?: string; description?: string; amount?: number; date?: string; notes?: string | null }
    const data = await app.prisma.budgetRendicion.update({
      where: { id },
      data: {
        ...(b.itemId !== undefined && { itemId: b.itemId }),
        ...(b.description?.trim() && { description: b.description.trim() }),
        ...(typeof b.amount === 'number' && { amount: Math.round(b.amount) }),
        ...(b.date && { date: new Date(b.date) }),
        ...(b.notes !== undefined && { notes: b.notes?.trim() || null }),
      },
      include: rendicionInclude,
    })
    return reply.send({ data })
  })

  app.delete('/rendiciones/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.prisma.budgetRendicion.delete({ where: { id } })
    return reply.send({ data: { id } })
  })

  // ── Partidas (BudgetItem) ─────────────────────────────────────────────────

  app.post('/items', async (req, reply) => {
    const body = req.body as { categoryId?: string; name?: string; annualAmount?: number }
    if (!body.categoryId || !body.name?.trim()) {
      return reply.status(400).send({ message: 'categoryId y name son requeridos' })
    }
    const last = await app.prisma.budgetItem.findFirst({
      where: { categoryId: body.categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const item = await app.prisma.budgetItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name.trim(),
        annualAmount: body.annualAmount ?? 0,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    })
    return reply.send({ data: item })
  })

  app.patch('/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as {
      name?: string
      annualAmount?: number
      spentAmount?: number
      notes?: string
    }
    const name = body.name?.trim()
    const item = await app.prisma.budgetItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(body.annualAmount !== undefined && { annualAmount: body.annualAmount }),
        ...(body.spentAmount !== undefined && { spentAmount: body.spentAmount }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    })
    return reply.send({ data: item })
  })

  app.delete('/items/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.prisma.budgetItem.delete({ where: { id } })
    return reply.send({ data: { id } })
  })

  // Reordena las partidas dentro de una subárea según el orden de `ids`.
  // También reasigna `categoryId`, por lo que sirve para mover una partida entre subáreas.
  app.patch('/items/reorder', async (req, reply) => {
    const { categoryId, ids } = req.body as { categoryId?: string; ids?: string[] }
    if (!categoryId || !Array.isArray(ids)) {
      return reply.status(400).send({ message: 'categoryId e ids son requeridos' })
    }
    await app.prisma.$transaction(
      ids.map((id, i) => app.prisma.budgetItem.update({ where: { id }, data: { sortOrder: i, categoryId } })),
    )
    return reply.send({ data: { count: ids.length } })
  })

  // ── Subáreas (BudgetCategory) ─────────────────────────────────────────────

  app.post('/categories', async (req, reply) => {
    const body = req.body as { name?: string; section?: string }
    if (!body.name?.trim()) return reply.status(400).send({ message: 'name es requerido' })
    const section = body.section === 'BENEFICIOS' ? 'BENEFICIOS' : 'PARTIDAS'
    const last = await app.prisma.budgetCategory.findFirst({
      where: { section },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    const category = await app.prisma.budgetCategory.create({
      data: { name: body.name.trim(), section, sortOrder: (last?.sortOrder ?? 0) + 1 },
      include: { items: true },
    })
    return reply.send({ data: category })
  })

  app.patch('/categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { name?: string; sortOrder?: number }
    const category = await app.prisma.budgetCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      },
    })
    return reply.send({ data: category })
  })

  // Reordena las subáreas según el orden de `ids`.
  app.patch('/categories/reorder', async (req, reply) => {
    const { ids } = req.body as { ids?: string[] }
    if (!Array.isArray(ids)) return reply.status(400).send({ message: 'ids es requerido' })
    await app.prisma.$transaction(
      ids.map((id, i) => app.prisma.budgetCategory.update({ where: { id }, data: { sortOrder: i } })),
    )
    return reply.send({ data: { count: ids.length } })
  })

  // Elimina la subárea y, en cascada, todas sus partidas.
  app.delete('/categories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.prisma.budgetCategory.delete({ where: { id } })
    return reply.send({ data: { id } })
  })
}
