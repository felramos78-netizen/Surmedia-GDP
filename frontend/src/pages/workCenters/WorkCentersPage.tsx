import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Save, Building2, Users, Briefcase, ChevronDown, ChevronUp } from 'lucide-react'
import { useWorkCenters, useCreateWorkCenter, useUpdateWorkCenter, useDeleteWorkCenter } from '@/hooks/useWorkCenters'
import type { WorkCenter, CostType } from '@/types'

const COST_TYPE_LABEL: Record<CostType, string> = { DIRECTO: 'Directo', INDIRECTO: 'Indirecto' }
const COST_TYPE_COLOR: Record<CostType, string> = {
  DIRECTO:   'bg-blue-100 text-blue-700',
  INDIRECTO: 'bg-gray-100 text-gray-600',
}

// ─── Modal crear/editar ───────────────────────────────────────────────────────

function WorkCenterModal({
  initial, onClose,
}: {
  initial?: WorkCenter | null
  onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [costType, setCostType] = useState<CostType>(initial?.costType ?? 'DIRECTO')
  const [error, setError]       = useState('')

  const create = useCreateWorkCenter()
  const update = useUpdateWorkCenter()
  const isPending = create.isPending || update.isPending

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, name: name.trim(), costType })
      } else {
        await create.mutateAsync({ name: name.trim(), costType })
      }
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {initial ? 'Editar centro' : 'Nuevo centro de trabajo'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Ej: CODELCO DET"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de costo</label>
            <div className="flex gap-3">
              {(['DIRECTO', 'INDIRECTO'] as CostType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setCostType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    costType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {COST_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Save size={14} />
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila de centro ───────────────────────────────────────────────────────────

function WorkCenterRow({
  wc, onEdit, onDelete,
}: {
  wc: WorkCenter
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900">{wc.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${COST_TYPE_COLOR[wc.costType]}`}>
            {COST_TYPE_LABEL[wc.costType]}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <Users size={14} className="text-gray-400" />
            {wc.totalPersonnel ?? 0}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(e => !e)}
            disabled={!wc.positions?.length}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <Briefcase size={14} />
            {wc.positions?.length ?? 0} cargos
            {wc.positions?.length ? (
              expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />
            ) : null}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && wc.positions && wc.positions.length > 0 && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="ml-6 flex flex-wrap gap-2">
              {wc.positions.map(p => (
                <span key={p.title} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                  <span className="font-medium">{p.title}</span>
                  <span className="bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 font-semibold">{p.count}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function WorkCentersPage() {
  const [modal, setModal]     = useState<'create' | WorkCenter | null>(null)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | CostType>('')
  const [confirmId, setConfirmId]   = useState<string | null>(null)

  const { data: centers = [], isLoading } = useWorkCenters()
  const deleteWC = useDeleteWorkCenter()

  const filtered = centers.filter(wc => {
    const matchSearch = !search || wc.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || wc.costType === typeFilter
    return matchSearch && matchType
  })

  const totalDirecto   = centers.filter(c => c.costType === 'DIRECTO').length
  const totalIndirecto = centers.filter(c => c.costType === 'INDIRECTO').length
  const totalPersonnel = centers.reduce((s, c) => s + (c.totalPersonnel ?? 0), 0)

  async function handleDelete(id: string) {
    await deleteWC.mutateAsync(id)
    setConfirmId(null)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Centros de Trabajo</h2>
          <p className="text-sm text-gray-500 mt-1">{centers.length} centros registrados</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nuevo centro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{centers.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total centros</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-blue-600">{totalDirecto}</p>
          <p className="text-sm text-gray-500 mt-0.5">Costos directos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-600">{totalIndirecto}</p>
          <p className="text-sm text-gray-500 mt-0.5">Costos indirectos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-2xl font-bold text-gray-900">{totalPersonnel}</p>
          <p className="text-sm text-gray-500 mt-0.5">Total asignaciones</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar centro…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as '' | CostType)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="DIRECTO">Directo</option>
            <option value="INDIRECTO">Indirecto</option>
          </select>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-sm text-gray-400">Cargando centros…</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay centros de trabajo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de costo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total personal</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total cargos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(wc => (
                  <WorkCenterRow
                    key={wc.id}
                    wc={wc}
                    onEdit={() => setModal(wc)}
                    onDelete={() => setConfirmId(wc.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <WorkCenterModal
          initial={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">¿Eliminar centro?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminarán también todas las asignaciones de colaboradores a este centro.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                disabled={deleteWC.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleteWC.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
