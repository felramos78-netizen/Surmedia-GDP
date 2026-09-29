import { useMemo, useState } from 'react'
import { Briefcase, FolderSearch, Loader2, MapPin, LayoutGrid, Table2 } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import { useJobOpenings, useUpdateJobOpening, STAGES, STAGE_META, type JobOpening } from '@/hooks/useRecruitment'

const VIEW_KEY = 'gdp_recruitment_openings_view'

export default function OpeningsView({ onOpenOpening, onOpenPreselection, onImport }: {
  onOpenOpening: (id: string) => void
  onOpenPreselection: (id: string) => void
  onImport: () => void
}) {
  const { data: openings = [], isLoading } = useJobOpenings()
  const update = useUpdateJobOpening()
  const [mode, setMode] = useState<'cards' | 'table'>(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards' } catch { return 'cards' }
  })
  const changeMode = (m: 'cards' | 'table') => {
    setMode(m)
    try { localStorage.setItem(VIEW_KEY, m) } catch { /* sin almacenamiento: solo esta sesión */ }
  }

  const columns = useMemo<Column<JobOpening>[]>(() => [
    {
      key: 'name', header: 'Vacante', value: o => o.name, className: 'whitespace-nowrap',
      render: o => <button onClick={() => onOpenOpening(o.id)} className="font-medium text-gray-800 hover:text-brand-700 text-left">{o.name}</button>,
    },
    { key: 'city', header: 'Ciudad', value: o => o.city, filter: 'select', className: 'text-xs text-gray-600' },
    {
      key: 'status', header: 'Estado', value: o => o.status === 'CERRADA' ? 'Cerrada' : 'Abierta', filter: 'select',
      render: o => <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${o.status === 'CERRADA' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{o.status}</span>,
    },
    { key: 'total', header: 'Postulantes', value: o => o.active + o.archived, filter: 'range', align: 'right' },
    { key: 'active', header: 'Actuales', value: o => o.active, filter: 'range', align: 'right' },
    { key: 'archived', header: 'Históricos', value: o => o.archived, filter: 'range', align: 'right' },
    ...STAGES.map<Column<JobOpening>>(st => ({
      key: st, header: STAGE_META[st].label, value: o => o.byStage[st], filter: 'range', align: 'right',
      render: o => o.byStage[st] ? <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${STAGE_META[st].cls}`}>{o.byStage[st]}</span> : <span className="text-gray-300">0</span>,
    })),
    {
      key: 'actions', header: '', value: () => null, filter: false, sortable: false, className: 'whitespace-nowrap text-right',
      render: o => (
        <span className="inline-flex gap-3 text-xs">
          <button onClick={() => onOpenPreselection(o.id)} className="text-brand-600 hover:underline">Preselección</button>
          <button onClick={() => onOpenOpening(o.id)} className="text-brand-600 hover:underline">Candidatos</button>
          <button onClick={() => update.mutate({ id: o.id, status: o.status === 'CERRADA' ? 'ABIERTA' : 'CERRADA' })} className="text-gray-400 hover:text-gray-700">
            {o.status === 'CERRADA' ? 'Reabrir' : 'Cerrar'}
          </button>
        </span>
      ),
    },
  ], [onOpenOpening, onOpenPreselection, update])

  const toggle = (
    <div className="flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Vista">
      {([['cards', LayoutGrid, 'Tarjetas'], ['table', Table2, 'Tabla']] as const).map(([m, Icon, label]) => (
        <button key={m} onClick={() => changeMode(m)} aria-pressed={mode === m}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${mode === m ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  )

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400">
      <Loader2 size={16} className="animate-spin" /> Cargando vacantes…
    </div>
  )

  if (openings.length === 0) return (
    <div className="py-16 text-center">
      <FolderSearch size={30} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-600">Aún no hay vacantes ni candidatos.</p>
      <p className="text-xs text-gray-400 mt-1">Cada carpeta de Reclutamiento en Drive se convierte en una vacante al importar.</p>
      <button onClick={onImport} className="mt-4 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700">
        Importar CVs desde Drive
      </button>
    </div>
  )

  if (mode === 'table') return (
    <DataTable rows={openings} columns={columns} rowKey={o => o.id} initialSort={{ key: 'name', dir: 'asc' }} toolbar={toggle} />
  )

  return (
    <div className="space-y-2">
    <div className="flex justify-end">{toggle}</div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {openings.map(o => {
        const closed = o.status === 'CERRADA'
        return (
          <div key={o.id} className={`rounded-xl border bg-white p-4 flex flex-col gap-3 ${closed ? 'border-gray-100 opacity-70' : 'border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                <Briefcase size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => onOpenOpening(o.id)} className="text-sm font-semibold text-gray-900 hover:text-brand-700 text-left">
                  {o.name}
                </button>
                <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                  {o.city && <span className="inline-flex items-center gap-0.5"><MapPin size={10} />{o.city}</span>}
                  <span>{o.active} activos{o.archived > 0 && ` · ${o.archived} históricos`}</span>
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${closed ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {closed ? 'CERRADA' : 'ABIERTA'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {STAGES.filter(s => o.byStage[s] > 0).map(s => (
                <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full ${STAGE_META[s].cls}`}>
                  {STAGE_META[s].label} {o.byStage[s]}
                </span>
              ))}
              {o.active === 0 && <span className="text-[11px] text-gray-400">Solo postulaciones históricas</span>}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-50">
              <span className="flex gap-3">
                <button onClick={() => onOpenPreselection(o.id)} className="text-xs font-medium text-brand-600 hover:underline">Preselección</button>
                <button onClick={() => onOpenOpening(o.id)} className="text-xs font-medium text-brand-600 hover:underline">Candidatos →</button>
              </span>
              <button
                onClick={() => update.mutate({ id: o.id, status: closed ? 'ABIERTA' : 'CERRADA' })}
                disabled={update.isPending}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                {closed ? 'Reabrir' : 'Cerrar vacante'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}
