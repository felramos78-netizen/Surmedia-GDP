import React, { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Undo, Redo } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  /** Alto del área editable (px). */
  height?: number
  placeholder?: string
}

// Editor de texto enriquecido mínimo basado en contentEditable + document.execCommand.
// Sin dependencias externas. Usado para el cuerpo del correo y para editar el
// contenido del documento adjunto (con las variables ya aplicadas).
export default function RichTextEditor({ value, onChange, height = 260, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Sincroniza el HTML externo solo cuando difiere del DOM (evita romper el cursor al tipear).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || ''
    }
  }, [value])

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const addLink = () => {
    const url = window.prompt('URL del enlace:')
    if (url) exec('createLink', url)
  }

  const btn = 'p-1.5 rounded hover:bg-gray-100 text-gray-600'

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 bg-gray-50">
        <button type="button" onClick={() => exec('bold')} className={btn} title="Negrita"><Bold size={14} /></button>
        <button type="button" onClick={() => exec('italic')} className={btn} title="Cursiva"><Italic size={14} /></button>
        <button type="button" onClick={() => exec('underline')} className={btn} title="Subrayado"><Underline size={14} /></button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btn} title="Lista"><List size={14} /></button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btn} title="Lista numerada"><ListOrdered size={14} /></button>
        <button type="button" onClick={addLink} className={btn} title="Enlace"><LinkIcon size={14} /></button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" onClick={() => exec('undo')} className={btn} title="Deshacer"><Undo size={14} /></button>
        <button type="button" onClick={() => exec('redo')} className={btn} title="Rehacer"><Redo size={14} /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder={placeholder}
        className="w-full px-4 py-3 text-sm text-gray-700 focus:outline-none overflow-y-auto rte-content"
        style={{ height, lineHeight: 1.7 }}
      />
      <style>{`
        .rte-content:empty:before { content: attr(data-placeholder); color: #9ca3af; }
        .rte-content a { color: #2563eb; }
        .rte-content p { margin: 0 0 10px; }
        .rte-content ul, .rte-content ol { padding-left: 20px; margin: 0 0 10px; }
        .rte-content li { margin-bottom: 4px; }
        .rte-content strong { font-weight: 600; }
        .rte-content table { border-collapse: collapse; }
        .rte-content td, .rte-content th { border: 1px solid #d1d5db; padding: 4px 8px; }
      `}</style>
    </div>
  )
}
