import { useSearchParams } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import OpeningsView from './OpeningsView'
import CandidatesView from './CandidatesView'
import DriveImportView from './DriveImportView'
import PreselectionView from './PreselectionView'
import CandidateDrawer from './CandidateDrawer'
import { AiReviewView } from './AiPanel'
import { useAiSuggestions } from '@/hooks/useRecruitment'

const VIEWS = [
  { value: 'vacantes',   label: 'Vacantes' },
  { value: 'candidatos', label: 'Candidatos' },
  { value: 'preseleccion', label: 'Preselección' },
  { value: 'importar',   label: 'Importar desde Drive' },
  { value: 'revision-ia', label: 'Revisión IA' },
] as const
type View = typeof VIEWS[number]['value']

export default function RecruitmentPage() {
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista')
  const view: View = VIEWS.some(v => v.value === vista) ? vista as View : 'vacantes'
  const { data: aiSuggestions = [] } = useAiSuggestions()
  const candidateId = params.get('candidato')

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k)
    setParams(next)
  }

  if (!hasRole('ADMIN', 'RRHH_MANAGER', 'RRHH_ANALYST')) return (
    <div className="p-6 py-24 text-center">
      <ShieldAlert size={28} className="text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">Solo el equipo de RRHH puede ver la base de candidatos.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reclutamiento</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Base de CVs por vacante. Los archivos siguen en la carpeta de Reclutamiento de Drive; GDP guarda los datos de cada candidato.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => {
              const vacante = params.get('vacante')
              setParams(v.value === 'vacantes' ? {} : v.value === 'preseleccion' && vacante ? { vista: v.value, vacante } : { vista: v.value })
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === v.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
            {v.value === 'revision-ia' && aiSuggestions.length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{aiSuggestions.length}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'vacantes' && (
        <OpeningsView
          onOpenOpening={id => setParams({ vista: 'candidatos', vacante: id })}
          onOpenPreselection={id => setParams({ vista: 'preseleccion', vacante: id })}
          onImport={() => setParams({ vista: 'importar' })}
        />
      )}
      {view === 'candidatos' && (
        <CandidatesView
          filters={{
            q:         params.get('q') ?? '',
            openingId: params.get('vacante') ?? '',
            stage:     params.get('etapa') ?? '',
            source:    params.get('origen') ?? '',
            archived:  (params.get('historicos') ?? '') as '' | 'current' | 'only',
          }}
          onFiltersChange={f => update({ q: f.q || null, vacante: f.openingId || null, etapa: f.stage || null, origen: f.source || null, historicos: f.archived || null })}
          onOpenCandidate={id => update({ candidato: id })}
          onReviewAi={() => setParams({ vista: 'revision-ia' })}
        />
      )}
      {view === 'revision-ia' && <AiReviewView onDone={() => setParams({ vista: 'candidatos' })} />}
      {view === 'preseleccion' && (
        <PreselectionView
          openingId={params.get('vacante') ?? ''}
          onOpeningChange={id => update({ vacante: id || null })}
          onOpenCandidate={id => update({ candidato: id })}
        />
      )}
      {view === 'importar' && <DriveImportView onDone={() => setParams({ vista: 'candidatos' })} />}

      {candidateId && <CandidateDrawer candidateId={candidateId} onClose={() => update({ candidato: null })} />}
    </div>
  )
}
