import React, { useState, useMemo, useEffect } from 'react'
import {
  Plus, Rocket, CheckCircle2, AlertTriangle, X, ChevronRight,
  Mail, Calendar, RefreshCw, Wrench, Globe,
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

function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
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
  const c = AUTO_CONFIG[type] ?? { icon: null, label: type, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Modal: Nuevo proceso (página única) ─────────────────────────────────────

function NewProcessModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    collaboratorName: '', collaboratorEmail: '', collaboratorPosition: '',
    collaboratorPhone: '', legalEntity: '', startDate: '', notes: '',
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: template = [], isLoading: templateLoading } = useOnboardingTemplate()
  const createOnboarding = useCreateOnboarding()

  useEffect(() => {
    if (template.length > 0 && selected.size === 0)
      setSelected(new Set(template.map(t => t.id)))
  }, [template])

  const field = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const togglePeriod = (period: OnboardingPeriod) => {
    const ids = template.filter(t => t.period === period).map(t => t.id)
    const allOn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev); ids.forEach(id => allOn ? next.delete(id) : next.add(id)); return next
    })
  }

  const handleSubmit = async () => {
    try {
      const process = await createOnboarding.mutateAsync({
        collaboratorName:     form.collaboratorName.trim(),
        collaboratorEmail:    form.collaboratorEmail.trim() || undefined,
        collaboratorPosition: form.collaboratorPosition.trim() || undefined,
        collaboratorPhone:    form.collaboratorPhone.trim() || undefined,
        legalEntity:          form.legalEntity || undefined,
        startDate:            form.startDate || undefined,
        notes:                form.notes.trim() || undefined,
        selectedTaskIds:      Array.from(selected),
      })
      onCreated(process.id); onClose()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al crear el proceso')
    }
  }

  const byPeriod = useMemo(() => {
    const map = new Map<OnboardingPeriod, OnboardingTemplateTask[]>()
    PERIOD_ORDER.forEach(p => map.set(p, []))
    template.forEach(t => map.get(t.period)?.push(t))
    return map
  }, [template])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Nuevo proceso de onboarding</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selected.size} de {template.length} hitos seleccionados</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Datos del colaborador */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre completo <span className="text-red-400">*</span></label>
              <input autoFocus type="text" placeholder="Ej: Juan Pérez Soto" value={form.collaboratorName}
                onChange={e => field('collaboratorName', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email corporativo</label>
              <input type="email" placeholder="juan.perez@surmedia.cl" value={form.collaboratorEmail}
                onChange={e => field('collaboratorEmail', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Teléfono</label>
              <input type="text" placeholder="+56 9 XXXX XXXX" value={form.collaboratorPhone}
                onChange={e => field('collaboratorPhone', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo</label>
              <input type="text" placeholder="Ej: Diseñador Gráfico" value={form.collaboratorPosition}
                onChange={e => field('collaboratorPosition', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Empresa</label>
              <select value={form.legalEntity} onChange={e => field('legalEntity', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Sin especificar</option>
                <option value="COMUNICACIONES_SURMEDIA">Comunicaciones Surmedia Spa</option>
                <option value="SURMEDIA_CONSULTORIA">Surmedia Consultoría Spa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha de ingreso</label>
              <input type="date" value={form.startDate} onChange={e => field('startDate', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas internas</label>
              <textarea rows={2} placeholder="Información relevante para el proceso..." value={form.notes}
                onChange={e => field('notes', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>

          {/* Hitos */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hitos del proceso</p>
            {templateLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Cargando hitos…
              </div>
            ) : (
              <div className="space-y-4">
                {PERIOD_ORDER.map(period => {
                  const tasks = byPeriod.get(period) ?? []
                  if (tasks.length === 0) return null
                  const allOn = tasks.every(t => selected.has(t.id))
                  return (
                    <div key={period}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PERIOD_COLORS[period]}`}>
                          {PERIOD_LABELS[period]}
                        </span>
                        <button onClick={() => togglePeriod(period)} className="text-xs text-blue-600 hover:text-blue-800">
                          {allOn ? 'Quitar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {tasks.map(task => (
                          <label key={task.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                            selected.has(task.id) ? 'bg-blue-50 border-blue-100' : 'border-transparent hover:bg-gray-50'
                          }`}>
                            <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${selected.has(task.id) ? 'text-gray-900' : 'text-gray-500'}`}>{task.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <AutoBadge type={task.automationType} />
                                {task.tool && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{task.tool}</span>}
                                {task.appliesWhen && <span className="text-[10px] text-gray-400 italic">{task.appliesWhen}</span>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!form.collaboratorName.trim() || selected.size === 0 || createOnboarding.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createOnboarding.isPending
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando...</>
              : <><Rocket size={14} /> Iniciar onboarding ({selected.size} hitos)</>
            }
          </button>
        </div>
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
  useOnboardingTemplate() // prefetch so template is ready when modal opens

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
