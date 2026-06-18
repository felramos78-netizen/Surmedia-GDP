// Modales del módulo Onboarding: verificación de Google Sheet, previsualización
// de correo y creación de evento de Google Calendar. Extraído de OnboardingDrawer.tsx.
import React, { useState, useRef } from 'react'
import { X, AlertTriangle, Loader2, Check, CheckCircle2, ExternalLink, Mail, ChevronUp, ChevronDown, FileText, Paperclip, Download, Calendar, Pencil, Save, RotateCcw, Trash2 } from 'lucide-react'
import { useVerifySheet, useApplySheetData, useUpdateTask, useEmailTemplates, useDocuments, useSendProcessEmail, useCreateProcessDraft, useDocumentParagraphs, useSaveEmailVersions } from '@/hooks/useOnboarding'
import { useProfiles } from '@/hooks/useProfiles'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { OnboardingTask, OnboardingProcess, EmailVersion, EmailVersionDoc } from '@/types'
import { buildProcessVars, applyVars, humanizeFieldValue, EMPLOYEE_FIELD_LABELS } from './onboardingShared'
import RichTextEditor from './RichTextEditor'

// ─── Modal verificación de Google Sheet ──────────────────────────────────────

export function SheetVerifyModal({
  task, process, onClose,
}: { task: OnboardingTask; process: OnboardingProcess; onClose: () => void }) {
  useEscapeKey(onClose)
  const cfg         = task.automationConfig as Record<string, any> | null
  const templateKey = cfg?.templateKey as string | undefined
  const rut         = process.collaboratorRut

  const verifySheet = useVerifySheet()
  const applySheet  = useApplySheetData()
  const updateTask  = useUpdateTask()

  React.useEffect(() => {
    if (templateKey && rut) verifySheet.mutate({ key: templateKey, rut })
  }, [])

  const result = verifySheet.data

  const handleApply = async () => {
    if (!templateKey || !rut || !result?.updates) return
    try {
      await applySheet.mutateAsync({ key: templateKey, rut, updates: result.updates })
      await updateTask.mutateAsync({ processId: process.id, taskId: task.id, completed: true })
    } catch {
      // error shown via applySheet.isError below
    }
  }

  const updatesCount = result?.updates ? Object.keys(result.updates).length : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Verificar formulario</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {process.collaboratorName}
              {rut && <span className="ml-1 text-gray-300">· RUT {rut}</span>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-4">
          {/* Warnings */}
          {!rut && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle size={14} />
              Este proceso no tiene RUT asociado. Edita el proceso para agregarlo.
            </div>
          )}
          {rut && !templateKey && (
            <p className="text-sm text-gray-400">No hay plantilla de sheet configurada para este hito.</p>
          )}

          {/* Loading */}
          {verifySheet.isPending && (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Buscando en el formulario...</span>
            </div>
          )}

          {/* Error */}
          {verifySheet.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {(verifySheet.error as any)?.response?.data?.message ?? 'Error al conectar con Google Sheets. Verifica que el sheet esté compartido con la cuenta de servicio.'}
            </div>
          )}

          {/* Not found */}
          {result && !result.found && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle size={14} />
              No se encontró el RUT <strong className="mx-1">{rut}</strong> en el formulario.
            </div>
          )}

          {/* Found — diff table */}
          {result?.found && result.updates && (
            <>
              {(() => {
                const entries = Object.entries(result.updates)
                const willChange = entries.filter(([f, v]) => {
                  const cur = result.currentValues?.[f]
                  return String(cur ?? '') !== String(v ?? '')
                })
                const equal = entries.filter(([f, v]) => {
                  const cur = result.currentValues?.[f]
                  return String(cur ?? '') === String(v ?? '')
                })
                return (
                  <div className="flex items-center gap-3 text-xs">
                    {willChange.length > 0 && (
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
                        {willChange.length} {willChange.length === 1 ? 'campo cambia' : 'campos cambian'}
                      </span>
                    )}
                    {equal.length > 0 && (
                      <span className="px-2 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full">
                        {equal.length} ya {equal.length === 1 ? 'es igual' : 'son iguales'}
                      </span>
                    )}
                    {entries.length === 0 && (
                      <span className="text-gray-400">No hay columnas mapeadas para actualizar.</span>
                    )}
                  </div>
                )
              })()}

              {updatesCount > 0 && (
                <div className="rounded-lg border border-gray-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2 text-left font-medium text-gray-500 w-1/4">Campo</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 w-[37.5%]">Actual</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 w-[37.5%]">Del formulario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.updates).map(([field, newVal]) => {
                        const curRaw = result.currentValues?.[field]
                        const curStr = humanizeFieldValue(curRaw)
                        const newStr = humanizeFieldValue(newVal)
                        const isNew     = !curStr
                        const isChanged = curStr !== newStr
                        const rowBg = isNew ? 'bg-brand-50/40' : isChanged ? 'bg-amber-50/40' : ''
                        return (
                          <tr key={field} className={`border-b border-gray-50 last:border-0 ${rowBg}`}>
                            <td className="px-3 py-2 text-gray-600 font-medium">
                              {EMPLOYEE_FIELD_LABELS[field] ?? field}
                            </td>
                            <td className="px-3 py-2">
                              {curStr
                                ? <span className={isChanged ? 'text-gray-400 line-through' : 'text-gray-700'}>{curStr}</span>
                                : <span className="text-gray-300 italic">sin datos</span>}
                            </td>
                            <td className="px-3 py-2">
                              {newStr
                                ? <span className={isNew ? 'text-brand-700 font-medium' : isChanged ? 'text-amber-700 font-medium' : 'text-gray-500'}>{newStr}</span>
                                : <span className="text-gray-300 italic">vacío</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Success banner */}
          {applySheet.isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <Check size={14} />
              Datos aplicados correctamente al perfil del colaborador.
            </div>
          )}

          {/* Error banner */}
          {applySheet.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {(applySheet.error as any)?.response?.data?.message ?? 'Error al aplicar los datos. Intenta nuevamente.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            {result?.found && result.employeeName && (
              <span>Perfil vinculado: <span className="font-medium text-gray-600">{result.employeeName}</span></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              {applySheet.isSuccess ? 'Cerrar' : 'Cancelar'}
            </button>
            {result?.found && updatesCount > 0 && !applySheet.isSuccess && (
              <button
                onClick={handleApply}
                disabled={applySheet.isPending || updateTask.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {(applySheet.isPending || updateTask.isPending)
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Check size={13} />}
                Aplicar al perfil
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal previsualización de correo ─────────────────────────────────────────

export function EmailPreviewModal({
  task, process, onClose, onSent,
}: { task: OnboardingTask; process: OnboardingProcess; onClose: () => void; onSent: () => void }) {
  useEscapeKey(onClose)
  const { data: templates = [] } = useEmailTemplates()
  const { data: allDocs = [] }   = useDocuments()
  const { data: profiles = [] }  = useProfiles()
  const cfg = task.automationConfig as Record<string, any> | null
  const templateKey = cfg?.templateKey ?? cfg?.template ?? ''
  const dbTemplate  = templates.find(t => t.key === templateKey)
  const vars        = buildProcessVars(process, task)

  // Documents linked to this email template
  const linkedDocs = (allDocs as any[]).filter(doc =>
    (doc.templateLinks ?? []).some((l: any) => l.templateKey === templateKey)
  )

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const sendProcessEmail    = useSendProcessEmail()
  const createProcessDraft  = useCreateProcessDraft()
  const saveVersions        = useSaveEmailVersions()

  // ── Versiones / edición de adjuntos ──
  const versions: EmailVersion[] = (task.emailVersions as EmailVersion[] | null) ?? []
  const defaultSendAs = (doc: any): 'WORD' | 'PDF' =>
    ((doc.templateLinks ?? []).find((l: any) => l.templateKey === templateKey)?.sendAs === 'PDF' ? 'PDF' : 'WORD')

  const [selectedVersionId, setSelectedVersionId] = useState<string>('original')
  const [docFormats, setDocFormats] = useState<Record<string, 'WORD' | 'PDF'>>({})
  // Ediciones de texto por documento: docId → { índiceDePárrafo → textoNuevo }
  const [docEdits,   setDocEdits]   = useState<Record<string, Record<string, string>>>({})
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [versionSaved, setVersionSaved] = useState(false)

  // Sembrar formato por defecto de cada adjunto cuando cargan los documentos.
  React.useEffect(() => {
    setDocFormats(prev => {
      const next = { ...prev }
      let changed = false
      for (const doc of linkedDocs) if (!(doc.id in next)) { next[doc.id] = defaultSendAs(doc); changed = true }
      return changed ? next : prev
    })
  }, [linkedDocs.length])

  const handleDownloadDoc = async (docId: string, docFileName: string) => {
    setDownloadingDocId(docId)
    try {
      const res = await fetch(`/api/onboarding/documents/${docId}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gdp_token')}` },
        body: JSON.stringify({ processId: process.id, format: 'PDF' }),
      })
      const isPdfFallback = res.headers.get('x-pdf-fallback') === 'true'
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = isPdfFallback ? docFileName : docFileName.replace('.docx', '.pdf')
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setDownloadingDocId(null)
    }
  }

  // Build initial values strictly from DB template (vars resolved). Empty if not in template.
  const initFrom    = applyVars(dbTemplate?.fromEmail ?? '', vars)
  const initTo      = applyVars((dbTemplate?.toEmails as string[] ?? []).join(', '), vars)
  const initCc      = applyVars((dbTemplate?.ccEmails as string[] ?? []).join(', '), vars)
  const initSubject = dbTemplate
    ? applyVars(dbTemplate.subject, vars)
    : `[Onboarding] ${task.name} — ${process.collaboratorName}`
  const initBody = dbTemplate
    ? applyVars(dbTemplate.bodyHtml, vars)
    : `<p>Hola ${process.collaboratorName},</p><p>Este correo corresponde al hito "${task.name}".</p><p><strong>Equipo RRHH Surmedia</strong></p>`

  const [from,      setFrom]    = useState(initFrom)
  const [to,        setTo]      = useState(initTo)
  const [toOpen,    setToOpen]  = useState(false)
  const toRef = useRef<HTMLDivElement>(null)
  const [cc,        setCc]      = useState(initCc)
  const [subject,   setSubject] = useState(initSubject)
  const [body,      setBody]    = useState(initBody)
  const [signature, setSignature] = useState(() => localStorage.getItem('gdp_email_signature') ?? '')
  const [showSig,   setShowSig]   = useState(true)
  const [sendError,   setSendError]   = useState('')
  const [sent,        setSent]        = useState(false)
  const [draftOpened, setDraftOpened] = useState(false)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toRef.current && !toRef.current.contains(e.target as Node)) setToOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const profileSuggestions = (profiles as any[]).filter(p =>
    p.email && (
      p.name.toLowerCase().includes(to.toLowerCase()) ||
      p.email.toLowerCase().includes(to.toLowerCase())
    )
  )

  // Carga una versión guardada (o el original) en el formulario.
  const loadVersion = (id: string) => {
    setSelectedVersionId(id)
    setVersionSaved(false)
    if (id === 'original') {
      setFrom(initFrom); setTo(initTo); setCc(initCc); setSubject(initSubject); setBody(initBody)
      setDocEdits({})
      setDocFormats(() => { const m: Record<string, 'WORD' | 'PDF'> = {}; for (const d of linkedDocs) m[d.id] = defaultSendAs(d); return m })
      return
    }
    const v = versions.find(x => x.id === id)
    if (!v) return
    setFrom(v.from || initFrom); setTo(v.to || initTo); setCc(v.cc ?? ''); setSubject(v.subject || initSubject); setBody(v.body || initBody)
    const edits: Record<string, Record<string, string>> = {}
    const fmts:  Record<string, 'WORD' | 'PDF'> = {}
    for (const d of linkedDocs) {
      const vd = v.documents?.[d.id]
      if (vd?.paragraphs && Object.keys(vd.paragraphs).length) edits[d.id] = vd.paragraphs
      fmts[d.id] = vd?.sendAs ?? defaultSendAs(d)
    }
    setDocEdits(edits); setDocFormats(fmts)
  }

  // Mapa de overrides de documentos para enviar/borrador.
  const buildDocsPayload = (): Record<string, { paragraphs?: Record<string, string>; sendAs: 'WORD' | 'PDF' }> => {
    const out: Record<string, { paragraphs?: Record<string, string>; sendAs: 'WORD' | 'PDF' }> = {}
    for (const doc of linkedDocs) {
      const edits = docEdits[doc.id]
      out[doc.id] = { sendAs: docFormats[doc.id] ?? defaultSendAs(doc), ...(edits && Object.keys(edits).length ? { paragraphs: edits } : {}) }
    }
    return out
  }

  const handleSaveVersion = async () => {
    const docs: Record<string, EmailVersionDoc> = {}
    for (const doc of linkedDocs) {
      docs[doc.id] = { paragraphs: docEdits[doc.id] ?? {}, sendAs: docFormats[doc.id] ?? defaultSendAs(doc), name: doc.name }
    }
    const now = new Date().toISOString()
    const newVersion: EmailVersion = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      name: `Versión ${versions.length + 1}`,
      createdAt: now, updatedAt: now,
      from, to, cc, subject, body, documents: docs,
    }
    try {
      await saveVersions.mutateAsync({ processId: process.id, taskId: task.id, emailVersions: [...versions, newVersion] })
      setSelectedVersionId(newVersion.id)
      setVersionSaved(true)
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Error al guardar la versión')
    }
  }

  const handleDeleteVersion = async (id: string) => {
    try {
      await saveVersions.mutateAsync({ processId: process.id, taskId: task.id, emailVersions: versions.filter(v => v.id !== id) })
      if (selectedVersionId === id) loadVersion('original')
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Error al eliminar la versión')
    }
  }

  const handleOpenInGmail = async () => {
    setSendError('')
    const sigHtml = showSig && signature.trim()
      ? `<br><br><span style="color:#666;font-size:13px;line-height:1.5;">--<br>${signature.trim().replace(/\n/g, '<br>')}</span>`
      : ''
    try {
      const result = await createProcessDraft.mutateAsync({
        processId: process.id,
        to,
        from:        from || undefined,
        cc:          cc   || undefined,
        subject,
        body:        body + sigHtml,
        templateKey: templateKey || undefined,
        documents:   buildDocsPayload(),
      })
      window.open(result.gmailUrl, '_blank')
      setDraftOpened(true)
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Error al crear el borrador')
    }
  }

  const handleSend = async () => {
    setSendError('')
    const sigHtml = showSig && signature.trim()
      ? `<br><br><span style="color:#666;font-size:13px;line-height:1.5;">--<br>${signature.trim().replace(/\n/g, '<br>')}</span>`
      : ''
    try {
      await sendProcessEmail.mutateAsync({
        processId: process.id,
        to,
        from:        from || undefined,
        cc:          cc   || undefined,
        subject,
        body:        body + sigHtml,
        templateKey: templateKey || undefined,
        documents:   buildDocsPayload(),
      })
      setSent(true)
      onSent()
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setSendError(err?.response?.data?.message ?? 'Error al enviar el correo')
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Previsualizar correo</h2>
            <p className="text-xs text-gray-400 mt-0.5">{task.name}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {versions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Versión</label>
              <div className="flex items-center gap-2">
                <select value={selectedVersionId} onChange={e => loadVersion(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="original">Original (plantilla)</option>
                  {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {selectedVersionId !== 'original' && (
                  <button type="button" onClick={() => handleDeleteVersion(selectedVersionId)}
                    title="Eliminar versión" className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
            <input value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div ref={toRef} className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Para</label>
            <input
              value={to}
              onChange={e => { setTo(e.target.value); setToOpen(true) }}
              onFocus={() => setToOpen(true)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {toOpen && profileSuggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1 max-h-48 overflow-y-auto">
                {profileSuggestions.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setTo(p.email); setToOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{p.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CC (opcional)</label>
            <input value={cc} onChange={e => setCc(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Asunto</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {templateKey && !dbTemplate && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              La plantilla <code className="font-mono bg-amber-100 px-1 rounded">{templateKey}</code> no existe en el sistema. Se usa un mensaje genérico.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cuerpo</label>
            <RichTextEditor value={body} onChange={setBody} height={240} />
          </div>
          {linkedDocs.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <Paperclip size={11} /> Adjuntos ({linkedDocs.length})
              </label>
              <div className="flex flex-col gap-1.5">
                {linkedDocs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{doc.name}</span>
                      {docEdits[doc.id] && Object.keys(docEdits[doc.id]).length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">editado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <select
                        value={docFormats[doc.id] ?? defaultSendAs(doc)}
                        onChange={e => setDocFormats(prev => ({ ...prev, [doc.id]: e.target.value as 'WORD' | 'PDF' }))}
                        className="text-[11px] border border-gray-200 rounded-md px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        title="Formato de envío"
                      >
                        <option value="WORD">WORD</option>
                        <option value="PDF">PDF</option>
                      </select>
                      <button
                        onClick={() => setEditingDocId(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-brand-600 hover:bg-brand-50 rounded-md"
                      >
                        <Pencil size={11} /> Editar
                      </button>
                      <button
                        onClick={() => handleDownloadDoc(doc.id, doc.fileName)}
                        disabled={downloadingDocId === doc.id}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded-md disabled:opacity-50"
                      >
                        {downloadingDocId === doc.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Download size={11} />}
                        Descargar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Firma */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSig(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600"
            >
              <span>Firma</span>
              {showSig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showSig && (
              <textarea
                rows={3}
                value={signature}
                onChange={e => {
                  setSignature(e.target.value)
                  localStorage.setItem('gdp_email_signature', e.target.value)
                }}
                placeholder="Ej: María López&#10;RRHH Surmedia&#10;rrhh@surmedia.cl"
                className="w-full px-3 py-2 text-sm text-gray-700 border-0 focus:outline-none resize-none placeholder:text-gray-300"
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-100">
          {sendError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sendError}</div>
          )}
          {sent && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={13} /> Correo enviado correctamente.
            </div>
          )}
          {draftOpened && !sent && (
            <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
              <ExternalLink size={13} /> Borrador creado — búscalo en la carpeta Borradores de Gmail.
            </div>
          )}
          {versionSaved && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={13} /> Versión guardada en el hito.
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSaveVersion}
              disabled={saveVersions.isPending || sent}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {saveVersions.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
                : <><Save size={13} /> Guardar versión</>}
            </button>
            <button
              onClick={handleOpenInGmail}
              disabled={!to || createProcessDraft.isPending || sent}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {createProcessDraft.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Preparando…</>
                : <><ExternalLink size={13} /> Abrir en Gmail</>}
            </button>
            <button
              onClick={handleSend}
              disabled={!to || sendProcessEmail.isPending || sent}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sendProcessEmail.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Enviando…</>
                : <><Mail size={13} /> Enviar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
    {editingDocId && (
      <DocumentEditorModal
        processId={process.id}
        docId={editingDocId}
        docName={(linkedDocs.find((d: any) => d.id === editingDocId)?.name) ?? 'Documento'}
        initialEdits={docEdits[editingDocId] ?? {}}
        onSave={(edits) => { const id = editingDocId; setDocEdits(prev => ({ ...prev, [id]: edits })); setEditingDocId(null) }}
        onClose={() => setEditingDocId(null)}
      />
    )}
    </>
  )
}

// ─── Modal editor de documento adjunto ───────────────────────────────────────

function DocumentEditorModal({
  processId, docId, docName, initialEdits, onSave, onClose,
}: {
  processId: string
  docId: string
  docName: string
  initialEdits: Record<string, string>
  onSave: (edits: Record<string, string>) => void
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const { data, isLoading, isError } = useDocumentParagraphs(processId, docId)
  const original = data?.paragraphs ?? []
  const [edits, setEdits] = useState<Record<string, string>>(initialEdits)

  const valueFor = (i: number) => edits[String(i)] ?? original[i] ?? ''
  const setPara = (i: number, text: string) => {
    setEdits(prev => {
      const next = { ...prev }
      if (text === (original[i] ?? '')) delete next[String(i)]
      else next[String(i)] = text
      return next
    })
  }
  const handleSave = () => {
    // Conservar solo los párrafos que realmente difieren del original.
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(edits)) {
      if (v !== (original[Number(k)] ?? '')) clean[k] = v
    }
    onSave(clean)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Editar documento</h2>
            <p className="text-xs text-gray-400 mt-0.5">{data?.name ?? docName} · solo texto · se conserva el formato (logo, estilos)</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Cargando documento…</span>
            </div>
          )}
          {isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              No se pudo cargar el documento. Verifica que el archivo exista.
            </div>
          )}
          {!isLoading && !isError && (
            <div className="flex flex-col gap-2">
              {original.map((text, i) => text.trim() === '' ? null : (
                <div key={i} className="flex flex-col gap-0.5">
                  <textarea
                    value={valueFor(i)}
                    onChange={e => setPara(i, e.target.value)}
                    rows={Math.max(1, Math.ceil((valueFor(i).length || 1) / 90))}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y ${edits[String(i)] !== undefined ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}
                  />
                </div>
              ))}
              {original.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">El documento no tiene texto editable.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => setEdits({})}
            disabled={isLoading || isError}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            <RotateCcw size={13} /> Restaurar original
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={isLoading || isError}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={13} /> Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de evento de Google Calendar ──────────────────────────────────────

export function CalendarEventModal({
  title: initialTitle, parentName, date, durationMinutes, defaultAttendeeIds, process: proc, onClose,
}: {
  title: string
  parentName?: string | null
  date: Date
  durationMinutes: number
  defaultAttendeeIds: string[]
  process: OnboardingProcess
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const { data: profiles = [] } = useProfiles()
  const [title, setTitle]       = useState(initialTitle)
  const [description, setDesc]  = useState(`Onboarding ${proc.collaboratorName}`)
  const [time, setTime]         = useState('')
  const [extraIds, setExtraIds] = useState<string[]>([])
  const [eventDate, setEventDate] = useState(() => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`
  })
  const allDay = durationMinutes === 0

  const attendeeEmails = [...new Set([...defaultAttendeeIds, ...extraIds])]
    .map(id => (profiles as any[]).find(p => p.id === id)?.email)
    .filter((e): e is string => !!e)
  if (proc.collaboratorEmail && !attendeeEmails.includes(proc.collaboratorEmail))
    attendeeEmails.push(proc.collaboratorEmail)

  const buildUrl = () => {
    const p2 = (n: number) => String(n).padStart(2, '0')
    const gFmt = (d: Date) => `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`
    const dFmt = (d: Date) => `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}`
    const s = new Date(eventDate + 'T12:00:00')
    if (!allDay && time) { const [h, m] = time.split(':').map(Number); s.setHours(h, m, 0, 0) }
    const dates = allDay
      ? `${dFmt(s)}/${dFmt(new Date(s.getTime() + 86_400_000))}`
      : `${gFmt(s)}/${gFmt(new Date(s.getTime() + durationMinutes * 60_000))}`
    const q = new URLSearchParams({ text: title, dates, details: description })
    if (attendeeEmails.length) q.set('add', attendeeEmails.join(','))
    return `https://calendar.google.com/calendar/r/eventedit?${q}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Crear evento en Google Calendar</h2>
            <p className="text-xs text-gray-400 mt-0.5">{parentName ? `${parentName} (${initialTitle})` : initialTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-3 flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Título del evento</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            {!allDay && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            )}
            {!allDay && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duración</label>
                <p className="px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-700 whitespace-nowrap">{durationMinutes} min</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Invitados <span className="font-normal text-gray-400">({attendeeEmails.length} seleccionados)</span>
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 py-0.5 px-1">
              {(profiles as any[]).map((pr: any) => {
                const isDefault = defaultAttendeeIds.includes(pr.id)
                const isExtra   = extraIds.includes(pr.id)
                return (
                  <label key={pr.id} className="flex items-center gap-2 px-1.5 py-0.5 rounded cursor-pointer hover:bg-purple-50">
                    <input type="checkbox" checked={isDefault || isExtra} disabled={isDefault}
                      onChange={e => { if (isDefault) return; setExtraIds(prev => e.target.checked ? [...prev, pr.id] : prev.filter(id => id !== pr.id)) }}
                      className="w-3 h-3 rounded accent-purple-600 flex-shrink-0" />
                    <span className="text-[10px] text-gray-700 flex-1 truncate">{pr.name}</span>
                    <span className="text-[10px] text-gray-400 truncate max-w-[140px]">{pr.email}</span>
                    {isDefault && <span className="text-[9px] text-purple-400 flex-shrink-0">por defecto</span>}
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <a href={buildUrl()} target="_blank" rel="noopener noreferrer" onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Calendar size={13} /> Crear en Google Calendar
          </a>
        </div>
      </div>
    </div>
  )
}
