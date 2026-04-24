import { useState, useMemo } from 'react'
import {
  Plus, Rocket, CheckCircle2, AlertTriangle, ChevronRight, X,
  Mail, Calendar, RefreshCw, Wrench, Globe, ChevronLeft,
} from 'lucide-react'
import {
  useOnboardingProcesses, useOnboardingStats,
  useCreateOnboarding, useOnboardingTemplate,
} from '@/hooks/useOnboarding'
import type { OnboardingProcess, OnboardingTemplateTask, OnboardingPeriod, TaskAutomationType } from '@/types'
import OnboardingDrawer from './OnboardingDrawer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysIn(startDate: string) {
  return Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000)
}

function calcProgress(process: OnboardingProcess) {
  const total = process.tasks.length
  if (total === 0) return 0
  return Math.round((process.tasks.filter(t => t.completedAt).length / total) * 100)
}

function initials(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
}

const STATUS_BADGE: Record<string, JSX.Element> = {
  IN_PROGRESS: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">En proceso</span>,
  COMPLETED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span>,
  CANCELLED:   <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Cancelado</span>,
}

const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

const PERIOD_ORDER: OnboardingPeriod[] = ['PRE_INGRESO', 'DIA_1', 'SEMANA_1', 'MES_1', 'EVALUACION']

const PERIOD_LABELS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'Pre Ingreso',
  DIA_1:       'Día 1',
  SEMANA_1:    'Semana 1',
  MES_1:       'Mes 1',
  EVALUACION:  'Evaluación',
}

const PERIOD_COLORS: Record<OnboardingPeriod, string> = {
  PRE_INGRESO: 'bg-violet-100 text-violet-700',
  DIA_1:       'bg-blue-100 text-blue-700',
  SEMANA_1:    'bg-cyan-100 text-cyan-700',
  MES_1:       'bg-emerald-100 text-emerald-700',
  EVALUACION:  'bg-amber-100 text-amber-700',
}

const AUTO_CONFIG: Record<TaskAutomationType, { icon: React.ReactNode; label: string; cls: string }> = {
  EMAIL:     { icon: <Mail size={10} />,       label: 'Email',    cls: 'bg-blue-100 text-blue-700' },
  CALENDAR:  { icon: <Calendar size={10} />,   label: 'Calendar', cls: 'bg-purple-100 text-purple-700' },
  BUK_CHECK: { icon: <RefreshCw size={10} />,  label: 'BUK',      cls: 'bg-orange-100 text-orange-700' },
  EXTERNAL:  { icon: <Globe size={10} />,      label: 'Externo',  cls: 'bg-cyan-100 text-cyan-700' },
  MANUAL:    { icon: <Wrench size={10} />,     label: 'Manual',   cls: 'bg-gray-100 text-gray-500' },
}

function AutoBadge({ type }: { type: TaskAutomationType }) {
  const c = AUTO_CONFIG[type]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Step 1: Datos del colaborador ────────────────────────────────────────────

interface CollaboratorForm {
  collaboratorName:     string
  collaboratorEmail:    string
  collaboratorPosition: string
  collaboratorPhone:    string
  legalEntity:          string
  startDate:            string
  notes:                string
}

function Step1({
  form, onChange, onNext, onClose,
}: {
  form: CollaboratorForm
  onChange: (f: CollaboratorForm) => void
  onNext: () => void
  onClose: () => void
}) {
  const field = (key: keyof CollaboratorForm, val: string) => onChange({ ...form, [key]: val })
  const canNext = form.collaboratorName.trim().length > 0

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900">Nuevo proceso de onboarding</h2>
          <p className="text-xs text-gray-400 mt-0.5">Paso 1 de 2 — Datos del nuevo colaborador</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
      </div>

      <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Nombre completo <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Ej: Juan Pérez Soto"
              value={form.collaboratorName}
              onChange={e => field('collaboratorName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo</label>
            <input
              type="email"
              placeholder="juan.perez@surmedia.cl"
              value={form.collaboratorEmail}
              onChange={e => field('collaboratorEmail', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
            <input
              type="text"
              placeholder="+56 9 XXXX XXXX"
              value={form.collaboratorPhone}
              onChange={e => field('collaboratorPhone', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo</label>
            <input
              type="text"
              placeholder="Ej: Diseñador Gráfico"
              value={form.collaboratorPosition}
              onChange={e => field('collaboratorPosition', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa</label>
            <select
              value={form.legalEntity}
              onChange={e => field('legalEntity', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Sin especificar</option>
              <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
              <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => field('startDate', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
            <textarea
              rows={2}
              placeholder="Información relevante para el proceso..."
              value={form.notes}
              onChange={e => field('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Seleccionar hitos <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}

// ─── Step 2: Checklist de hitos aplicables ────────────────────────────────────

function Step2({
  template, selected, onToggle, onTogglePeriod,
  onBack, onSubmit, isPending, collaboratorName,
}: {
  template: OnboardingTemplateTask[]
  selected: Set<string>
  onToggle: (id: string) => void
  onTogglePeriod: (period: OnboardingPeriod, allSelected: boolean) => void
  onBack: () => void
  onSubmit: () => void
  isPending: boolean
  collaboratorName: string
}) {
  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingTemplateTask[]>()
    for (const p of PERIOD_ORDER) map.set(p, [])
    for (const t of template) {
      const arr = map.get(t.period)
      if (arr) arr.push(t)
    }
    return map
  }, [template])

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900">Hitos aplicables</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Paso 2 de 2 — {selected.size} de {template.length} hitos seleccionados para <span className="font-medium text-gray-600">{collaboratorName}</span>
          </p>
        </div>
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
      </div>

      <div className="overflow-y-auto max-h-[58vh] divide-y divide-gray-50">
        {PERIOD_ORDER.map(period => {
          const tasks = byPeriod.get(period) ?? []
          if (tasks.length === 0) return null
          const allSelected = tasks.every(t => selected.has(t.id))
          const someSelected = tasks.some(t => selected.has(t.id))

          return (
            <div key={period} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PERIOD_COLORS[period]}`}>
                    {PERIOD_LABELS[period]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {tasks.filter(t => selected.has(t.id)).length}/{tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => onTogglePeriod(period, allSelected)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {allSelected ? 'Quitar todos' : 'Marcar todos'}
                </button>
              </div>

              <div className="space-y-1">
                {tasks.map(task => {
                  const isSelected = selected.has(task.id)
                  return (
                    <label
                      key={task.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(task.id)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                          {task.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <AutoBadge type={task.automationType} />
                          {task.tool && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">
                              {task.tool}
                            </span>
                          )}
                          {task.appliesWhen && (
                            <span className="text-[10px] text-gray-400 italic">{task.appliesWhen}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={14} /> Atrás
        </button>
        <button
          onClick={onSubmit}
          disabled={selected.size === 0 || isPending}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isPending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando...</>
          ) : (
            <><Rocket size={14} /> Iniciar onboarding ({selected.size} hitos)</>
          )}
        </button>
      </div>
    </>
  )
}

// ─── Modal: Nuevo proceso ──────────────────────────────────────────────────────

function NewProcessModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<CollaboratorForm>({
    collaboratorName:     '',
    collaboratorEmail:    '',
    collaboratorPosition: '',
    collaboratorPhone:    '',
    legalEntity:          '',
    startDate:            '',
    notes:                '',
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: template = [] } = useOnboardingTemplate()
  const createOnboarding = useCreateOnboarding()

  const handleGoToStep2 = () => {
    if (selected.size === 0 && template.length > 0) {
      setSelected(new Set(template.map(t => t.id)))
    }
    setStep(2)
  }

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleTogglePeriod = (period: OnboardingPeriod, allSelected: boolean) => {
    const ids = template.filter(t => t.period === period).map(t => t.id)
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const handleSubmit = async () => {
    try {
      const process = await createOnboarding.mutateAsync({
        collaboratorName:      form.collaboratorName.trim(),
        collaboratorEmail:     form.collaboratorEmail.trim() || undefined,
        collaboratorPosition:  form.collaboratorPosition.trim() || undefined,
        collaboratorPhone:     form.collaboratorPhone.trim() || undefined,
        legalEntity:           form.legalEntity || undefined,
        startDate:             form.startDate || undefined,
        notes:                 form.notes.trim() || undefined,
        selectedTaskIds:       Array.from(selected),
      })
      onCreated(process.id)
      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al crear el proceso')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {step === 1 ? (
          <Step1
            form={form}
            onChange={setForm}
            onNext={handleGoToStep2}
            onClose={onClose}
          />
        ) : (
          <Step2
            template={template}
            selected={selected}
            onToggle={handleToggle}
            onTogglePeriod={handleTogglePeriod}
            onBack={() => setStep(1)}
            onSubmit={handleSubmit}
            isPending={createOnboarding.isPending}
            collaboratorName={form.collaboratorName}
          />
        )}
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [drawerProcessId, setDrawerProcessId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal]       = useState(false)
  const [filterStatus, setFilterStatus]       = useState<string>('IN_PROGRESS')

  const { data: processes, isLoading, isError } = useOnboardingProcesses()
  const { data: stats } = useOnboardingStats()

  const filtered = (processes ?? []).filter(p =>
    filterStatus === 'ALL' ? true : p.status === filterStatus
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento de ingreso — primeros 90 días</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nuevo proceso
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'En proceso',    value: stats?.inProgress    ?? '—', icon: <Rocket size={18} />,        color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Completados',   value: stats?.completed     ?? '—', icon: <CheckCircle2 size={18} />,  color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Por finalizar', value: stats?.finalizingSoon ?? '—', icon: <AlertTriangle size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cancelados',    value: stats?.cancelled     ?? '—', icon: <X size={18} />,             color: 'text-gray-500',  bg: 'bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { value: 'IN_PROGRESS', label: 'En proceso' },
          { value: 'COMPLETED',   label: 'Completados' },
          { value: 'CANCELLED',   label: 'Cancelados' },
          { value: 'ALL',         label: 'Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterStatus === f.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <AlertTriangle size={32} />
            <p className="text-sm">Error cargando datos. Intenta nuevamente.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Rocket size={40} className="opacity-30" />
            <p className="text-sm font-medium">
              No hay procesos {filterStatus === 'IN_PROGRESS' ? 'activos' : 'en esta categoría'}
            </p>
            {filterStatus === 'IN_PROGRESS' && (
              <button onClick={() => setShowNewModal(true)} className="text-sm text-blue-600 hover:underline">
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Ingreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">Día</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Progreso</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(process => {
                const progress   = calcProgress(process)
                const days       = daysIn(process.startDate)
                const shortName  = ENTITY_LABEL[process.legalEntity ?? ''] ?? '—'
                const avatarText = initials(process.collaboratorName)

                return (
                  <tr
                    key={process.id}
                    onClick={() => setDrawerProcessId(process.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0 uppercase">
                          {avatarText}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{process.collaboratorName}</p>
                          <p className="text-xs text-gray-400">{process.collaboratorPosition ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{shortName}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell whitespace-nowrap">
                      {fmt(process.startDate)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${days > 90 ? 'text-amber-600' : 'text-gray-600'}`}>
                        Día {days}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#3b82f6' }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{STATUS_BADGE[process.status]}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {drawerProcessId && (
        <OnboardingDrawer
          processId={drawerProcessId}
          onClose={() => setDrawerProcessId(null)}
        />
      )}

      {/* New process modal */}
      {showNewModal && (
        <NewProcessModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setDrawerProcessId(id); setShowNewModal(false) }}
        />
      )}
    </div>
  )
}
