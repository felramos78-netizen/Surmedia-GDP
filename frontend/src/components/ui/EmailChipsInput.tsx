import { useState } from 'react'
import { X } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Lista de emails escritos a mano (invitados, copias, etc.).
// Se agregan con Enter, coma o al salir del campo; se pueden pegar varios separados por coma o espacio.
export function EmailChipsInput({
  value, onChange, placeholder = 'correo@surmedia.cl', lockedEmails = [], className = '',
}: {
  value: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
  /** Emails mostrados como fijos (no se pueden quitar) */
  lockedEmails?: string[]
  className?: string
}) {
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)

  const commit = () => {
    const parts = input.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    if (parts.length === 0) return
    const bad = parts.filter(p => !EMAIL_RE.test(p))
    const good = parts.filter(p => EMAIL_RE.test(p) && !value.includes(p) && !lockedEmails.includes(p))
    if (good.length) onChange([...value, ...good])
    setInput(bad.join(', '))
    setInvalid(bad.length > 0)
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 px-1.5 py-1 border rounded-lg bg-white ${invalid ? 'border-red-300' : 'border-gray-200'} focus-within:ring-1 focus-within:ring-brand-500 ${className}`}>
      {lockedEmails.map(email => (
        <span key={email} className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full">
          {email}
        </span>
      ))}
      {value.map(email => (
        <span key={email} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded-full">
          {email}
          <button type="button" onClick={() => onChange(value.filter(e => e !== email))} aria-label={`Quitar ${email}`} className="hover:text-purple-900">
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); setInvalid(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          else if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        aria-label="Agregar email"
        aria-invalid={invalid}
        className="flex-1 min-w-[120px] px-1 py-0.5 text-xs bg-transparent focus:outline-none"
      />
    </div>
  )
}
