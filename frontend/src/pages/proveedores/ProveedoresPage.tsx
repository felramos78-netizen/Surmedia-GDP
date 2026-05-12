import { useState } from 'react'
import { Search, X, Building2, FileText, ShoppingCart } from 'lucide-react'
import { useSmartProveedores } from '@/hooks/useSmart'
import type { SmartProveedor } from '@/types'
import ProveedorDrawer from './ProveedorDrawer'

// ── Formatting ────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmtN = (n: number) => n === 0 ? '—' : CLP.format(n)

function initials(s: string) {
  return s.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

// ── Proveedor card ────────────────────────────────────────────────────────────

function ProveedorCard({ prov, onClick }: { prov: SmartProveedor; onClick: () => void }) {
  const docs     = prov.documents ?? []
  const honCount = docs.filter(d => d.category === 'HONORARIO').length
  const cmpCount = docs.filter(d => d.category === 'COMPRA').length
  const total    = docs.reduce((s, d) => s + d.montoTotal, 0)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all"
    >
      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
          {initials(prov.razonSocial)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate text-sm leading-tight">
            {prov.razonSocial}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{prov.rut}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {prov.area && (
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
            {prov.area}
          </span>
        )}
        {prov.categoria && (
          <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 rounded-full px-2 py-0.5">
            {prov.categoria}
          </span>
        )}
        {prov.workCenter && (
          <span className="text-[10px] bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
            {prov.workCenter.name}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {honCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText size={11} className="text-amber-500" />
              {honCount} hon.
            </span>
          )}
          {cmpCount > 0 && (
            <span className="flex items-center gap-1">
              <ShoppingCart size={11} className="text-blue-500" />
              {cmpCount} compras
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-700 tabular-nums">{fmtN(total)}</p>
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const [search,   setSearch]   = useState('')
  const [area,     setArea]     = useState('')
  const [categoria, setCategoria] = useState('')
  const [selected, setSelected] = useState<SmartProveedor | null>(null)

  const { data: proveedores = [], isLoading } = useSmartProveedores({
    search:    search    || undefined,
    area:      area      || undefined,
    categoria: categoria || undefined,
  })

  const { data: allProvs = [] } = useSmartProveedores({})
  const areas       = [...new Set(allProvs.map(p => p.area).filter(Boolean))]  as string[]
  const categorias  = [...new Set(allProvs.map(p => p.categoria).filter(Boolean))] as string[]

  const total    = proveedores.reduce((s, p) => s + (p.documents?.reduce((ss, d) => ss + d.montoTotal, 0) ?? 0), 0)
  const docCount = proveedores.reduce((s, p) => s + (p.documents?.length ?? 0), 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-1">
            {proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} · {docCount} documentos
          </p>
        </div>
        {total > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Total facturado</p>
            <p className="text-lg font-bold text-gray-800 tabular-nums">{CLP.format(total)}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor o RUT…"
            className="pl-7 pr-8 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {areas.length > 0 && (
          <select value={area} onChange={e => setArea(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Todas las áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}

        {categorias.length > 0 && (
          <select value={categoria} onChange={e => setCategoria(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando proveedores…</div>
      ) : proveedores.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {search || area || categoria
              ? 'Sin resultados para los filtros aplicados.'
              : 'Sin proveedores. Importa datos desde Importables Excel → Smart CTO.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {proveedores.map(p => (
            <ProveedorCard key={p.id} prov={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <ProveedorDrawer proveedorId={selected.id} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
