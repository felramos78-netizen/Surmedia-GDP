import React, { useState } from 'react'
import { Mail, Calendar, FileText } from 'lucide-react'
import type { OnboardingProcess } from '@/types'
import CorreosPanel from './CorreosPanel'
import CalendarPanel from './CalendarPanel'
import FormulariosPanel from './FormulariosPanel'

interface Props {
  processes: OnboardingProcess[]
}

export default function AutomatizacionTab({ processes }: Props) {
  const [sub, setSub] = useState<'correos' | 'calendar' | 'formularios'>('correos')

  const SUB_TABS = [
    { key: 'correos'     as const, label: 'Correos',     icon: <Mail size={14} /> },
    { key: 'calendar'    as const, label: 'Calendar',    icon: <Calendar size={14} /> },
    { key: 'formularios' as const, label: 'Formularios', icon: <FileText size={14} /> },
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

      {sub === 'correos'     && <CorreosPanel />}
      {sub === 'calendar'    && <CalendarPanel processes={processes} />}
      {sub === 'formularios' && <FormulariosPanel processes={processes} />}
    </div>
  )
}
