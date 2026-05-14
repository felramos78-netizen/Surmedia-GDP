import React, { useState, useRef } from 'react'
import {
  Upload, FileText, Trash2, Link2, Plus, X, Download, Loader2,
  ChevronRight, FileDown, AlertCircle, Mail,
} from 'lucide-react'
import {
  useDocuments, useUploadDocument, useDeleteDocument,
  useLinkDocument, useUnlinkDocument, useUpdateDocumentLink,
  useEmailTemplates,
} from '@/hooks/useOnboarding'
import type { OnboardingDocument, OnboardingDocumentTemplate } from '@/types'
import api from '@/lib/api'

// ─── Modal: vincular documento a plantilla ────────────────────────────────────

function LinkModal({
  doc,
  existingKeys,
  onClose,
}: {
  doc: OnboardingDocument
  existingKeys: string[]
  onClose: () => void
}) {
  const { data: templates = [] } = useEmailTemplates()
  const linkDoc = useLinkDocument()
  const [templateKey, setTemplateKey] = useState('')
  const [sendAs, setSendAs] = useState<'WORD' | 'PDF'>('WORD')
  const [error, setError] = useState('')

  const available = templates.filter(t => !existingKeys.includes(t.key))

  const handleSave = async () => {
    if (!templateKey) { setError('Selecciona una plantilla'); return }
    setError('')
    try {
      await linkDoc.mutateAsync({ id: doc.id, templateKey, sendAs })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al vincular')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Vincular a plantilla de correo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Plantilla de correo
            </label>
            {available.length === 0 ? (
              <p className="text-xs text-gray-400">Ya está vinculado a todas las plantillas disponibles.</p>
            ) : (
              <select
                value={templateKey}
                onChange={e => setTemplateKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar plantilla…</option>
                {available.map(t => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Formato al enviar
            </label>
            <div className="flex gap-3">
              {(['WORD', 'PDF'] as const).map(f => (
                <label key={f} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendAs"
                    value={f}
                    checked={sendAs === f}
                    onChange={() => setSendAs(f)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {f === 'WORD' ? 'Word (.docx)' : 'PDF'}
                  </span>
                  {f === 'PDF' && (
                    <span className="text-[10px] text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Requiere LibreOffice
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!templateKey || linkDoc.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {linkDoc.isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            Vincular
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel de detalle de documento ───────────────────────────────────────────

function DocDetail({ doc }: { doc: OnboardingDocument }) {
  const { data: templates = [] } = useEmailTemplates()
  const unlink = useUnlinkDocument()
  const updateLink = useUpdateDocumentLink()
  const deleteDoc = useDeleteDocument()
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [renderLoading, setRenderLoading] = useState<string | null>(null)

  const existingKeys = doc.templateLinks.map(l => l.templateKey)

  const getTemplateName = (key: string) =>
    templates.find(t => t.key === key)?.name ?? key

  const handleUnlink = async (link: OnboardingDocumentTemplate) => {
    if (!confirm(`¿Desvincular de "${getTemplateName(link.templateKey)}"?`)) return
    await unlink.mutateAsync({ id: doc.id, templateKey: link.templateKey })
  }

  const handleToggleSendAs = async (link: OnboardingDocumentTemplate) => {
    const next = link.sendAs === 'WORD' ? 'PDF' : 'WORD'
    await updateLink.mutateAsync({ id: doc.id, templateKey: link.templateKey, sendAs: next })
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el documento "${doc.name}"? Esta acción no se puede deshacer.`)) return
    await deleteDoc.mutateAsync(doc.id)
  }

  const handleDownloadOriginal = () => {
    const a = document.createElement('a')
    a.href = `${api.defaults.baseURL}/onboarding/documents/${doc.id}/download`
    a.download = doc.fileName
    a.click()
  }

  const handleRender = async (processId?: string) => {
    const key = processId ?? 'sample'
    setRenderLoading(key)
    try {
      const resp = await api.post(
        `/onboarding/documents/${doc.id}/render`,
        { vars: makeSampleVars(), format: 'WORD' },
        { responseType: 'blob' }
      )
      const fallback = resp.headers['x-pdf-fallback'] === 'true'
      const blob = new Blob([resp.data], {
        type: fallback
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : resp.headers['content-type'],
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fallback ? doc.fileName : doc.fileName.replace('.docx', '.pdf')
      a.click()
      URL.revokeObjectURL(url)
      if (fallback) alert('LibreOffice no está disponible. Se descargó el documento en formato Word.')
    } catch (err: any) {
      alert(`Error al renderizar: ${err?.response?.data?.message ?? err.message}`)
    } finally {
      setRenderLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-sm">{doc.name}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-7">{doc.fileName}</p>
          {doc.description && <p className="text-xs text-gray-500 mt-1 ml-7">{doc.description}</p>}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleDownloadOriginal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Descargar archivo original"
          >
            <Download size={12} /> Original
          </button>
          <button
            onClick={() => handleRender()}
            disabled={!!renderLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Vista previa con datos de ejemplo"
          >
            {renderLoading === 'sample' ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
            Vista previa
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-300 hover:text-red-400 border border-gray-200 rounded-lg hover:bg-red-50 transition-colors"
            title="Eliminar documento"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Variables hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
        <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-amber-700">Variables en el documento Word</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Escribe variables usando la sintaxis <code className="bg-amber-100 px-1 rounded">{'{{nombre}}'}</code> en el documento Word.
            Ej: <code className="bg-amber-100 px-1 rounded">{'{{cargo}}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{fechaIngreso}}'}</code>, <code className="bg-amber-100 px-1 rounded">{'{{empresa}}'}</code>.
          </p>
        </div>
      </div>

      {/* Plantillas vinculadas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Plantillas de correo vinculadas</p>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus size={12} /> Vincular
          </button>
        </div>

        {doc.templateLinks.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 text-center">
            <Link2 size={20} className="text-gray-300 mx-auto mb-1.5" />
            <p className="text-xs text-gray-400">No vinculado a ninguna plantilla de correo</p>
            <button onClick={() => setShowLinkModal(true)} className="text-xs text-blue-500 mt-1 hover:underline">
              Vincular ahora
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {doc.templateLinks.map(link => (
              <div key={link.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={13} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{getTemplateName(link.templateKey)}</p>
                    <p className="text-[10px] text-gray-400">{link.templateKey}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleSendAs(link)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                      link.sendAs === 'PDF'
                        ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                        : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                    }`}
                    title="Clic para cambiar formato"
                  >
                    {link.sendAs === 'PDF' ? 'PDF' : 'Word'}
                  </button>
                  <button
                    onClick={() => handleUnlink(link)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                    title="Desvincular"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLinkModal && (
        <LinkModal
          doc={doc}
          existingKeys={existingKeys}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  )
}

// Variables de muestra para vista previa
function makeSampleVars(): Record<string, string> {
  return {
    nombre: 'Juan Pérez Ejemplo',
    primerNombre: 'Juan',
    apellido: 'Pérez Ejemplo',
    rut: '12.345.678-9',
    cargo: 'Diseñador Gráfico',
    empresa: 'Comunicaciones Surmedia Spa',
    email: 'juan.perez@surmedia.cl',
    emailPersonal: 'juanperez@gmail.com',
    telefono: '+56 9 8765 4321',
    centroTrabajo: 'Digital Surmedia',
    fechaIngreso: '15 de mayo de 2026',
    fechaIngresoCorta: '15/05/2026',
    fechaActual: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    año: new Date().getFullYear().toString(),
    supervisor: 'María López',
    jornada: 'Mensual 40.0 hrs. (L, M, M, J, V)',
    ciudad: 'Santiago',
    comuna: 'Las Condes',
    afp: 'Habitat',
    isapre: 'Banmédica',
    saludoHorario: 'buenos días',
    diaNumero: '1',
    instruccion: 'Por favor realiza esta acción antes del viernes.',
  }
}

// ─── Panel principal Documentos ───────────────────────────────────────────────

export default function DocumentosPanel() {
  const { data: docs = [], isLoading } = useDocuments()
  const upload = useUploadDocument()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const selected = docs.find(d => d.id === selectedId) ?? docs[0] ?? null

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) {
      alert('Solo se aceptan archivos .docx')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace('.docx', ''))
      const doc = await upload.mutateAsync(formData)
      setSelectedId(doc.id)
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al subir el documento')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-5">
      {/* Sidebar */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden h-fit">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentos Word</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
            title="Subir documento .docx"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {docs.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <FileText size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400 mb-3">Sin documentos. Sube el primero.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mx-auto"
            >
              <Upload size={12} /> Subir .docx
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {docs.map(doc => {
              const isActive = selected?.id === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{doc.fileName}</p>
                    {doc.templateLinks.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Link2 size={9} className="text-indigo-400" />
                        <span className="text-[9px] text-indigo-500">
                          {doc.templateLinks.length} plantilla{doc.templateLinks.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0 ml-1" />
                </button>
              )
            })}
          </div>
        )}

        {/* Drop zone hint */}
        <div
          className="mx-3 mb-3 mt-2 border-2 border-dashed border-gray-200 rounded-lg py-3 text-center cursor-pointer hover:border-blue-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-[10px] text-gray-400">Clic o arrastra un .docx aquí</p>
        </div>
      </div>

      {/* Detail */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        {selected ? (
          <DocDetail key={selected.id} doc={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <FileText size={32} className="opacity-20" />
            <p className="text-sm">Selecciona o sube un documento Word</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              <Upload size={14} /> Subir .docx
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
