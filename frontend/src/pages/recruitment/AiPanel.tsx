import { useMemo, useState } from 'react'
import { Sparkles, Loader2, AlertTriangle, Check, X, CheckCheck } from 'lucide-react'
import { fold } from '@/lib/utils'
import {
  useAiStatus, useStartAi, useAiSuggestions, useApplyAi, useDiscardAi, profileIncomplete, AI_FIELD_LABEL,
  type CandidateListItem, type AiSuggestionRow, type AiField,
} from '@/hooks/useRecruitment'

// Perfil con IA (Gemini, plan gratuito): se lanza a pedido y todo queda como sugerencia a revisar.

/** Barra de estado + botón para procesar los candidatos visibles con perfil incompleto */
export function AiBatchBar({ candidates, onReview }: { candidates: CandidateListItem[]; onReview: () => void }) {
  const { data: status } = useAiStatus()
  const { data: suggestions = [] } = useAiSuggestions()
  const start = useStartAi()
  const [confirming, setConfirming] = useState(false)

  const pending = useMemo(() => candidates.filter(c => profileIncomplete(c) && !c.aiSuggestedAt), [candidates])
  const job = status?.job

  if (!status?.configured) return null

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border border-violet-100 bg-violet-50/40 text-sm">
      <Sparkles size={15} className="text-violet-500" />
      {job?.running ? (
        <span className="flex items-center gap-2 text-violet-800">
          <Loader2 size={13} className="animate-spin" />
          Leyendo CVs con IA… {job.done}/{job.total}
          <span className="w-28 h-1.5 bg-violet-100 rounded-full overflow-hidden" aria-hidden>
            <span className="block h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.round((job.done / job.total) * 100)}%` }} />
          </span>
        </span>
      ) : confirming ? (
        <span className="flex flex-wrap items-center gap-2 text-gray-700">
          Leer con IA los CVs de {pending.length} candidato{pending.length !== 1 && 's'} con perfil incompleto (unos {Math.max(1, Math.round(pending.length * 9 / 60))} min).
          Nada se guarda sin tu revisión.
          <button onClick={() => { start.mutate(pending.map(c => c.id)); setConfirming(false) }}
            className="px-2.5 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700">Comenzar</button>
          <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800">Cancelar</button>
        </span>
      ) : (
        <>
          <span className="text-gray-700">
            {pending.length > 0
              ? <>{pending.length} de los candidatos visibles tienen el perfil incompleto.</>
              : <>Los candidatos visibles ya tienen perfil o ya se leyeron con IA.</>}
          </span>
          {pending.length > 0 && (
            <button onClick={() => setConfirming(true)} disabled={start.isPending}
              className="px-2.5 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              Completar perfiles con IA
            </button>
          )}
        </>
      )}
      {job && !job.running && job.stoppedReason && (
        <span className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={12} />{job.stoppedReason}</span>
      )}
      {job && !job.running && job.failed > 0 && (
        <span className="text-xs text-gray-500">{job.failed} CV{job.failed !== 1 && 's'} no se pudieron leer.</span>
      )}
      {start.isError && <span className="text-xs text-red-600">{(start.error as any)?.response?.data?.message ?? 'No se pudo iniciar'}</span>}
      {suggestions.length > 0 && (
        <button onClick={onReview} className="ml-auto px-2.5 py-1 text-xs font-medium text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100">
          Revisar {suggestions.length} sugerencia{suggestions.length !== 1 && 's'} →
        </button>
      )}
    </div>
  )
}

// ── Revisión de sugerencias ───────────────────────────────────────────────────

const FIELDS: AiField[] = ['fullName', 'email', 'phone', 'linkedinUrl', 'professionalTitle', 'institution', 'city', 'yearsExperience',
  'lastEmployer', 'lastPosition', 'sector', 'skills', 'tools', 'certifications', 'availability']

const empty = (v: unknown) => v === null || v === undefined || String(v).trim() === ''
const same  = (a: unknown, b: unknown) => fold(String(a ?? '')) === fold(String(b ?? ''))

/** Marcado por defecto: campo vacío, o nombre actual que no se parece al leído del CV (nombre mal extraído) */
function defaultChecked(row: AiSuggestionRow, f: AiField): boolean {
  const cur = row[f as keyof AiSuggestionRow], next = row.aiSuggestion[f]
  if (empty(next) || same(cur, next)) return false
  if (f === 'fullName') {
    const words = fold(String(next)).split(' ').filter(w => w.length > 2)
    return !words.some(w => fold(String(cur)).includes(w))
  }
  return empty(cur)
}

function SuggestionCard({ row, selected, onToggle }: {
  row: AiSuggestionRow; selected: Set<AiField>; onToggle: (f: AiField) => void
}) {
  const fields = FIELDS.filter(f => !empty(row.aiSuggestion[f]) && !same(row[f as keyof AiSuggestionRow], row.aiSuggestion[f]))
  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">{row.fullName}</span>
        <span className="text-xs text-gray-400">{selected.size}/{fields.length} campos</span>
      </div>
      {fields.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-400">La IA no encontró datos nuevos en su CV.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-400">
            <tr><th className="w-8" /><th className="text-left font-medium px-2 py-1 w-40">Campo</th><th className="text-left font-medium px-2 py-1">Actual</th><th className="text-left font-medium px-2 py-1">Leído del CV</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fields.map(f => {
              const cur = row[f as keyof AiSuggestionRow]
              return (
                <tr key={f} className={selected.has(f) ? 'bg-violet-50/40' : ''}>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={selected.has(f)} onChange={() => onToggle(f)}
                      aria-label={`Usar ${AI_FIELD_LABEL[f]} leído del CV`} className="w-3.5 h-3.5 accent-violet-600" />
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">{AI_FIELD_LABEL[f]}</td>
                  <td className="px-2 py-1.5 text-gray-500">{empty(cur) ? <span className="text-gray-300">—</span> : String(cur)}</td>
                  <td className="px-2 py-1.5 text-gray-800">{String(row.aiSuggestion[f])}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function AiReviewView({ onDone }: { onDone: () => void }) {
  const { data: rows = [], isLoading } = useAiSuggestions()
  const apply = useApplyAi()
  const discard = useDiscardAi()
  const [overrides, setOverrides] = useState<Record<string, Set<AiField>>>({})
  const [result, setResult] = useState<{ applied: number; skipped: string[] } | null>(null)

  const selectedFor = (r: AiSuggestionRow) =>
    overrides[r.id] ?? new Set(FIELDS.filter(f => defaultChecked(r, f)))
  const toggle = (r: AiSuggestionRow, f: AiField) => setOverrides(o => {
    const s = new Set(selectedFor(r)); s.has(f) ? s.delete(f) : s.add(f)
    return { ...o, [r.id]: s }
  })

  const applyAll = async () => {
    const items = rows.map(r => ({
      candidateId: r.id,
      fields: Object.fromEntries([...selectedFor(r)].map(f => [f, r.aiSuggestion[f] ?? null])),
    }))
    setResult(await apply.mutateAsync(items))
    setOverrides({})
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Cargando…</div>

  return (
    <div className="space-y-4">
      {result && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
          <Check size={15} className="mt-0.5" />
          <div>
            {result.applied} perfil{result.applied !== 1 && 'es'} actualizado{result.applied !== 1 && 's'}.
            {result.skipped.length > 0 && <ul className="mt-1 text-xs text-amber-700">{result.skipped.map(s => <li key={s}>{s}</li>)}</ul>}
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          No hay sugerencias pendientes.
          <button onClick={onDone} className="block mx-auto mt-3 text-brand-600 hover:underline">Volver a candidatos</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-600 flex-1">
              La IA leyó el CV de <b>{rows.length}</b> candidato{rows.length !== 1 && 's'}. Vienen marcados los campos vacíos y los nombres que parecen mal extraídos;
              ajusta y aplica. Lo que no marques no se toca.
            </p>
            <button onClick={() => discard.mutate(rows.map(r => r.id))} disabled={discard.isPending}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
              <X size={14} /> Descartar todas
            </button>
            <button onClick={applyAll} disabled={apply.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {apply.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Aplicar lo marcado
            </button>
          </div>
          <div className="space-y-3">
            {rows.map(r => <SuggestionCard key={r.id} row={r} selected={selectedFor(r)} onToggle={f => toggle(r, f)} />)}
          </div>
        </>
      )}
    </div>
  )
}
