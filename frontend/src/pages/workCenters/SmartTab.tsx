import { useState, useEffect, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useSmartHonorarios, useSmartCompras } from '@/hooks/useSmart'
import { fmtPeriodo, type SmartCategory } from './SmartShared'
import { DataTable, SummaryCards, getDocVal, compareDocVal, type SortState, type ColFilters } from './SmartDataTable'

export { SmartImportTab } from './SmartImportPreview'
export type { SmartCategory } from './SmartShared'

// ── SmartTab — data view only (Centros de Trabajo) ────────────────────────────

export function SmartTab({ category, year, month }: { category: SmartCategory; year?: string; month?: string }) {
  const [search,     setSearch]     = useState('')
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [sort,       setSort]       = useState<SortState>(null)

  // Sync periodo column filter with header year/month
  useEffect(() => {
    setColFilters(prev => {
      if (year && month) {
        const periodo = fmtPeriodo(`${year}${month.padStart(2, '0')}`)
        return { ...prev, periodo: new Set([periodo]) }
      }
      const { periodo: _, ...rest } = prev
      return rest
    })
  }, [year, month])

  // Fetch all data for current period (server-side) or all if no month selected
  const serverParams = (year && month) ? { periodo: `${year}${month.padStart(2, '0')}` } : {}
  const honQuery = useSmartHonorarios(category === 'honorarios' ? serverParams : { periodo: 'none' })
  const cmpQuery = useSmartCompras(category === 'compras'       ? serverParams : { periodo: 'none' })
  const { data: allDocs = [], isLoading } = category === 'honorarios' ? honQuery : cmpQuery

  function handleSort(col: string, dir?: 'asc' | 'desc') {
    setSort(prev => {
      if (dir) return { col, dir }
      if (!prev || prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc') return { col, dir: 'desc' }
      return null
    })
  }

  function handleFilterChange(col: string, vals: Set<string>) {
    setColFilters(prev => {
      if (vals.size === 0) {
        const { [col]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [col]: vals }
    })
  }

  const filteredDocs = useMemo(() => {
    let result = allDocs

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.proveedor.rut.toLowerCase().includes(q) ||
        d.proveedor.razonSocial.toLowerCase().includes(q),
      )
    }

    for (const [col, vals] of Object.entries(colFilters)) {
      if (vals.size === 0) continue
      result = result.filter(d => vals.has(getDocVal(d, col)))
    }

    if (sort) {
      result = [...result].sort((a, b) => {
        const cmp = compareDocVal(a, b, sort.col)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [allDocs, search, colFilters, sort])

  const hasFilters = search || Object.values(colFilters).some(s => s.size > 0) || !!sort

  return (
    <div className="space-y-5">
      <SummaryCards docs={filteredDocs} category={category} />

      {/* Search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor o RUT…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setColFilters({}); setSort(null) }}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <X size={11} /> Limpiar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filteredDocs.length !== allDocs.length
            ? `${filteredDocs.length} de ${allDocs.length} registros`
            : `${allDocs.length} registros`}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <DataTable
          allDocs={allDocs}
          docs={filteredDocs}
          category={category}
          isLoading={isLoading}
          colFilters={colFilters}
          onFilterChange={handleFilterChange}
          sort={sort}
          onSort={handleSort}
        />
      </div>
    </div>
  )
}
