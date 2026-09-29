import { useState } from 'react'
import { X, Plus, Trash2, Loader2, Save, Calculator, Hand } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import {
  useSaveCriterion, useDeleteCriterion, PROFILE_FIELDS, OPERATOR_LABEL,
  type ScoringCriterion, type CriterionOperator, type ProfileField,
} from '@/hooks/useRecruitment'

type Draft = Omit<ScoringCriterion, 'id' | 'jobOpeningId' | 'sortOrder'> & { id?: string }

const EMPTY: Draft = { name: '', type: 'RULE', field: 'city', operator: 'CONTAINS', value: '', pointsIfTrue: 1, pointsIfFalse: 0 }

const inputCls = 'px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'

export function describeCriterion(c: Pick<ScoringCriterion, 'type' | 'field' | 'operator' | 'value' | 'pointsIfTrue' | 'pointsIfFalse'>): string {
  if (c.type === 'MANUAL') return 'Puntaje a mano en la tabla'
  const f = PROFILE_FIELDS.find(p => p.key === c.field)?.label ?? c.field
  const op = c.operator ? OPERATOR_LABEL[c.operator] : ''
  const pts = (n: number) => `${n > 0 ? '+' : ''}${n}`
  return `${f} ${op}${c.operator === 'NOT_EMPTY' ? '' : ` "${c.value ?? ''}"`} → ${pts(c.pointsIfTrue)}, si no ${pts(c.pointsIfFalse)}`
}

function CriterionForm({ draft, openingId, onDone }: { draft: Draft; openingId: string; onDone: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const save = useSaveCriterion()
  const numeric = PROFILE_FIELDS.find(f => f.key === d.field)?.numeric
  const ops: CriterionOperator[] = numeric ? ['GTE', 'LTE', 'EQUALS', 'NOT_EMPTY'] : ['CONTAINS', 'NOT_CONTAINS', 'EQUALS', 'NOT_EMPTY']

  const submit = async () => {
    await save.mutateAsync({ ...d, openingId, value: d.type === 'RULE' && d.operator !== 'NOT_EMPTY' ? d.value : null })
    onDone()
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-3 space-y-3">
      <div className="flex gap-2">
        <input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Nombre del criterio (ej. Vive en Antofagasta)"
          aria-label="Nombre del criterio" className={`${inputCls} flex-1`} autoFocus />
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(['RULE', 'MANUAL'] as const).map(t => (
            <button key={t} onClick={() => setD({ ...d, type: t })}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${d.type === t ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
              {t === 'RULE' ? <><Calculator size={12} /> Automático</> : <><Hand size={12} /> Manual</>}
            </button>
          ))}
        </div>
      </div>

      {d.type === 'RULE' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>Si</span>
          <select value={d.field ?? ''} aria-label="Campo" className={inputCls}
            onChange={e => {
              const field = e.target.value as ProfileField
              const isNum = PROFILE_FIELDS.find(f => f.key === field)?.numeric
              setD({ ...d, field, operator: isNum ? 'GTE' : 'CONTAINS' })
            }}>
            {PROFILE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={d.operator ?? ''} onChange={e => setD({ ...d, operator: e.target.value as CriterionOperator })} aria-label="Condición" className={inputCls}>
            {ops.map(o => <option key={o} value={o}>{OPERATOR_LABEL[o]}</option>)}
          </select>
          {d.operator !== 'NOT_EMPTY' && (
            <input value={d.value ?? ''} onChange={e => setD({ ...d, value: e.target.value })} aria-label="Valor"
              type={numeric && d.operator !== 'EQUALS' ? 'number' : 'text'}
              placeholder={numeric ? '3' : 'Antofagasta, Calama'} className={`${inputCls} w-44`} />
          )}
          <span>→ suma</span>
          <input type="number" step="0.5" value={d.pointsIfTrue} onChange={e => setD({ ...d, pointsIfTrue: Number(e.target.value) })} aria-label="Puntos si cumple" className={`${inputCls} w-16`} />
          <span>si no</span>
          <input type="number" step="0.5" value={d.pointsIfFalse} onChange={e => setD({ ...d, pointsIfFalse: Number(e.target.value) })} aria-label="Puntos si no cumple" className={`${inputCls} w-16`} />
        </div>
      ) : (
        <p className="text-xs text-gray-500">El puntaje se escribe a mano para cada candidato en la tabla de preselección.</p>
      )}
      {d.type === 'RULE' && !numeric && d.operator !== 'NOT_EMPTY' && (
        <p className="text-[11px] text-gray-400">Varias alternativas separadas por coma. No distingue mayúsculas ni tildes.</p>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={!d.name.trim() || save.isPending || (d.type === 'RULE' && d.operator !== 'NOT_EMPTY' && !d.value?.trim())}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
          {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
        </button>
      </div>
    </div>
  )
}

export default function CriteriaModal({ openingId, openingName, criteria, onClose }: {
  openingId: string; openingName: string; criteria: ScoringCriterion[]; onClose: () => void
}) {
  useEscapeKey(onClose)
  const [editing, setEditing] = useState<Draft | null>(null)
  const del = useDeleteCriterion()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]" role="dialog" aria-label="Criterios de puntaje">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Criterios de puntaje</h2>
            <p className="text-xs text-gray-400 mt-0.5">{openingName} · el total es la suma de todos los criterios</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-2">
          {criteria.length === 0 && !editing && (
            <p className="text-sm text-gray-400 py-4 text-center">Esta vacante aún no tiene criterios.</p>
          )}
          {criteria.map(c => editing?.id === c.id ? (
            <CriterionForm key={c.id} draft={editing} openingId={openingId} onDone={() => setEditing(null)} />
          ) : (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200">
              {c.type === 'RULE' ? <Calculator size={14} className="text-brand-500 flex-shrink-0" /> : <Hand size={14} className="text-gray-400 flex-shrink-0" />}
              <button onClick={() => setEditing({ ...c })} className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-medium text-gray-800">{c.name}</span>
                <span className="block text-xs text-gray-400 truncate">{describeCriterion(c)}</span>
              </button>
              <button onClick={() => { if (confirm(`¿Eliminar el criterio "${c.name}"? Se pierden sus puntajes manuales.`)) del.mutate(c.id) }}
                aria-label={`Eliminar ${c.name}`} className="p-1 text-gray-300 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {editing && !editing.id && <CriterionForm draft={editing} openingId={openingId} onDone={() => setEditing(null)} />}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-between">
          <button onClick={() => setEditing({ ...EMPTY })} disabled={!!editing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg disabled:opacity-40">
            <Plus size={14} /> Agregar criterio
          </button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Listo</button>
        </div>
      </div>
    </div>
  )
}
