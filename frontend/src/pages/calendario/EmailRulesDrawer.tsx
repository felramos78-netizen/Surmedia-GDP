import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Plus, Pencil, Trash2, Mail, MailOpen,
  Clock, AlertCircle, Check, Info, Send, Zap,
} from 'lucide-react'
import api from '@/lib/api'
import { useEscapeKey } from '@/hooks/useEscapeKey'

// ── Types ──────────────────────────────────────────────────────────────────────

type EventType = 'CUMPLEANOS' | 'ANIVERSARIO_LABORAL' | 'RECONOCIMIENTO'

interface EmailRule {
  id: string
  name: string
  eventType: EventType
  fromProfileId: string | null
  fromProfile?: { id: string; name: string; email: string } | null
  subject: string
  bodyHtml: string
  daysBeforeEvent: number
  sendTime: string
  toColaborador: boolean
  toDirectEmails: string[]
  ccProfileIds: string[]
  ccCustomEmails: string[]
  isActive: boolean
  createdAt: string
}

interface UpcomingItem {
  ruleId: string
  ruleName: string
  ruleIsActive: boolean
  sendTime: string
  eventType: EventType
  employeeId: string
  employeeName: string
  date: string
  triggerDate: string
  subject: string
  body: string
  toEmails: string[]
  ccEmails: string[]
  alreadySent: boolean
  years?: number
}

interface Profile {
  id: string
  name: string
  email: string
  position: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CUMPLEANOS:          'Cumpleaños',
  ANIVERSARIO_LABORAL: 'Aniversario laboral',
  RECONOCIMIENTO:      'Reconocimiento',
}

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  CUMPLEANOS:          '#db2777',
  ANIVERSARIO_LABORAL: '#7c3aed',
  RECONOCIMIENTO:      '#0891b2',
}

const VARIABLES = [
  // Colaborador
  { key: 'nombre',           label: '{{nombre}}',            desc: 'Nombre completo' },
  { key: 'primerNombre',         label: '{{primerNombre}}',         desc: 'Primer nombre (solo el primero: "Erick")' },
  { key: 'primerNombreCompleto', label: '{{primerNombreCompleto}}', desc: 'Primer nombre completo ("Erick Fernando")' },
  { key: 'apellido',             label: '{{apellido}}',             desc: 'Apellido' },
  { key: 'cargo',            label: '{{cargo}}',             desc: 'Cargo' },
  { key: 'empresa',          label: '{{empresa}}',           desc: 'Empresa (razón social)' },
  { key: 'emailColaborador', label: '{{emailColaborador}}',  desc: 'Email corporativo' },
  { key: 'fechaIngreso',     label: '{{fechaIngreso}}',      desc: 'Fecha de ingreso (DD/MM/YYYY)' },
  { key: 'años',             label: '{{años}}',              desc: 'Años de servicio' },
  // Jefatura
  { key: 'nombreJefatura',   label: '{{nombreJefatura}}',    desc: 'Nombre del supervisor directo' },
  { key: 'cargoJefatura',    label: '{{cargoJefatura}}',     desc: 'Cargo del supervisor' },
  { key: 'emailJefatura',    label: '{{emailJefatura}}',     desc: 'Email del supervisor (si está en GDP)' },
]

const TEMPLATES: Record<EventType, Pick<EmailRule, 'subject' | 'bodyHtml'>> = {
  CUMPLEANOS: {
    subject: '¡Feliz cumpleaños, {{primerNombre}}!',
    bodyHtml: 'Hola {{primerNombre}},\n\n¡Feliz cumpleaños! 🎂 Desde el equipo de Surmedia te deseamos un excelente día lleno de alegrías.\n\n¡Que los cumplas muy bien!\n\nSaludos,\nEquipo Surmedia',
  },
  ANIVERSARIO_LABORAL: {
    subject: '¡{{años}} año{{años}} en Surmedia, {{primerNombre}}!',
    bodyHtml: 'Hola {{primerNombre}},\n\nHoy se cumplen {{años}} año{{años}} desde que te uniste a nuestro equipo en {{empresa}}. 🎉\n\nGracias por tu compromiso, dedicación y todo lo que aportas día a día. ¡Es un placer contar contigo!\n\nSaludos,\nEquipo Surmedia',
  },
  RECONOCIMIENTO: {
    subject: 'Reconocimiento — {{nombre}}',
    bodyHtml: 'Hola {{primerNombre}},\n\nQuería tomar un momento para reconocer tu excelente trabajo. Tu contribución en {{empresa}} no pasa desapercibida.\n\n¡Muchas gracias!\n\nSaludos,\nEquipo Surmedia',
  },
}

const EMPTY_RULE: Omit<EmailRule, 'id' | 'createdAt' | 'fromProfile'> = {
  name: '', eventType: 'CUMPLEANOS',
  fromProfileId: null,
  subject: TEMPLATES.CUMPLEANOS.subject,
  bodyHtml: TEMPLATES.CUMPLEANOS.bodyHtml,
  daysBeforeEvent: 0, sendTime: '09:00',
  toColaborador: true, toDirectEmails: [],
  ccProfileIds: [], ccCustomEmails: [],
  isActive: false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(s: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = s.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
}

function openGmail(to: string, subject: string, body: string, cc?: string) {
  const sig = localStorage.getItem('gdp_email_signature') ?? ''
  const fullBody = sig.trim() ? `${body}\n\n--\n${sig.trim()}` : body
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body: fullBody })
  if (cc) params.set('cc', cc)
  window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank')
}

// ── RuleForm ──────────────────────────────────────────────────────────────────

function RuleForm({
  initial, profiles, onSave, onCancel,
}: {
  initial: Omit<EmailRule, 'id' | 'createdAt' | 'fromProfile'>
  profiles: Profile[]
  onSave: (data: Omit<EmailRule, 'id' | 'createdAt' | 'fromProfile'>) => void
  onCancel: () => void
}) {
  const [form, setForm]                   = useState(initial)
  const [directEmailInput, setDirectEmailInput] = useState('')
  const [ccCustomInput, setCcCustomInput] = useState('')
  const [bodyRef, setBodyRef]             = useState<HTMLTextAreaElement | null>(null)

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleEventTypeChange = (et: EventType) => {
    const tpl = TEMPLATES[et]
    setForm(f => ({ ...f, eventType: et, subject: tpl.subject, bodyHtml: tpl.bodyHtml }))
  }

  const insertVariable = (key: string) => {
    if (!bodyRef) return
    const token = `{{${key}}}`
    const start = bodyRef.selectionStart, end = bodyRef.selectionEnd
    const newVal = form.bodyHtml.slice(0, start) + token + form.bodyHtml.slice(end)
    set('bodyHtml', newVal)
    setTimeout(() => {
      bodyRef.focus()
      bodyRef.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  const addDirectEmail = () => {
    const email = directEmailInput.trim()
    if (!email || form.toDirectEmails.includes(email)) return
    set('toDirectEmails', [...form.toDirectEmails, email])
    setDirectEmailInput('')
  }

  const addCcCustom = () => {
    const email = ccCustomInput.trim()
    if (!email || form.ccCustomEmails.includes(email)) return
    set('ccCustomEmails', [...form.ccCustomEmails, email])
    setCcCustomInput('')
  }

  const toggleCcProfile = (id: string) => {
    const ids = form.ccProfileIds ?? []
    set('ccProfileIds', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  const isReconocimiento = form.eventType === 'RECONOCIMIENTO'
  const valid = form.name.trim() && form.subject.trim() && form.bodyHtml.trim()

  return (
    <div className="flex flex-col gap-4 py-2">

      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la plantilla *</label>
        <input
          value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="Ej: Felicitación de cumpleaños"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Tipo de evento */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de evento *</label>
        <select
          value={form.eventType}
          onChange={e => handleEventTypeChange(e.target.value as EventType)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(et => (
            <option key={et} value={et}>{EVENT_TYPE_LABELS[et]}</option>
          ))}
        </select>
      </div>

      {/* Días de anticipación */}
      {!isReconocimiento && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Días de anticipación
            <span className="ml-1 text-gray-400 font-normal">(0 = el mismo día)</span>
          </label>
          <input type="number" min={0} max={30}
            value={form.daysBeforeEvent}
            onChange={e => set('daysBeforeEvent', parseInt(e.target.value) || 0)}
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* De */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
        <select
          value={form.fromProfileId ?? ''}
          onChange={e => set('fromProfileId', e.target.value || null)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">— Seleccionar perfil —</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.email}</option>
          ))}
        </select>
        <p className="text-[10px] text-gray-400 mt-0.5">El nombre del perfil aparece como remitente en el correo.</p>
      </div>

      {/* Asunto */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Asunto *</label>
        <input value={form.subject} onChange={e => set('subject', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Variables */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Variables disponibles</p>
        <div className="flex flex-wrap gap-1">
          {VARIABLES.map(v => (
            <button key={v.key} type="button" onClick={() => insertVariable(v.key)} title={v.desc}
              className="px-2 py-0.5 text-[11px] font-mono bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 rounded border border-gray-200 hover:border-brand-300 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cuerpo */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Cuerpo del correo *</label>
        <textarea
          ref={el => setBodyRef(el)}
          value={form.bodyHtml}
          onChange={e => set('bodyHtml', e.target.value)}
          rows={7}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono resize-none"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Texto plano. Usa las variables de arriba.</p>
      </div>

      {/* ── PARA ── */}
      <div className="border border-gray-100 rounded-xl p-3.5 space-y-2.5">
        <p className="text-xs font-semibold text-gray-600">Para</p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.toColaborador}
            onChange={e => set('toColaborador', e.target.checked)}
            className="w-4 h-4 rounded accent-brand-600"
          />
          <span className="text-sm text-gray-700">Al colaborador (email corporativo)</span>
        </label>

        <div>
          <p className="text-xs text-gray-500 mb-1">Otros destinatarios directos</p>
          <div className="flex gap-2">
            <input
              value={directEmailInput}
              onChange={e => setDirectEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDirectEmail() } }}
              placeholder="correo@ejemplo.com"
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="button" onClick={addDirectEmail}
              className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            >
              Agregar
            </button>
          </div>
          {form.toDirectEmails.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {form.toDirectEmails.map(email => (
                <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 text-[11px] rounded-full">
                  {email}
                  <button onClick={() => set('toDirectEmails', form.toDirectEmails.filter(e => e !== email))} aria-label={`Quitar ${email}`} className="hover:text-brand-900">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Horario */}
      {!isReconocimiento && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Horario de envío
            <span className="ml-1 text-gray-400 font-normal">(hora Chile)</span>
          </label>
          <input type="time" value={form.sendTime}
            onChange={e => set('sendTime', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* ── CC ── */}
      <div className="border border-gray-100 rounded-xl p-3.5 space-y-2.5">
        <p className="text-xs font-semibold text-gray-600">CC</p>

        {profiles.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Perfiles del sistema</p>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={(form.ccProfileIds ?? []).includes(p.id)}
                    onChange={() => toggleCcProfile(p.id)}
                    className="w-3.5 h-3.5 rounded accent-brand-600"
                  />
                  <span className="text-xs text-gray-700">{p.name} <span className="text-gray-400">— {p.email}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 mb-1">Correos adicionales (CC)</p>
          <div className="flex gap-2">
            <input
              value={ccCustomInput}
              onChange={e => setCcCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCcCustom() } }}
              placeholder="correo@ejemplo.com"
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="button" onClick={addCcCustom}
              className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            >
              Agregar
            </button>
          </div>
          {form.ccCustomEmails.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {form.ccCustomEmails.map(email => (
                <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-full">
                  {email}
                  <button onClick={() => set('ccCustomEmails', form.ccCustomEmails.filter(e => e !== email))} aria-label={`Quitar ${email}`} className="hover:text-gray-900">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plantilla activa */}
      <div className={`rounded-xl p-3.5 border transition-colors ${form.isActive ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isActive}
            onChange={e => set('isActive', e.target.checked)}
            className="w-4 h-4 rounded accent-emerald-600 mt-0.5"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">Plantilla activa</span>
              {form.isActive && <Zap size={13} className="text-emerald-600" />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {isReconocimiento
                ? 'Los reconocimientos siempre se envían manualmente desde "Próximos envíos".'
                : form.isActive
                  ? `El sistema enviará automáticamente por SMTP a las ${form.sendTime || '09:00'} (hora Chile) en cada fecha programada.`
                  : 'Cuando esté activa, el sistema enviará el correo automáticamente por SMTP en la fecha y horario programados.'}
            </p>
          </div>
        </label>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button type="button" onClick={() => valid && onSave(form)} disabled={!valid}
          className="flex-1 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Guardar plantilla
        </button>
      </div>
    </div>
  )
}

// ── localStorage helpers para confirmación manual ─────────────────────────────

function doneKey(item: UpcomingItem): string {
  return `gdp_email_done::${item.ruleId}::${item.employeeId}::${item.triggerDate}`
}

function loadDone(item: UpcomingItem): boolean {
  try { return localStorage.getItem(doneKey(item)) === '1' } catch { return false }
}

function saveDone(item: UpcomingItem, value: boolean): void {
  try {
    if (value) localStorage.setItem(doneKey(item), '1')
    else localStorage.removeItem(doneKey(item))
  } catch {}
}

// ── UpcomingItem card ─────────────────────────────────────────────────────────

function UpcomingCard({ item }: { item: UpcomingItem }) {
  const [done, setDone] = useState(() => loadDone(item))
  const color           = EVENT_TYPE_COLORS[item.eventType]
  const days            = daysUntil(item.triggerDate)
  const sentOrDone      = item.alreadySent || done

  const toggleDone = () => {
    const next = !done
    setDone(next)
    saveDone(item, next)
  }

  const cc = (item.ccEmails ?? []).join(',')
  const openDraft = (email: string) => openGmail(email, item.subject, item.body, cc || undefined)

  return (
    <div className={`border rounded-xl p-3.5 transition-colors ${
      sentOrDone ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-100 hover:border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        {/* Ícono */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
          style={{ backgroundColor: sentOrDone ? '#10b981' : color }}>
          {sentOrDone ? <Check size={14} strokeWidth={2.5} /> : <Mail size={14} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className={`text-sm font-medium truncate ${sentOrDone ? 'text-emerald-700' : 'text-gray-800'}`}>
              {item.employeeName}
            </p>
            {item.years !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: color }}>
                {item.years} año{item.years !== 1 ? 's' : ''}
              </span>
            )}
            {item.alreadySent && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 flex-shrink-0">
                <Zap size={9} /> Enviado auto
              </span>
            )}
            {!item.alreadySent && done && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 flex-shrink-0">
                <Check size={9} strokeWidth={2.5} /> Confirmado
              </span>
            )}
          </div>
          <p className={`text-xs truncate ${sentOrDone ? 'text-emerald-600' : 'text-gray-500'}`}>
            {item.subject}
          </p>
          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
            <Clock size={10} />
            {fmtDate(item.triggerDate)}
            {days === 0 ? ' · hoy' : days === 1 ? ' · mañana' : ` · en ${days} días`}
            {item.ruleIsActive && ` · ${item.sendTime}`}
          </span>
        </div>

        {/* Badge modo */}
        <div className="flex-shrink-0">
          {item.ruleIsActive ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Zap size={9} /> Auto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-100">
              Manual
            </span>
          )}
        </div>
      </div>

      {/* Fila de acciones */}
      {!item.alreadySent && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {/* Botones borrador por destinatario */}
          {item.toEmails.length > 0 ? (
            item.toEmails.map(email => (
              <button
                key={email}
                onClick={() => openDraft(email)}
                title="Abre el correo como borrador en Gmail"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-gray-600"
              >
                <Mail size={11} />
                Borrador{item.toEmails.length > 1 ? ` → ${email.split('@')[0]}` : ''}
              </button>
            ))
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertCircle size={12} /> Sin destinatarios
            </span>
          )}

          {/* Separador */}
          <div className="flex-1" />

          {/* Checkbox confirmar */}
          <label className={`flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 rounded-lg border transition-colors ${
            done
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
            <input
              type="checkbox"
              checked={done}
              onChange={toggleDone}
              className="w-3.5 h-3.5 rounded accent-emerald-600"
            />
            <span className="text-xs font-medium">{done ? 'Hecho' : 'Marcar hecho'}</span>
          </label>
        </div>
      )}

      {/* Info auto-send */}
      {item.ruleIsActive && !item.alreadySent && (
        <p className="mt-1.5 text-[10px] text-emerald-600 flex items-center gap-1">
          <Zap size={10} />
          Se enviará automáticamente el {fmtDate(item.triggerDate)} a las {item.sendTime}
        </p>
      )}
    </div>
  )
}

// ── UpcomingTab ───────────────────────────────────────────────────────────────

function UpcomingTab() {
  const daysUntilYearEnd = (() => {
    const today = new Date()
    const yearEnd = new Date(today.getFullYear(), 11, 31)
    return Math.ceil((yearEnd.getTime() - today.getTime()) / 86400000) + 1
  })()

  const { data: items = [], isLoading } = useQuery<UpcomingItem[]>({
    queryKey: ['calendar-email-upcoming', daysUntilYearEnd],
    queryFn: () => api.get(`/calendar/email-rules/upcoming?days=${daysUntilYearEnd}`).then(r => r.data),
    staleTime: 3 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        Calculando próximos envíos…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <MailOpen size={32} className="opacity-30" />
        <p className="text-sm text-center">No hay correos en los próximos 30 días.</p>
        <p className="text-xs text-center">Crea plantillas en la pestaña "Plantillas" para activar los envíos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 py-2">
      {items.map((item, i) => <UpcomingCard key={i} item={item} />)}
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function EmailRulesDrawer({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose)
  const [tab, setTab]               = useState<'plantillas' | 'proximos'>('plantillas')
  const [editing, setEditing]       = useState<EmailRule | null>(null)
  const [creating, setCreating]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const qc = useQueryClient()

  const { data: rules = [], isLoading } = useQuery<EmailRule[]>({
    queryKey: ['calendar-email-rules'],
    queryFn: () => api.get('/calendar/email-rules').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const [saveError, setSaveError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: Omit<EmailRule, 'id' | 'createdAt' | 'fromProfile'>) =>
      api.post('/calendar/email-rules', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-email-rules'] })
      qc.invalidateQueries({ queryKey: ['calendar-email-upcoming'] })
      setSaveError(null)
      setCreating(false)
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<EmailRule, 'id' | 'createdAt' | 'fromProfile'> }) =>
      api.put(`/calendar/email-rules/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-email-rules'] })
      qc.invalidateQueries({ queryKey: ['calendar-email-upcoming'] })
      setSaveError(null)
      setEditing(null)
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.message ?? err?.message ?? 'Error al guardar')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/email-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-email-rules'] })
      qc.invalidateQueries({ queryKey: ['calendar-email-upcoming'] })
      setDeletingId(null)
    },
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const showForm = creating || !!editing

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-[500px] bg-white h-full flex flex-col shadow-2xl border-l border-gray-100">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Mail size={16} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Correos automáticos</h2>
              <p className="text-xs text-gray-400">Plantillas para cumpleaños, aniversarios y reconocimientos</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['plantillas', 'proximos'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setCreating(false); setEditing(null) }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'plantillas' ? 'Plantillas' : 'Próximos envíos'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {tab === 'plantillas' && (
            <>
              {!showForm && (
                <button onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 justify-center py-2.5 mb-4 text-sm font-medium text-brand-600 border border-dashed border-brand-300 rounded-xl hover:bg-brand-50 transition-colors"
                >
                  <Plus size={14} />
                  Nueva plantilla
                </button>
              )}

              {showForm && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 rounded-full"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[editing?.eventType ?? 'CUMPLEANOS'] }}
                    />
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {editing ? 'Editar plantilla' : 'Nueva plantilla'}
                    </p>
                  </div>
                  {saveError && (
                    <div className="mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{saveError}</p>
                    </div>
                  )}
                  <RuleForm
                    initial={editing ? {
                      name: editing.name, eventType: editing.eventType,
                      fromProfileId: editing.fromProfileId,
                      subject: editing.subject, bodyHtml: editing.bodyHtml,
                      daysBeforeEvent: editing.daysBeforeEvent,
                      sendTime: editing.sendTime,
                      toColaborador: editing.toColaborador,
                      toDirectEmails: editing.toDirectEmails,
                      ccProfileIds: editing.ccProfileIds,
                      ccCustomEmails: editing.ccCustomEmails,
                      isActive: editing.isActive,
                    } : EMPTY_RULE}
                    profiles={profiles}
                    onSave={data => {
                      setSaveError(null)
                      if (editing) updateMutation.mutate({ id: editing.id, data })
                      else createMutation.mutate(data)
                    }}
                    onCancel={() => { setCreating(false); setEditing(null); setSaveError(null) }}
                  />
                </div>
              )}

              {!showForm && (
                <>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                      <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      Cargando plantillas…
                    </div>
                  ) : rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                      <Mail size={32} className="opacity-20" />
                      <p className="text-sm">Aún no hay plantillas de correo.</p>
                      <p className="text-xs">Crea una para automatizar cumpleaños o aniversarios.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(et => {
                        const group = rules.filter(r => r.eventType === et)
                        if (group.length === 0) return null
                        return (
                          <div key={et}>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                              {EVENT_TYPE_LABELS[et]}
                            </p>
                            {group.map(rule => (
                              <div key={rule.id}
                                className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors mb-1.5"
                              >
                                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: rule.isActive ? EVENT_TYPE_COLORS[rule.eventType] : '#d1d5db' }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`text-sm font-medium truncate ${rule.isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                                      {rule.name}
                                    </p>
                                    {rule.isActive
                                      ? <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold border border-emerald-100"><Zap size={8} />AUTO</span>
                                      : <span className="flex-shrink-0 text-[9px] px-1 py-0.5 bg-gray-100 text-gray-400 rounded font-semibold">INACTIVA</span>
                                    }
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                                    {rule.fromProfile && <span>De: {rule.fromProfile.name}</span>}
                                    {rule.isActive && rule.eventType !== 'RECONOCIMIENTO' && (
                                      <span className="flex items-center gap-0.5"><Clock size={9} />{rule.sendTime}</span>
                                    )}
                                    {rule.daysBeforeEvent > 0 && !isReconocimiento(rule) && (
                                      <span>{rule.daysBeforeEvent}d antes</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {deletingId === rule.id ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => deleteMutation.mutate(rule.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Confirmar" aria-label="Confirmar eliminación">
                                        <Check size={13} />
                                      </button>
                                      <button onClick={() => setDeletingId(null)}
                                        className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" aria-label="Cancelar">
                                        <X size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button onClick={() => { setEditing(rule); setCreating(false) }}
                                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar" aria-label="Editar">
                                        <Pencil size={13} />
                                      </button>
                                      <button onClick={() => setDeletingId(rule.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar" aria-label="Eliminar">
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'proximos' && <UpcomingTab />}
        </div>
      </div>
    </div>
  )
}

function isReconocimiento(rule: EmailRule): boolean {
  return rule.eventType === 'RECONOCIMIENTO'
}
