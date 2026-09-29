import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Paperclip } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import { AiBatchBar } from './AiPanel'
import { LinkedinIcon } from '@/components/ui/LinkedinIcon'
import {
  useCandidates, useJobOpenings, STAGE_META, SOURCE_LABEL, PROFILE_FIELDS,
  type CandidateFilters, type CandidateListItem,
} from '@/hooks/useRecruitment'

const selectCls = 'px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500'

export default function CandidatesView({ filters, onFiltersChange, onOpenCandidate, onReviewAi }: {
  filters: Required<CandidateFilters>
  onFiltersChange: (f: Required<CandidateFilters>) => void
  onOpenCandidate: (id: string) => void
  onReviewAi: () => void
}) {
  const { data: openings = [] } = useJobOpenings()
  const { data: candidates = [], isLoading, isFetching } = useCandidates(filters)
  const [q, setQ] = useState(filters.q)

  // Búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    if (q === filters.q) return
    const t = setTimeout(() => onFiltersChange({ ...filters, q }), 300)
    return () => clearTimeout(t)
  }, [q])

  const set = (k: keyof CandidateFilters, v: string) => onFiltersChange({ ...filters, [k]: v })

  const columns = useMemo<Column<CandidateListItem>[]>(() => [
    {
      key: 'name', header: 'Nombre', value: c => c.fullName, className: 'whitespace-nowrap',
      render: c => <span className="font-medium text-gray-800">{c.fullName}</span>,
    },
    {
      key: 'openings', header: 'Vacantes', value: c => c.applications.map(a => a.jobOpening.name).join(', '),
      render: c => (
        <div className="flex flex-wrap gap-1 max-w-[260px]">
          {c.applications.map(a => (
            <span key={a.id} className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_META[a.stage].cls} ${a.isArchived ? 'opacity-60' : ''}`}
              title={`${STAGE_META[a.stage].label}${a.isArchived ? ' (convocatoria anterior)' : ''}`}>
              {a.jobOpening.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'stage', header: 'Mejor etapa', filter: 'select',
      // La etapa más avanzada entre sus postulaciones (Descartado cuenta como la menor)
      value: c => {
        const order = ['DESCARTADO', 'RECIBIDO', 'EN_REVISION', 'PRESELECCIONADO', 'ENTREVISTA', 'OFERTA', 'CONTRATADO'] as const
        const best = [...c.applications].sort((a, b) => order.indexOf(b.stage) - order.indexOf(a.stage))[0]
        return best ? STAGE_META[best.stage].label : null
      },
      className: 'text-xs text-gray-600 whitespace-nowrap',
    },
    { key: 'email', header: 'Correo', value: c => c.email, className: 'text-xs text-gray-600' },
    { key: 'phone', header: 'Teléfono', value: c => c.phone, className: 'text-xs text-gray-600 whitespace-nowrap' },
    ...PROFILE_FIELDS.filter(f => !f.long).map<Column<CandidateListItem>>(f => ({
      key: f.key, header: f.label, value: c => c[f.key],
      filter: f.numeric ? 'range' : f.key === 'city' || f.key === 'availability' ? 'select' : 'text',
      align: f.numeric ? 'right' : 'left', className: 'text-xs text-gray-600',
    })),
    ...PROFILE_FIELDS.filter(f => f.long).map<Column<CandidateListItem>>(f => ({
      key: f.key, header: f.label, value: c => c[f.key],
      render: c => c[f.key] ? <span className="block max-w-[240px] line-clamp-2 text-xs text-gray-600" title={String(c[f.key])}>{c[f.key]}</span> : null,
    })),
    { key: 'source', header: 'Origen', value: c => SOURCE_LABEL[c.source], filter: 'select', className: 'text-xs text-gray-500' },
    {
      key: 'linkedin', header: 'LinkedIn', value: c => c.linkedinUrl ? 'Sí' : 'No', filter: 'select', align: 'center',
      render: c => c.linkedinUrl ? (
        <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          aria-label={`LinkedIn de ${c.fullName}`} className="inline-flex text-gray-400 hover:text-[#0a66c2]"><LinkedinIcon size={14} /></a>
      ) : null,
    },
    {
      key: 'files', header: 'CVs', value: c => c._count.files, filter: 'range', align: 'right',
      render: c => <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400"><Paperclip size={11} />{c._count.files}</span>,
    },
    { key: 'createdAt', header: 'En GDP desde', value: c => c.createdAt.slice(0, 10), className: 'text-xs text-gray-400 whitespace-nowrap',
      render: c => new Date(c.createdAt).toLocaleDateString('es-CL') },
  ], [])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono o RUT…"
            aria-label="Buscar candidatos"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select value={filters.openingId} onChange={e => set('openingId', e.target.value)} aria-label="Vacante" className={selectCls}>
          <option value="">Todas las vacantes</option>
          {openings.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={filters.archived} onChange={e => set('archived', e.target.value)} aria-label="Convocatoria" className={selectCls}>
          <option value="">Todas las postulaciones</option>
          <option value="current">Solo convocatorias actuales</option>
          <option value="only">Solo convocatorias anteriores</option>
        </select>
        {isFetching && <Loader2 size={14} className="animate-spin text-gray-400" />}
      </div>

      <AiBatchBar candidates={candidates} onReview={onReviewAi} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Cargando candidatos…
        </div>
      ) : (
        <DataTable
          rows={candidates}
          columns={columns}
          rowKey={c => c.id}
          onRowClick={c => onOpenCandidate(c.id)}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyText="No hay candidatos con estos filtros"
        />
      )}
    </div>
  )
}
