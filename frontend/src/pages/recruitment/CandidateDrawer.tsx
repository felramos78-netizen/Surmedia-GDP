import { useEffect, useState } from 'react'
import { X, Loader2, Pencil, Save, Sparkles, FileText, Download, ExternalLink, Mail, Phone, AlertTriangle, Archive, ArchiveRestore } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { LinkedinIcon } from '@/components/ui/LinkedinIcon'
import {
  useCandidate, useUpdateCandidate, useUpdateApplication, openCandidateFile, useAiStatus, useStartAi,
  STAGES, STAGE_META, SOURCE_LABEL, PROFILE_FIELDS,
  type Candidate, type CandidateFile, type CandidateSource, type ProfileField,
} from '@/hooks/useRecruitment'

type Form = Record<'fullName' | 'email' | 'phone' | 'rut' | 'linkedinUrl' | 'referredBy' | 'notes' | 'source' | ProfileField, string>

const toForm = (c: Candidate): Form => ({
  fullName: c.fullName, email: c.email ?? '', phone: c.phone ?? '', rut: c.rut ?? '',
  linkedinUrl: c.linkedinUrl ?? '', referredBy: c.referredBy ?? '', notes: c.notes ?? '', source: c.source,
  ...Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, c[f.key] === null || c[f.key] === undefined ? '' : String(c[f.key])])) as Record<ProfileField, string>,
})

const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

export default function CandidateDrawer({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  useEscapeKey(onClose)
  const { data: c, isLoading, isError } = useCandidate(candidateId)
  const updateCandidate = useUpdateCandidate()
  const updateApp = useUpdateApplication()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [fileError, setFileError] = useState('')
  const { data: ai } = useAiStatus()
  const startAi = useStartAi()

  useEffect(() => { if (c) setForm(toForm(c)); setEditing(false); setError('') }, [c?.id])

  const save = async () => {
    if (!form) return
    setError('')
    try {
      await updateCandidate.mutateAsync({ id: candidateId, ...form })
      setEditing(false)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'No se pudo guardar')
    }
  }

  const openFile = async (f: CandidateFile, download = false) => {
    setFileError('')
    try { await openCandidateFile(f, download) }
    catch { setFileError(`No se pudo abrir "${f.fileName}". Puede que se haya movido en Drive: vuelve a importar.`) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full" role="dialog" aria-label="Ficha del candidato">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{c?.fullName ?? 'Candidato'}</h2>
            {c && (
              <p className="text-xs text-gray-400 mt-0.5">
                {SOURCE_LABEL[c.source]}{c.referredBy && ` · referido por ${c.referredBy}`} · en GDP desde {fmtDate(c.createdAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {c && !editing && ai?.configured && c.files.some(f => !f.removedAt) && (
              <button
                onClick={() => startAi.mutate([c.id])}
                disabled={!!ai.job?.running || startAi.isPending}
                title="Lee su CV con IA y deja una sugerencia en «Revisión IA» (no guarda nada sin tu revisión)"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-violet-700 hover:bg-violet-50 rounded-lg disabled:opacity-50"
              >
                {ai.job?.running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Completar con IA
              </button>
            )}
            {c && !editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
                <Pencil size={12} /> Editar
              </button>
            )}
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
          </div>
        </div>

        {isLoading || !form ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-400">
            {isError ? 'No se encontró el candidato.' : <><Loader2 size={16} className="animate-spin" /> Cargando…</>}
          </div>
        ) : c && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Datos */}
            <section>
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Field label="Nombre completo *"><input className={inputCls} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></Field></div>
                  <Field label="Email"><input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Teléfono"><input className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
                  <Field label="RUT"><input className={inputCls} value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} placeholder="12.345.678-9" /></Field>
                  <Field label="Origen">
                    <select className={`${inputCls} bg-white`} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                      {(Object.keys(SOURCE_LABEL) as CandidateSource[]).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                    </select>
                  </Field>
                  <div className="col-span-2"><Field label="LinkedIn"><input className={inputCls} value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/…" /></Field></div>
                  <div className="col-span-2 pt-2 border-t border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Perfil</div>
                  {PROFILE_FIELDS.map(f => (
                    <div key={f.key} className={f.long ? 'col-span-2' : ''}>
                      <Field label={f.label}>
                        {f.long ? (
                          <textarea rows={2} className={`${inputCls} resize-none`} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                        ) : (
                          <input className={inputCls} type={f.numeric ? 'number' : 'text'} step={f.numeric ? '0.5' : undefined} min={f.numeric ? 0 : undefined}
                            value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                        )}
                      </Field>
                    </div>
                  ))}
                  <div className="col-span-2 pt-2 border-t border-gray-100" />
                  <div className="col-span-2"><Field label="Referido por"><input className={inputCls} value={form.referredBy} onChange={e => setForm({ ...form, referredBy: e.target.value })} /></Field></div>
                  <div className="col-span-2"><Field label="Notas"><textarea rows={3} className={`${inputCls} resize-none`} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field></div>
                  {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
                  <div className="col-span-2 flex justify-end gap-2">
                    <button onClick={() => { setForm(toForm(c)); setEditing(false); setError('') }} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button onClick={save} disabled={!form.fullName.trim() || updateCandidate.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                      {updateCandidate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100">
                        <Mail size={13} className="text-gray-400" />{c.email}
                      </a>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 text-gray-700">
                        <Phone size={13} className="text-gray-400" />{c.phone}
                      </span>
                    )}
                    {c.linkedinUrl ? (
                      <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a66c2]/10 text-[#0a66c2] hover:bg-[#0a66c2]/20">
                        <LinkedinIcon size={13} /> LinkedIn <ExternalLink size={11} />
                      </a>
                    ) : (
                      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:text-gray-600">
                        <LinkedinIcon size={12} /> Agregar LinkedIn
                      </button>
                    )}
                  </div>
                  {c.rut && <p className="text-xs text-gray-500">RUT {c.rut}</p>}
                  {PROFILE_FIELDS.some(f => c[f.key] !== null && c[f.key] !== '') ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
                      {PROFILE_FIELDS.filter(f => c[f.key] !== null && c[f.key] !== '').map(f => (
                        <div key={f.key} className={f.long ? 'col-span-2' : ''}>
                          <dt className="text-[11px] text-gray-400">{f.label}</dt>
                          <dd className="text-sm text-gray-700 whitespace-pre-wrap">{c[f.key]}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">+ Completar perfil (título, experiencia, competencias…)</button>
                  )}
                  {c.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap bg-amber-50/50 rounded-lg px-3 py-2">{c.notes}</p>}
                </div>
              )}
            </section>

            {/* Postulaciones */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Postulaciones</h3>
              <ul className="space-y-1.5">
                {c.applications.map(a => (
                  <li key={a.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${a.isArchived ? 'border-gray-100 bg-gray-50/60' : 'border-gray-200'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{a.jobOpening.name}</p>
                      <p className="text-[11px] text-gray-400">{a.isArchived ? 'Convocatoria anterior (histórico)' : 'Convocatoria actual'}</p>
                    </div>
                    <select
                      value={a.stage}
                      onChange={e => updateApp.mutate({ id: a.id, stage: e.target.value as any })}
                      aria-label={`Etapa en ${a.jobOpening.name}`}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium focus:ring-2 focus:ring-brand-500 ${STAGE_META[a.stage].cls}`}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                    </select>
                    <button
                      onClick={() => updateApp.mutate({ id: a.id, isArchived: !a.isArchived })}
                      title={a.isArchived ? 'Mover a la convocatoria actual' : 'Marcar como histórico'}
                      aria-label={a.isArchived ? 'Mover a la convocatoria actual' : 'Marcar como histórico'}
                      className="p-1 text-gray-300 hover:text-gray-600"
                    >
                      {a.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Archivos */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CV y archivos</h3>
              {fileError && (
                <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{fileError}
                </p>
              )}
              <ul className="space-y-1">
                {c.files.map(f => (
                  <li key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 ${f.removedAt ? 'opacity-50' : ''}`}>
                    <FileText size={15} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => openFile(f)} disabled={!!f.removedAt} className="block text-sm text-gray-800 hover:text-brand-700 truncate max-w-full text-left disabled:hover:text-gray-800">
                        {f.fileName}
                      </button>
                      <p className="text-[11px] text-gray-400 truncate" title={f.drivePath}>
                        {f.removedAt ? 'Ya no está en Drive' : f.drivePath.split('/').slice(0, -1).join(' / ')}
                        {f.modifiedAt && ` · ${fmtDate(f.modifiedAt)}`}
                      </p>
                    </div>
                    {!f.removedAt && (
                      <button onClick={() => openFile(f, true)} aria-label={`Descargar ${f.fileName}`} className="p-1 text-gray-300 hover:text-gray-600">
                        <Download size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}
