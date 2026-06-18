import React, { useEffect, useRef, useState } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'

interface EditableComboboxProps {
  value: string
  onChange: (v: string) => void
  /** Opciones que ya existen en el sistema (no se pueden eliminar). */
  systemOptions?: string[]
  /** Clave de localStorage donde se persisten las opciones agregadas por el usuario. */
  storageKey: string
  placeholder?: string
  /** Usa textarea en lugar de input (para textos largos como el horario). */
  multiline?: boolean
}

/**
 * Combobox editable: el usuario puede escribir libremente, elegir de una lista
 * desplegable (opciones del sistema + opciones agregadas), agregar nuevas
 * opciones que quedan guardadas en memoria (localStorage) y eliminar las
 * agregadas manualmente.
 */
export default function EditableCombobox({
  value, onChange, systemOptions = [], storageKey, placeholder, multiline,
}: EditableComboboxProps) {
  const [custom, setCustom] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      }
    } catch {}
    return []
  })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(custom))
  }, [custom, storageKey])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allOptions = Array.from(new Set([
    ...systemOptions.filter(o => o && o.trim()),
    ...custom.filter(o => o && o.trim()),
  ]))
  const q = value.trim().toLowerCase()
  const filtered = q ? allOptions.filter(o => o.toLowerCase().includes(q)) : allOptions
  const exactMatch = allOptions.some(o => o.toLowerCase() === q)
  const canAdd = q.length > 0 && !exactMatch

  const addCustom = (text: string) => {
    const t = text.trim()
    if (!t) return
    if (!allOptions.some(o => o.toLowerCase() === t.toLowerCase())) setCustom(prev => [...prev, t])
    onChange(t)
    setOpen(false)
  }
  const removeCustom = (opt: string) => setCustom(prev => prev.filter(o => o !== opt))

  const inputClass = 'w-full pr-8 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        {multiline ? (
          <textarea
            rows={2} placeholder={placeholder} value={value}
            onChange={e => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className={inputClass + ' resize-none'}
          />
        ) : (
          <input
            type="text" placeholder={placeholder} value={value}
            onChange={e => { onChange(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className={inputClass}
          />
        )}
        <button
          type="button" tabIndex={-1} aria-label="Ver opciones"
          onClick={() => setOpen(o => !o)}
          className="absolute right-2 top-2.5 text-gray-300 hover:text-gray-500"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {open && (filtered.length > 0 || canAdd) && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(opt => {
            const isCustom = custom.includes(opt) && !systemOptions.includes(opt)
            return (
              <div key={opt} className="group flex items-center hover:bg-brand-50 border-b border-gray-50 last:border-0">
                <button
                  type="button" onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className="flex-1 px-3 py-2 text-left text-xs text-gray-700 truncate"
                >
                  {opt}
                </button>
                {isCustom && (
                  <button
                    type="button" onMouseDown={e => e.preventDefault()}
                    onClick={() => removeCustom(opt)} aria-label="Quitar opción"
                    className="px-2 py-2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
          {canAdd && (
            <button
              type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => addCustom(value)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-xs text-brand-600 hover:bg-brand-50 border-t border-gray-100"
            >
              <Plus size={12} /> Agregar «{value.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  )
}
