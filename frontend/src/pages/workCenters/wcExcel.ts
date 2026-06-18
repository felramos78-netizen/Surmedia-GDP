// Exportación a Excel de Centros de Trabajo. Extraído de WorkCentersPage.tsx.
import * as XLSX from 'xlsx'
import type { WorkCenter, PayrollRawEntry, LegalEntity } from '@/types'
import {
  type WCAggRow, parsePayrollItems, getPonderacion, aggregateWCRows,
  LEGAL_ENTITY_LABEL, COST_TYPE_LABEL,
} from './wcUtils'

export function applyClpFormat(ws: XLSX.WorkSheet, cols: number[], clpFmt = '$#,##0') {
  const range = XLSX.utils.decode_range(ws['!ref']!)
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (const C of cols) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && typeof cell.v === 'number') cell.z = clpFmt
    }
  }
}

export function exportCentrosToExcel(
  centers: WorkCenter[],
  allEntries: PayrollRawEntry[],
  periodoLabel: string,
  isMonthly: boolean,
) {
  const wb = XLSX.utils.book_new()
  const CONTRACTUAL = 160_000

  function filterForCenter(entries: PayrollRawEntry[], wc: WorkCenter): PayrollRawEntry[] {
    const idSet = new Set(wc.employeeIds ?? [])
    if (idSet.size > 0) return entries.filter(e => idSet.has(e.employeeId))
    const byWC = entries.filter(e =>
      e.employee.workCenters?.some(a => a.workCenter.name === wc.name && a.legalEntity === e.legalEntity)
    )
    if (byWC.length > 0) return byWC
    return entries.filter(e => e.employee.costCenter === wc.name)
  }

  // Pre-computar primer centro por empleado (en orden de la lista)
  const employeeFirstCenter = new Map<string, string>()
  for (const wc of centers) {
    for (const e of filterForCenter(allEntries, wc)) {
      if (!employeeFirstCenter.has(e.employeeId)) {
        employeeFirstCenter.set(e.employeeId, wc.name)
      }
    }
  }

  // ── Hoja 1: Resumen ──────────────────────────────────────────────────────────
  const data = centers.map(wc => {
    const wcEntries = filterForCenter(allEntries, wc)
    let gastoReal = 0, gastoEstandar = 0, gastoLiquido = 0
    let gastoBonos = 0, gastoHH = 0, gastoNoImp = 0
    for (const e of wcEntries) {
      const p    = parsePayrollItems(e.items ?? [], e.grossSalary)
      const pond = getPonderacion(e.employee.workCenters, e.legalEntity)
      gastoReal     += e.grossSalary * pond
      gastoLiquido  += e.liquidSalary * pond
      gastoEstandar += (p.sueldoBase + p.gratificacion + p.noImponiblesTotal) * pond
      gastoBonos    += p.bonosTotal * pond
      gastoHH       += p.hhTotal * pond
      gastoNoImp    += p.noImponiblesTotal * pond
    }
    const nColabs   = new Set(wcEntries.map(e => e.employeeId)).size
    // Solo cuenta empleados cuyo primer centro es este
    const nPrimary  = new Set(
      wcEntries.filter(e => employeeFirstCenter.get(e.employeeId) === wc.name).map(e => e.employeeId)
    ).size
    const exportMonths   = isMonthly ? 1 : Math.max(new Set(allEntries.map(e => e.month)).size, 1)
    const gastoContract  = nPrimary * CONTRACTUAL * exportMonths
    const ingresos       = (wc.totalIngresos ?? 0) * exportMonths
    const diferencia     = ingresos > 0 ? ingresos - (gastoReal + gastoContract) : null
    return {
      'Centro':                wc.name,
      'Ubicación':             wc.ubicacion ?? '',
      'Tipo de Costo':         COST_TYPE_LABEL[wc.costType],
      'Colaboradores período': nColabs,
      'N° Cargos':             wc.positions?.length ?? 0,
      'Ingresos':              ingresos,
      'Sueldo Bruto':          gastoReal,
      'Sueldo Estándar':       gastoEstandar,
      'Sueldo Líquido':        gastoLiquido,
      'Total Bonos':           gastoBonos,
      'Total HH Extra':        gastoHH,
      'Total Hab. No Imp.':    gastoNoImp,
      'Gastos Contractuales':  gastoContract,
      'Diferencia Ing−Gasto':  diferencia,
    }
  })

  const sumCols = [
    'Colaboradores período', 'N° Cargos', 'Ingresos',
    'Sueldo Bruto', 'Sueldo Estándar', 'Sueldo Líquido',
    'Total Bonos', 'Total HH Extra', 'Total Hab. No Imp.',
    'Gastos Contractuales', 'Diferencia Ing−Gasto',
  ]
  const totals: Record<string, number | string | null> = {
    'Centro': `TOTAL (${centers.length} centros)`,
    'Ubicación': '', 'Tipo de Costo': '',
  }
  for (const col of sumCols) {
    totals[col] = data.reduce((s, r) => {
      const v = (r as Record<string, unknown>)[col]
      return s + (typeof v === 'number' ? v : 0)
    }, 0)
  }

  const ws = XLSX.utils.json_to_sheet([...data, totals])
  ws['!cols'] = [
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 10 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
  ]
  // cols: Ingresos(5), Bruto(6), Estándar(7), Líquido(8), Bonos(9), HH(10), NoImp(11), Contract(12), Diferencia(13)
  applyClpFormat(ws, [5, 6, 7, 8, 9, 10, 11, 12, 13])
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen')

  // ── Hoja por centro ──────────────────────────────────────────────────────────
  for (const wc of centers) {
    const wcEntries = filterForCenter(allEntries, wc)
    const rows = aggregateWCRows(wcEntries, isMonthly)

    type DetailRow = Record<string, string | number | null>
    const chargedInCenter = new Set<string>()
    const detailData: DetailRow[] = rows.map(r => {
      const isFirstCenter = employeeFirstCenter.get(r.employeeId) === wc.name
      const chargeHere    = isFirstCenter && !chargedInCenter.has(r.employeeId)
      if (chargeHere) chargedInCenter.add(r.employeeId)
      return {
        'Colaborador':               r.employeeName,
        'RUT':                       r.rut,
        'Razón Social':              LEGAL_ENTITY_LABEL[r.legalEntity as LegalEntity] ?? r.legalEntity,
        'Cargo':                     r.jobTitle,
        'Período':                   r.period,
        'Ponderación':               r.ponderacion,
        'Sueldo Bruto':              r.grossSalary,
        'Sueldo Bruto Ponderado':    r.grossSalary       * r.ponderacion,
        'Sueldo Estándar':           r.sueldoEstandar    * r.ponderacion,
        'Sueldo Líquido':            r.liquidSalary      * r.ponderacion,
        'Sueldo Base':               r.sueldoBase        * r.ponderacion,
        'Gratificación':             r.gratificacion     * r.ponderacion,
        'Total Bonos':               r.bonosTotal        * r.ponderacion,
        'Bonos identificados':       r.bonosNames,
        'Total HH Extra':            r.hhTotal           * r.ponderacion,
        'HH identificadas':          r.hhDetail,
        'Total Hab. No Imp.':        r.noImponiblesTotal * r.ponderacion,
        'Hab. No Imp.':              r.noImponiblesNames,
        'Gastos Contractuales':      chargeHere ? CONTRACTUAL : 0,
      }
    })

    // Fila de totales
    if (detailData.length > 0) {
      const numCols = [
        'Sueldo Bruto', 'Sueldo Bruto Ponderado', 'Sueldo Estándar', 'Sueldo Líquido', 'Sueldo Base',
        'Gratificación', 'Total Bonos', 'Total HH Extra', 'Total Hab. No Imp.',
        'Gastos Contractuales',
      ]
      const rowTotals: DetailRow = {
        'Colaborador': `TOTAL (${detailData.length} colaboradores)`,
        'RUT': '', 'Razón Social': '', 'Cargo': '', 'Período': '',
        'Ponderación': null,
        'Bonos identificados': '', 'HH identificadas': '', 'Hab. No Imp.': '',
      }
      for (const col of numCols) {
        rowTotals[col] = detailData.reduce((s, r) => s + (typeof r[col] === 'number' ? (r[col] as number) : 0), 0)
      }
      detailData.push(rowTotals)
    }

    const dws = XLSX.utils.json_to_sheet(
      detailData.length > 0
        ? detailData
        : [{ 'Colaborador': 'Sin datos de remuneración para el período seleccionado' }]
    )
    dws['!cols'] = [
      { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 14 },
      { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
      { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, { wch: 20 },
    ]
    // CLP: Bruto(6), BrutoPond(7), Estándar(8), Líquido(9), Base(10), Gratif(11), Bonos(12), HH(14), NoImp(16), Contract(18)
    applyClpFormat(dws, [6, 7, 8, 9, 10, 11, 12, 14, 16, 18])
    const drng = XLSX.utils.decode_range(dws['!ref']!)
    for (let R = drng.s.r + 1; R <= drng.e.r; R++) {
      const cell = dws[XLSX.utils.encode_cell({ r: R, c: 5 })]
      if (cell && typeof cell.v === 'number') cell.z = '0%'
    }

    const sheetName = wc.name.replace(/[\\/?*[\]:']/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, dws, sheetName || `Centro ${wc.id.slice(0, 6)}`)
  }

  const safe = periodoLabel.replace(/[\s/]+/g, '-').toLowerCase()
  XLSX.writeFile(wb, `centros-de-trabajo${safe ? `-${safe}` : ''}.xlsx`)
}

export function exportRemuneracionesToExcel(rows: WCAggRow[], centerName: string, periodoLabel: string) {
  const CONTRACTUAL = 160_000
  const STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'Con permiso', DUPLICATE: 'Duplicado',
  }

  // ── Hoja Remuneraciones: una fila por (empleado × centro) ────────────────────
  type ExportRow = Record<string, string | number>
  const data: ExportRow[] = []

  for (const r of rows) {
    const rawList = (r.centers && r.centers !== '—')
      ? r.centers.split(', ').map(c => c.trim()).filter(Boolean)
      : ['—']
    // Si hay filtro de centro sólo mostramos ese centro; si no, expandimos
    const targets = centerName ? [centerName] : rawList

    for (const centro of targets) {
      const isFirstCenter = rawList[0] === centro
      data.push({
        'Razón Social':               LEGAL_ENTITY_LABEL[r.legalEntity as LegalEntity] ?? r.legalEntity,
        'Estado':                     STATUS_LABEL[r.status] ?? r.status,
        'Centro':                     centro,
        'Colaborador':                r.employeeName,
        'RUT':                        r.rut,
        'Cargo':                      r.jobTitle,
        'Ponderación':                Math.round(r.ponderacion * 100),
        'Sueldo bruto ponderado':     Math.round(r.grossSalary     * r.ponderacion),
        'Sueldo estándar ponderado':  Math.round(r.sueldoEstandar  * r.ponderacion),
        'Total bonos':                Math.round(r.bonosTotal       * r.ponderacion),
        'Bonos identificados':        r.bonosNames,
        'Total HH extra':             Math.round(r.hhTotal          * r.ponderacion),
        'HH extra identificadas':     r.hhDetail,
        'Gastos contractuales':       isFirstCenter ? CONTRACTUAL : 0,
      })
    }
  }

  // Ordenar: Razón Social → Centro → Colaborador
  data.sort((a, b) => {
    const rs = String(a['Razón Social']).localeCompare(String(b['Razón Social']), 'es')
    if (rs !== 0) return rs
    const cs = String(a['Centro']).localeCompare(String(b['Centro']), 'es')
    if (cs !== 0) return cs
    return String(a['Colaborador']).localeCompare(String(b['Colaborador']), 'es')
  })

  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 16 }, // Razón Social
    { wch: 10 }, // Estado
    { wch: 24 }, // Centro
    { wch: 28 }, // Colaborador
    { wch: 14 }, // RUT
    { wch: 24 }, // Cargo
    { wch: 12 }, // Ponderación
    { wch: 22 }, // Sueldo bruto ponderado
    { wch: 24 }, // Sueldo estándar ponderado
    { wch: 14 }, // Total bonos
    { wch: 30 }, // Bonos identificados
    { wch: 14 }, // Total HH extra
    { wch: 30 }, // HH extra identificadas
    { wch: 20 }, // Gastos contractuales
  ]
  // CLP: bruto=7, estándar=8, bonos=9, HH=11, contractuales=13
  applyClpFormat(ws, [7, 8, 9, 11, 13])

  // ── Hoja Dashboard ────────────────────────────────────────────────────────────
  const totBruto    = data.reduce((s, r) => s + (r['Sueldo bruto ponderado']    as number || 0), 0)
  const totEstandar = data.reduce((s, r) => s + (r['Sueldo estándar ponderado'] as number || 0), 0)
  const totBonos    = data.reduce((s, r) => s + (r['Total bonos']               as number || 0), 0)
  const totHH       = data.reduce((s, r) => s + (r['Total HH extra']            as number || 0), 0)
  const totContract = data.reduce((s, r) => s + (r['Gastos contractuales']      as number || 0), 0)
  const totEmpleados = new Set(rows.map(r => `${r.employeeId}::${r.legalEntity}`)).size

  const byEntity = new Map<string, { n: number; bruto: number }>()
  const byEstado = new Map<string, { n: number; bruto: number }>()
  const byCentro = new Map<string, { n: number; bruto: number }>()
  for (const r of data) {
    const addTo = (m: typeof byEntity, key: string) => {
      const ex = m.get(key) ?? { n: 0, bruto: 0 }
      ex.n++; ex.bruto += r['Sueldo bruto ponderado'] as number || 0
      m.set(key, ex)
    }
    addTo(byEntity, String(r['Razón Social']))
    addTo(byEstado, String(r['Estado']))
    addTo(byCentro, String(r['Centro']))
  }
  const sortedEntries = (m: typeof byEntity) =>
    [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))

  type AoaCell = string | number | null
  const aoa: AoaCell[][] = [
    [`DASHBOARD — REMUNERACIONES ${periodoLabel.toUpperCase()}`, '', ''],
    [],
    ['Métricas generales', '', 'Valor'],
    ['Colaboradores únicos', '', totEmpleados],
    ['Filas en reporte (con expansión)', '', data.length],
    ['Sueldo bruto ponderado total', '', totBruto],
    ['Sueldo estándar ponderado total', '', totEstandar],
    ['Total bonos', '', totBonos],
    ['Total HH extra', '', totHH],
    ['Gastos contractuales', '', totContract],
    [],
    ['Por Razón Social', 'Filas', 'Sueldo Bruto Ponderado'],
    ...sortedEntries(byEntity).map(([k, v]) => [k, v.n, v.bruto] as AoaCell[]),
    [],
    ['Por Estado', 'Filas', 'Sueldo Bruto Ponderado'],
    ...sortedEntries(byEstado).map(([k, v]) => [k, v.n, v.bruto] as AoaCell[]),
    [],
    ['Por Centro de Trabajo', 'Filas', 'Sueldo Bruto Ponderado'],
    ...sortedEntries(byCentro).map(([k, v]) => [k, v.n, v.bruto] as AoaCell[]),
  ]

  const dws = XLSX.utils.aoa_to_sheet(aoa)
  dws['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 26 }]
  // Aplicar formato CLP a columna 2 donde sea un número grande (montos)
  const dashRng = XLSX.utils.decode_range(dws['!ref']!)
  for (let R = dashRng.s.r; R <= dashRng.e.r; R++) {
    const cell = dws[XLSX.utils.encode_cell({ r: R, c: 2 })]
    if (cell && typeof cell.v === 'number' && cell.v > 999) cell.z = '$#,##0'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Remuneraciones')
  XLSX.utils.book_append_sheet(wb, dws, 'Dashboard')

  const safe = periodoLabel.replace(/[\s/]+/g, '-').toLowerCase()
  const centerSafe = centerName ? centerName.replace(/[\\/?*[\]:']/g, '').slice(0, 20) + '-' : ''
  XLSX.writeFile(wb, `remuneraciones-${centerSafe}${safe || 'todos'}.xlsx`)
}
