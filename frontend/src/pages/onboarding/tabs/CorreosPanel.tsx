import React, { useState, useRef } from 'react'
import { Save, Eye, Send, CheckCircle2, AlertCircle, Clock, Mail, ChevronRight } from 'lucide-react'
import {
  useEmailTemplates, useUpdateEmailTemplate,
  usePreviewEmailTemplate, useSendTestEmail, useEmailLogs,
} from '@/hooks/useOnboarding'
import type { EmailTemplate, EmailLog } from '@/types'

// ─── Editor de template ───────────────────────────────────────────────────────

function TemplateEditor({ template, onSave }: { template: EmailTemplate; onSave: () => void }) {
  const [subject,  setSubject]  = useState(template.subject)
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml)
  const [testEmail, setTestEmail] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showTest, setShowTest] = useState(false)

  const updateTpl  = useUpdateEmailTemplate()
  const previewTpl = usePreviewEmailTemplate()
  const sendTest   = useSendTestEmail()

  const dirty = subject !== template.subject || bodyHtml !== template.bodyHtml

  const handleSave = async () => {
    await updateTpl.mutateAsync({ key: template.key, subject, bodyHtml })
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header del template */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Key: <code className="bg-gray-100 px-1 rounded">{template.key}</code></p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Envío de prueba */}
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
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Variables disponibles */}
      {template.variables.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Variables disponibles</p>
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map(v => (
              <code
                key={v.name}
                title={`Ejemplo: ${v.example}`}
                className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded cursor-default hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {`{${v.name}}`}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* HTML body */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          Cuerpo HTML <span className="text-gray-400 font-normal">(contenido interno, sin wrapper)</span>
        </label>
        <textarea
          value={bodyHtml}
          onChange={e => setBodyHtml(e.target.value)}
          rows={14}
          className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-medium text-sm text-gray-900">Preview: {template.name}</span>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-700">✕</button>
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [view, setView] = useState<'editor' | 'log'>('editor')

  const selected = templates.find(t => t.key === selectedKey) ?? templates[0] ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Vista selector */}
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
          {/* Lista de templates */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-fit">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plantillas</p>
            </div>
            <div className="divide-y divide-gray-50">
              {templates.map(tpl => (
                <button
                  key={tpl.key}
                  onClick={() => setSelectedKey(tpl.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    (selected?.key === tpl.key) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${selected?.key === tpl.key ? 'text-blue-700' : 'text-gray-800'}`}>
                      {tpl.name}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{tpl.key}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            {selected ? (
              <TemplateEditor key={selected.key} template={selected} onSave={() => {}} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <Mail size={28} className="opacity-30" />
                <p className="text-sm">Selecciona una plantilla para editarla.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
