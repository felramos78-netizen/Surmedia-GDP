import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { type CalEvent, TYPE_LABELS, parseDate } from './calendarUtils'

export function EventDetailModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  useEscapeKey(onClose)
  const s       = parseDate(event.start)
  const e       = parseDate(event.end)
  const sameDay = event.start === event.end

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-xs p-4"
        onClick={ev => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              {TYPE_LABELS[event.type] ?? event.type}
            </span>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={14} />
          </button>
        </div>

        <p className="text-sm font-semibold text-gray-800 mb-3">{event.title}</p>

        <div className="text-xs text-gray-500 space-y-1.5">
          {sameDay ? (
            <p>{s.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          ) : (
            <p>
              {s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} →{' '}
              {e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
              {event.meta?.days ? ` (${event.meta.days} días)` : ''}
            </p>
          )}
          {event.meta?.status      && <p>Estado: {event.meta.status === 'APPROVED' ? 'Aprobado' : 'Pendiente'}</p>}
          {event.meta?.jobTitle    && <p>Cargo: {event.meta.jobTitle}</p>}
          {event.meta?.contractType && <p>Contrato: {event.meta.contractType}</p>}
          {event.meta?.name        && <p>Colaborador: {event.meta.name}</p>}
          {event.meta?.period      && <p>Período: {String(event.meta.period).replace('_', ' ')}</p>}
        </div>
      </div>
    </div>
  )
}
