import React, { useState, useRef } from 'react'
import { Save, Eye, Send, CheckCircle2, AlertCircle, Clock, Mail, ChevronRight, Link2, Plus, Trash2, X, Loader2, Pencil } from 'lucide-react'
import {
  useEmailTemplates, useUpdateEmailTemplate, useCreateEmailTemplate, useDeleteEmailTemplate,
  usePreviewEmailTemplate, useSendTestEmail, useEmailLogs,
  useTemplateTasks,
} from '@/hooks/useOnboarding'
import type { EmailTemplate, EmailLog } from '@/types'

// ─── Variables del sistema ────────────────────────────────────────────────────

interface VarDef { key: string; label: string; example: string }

const VARIABLES: { group: string; vars: VarDef[] }[] = [
  {
    group: 'Colaborador',
    vars: [
      { key: 'nombre',            label: 'Nombre completo',       example: 'Juan Pérez' },
      { key: 'primerNombre',      label: 'Primer nombre',         example: 'Juan' },
      { key: 'apellido',          label: 'Apellido',              example: 'Pérez' },
      { key: 'rut',               label: 'RUT',                   example: '12.345.678-9' },
      { key: 'cargo',             label: 'Cargo',                 example: 'Diseñador Gráfico' },
      { key: 'empresa',           label: 'Empresa',               example: 'Comunicaciones Surmedia' },
      { key: 'email',             label: 'Email corporativo',     example: 'juan@surmedia.cl' },
      { key: 'emailPersonal',     label: 'Email personal',        example: 'juan@gmail.com' },
      { key: 'telefono',          label: 'Teléfono',              example: '+56 9 8765 4321' },
      { key: 'jornada',           label: 'Jornada laboral',       example: 'Mensual 40.0 hrs.' },
      { key: 'supervisor',        label: 'Supervisor',            example: 'María López' },
      { key: 'afp',               label: 'AFP',                   example: 'Habitat' },
      { key: 'isapre',            label: 'Isapre / Fonasa',       example: 'Banmédica' },
      { key: 'ciudad',            label: 'Ciudad',                example: 'Santiago' },
      { key: 'comuna',            label: 'Comuna',                example: 'Las Condes' },
    ],
  },
  {
    group: 'Centro de Trabajo',
    vars: [
      { key: 'centroTrabajo',     label: 'Centro de Trabajo',     example: 'Digital Surmedia' },
      { key: 'tipoCentro',        label: 'Tipo de Centro',        example: 'Directo' },
    ],
  },
  {
    group: 'Fechas',
    vars: [
      { key: 'fechaIngreso',      label: 'Fecha de ingreso',      example: '15 de mayo de 2026' },
      { key: 'fechaIngresoCorta', label: 'Fecha ingreso (corta)', example: '15/05/2026' },
      { key: 'fechaActual',       label: 'Fecha actual',          example: '11 de mayo de 2026' },
      { key: 'año',               label: 'Año actual',            example: '2026' },
    ],
  },
  {
    group: 'Saludo y proceso',
    vars: [
      { key: 'saludoHorario',     label: 'Saludo horario',        example: 'buenos días' },
      { key: 'diaNumero',         label: 'Día del proceso',       example: '30' },
      { key: 'nombreHito',        label: 'Nombre del hito',       example: 'Foto corporativa' },
      { key: 'instruccion',       label: 'Instrucción',           example: 'Completa antes del viernes.' },
    ],
  },
]

const ALL_VARS = VARIABLES.flatMap(g => g.vars)

// ─── Modal nueva plantilla ────────────────────────────────────────────────────

function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState('')
  const [key,     setKey]     = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [error,   setError]   = useState('')
  const create = useCreateEmailTemplate()

  const derivedKey = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const displayKey = keyTouched ? key : derivedKey

  const handleSave = async () => {
    setError('')
    try {
      await create.mutateAsync({ key: displayKey.trim(), name: name.trim() })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al crear la plantilla')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Nueva plantilla de correo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Carta oferta de trabajo"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Key único</label>
            <input
              value={displayKey}
              onChange={e => { setKeyTouched(true); setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')) }}
              placeholder="se genera automáticamente"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[10px] text-gray-400 mt-1">Identificador único, solo letras minúsculas y guiones bajos.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !displayKey.trim() || create.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Crear plantilla
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Editor de template ───────────────────────────────────────────────────────

function TemplateEditor({
  template, onSave, onDirtyChange,
}: {
  template: EmailTemplate
  onSave: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [name,      setName]      = useState(template.name)
  const [editingName, setEditingName] = useState(false)
  const [subject,   setSubject]   = useState(template.subject)
  const [bodyHtml,  setBodyHtml]  = useState(template.bodyHtml)
  const [testEmail, setTestEmail] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showTest,    setShowTest]    = useState(false)
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body')

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef    = useRef<HTMLTextAreaElement>(null)

  const updateTpl  = useUpdateEmailTemplate()
  const previewTpl = usePreviewEmailTemplate()
  const sendTest   = useSendTestEmail()

  const dirty = name !== template.name || subject !== template.subject || bodyHtml !== template.bodyHtml

  React.useEffect(() => { onDirtyChange?.(dirty) }, [dirty])

  const handleSave = async () => {
    await updateTpl.mutateAsync({ key: template.key, name, subject, bodyHtml })
    onSave()
  }

  const handlePreview = async () => {
    const result = await previewTpl.mutateAsync(template.key)
    setPreviewHtml(result.html)
    setShowPreview(true)
  }

  const handleSendTest = async () => {
    if (!testEmail.trim()) return
    try {
      await sendTest.mutateAsync({ key: template.key, to: testEmail.trim() })
      alert(`Email de prueba enviado a ${testEmail}`)
      setShowTest(false)
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al enviar')
    }
  }

  const insertVar = (varKey: string) => {
    const tag = `"${varKey}"`
    if (activeField === 'subject') {
      const el = subjectRef.current
      if (!el) return
      const start = el.selectionStart ?? subject.length
      const end   = el.selectionEnd   ?? start
      const next  = subject.slice(0, start) + tag + subject.slice(end)
      setSubject(next)
      setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length) }, 0)
    } else {
      const el = bodyRef.current
      if (!el) return
      const start = el.selectionStart ?? bodyHtml.length
      const end   = el.selectionEnd   ?? start
      const next  = bodyHtml.slice(0, start) + tag + bodyHtml.slice(end)
      setBodyHtml(next)
      setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length) }, 0)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
                className="font-semibold text-gray-900 text-sm border border-blue-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
              <button
                onClick={() => setEditingName(true)}
                className="p-0.5 rounded text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
                title="Editar nombre"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Key: <code className="bg-gray-100 px-1 rounded">{template.key}</code></p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowTest(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Send size={12} /> Enviar prueba
          </button>
          <button
            onClick={handlePreview}
            disabled={previewTpl.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Eye size={12} /> Preview
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || updateTpl.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={12} /> {updateTpl.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
          Hay cambios sin guardar.
        </div>
      )}

      {showTest && (
        <div className="flex gap-2 items-center bg-blue-50 border border-blue-100 rounded-lg p-3">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            placeholder="email@ejemplo.cl"
            className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendTest}
            disabled={sendTest.isPending || !testEmail.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {sendTest.isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}

      {/* Asunto */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Asunto</label>
        <input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          onFocus={() => setActiveField('subject')}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Variables disponibles */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">
          Variables disponibles
          <span className="ml-1.5 font-normal text-gray-400">
            — clic para insertar en {activeField === 'subject' ? 'asunto' : 'cuerpo'}
          </span>
        </p>
        <div className="space-y-2">
          {VARIABLES.map(group => (
            <div key={group.group} className="flex items-start gap-2">
              <span className="text-[10px] text-gray-400 font-medium pt-0.5 w-28 flex-shrink-0">{group.group}</span>
              <div className="flex flex-wrap gap-1">
                {group.vars.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    title={`${v.label} · ej: ${v.example}`}
                    className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors font-mono"
                  >
                    "{v.key}"
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HTML body */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          Cuerpo HTML
          <span className="ml-1.5 font-normal text-gray-400">(contenido interno, sin wrapper)</span>
        </label>
        <textarea
          ref={bodyRef}
          value={bodyHtml}
          onChange={e => setBodyHtml(e.target.value)}
          onFocus={() => setActiveField('body')}
          rows={16}
          className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-medium text-sm text-gray-900">Preview: {template.name}</span>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-1">
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                className="w-full h-full min-h-[500px] border-0 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Log de emails ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  SENT:    { color: 'text-green-700 bg-green-50',  icon: <CheckCircle2 size={11} />, label: 'Enviado' },
  SKIPPED: { color: 'text-gray-500 bg-gray-50',    icon: <Clock size={11} />,        label: 'Saltado' },
  FAILED:  { color: 'text-red-700 bg-red-50',      icon: <AlertCircle size={11} />,  label: 'Error' },
}

function EmailLogTable() {
  const { data: logs = [], isLoading } = useEmailLogs()

  if (isLoading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
        <Mail size={28} className="opacity-30" />
        <p className="text-sm">No hay correos enviados todavía.</p>
      </div>
    )
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Fecha</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Para</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Asunto</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Template</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {logs.map((log: EmailLog) => {
            const st = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.SENT
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(log.sentAt)}</td>
                <td className="px-3 py-2.5 text-xs text-gray-700">{log.toEmail}</td>
                <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[240px] truncate">{log.subject}</td>
                <td className="px-3 py-2.5">
                  {log.templateKey && (
                    <code className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{log.templateKey}</code>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${st.color}`}>
                    {st.icon}{st.label}
                  </span>
                  {log.error && <p className="text-[10px] text-red-500 mt-0.5 max-w-[200px] truncate">{log.error}</p>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Panel principal Correos ──────────────────────────────────────────────────

export default function CorreosPanel() {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: templateTasks = [] }        = useTemplateTasks()
  const deleteTemplate = useDeleteEmailTemplate()

  const [selectedKey, setSelectedKey]   = useState<string | null>(null)
  const [view,        setView]          = useState<'editor' | 'log'>('editor')
  const [editorDirty, setEditorDirty]   = useState(false)
  const [showCreate,  setShowCreate]    = useState(false)

  const selected = templates.find(t => t.key === selectedKey) ?? templates[0] ?? null

  const templateToHitos = React.useMemo(() => {
    const map = new Map<string, string[]>()
    templateTasks.forEach(task => {
      const addLink = (key: string | null | undefined) => {
        if (!key) return
        const list = map.get(key) ?? []
        if (!list.includes(task.name)) list.push(task.name)
        map.set(key, list)
      }
      addLink((task.automationConfig as any)?.templateKey)
      task.subTasks?.forEach(st => addLink(st.plantilla))
    })
    return map
  }, [templateTasks])

  const handleSelectTemplate = (key: string) => {
    if (editorDirty && key !== selected?.key) {
      if (!confirm('Hay cambios sin guardar. ¿Descartar y cambiar?')) return
    }
    setSelectedKey(key)
    setEditorDirty(false)
  }

  const handleDelete = (tpl: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}"? Esta acción no se puede deshacer.`)) return
    deleteTemplate.mutate(tpl.key, {
      onSuccess: () => { if (selected?.key === tpl.key) setSelectedKey(null) },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {([['editor', 'Editor de plantillas'], ['log', 'Historial de envíos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>{l}</button>
        ))}
      </div>

      {view === 'log' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Historial de correos enviados</h3>
            <p className="text-xs text-gray-400 mt-0.5">Últimos 100 registros</p>
          </div>
          <EmailLogTable />
        </div>
      )}

      {view === 'editor' && (
        <div className="grid grid-cols-[240px_1fr] gap-5">
          {/* Sidebar */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-fit">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plantillas</p>
              <button
                onClick={() => setShowCreate(true)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                title="Nueva plantilla"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {templates.map(tpl => {
                const linkedHitos = templateToHitos.get(tpl.key) ?? []
                const isActive = selected?.key === tpl.key
                return (
                  <button
                    key={tpl.key}
                    onClick={() => handleSelectTemplate(tpl.key)}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                        {tpl.name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{tpl.key}</p>
                      {linkedHitos.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link2 size={9} className="text-indigo-400 flex-shrink-0" />
                          <span className="text-[9px] text-indigo-500 truncate" title={linkedHitos.join(', ')}>
                            {linkedHitos.length === 1 ? linkedHitos[0] : `${linkedHitos.length} hitos`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
                      <button
                        onClick={e => handleDelete(tpl, e)}
                        className="p-1 rounded text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Eliminar plantilla"
                      >
                        <Trash2 size={11} />
                      </button>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </button>
                )
              })}
              {templates.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-400">Sin plantillas. Crea la primera.</p>
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            {selected ? (
              <TemplateEditor
                key={selected.key}
                template={selected}
                onSave={() => setEditorDirty(false)}
                onDirtyChange={setEditorDirty}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <Mail size={28} className="opacity-30" />
                <p className="text-sm">Selecciona o crea una plantilla.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <NewTemplateModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
