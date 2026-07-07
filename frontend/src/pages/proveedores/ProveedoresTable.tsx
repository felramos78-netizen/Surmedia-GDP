import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, FileText, ShoppingCart } from 'lucide-react'
import type { SmartProveedor } from '@/types'

// ── Formatting ────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmtN = (n: number) => (n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n))

function initials(s: string) {
  return s.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

// Normaliza el área quitando sufijos entre paréntesis: "Administración (NCEN)" → "Administración".
// Solo deben existir Administración, Personas y Operaciones.
export const cleanArea = (a?: string | null) => (a ?? '').replace(/\s*\(.*$/, '').trim()

// ── Derived row stats ─────────────────────────────────────────────────────────

interface Row {
  prov:       SmartProveedor
  honCount:   number
  cmpCount:   number
  totalHon:   number
  totalCmp:   number
  total:      number
  categorias: string[]
  centers:    string[]
}

function buildRow(prov: SmartProveedor): Row {
  const docs = prov.documents ?? []
  let honCount = 0, cmpCount = 0, totalHon = 0, totalCmp = 0
  const centerSet = new Map<string, string>()
  const catSet    = new Set<string>()
  for (const d of docs) {
    if (d.category === 'HONORARIO') { honCount++; totalHon += d.montoTotal }
    else                           { cmpCount++; totalCmp += d.montoTotal }
    if (d.workCenter) centerSet.set(d.workCenter.id, d.workCenter.name)
    if (d.categoria)  catSet.add(d.categoria)
  }
  // Categoría y centros provienen de las BH/facturas (cada documento tiene los suyos);
  // el proveedor per se no tiene categoría ni centro de trabajo.
  return {
    prov, honCount, cmpCount, totalHon, totalCmp,
    total:      totalHon + totalCmp,
    categorias: [...catSet].sort(),
    centers:    [...centerSet.values()].sort(),
  }
}

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'nombre' | 'area' | 'categoria' | 'honCount' | 'cmpCount' | 'totalHon' | 'totalCmp' | 'total' | 'centers'
type SortDir = 'asc' | 'desc'

function sortRows(rows: Row[], key: SortKey, dir: SortDir): Row[] {
  const mult = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'nombre':    cmp = a.prov.razonSocial.localeCompare(b.prov.razonSocial); break
      case 'area':      cmp = cleanArea(a.prov.area).localeCompare(cleanArea(b.prov.area)); break
      case 'categoria': cmp = a.categorias.length - b.categorias.length; break
      case 'centers':   cmp = a.centers.length - b.centers.length; break
      default:          cmp = (a[key] as number) - (b[key] as number)
    }
    return cmp * mult
  })
}

// ── Header cell ───────────────────────────────────────────────────────────────

function Th({
  label, sortKey, activeKey, dir, onSort, align = 'left',
}: {
  label: string; sortKey: SortKey; activeKey: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: 'left' | 'right' | 'center'
}) {
  const active = activeKey === sortKey
  const alignCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className={`px-3 py-2.5 text-${align} text-xs font-medium text-gray-500 whitespace-nowrap`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 ${alignCls} w-full`}
      >
        {label}
        {active
          ? (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
          : <ArrowUpDown size={11} className="text-gray-300" />}
      </button>
    </th>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

export default function ProveedoresTable({
  proveedores, onSelect,
}: {
  proveedores: SmartProveedor[]
  onSelect: (p: SmartProveedor) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir(k === 'nombre' || k === 'area' ? 'asc' : 'desc') }
  }

  const rows = useMemo(
    () => sortRows(proveedores.map(buildRow), sortKey, sortDir),
    [proveedores, sortKey, sortDir],
  )

  const totals = useMemo(() => rows.reduce(
    (acc, r) => {
      acc.honCount += r.honCount; acc.cmpCount += r.cmpCount
      acc.totalHon += r.totalHon; acc.totalCmp += r.totalCmp; acc.total += r.total
      return acc
    },
    { honCount: 0, cmpCount: 0, totalHon: 0, totalCmp: 0, total: 0 },
  ), [rows])

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-200">
            <Th label="Proveedor"  sortKey="nombre"    activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Área"       sortKey="area"      activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Categoría"  sortKey="categoria" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="Centros de Trabajo" sortKey="centers" activeKey={sortKey} dir={sortDir} onSort={onSort} />
            <Th label="BH"         sortKey="honCount"  activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
            <Th label="Compras"    sortKey="cmpCount"  activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
            <Th label="Total Hon." sortKey="totalHon"  activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
            <Th label="Total Cmp." sortKey="totalCmp"  activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
            <Th label="Total"      sortKey="total"     activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ prov, honCount, cmpCount, totalHon, totalCmp, total, categorias, centers }) => (
            <tr
              key={prov.id}
              onClick={() => onSelect(prov)}
              className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40 cursor-pointer"
            >
              {/* Proveedor */}
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(prov.razonSocial)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{prov.razonSocial}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{prov.rut}</p>
                  </div>
                </div>
              </td>
              {/* Área */}
              <td className="px-3 py-2.5">
                {cleanArea(prov.area)
                  ? <span className="text-[10px] bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5 whitespace-nowrap">{cleanArea(prov.area)}</span>
                  : <span className="text-gray-300 text-xs">—</span>}
              </td>
              {/* Categoría */}
              <td className="px-3 py-2.5">
                {categorias.length === 0 ? (
                  <span className="text-gray-300 text-xs">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {categorias.slice(0, 2).map(c => (
                      <span key={c} className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 rounded-full px-2 py-0.5 whitespace-nowrap">{c}</span>
                    ))}
                    {categorias.length > 2 && (
                      <span className="text-[10px] text-gray-400 px-1 py-0.5" title={categorias.join(', ')}>
                        +{categorias.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </td>
              {/* Centros */}
              <td className="px-3 py-2.5">
                {centers.length === 0 ? (
                  <span className="text-gray-300 text-xs">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                    {centers.slice(0, 2).map(c => (
                      <span key={c} className="text-[10px] bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5 whitespace-nowrap">{c}</span>
                    ))}
                    {centers.length > 2 && (
                      <span className="text-[10px] text-gray-400 px-1 py-0.5" title={centers.join(', ')}>
                        +{centers.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </td>
              {/* BH */}
              <td className="px-3 py-2.5 text-right">
                {honCount > 0
                  ? <span className="inline-flex items-center gap-1 text-xs text-gray-600 tabular-nums"><FileText size={11} className="text-amber-500" />{honCount}</span>
                  : <span className="text-gray-300 text-xs">—</span>}
              </td>
              {/* Compras */}
              <td className="px-3 py-2.5 text-right">
                {cmpCount > 0
                  ? <span className="inline-flex items-center gap-1 text-xs text-gray-600 tabular-nums"><ShoppingCart size={11} className="text-brand-500" />{cmpCount}</span>
                  : <span className="text-gray-300 text-xs">—</span>}
              </td>
              {/* Totales */}
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums whitespace-nowrap">{fmtN(totalHon)}</td>
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums whitespace-nowrap">{fmtN(totalCmp)}</td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-800 tabular-nums whitespace-nowrap">{fmtN(total)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-sm text-gray-400">Sin resultados</td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200 font-medium">
              <td className="px-3 py-2.5 text-xs text-gray-500" colSpan={3}>{rows.length} proveedores</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums">{totals.honCount}</td>
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums">{totals.cmpCount}</td>
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums whitespace-nowrap">{fmtN(totals.totalHon)}</td>
              <td className="px-3 py-2.5 text-right text-xs text-gray-600 tabular-nums whitespace-nowrap">{fmtN(totals.totalCmp)}</td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-800 tabular-nums whitespace-nowrap">{fmtN(totals.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
