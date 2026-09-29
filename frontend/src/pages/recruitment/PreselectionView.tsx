import { useMemo, useState } from 'react'
import { Loader2, SlidersHorizontal, FileText, Calculator } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import { LinkedinIcon } from '@/components/ui/LinkedinIcon'
import {
  useJobOpenings, usePreselection, useUpdateApplication, openCandidateFile, scoreCriterion, totalScore,
  STAGES, STAGE_META, SOURCE_LABEL, PROFILE_FIELDS, type PreselectionRow, type RecruitmentStage,
} from '@/hooks/useRecruitment'
import CriteriaModal, { describeCriterion } from './CriteriaModal'

const fmtScore = (n: number | null) => n === null ? '' : Number.isInteger(n) ? String(n) : n.toFixed(1)

/** Input que guarda al salir del campo (o con Enter) */
function InlineInput({ value, onSave, type = 'text', ariaLabel, className = '' }: {
  value: string; onSave: (v: string) => void; type?: 'text' | 'number'; ariaLabel: string; className?: string
}) {
  const [v, setV] = useState(value)
  const [prev, setPrev] = useState(value)
  if (value !== prev) { setPrev(value); setV(value) }
  return (
    <input
      type={type} value={v} step="0.5" aria-label={ariaLabel}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onClick={e => e.stopPropagation()}
      className={`px-1.5 py-1 text-xs border border-transparent hover:border-gray-200 focus:border-gray-300 rounded bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
    />
  )
}

function LongText({ text }: { text: string | null }) {
  if (!text) return <span className="text-gray-300">—</span>
  return <span className="block max-w-[260px] line-clamp-2 text-xs text-gray-600" title={text}>{text}</span>
}

export default function PreselectionView({ openingId, onOpeningChange, onOpenCandidate }: {
  openingId: string
  onOpeningChange: (id: string) => void
  onOpenCandidate: (id: string) => void
}) {
  const { data: openings = [] } = useJobOpenings()
  const { data, isLoading, isFetching } = usePreselection(openingId || null)
  const updateApp = useUpdateApplication()
  const [showCriteria, setShowCriteria] = useState(false)

  const criteria = data?.opening.criteria ?? []

  const columns = useMemo<Column<PreselectionRow>[]>(() => [
    {
      key: 'total', header: 'Total', value: r => totalScore(criteria, r), filter: 'range', align: 'right',
      render: r => <span className="inline-block min-w-[2rem] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold text-xs">{fmtScore(totalScore(criteria, r)) || '—'}</span>,
    },
    ...criteria.map<Column<PreselectionRow>>(c => ({
      key: `c:${c.id}`, header: c.name, title: describeCriterion(c), value: r => scoreCriterion(c, r), filter: 'range', align: 'right',
      render: r => c.type === 'MANUAL' ? (
        <InlineInput type="number" ariaLabel={`${c.name} de ${r.candidate.fullName}`} className="w-14 text-right"
          value={r.manualScores[c.id] === undefined ? '' : String(r.manualScores[c.id])}
          onSave={v => updateApp.mutate({ id: r.id, scores: { [c.id]: v.trim() === '' ? null : Number(v) } })} />
      ) : (
        <span className="text-xs text-gray-500 inline-flex items-center gap-0.5" title={describeCriterion(c)}>
          <Calculator size={9} className="text-gray-300" />{fmtScore(scoreCriterion(c, r))}
        </span>
      ),
    })),
    {
      key: 'name', header: 'Nombre', value: r => r.candidate.fullName, className: 'whitespace-nowrap',
      render: r => (
        <button onClick={e => { e.stopPropagation(); onOpenCandidate(r.candidate.id) }} className="text-left font-medium text-gray-800 hover:text-brand-700">
          {r.candidate.fullName}
        </button>
      ),
    },
    {
      key: 'stage', header: 'Etapa', value: r => STAGE_META[r.stage].label, filter: 'select',
      render: r => (
        <select value={r.stage} onClick={e => e.stopPropagation()} aria-label={`Etapa de ${r.candidate.fullName}`}
          onChange={e => updateApp.mutate({ id: r.id, stage: e.target.value as RecruitmentStage })}
          className={`text-[11px] px-1.5 py-0.5 rounded-full border-0 ${STAGE_META[r.stage].cls}`}>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </select>
      ),
    },
    { key: 'hist', header: 'Convocatoria', value: r => r.isArchived ? 'Anterior' : 'Actual', filter: 'select', className: 'text-xs text-gray-500' },
    { key: 'phone', header: 'Teléfono', value: r => r.candidate.phone, className: 'text-xs text-gray-600 whitespace-nowrap' },
    { key: 'email', header: 'Correo', value: r => r.candidate.email, className: 'text-xs text-gray-600' },
    ...PROFILE_FIELDS.map<Column<PreselectionRow>>(f => ({
      key: f.key, header: f.label, value: r => r.candidate[f.key],
      filter: f.numeric ? 'range' : f.key === 'city' || f.key === 'availability' ? 'select' : 'text',
      align: f.numeric ? 'right' : 'left',
      render: r => f.long ? <LongText text={r.candidate[f.key] as string | null} /> : <span className="text-xs text-gray-600">{r.candidate[f.key] ?? ''}</span>,
    })),
    { key: 'source', header: 'Origen', value: r => SOURCE_LABEL[r.candidate.source], filter: 'select', className: 'text-xs text-gray-500' },
    {
      key: 'notes', header: 'Comentario', value: r => r.notes,
      render: r => <InlineInput value={r.notes ?? ''} ariaLabel={`Comentario de ${r.candidate.fullName}`} className="w-56"
        onSave={v => updateApp.mutate({ id: r.id, notes: v })} />,
    },
    {
      key: 'links', header: 'CV', value: r => r.candidate.files.length, filter: false, sortable: false,
      render: r => (
        <span className="flex items-center gap-1.5">
          {r.candidate.linkedinUrl && (
            <a href={r.candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              aria-label={`LinkedIn de ${r.candidate.fullName}`} className="text-gray-400 hover:text-[#0a66c2]"><LinkedinIcon size={13} /></a>
          )}
          {r.candidate.files.map(f => (
            <button key={f.id} onClick={e => { e.stopPropagation(); openCandidateFile(f).catch(() => alert(`No se pudo abrir ${f.fileName}`)) }}
              title={f.fileName} aria-label={`Abrir ${f.fileName}`} className="text-gray-400 hover:text-brand-600"><FileText size={13} /></button>
          ))}
        </span>
      ),
    },
  ], [criteria, updateApp, onOpenCandidate])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={openingId} onChange={e => onOpeningChange(e.target.value)} aria-label="Vacante"
          className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[260px]">
          <option value="">Elige una vacante…</option>
          {openings.map(o => <option key={o.id} value={o.id}>{o.name} ({o.active + o.archived})</option>)}
        </select>
        {openingId && (
          <button onClick={() => setShowCriteria(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            <SlidersHorizontal size={14} /> Criterios de puntaje ({criteria.length})
          </button>
        )}
        {isFetching && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      {!openingId ? (
        <p className="py-16 text-center text-sm text-gray-400">Elige una vacante para ver su tabla de preselección.</p>
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
      ) : (
        <DataTable
          rows={data.applications}
          columns={columns}
          rowKey={r => r.id}
          initialSort={{ key: 'total', dir: 'desc' }}
          emptyText="Sin postulantes con estos filtros"
          rowClassName={r => r.isArchived ? 'bg-gray-50/40' : ''}
        />
      )}

      {showCriteria && data && (
        <CriteriaModal openingId={data.opening.id} openingName={data.opening.name} criteria={criteria} onClose={() => setShowCriteria(false)} />
      )}
    </div>
  )
}
