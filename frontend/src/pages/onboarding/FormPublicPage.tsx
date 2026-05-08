import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { OnboardingForm, FormField } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

async function fetchPublicForm(token: string): Promise<OnboardingForm> {
  const res = await fetch(`${BASE_URL}/forms/${token}`)
  if (!res.ok) throw new Error('Formulario no encontrado')
  const json = await res.json()
  return json.data
}

async function submitPublicForm(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/forms/${token}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Error al enviar el formulario')
  }
  return res.json()
}

// ─── Renderizador de campo ────────────────────────────────────────────────────

function FieldInput({
  field, value, onChange,
}: {
  field:    FormField
  value:    unknown
  onChange: (v: unknown) => void
}) {
  const baseClass = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        className={`${baseClass} resize-none`}
      />
    )
  }
  if (field.type === 'date') {
    return (
      <input type="date" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
        required={field.required} className={baseClass} />
    )
  }
  if (field.type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}
        required={field.required} className={`${baseClass} bg-white`}>
        <option value="">— Seleccionar —</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (field.type === 'radio') {
    return (
      <div className="space-y-2 mt-1">
        {(field.options ?? []).map(o => (
          <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
            <input type="radio" name={field.id} value={o} checked={value === o}
              onChange={() => onChange(o)} required={field.required}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">{o}</span>
          </label>
        ))}
      </div>
    )
  }
  if (field.type === 'checkbox') {
    const vals = Array.isArray(value) ? value as string[] : []
    return (
      <div className="space-y-2 mt-1">
        {(field.options ?? []).map(o => (
          <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={vals.includes(o)}
              onChange={e => {
                if (e.target.checked) onChange([...vals, o])
                else onChange(vals.filter((v: string) => v !== o))
              }}
              className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">{o}</span>
          </label>
        ))}
      </div>
    )
  }
  return (
    <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder} required={field.required} className={baseClass} />
  )
}

// ─── Página pública ───────────────────────────────────────────────────────────

export default function FormPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [data,       setData]       = useState<Record<string, unknown>>({})
  const [respondentName,  setName]  = useState('')
  const [respondentEmail, setEmail] = useState('')
  const [submitted, setSubmitted]   = useState(false)

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['publicForm', token],
    queryFn: () => fetchPublicForm(token!),
    enabled: !!token,
    retry: false,
  })

  const submit = useMutation({
    mutationFn: () => submitPublicForm(token!, { respondentName, respondentEmail, data }),
    onSuccess: () => setSubmitted(true),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Formulario no disponible</h2>
          <p className="text-sm text-gray-500">El enlace es inválido, el formulario fue desactivado o ya expiró.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Respuesta enviada!</h2>
          <p className="text-sm text-gray-500">
            Gracias por completar el formulario. El equipo de Personas revisará la información.
          </p>
        </div>
      </div>
    )
  }

  const fields = form.fields as FormField[]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit.mutate()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl px-6 py-8 mb-6 text-white text-center shadow-lg">
          <p className="text-sm text-blue-200 mb-1">Surmedia · Gestión de Personas</p>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.process && (
            <p className="text-blue-200 text-sm mt-2">
              Onboarding de {form.process.collaboratorName}
            </p>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          {/* Datos del respondente */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Tu nombre</label>
              <input type="text" value={respondentName} onChange={e => setName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Tu email</label>
              <input type="email" value={respondentEmail} onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.cl"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Este formulario no tiene campos configurados.</p>
          ) : (
            fields.map(field => (
              <div key={field.id}>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <FieldInput
                  field={field}
                  value={data[field.id]}
                  onChange={v => setData(prev => ({ ...prev, [field.id]: v }))}
                />
              </div>
            ))
          )}

          {submit.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {(submit.error as Error)?.message ?? 'Error al enviar el formulario. Intenta de nuevo.'}
            </div>
          )}

          <button
            type="submit"
            disabled={submit.isPending}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submit.isPending ? 'Enviando…' : 'Enviar formulario'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Este formulario es parte del proceso de onboarding de Surmedia.
          </p>
        </form>
      </div>
    </div>
  )
}
