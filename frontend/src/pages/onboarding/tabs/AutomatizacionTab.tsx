import React, { useState } from 'react'
import { Mail, FileText, FolderOpen } from 'lucide-react'
import CorreosPanel from './CorreosPanel'
import SheetsPanel from './SheetsPanel'
import DocumentosPanel from './DocumentosPanel'

export default function AutomatizacionTab() {
  const [sub, setSub] = useState<'correos' | 'sheets' | 'documentos'>('correos')

  const SUB_TABS = [
    { key: 'correos'    as const, label: 'Correos',    icon: <Mail size={14} /> },
    { key: 'sheets'     as const, label: 'Sheets',     icon: <FileText size={14} /> },
    { key: 'documentos' as const, label: 'Documentos', icon: <FolderOpen size={14} /> },
  ]

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6 border-b border-gray-100 pb-0">
        {SUB_TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              sub === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {sub === 'correos'    && <CorreosPanel />}
      {sub === 'sheets'     && <SheetsPanel />}
      {sub === 'documentos' && <DocumentosPanel />}
    </div>
  )
}
