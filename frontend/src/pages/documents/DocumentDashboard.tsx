import { useState } from 'react'
import { AlertTriangle, Pencil, Plus, ShieldCheck, UserCircle2, X } from 'lucide-react'
import {
  useDocSummary, useCategoryMissing,
  type DocCategoryInput, type DocCategorySummary, type DocSummary,
} from '@/hooks/useBukDocuments'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { ENTITY_LABEL, ENTITY_COLOR } from './EmployeeDocuments'
import CategoryModal from './CategoryModal'
import SyncStatus from './SyncStatus'

const fmt = (n: number) => n.toLocaleString('es-CL')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function StatTile({ label, value, detail, onClick }: { label: string; value: string; detail?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`bg-white border border-gray-100 rounded-xl p-4 text-left ${onClick ? 'hover:border-brand-200 transition-colors' : ''}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
      {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
    </Tag>
  )
}

// Barra de cobertura: una sola tinta sobre riel gris; el valor va siempre en texto
function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="h-2 bg-gray-100 rounded-full overflow-hidden"
      role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
    >
      <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct(value, max)}%` }} />
    </div>
  )
}

function MissingModal({ category, activePeople, onClose, onOpenEmployee }: {
  category: DocCategorySummary; activePeople: number; onClose: () => void; onOpenEmployee: (id: string) => void
}) {
  useEscapeKey(onClose)
  const { data, isLoading } = useCategoryMissing(category.id)
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Sin ${category.name}`}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Activos sin {category.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {data ? `${data.length} de ${activePeople} personas activas (revisando todas sus fichas BUK)` : 'Cargando…'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <ul className="overflow-y-auto divide-y divide-gray-50 px-2 py-2">
          {isLoading && <li className="px-4 py-3 text-sm text-gray-400">Cargando…</li>}
          {data?.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Todas las personas activas tienen este documento.</li>}
          {data?.map(f => (
            <li key={f.rut} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-800 truncate">{f.fullName}</span>
                <span className="block text-xs text-gray-400">{f.rut}</span>
              </span>
              {f.legalEntities.map(e => (
                <span key={e} className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[e]}`}>{ENTITY_LABEL[e]}</span>
              ))}
              {f.employeeId ? (
                <button
                  onClick={() => onOpenEmployee(f.employeeId!)}
                  title="Ver sus documentos" aria-label={`Ver documentos de ${f.fullName}`}
                  className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
                >
                  <UserCircle2 size={15} />
                </button>
              ) : <span className="w-7" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function RequiredCoverage({ summary, onMissing }: { summary: DocSummary; onMissing: (c: DocCategorySummary) => void }) {
  const required = summary.categories.filter(c => c.required)
  if (!required.length) return null
  return (
    <section className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={16} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-gray-900">Documentos obligatorios</h2>
        <span className="text-xs text-gray-400">cobertura sobre {summary.activePeople} personas activas, en cualquiera de sus fichas BUK</span>
      </div>
      <div className="space-y-3">
        {required.map(c => {
          const missing = summary.activePeople - c.activeWith
          return (
            <div key={c.id} className="grid grid-cols-[10rem_1fr_9rem_8rem] items-center gap-4">
              <span className="text-sm text-gray-700 truncate" title={c.name}>{c.name}</span>
              <Meter value={c.activeWith} max={summary.activePeople} />
              <span className="text-xs text-gray-600 tabular-nums">
                {c.activeWith} de {summary.activePeople} ({pct(c.activeWith, summary.activePeople)}%)
              </span>
              {missing > 0 ? (
                <button onClick={() => onMissing(c)} className="flex items-center gap-1 text-xs text-amber-700 hover:underline justify-self-start">
                  <AlertTriangle size={12} /> {missing} sin documento
                </button>
              ) : <span className="text-xs text-gray-400">Completo</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Dashboard de documentos BUK: cuántos hay por tipo, cobertura de los obligatorios
// y qué nombres quedan sin clasificar
export default function DocumentDashboard({ onSearchCategory, onOpenEmployee }: {
  onSearchCategory: (categoryId: string) => void
  onOpenEmployee:   (employeeId: string) => void
}) {
  const { data, isLoading, isError } = useDocSummary()
  const [editing, setEditing] = useState<{ category?: DocCategorySummary; draft?: Partial<DocCategoryInput> } | null>(null)
  const [missing, setMissing] = useState<DocCategorySummary | null>(null)

  if (isLoading) return <div className="py-16 text-center text-sm text-gray-400">Cargando resumen…</div>
  if (isError || !data) return (
    <div className="py-16 text-center">
      <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No se pudo cargar el resumen de documentos.</p>
    </div>
  )

  const groups = new Map<string, DocCategorySummary[]>()
  for (const c of data.categories) groups.set(c.group, [...(groups.get(c.group) ?? []), c])
  const groupNames = [...groups.keys()]
  const maxSortOrder = Math.max(0, ...data.categories.map(c => c.sortOrder))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SyncStatus />
        <button
          onClick={() => setEditing({ draft: { sortOrder: maxSortOrder + 10 } })}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
        >
          <Plus size={14} /> Nueva categoría
        </button>
      </div>

      {data.totalDocs === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          {data.syncing ? 'Primera sincronización con BUK en curso; los números aparecerán al terminar.' : 'Aún no hay documentos sincronizados. Usa “Sincronizar”.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Documentos en BUK" value={fmt(data.totalDocs)} />
            <StatTile label="Fichas con documentos" value={fmt(data.totalFichas)} detail={`${data.activePeople} personas activas`} />
            <StatTile label="Categorías" value={fmt(data.categories.length)} detail={`${groupNames.length} grupos`} />
            <StatTile
              label="Sin clasificar"
              value={fmt(data.uncategorizedDocs)}
              detail={`${pct(data.uncategorizedDocs, data.totalDocs)}% del total · ver`}
              onClick={() => onSearchCategory('none')}
            />
          </div>

          <RequiredCoverage summary={data} onMissing={setMissing} />

          {/* Categorías por grupo */}
          {[...groups.entries()].map(([group, cats]) => (
            <section key={group}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {cats.map(c => (
                  <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-brand-200 transition-colors group relative">
                    <button onClick={() => onSearchCategory(c.id)} className="block w-full text-left" title="Ver documentos y quiénes los tienen">
                      <p className="text-sm font-medium text-gray-800 pr-6">
                        {c.name}
                        {c.required && <span className="ml-2 align-middle text-[10px] font-medium px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">Obligatorio</span>}
                      </p>
                      <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums">{fmt(c.docs)}</p>
                      <p className="text-xs text-gray-400">documentos en {fmt(c.fichas)} fichas</p>
                      <p className="mt-2 text-[11px] text-gray-400 truncate" title={c.keywords.join(', ')}>
                        {c.keywords.join(' · ')}
                      </p>
                    </button>
                    <button
                      onClick={() => setEditing({ category: c })}
                      aria-label={`Editar ${c.name}`} title="Editar categoría"
                      className="absolute top-3 right-3 p-1 text-gray-300 hover:text-brand-600 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Sin clasificar */}
          {data.topUncategorized.length > 0 && (
            <section className="bg-white border border-gray-100 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900">Nombres sin clasificar más frecuentes</h2>
              <p className="text-xs text-gray-400 mt-0.5 mb-3">
                Nombres de archivo sin fecha ni nombre de la persona. Crea una categoría para agruparlos.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 text-left">
                    <th className="font-normal py-1.5">Nombre</th>
                    <th className="font-normal py-1.5 text-right">Documentos</th>
                    <th className="font-normal py-1.5 text-right">Fichas</th>
                    <th className="font-normal py-1.5 pl-6">Ejemplo</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topUncategorized.map(u => (
                    <tr key={u.stem}>
                      <td className="py-2 text-gray-800">{u.stem}</td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{u.docs}</td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{u.fichas}</td>
                      <td className="py-2 pl-6 text-xs text-gray-400 max-w-64 truncate" title={u.example}>{u.example}</td>
                      <td className="py-2 text-right">
                        {u.stem !== '(sin nombre)' && (
                          <button
                            onClick={() => setEditing({ draft: {
                              name: u.stem[0].toUpperCase() + u.stem.slice(1),
                              keywords: [u.stem],
                              sortOrder: maxSortOrder + 10,
                            } })}
                            className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                          >
                            Crear categoría
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {editing && (
        <CategoryModal
          category={editing.category}
          draft={editing.draft}
          groups={groupNames}
          onClose={() => setEditing(null)}
        />
      )}
      {missing && (
        <MissingModal
          category={missing}
          activePeople={data.activePeople}
          onClose={() => setMissing(null)}
          onOpenEmployee={id => { setMissing(null); onOpenEmployee(id) }}
        />
      )}
    </div>
  )
}
