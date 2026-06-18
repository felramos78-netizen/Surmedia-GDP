import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, X, CalendarPlus, Check } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import {
  type CalEvent, type RangeOption, RANGE_OPTIONS, TYPE_LABELS,
  parseDate, toDateStr, addDays, getPresetRange, useCalendarEvents, useProfiles,
  loadExportedIds, saveExportedIds, downloadICS, EMPTY_EVENTS, EMPTY_PROFILES,
} from './calendarUtils'

export function ProfileCalendarModal({ activeTypes, onClose }: {
  activeTypes: Set<string>
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const today = new Date()

  const [rangeOption, setRangeOption]   = useState<RangeOption>('desde-hoy')
  const [customStart, setCustomStart]   = useState(toDateStr(today))
  const [customEnd, setCustomEnd]       = useState(toDateStr(addDays(today, 30)))
  const [profileId, setProfileId]       = useState('')
  const [checked, setChecked]           = useState<Set<string>>(new Set())
  const [exportedIds, setExportedIds]   = useState<Set<string>>(new Set())
  const [justDownloaded, setJustDownloaded] = useState(false)

  const { data: profiles = EMPTY_PROFILES, isLoading: loadingProfiles } = useProfiles()

  const queryRange = useMemo(() => {
    if (rangeOption === 'personalizado') {
      return { start: customStart || toDateStr(today), end: customEnd || toDateStr(addDays(today, 30)) }
    }
    return getPresetRange(rangeOption)
  }, [rangeOption, customStart, customEnd])

  const { data: rawEvents = EMPTY_EVENTS, isFetching } = useCalendarEvents(queryRange.start, queryRange.end)

  const events = useMemo(
    () => rawEvents.filter((ev: CalEvent) => activeTypes.has(ev.type)),
    [rawEvents, activeTypes],
  )

  const profile = profiles.find(p => p.id === profileId)

  // Cuando cambia el perfil: cargar IDs ya exportados y desmarcarlos por defecto
  useEffect(() => {
    const exported = profile ? loadExportedIds(profile.email) : new Set<string>()
    setExportedIds(exported)
    setChecked(new Set(events.filter(e => !exported.has(e.id)).map(e => e.id)))
    setJustDownloaded(false)
  }, [profileId])

  // Cuando cambian los eventos (rango): resetear selección respetando exportados
  useEffect(() => {
    setChecked(new Set(events.filter(e => !exportedIds.has(e.id)).map(e => e.id)))
    setJustDownloaded(false)
  }, [events])

  const selected = events.filter(ev => checked.has(ev.id))

  const toggle = (id: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleDownload = () => {
    if (!profile || selected.length === 0) return
    const date = toDateStr(today)
    downloadICS(selected, profile.email, `gdp-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${date}.ics`)
    saveExportedIds(profile.email, selected.map(e => e.id))
    setExportedIds(prev => { const n = new Set(prev); selected.forEach(e => n.add(e.id)); return n })
    setJustDownloaded(true)
  }

  const fmtShort = (s: string) =>
    parseDate(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Exportar a Google Calendar</h3>
            <p className="text-xs text-gray-400 mt-0.5">Descarga el .ics e impórtalo en Google Calendar de una vez.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Selector de rango */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="text-xs font-medium text-gray-600 mb-2">Rango de fechas</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setRangeOption(opt.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  rangeOption === opt.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rangeOption === 'personalizado' ? (
            <div className="flex items-center gap-2">
              <input
                type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-gray-400 text-xs flex-shrink-0">→</span>
              <input
                type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              {fmtShort(queryRange.start)} → {fmtShort(queryRange.end)}
            </p>
          )}
        </div>

        {/* Selector de perfil */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil destinatario</label>
          {loadingProfiles ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Seleccionar perfil...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.email}</option>
              ))}
            </select>
          )}
          {profile && (
            <p className="mt-1 text-xs text-gray-400">
              {profile.position} · se incluirá <span className="font-medium text-gray-600">{profile.email}</span> como invitado
            </p>
          )}
        </div>

        {/* Lista de eventos */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isFetching ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Cargando eventos…
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-1">
              <CalendarDays size={28} className="opacity-30" />
              <p className="text-sm">Sin eventos para este rango y filtros activos.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">{selected.length}</span> de {events.length} seleccionados
                  {exportedIds.size > 0 && (
                    <span className="ml-1.5 text-emerald-600 font-medium">· {exportedIds.size} ya exportados</span>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setChecked(new Set(events.map(e => e.id)))}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Todo
                  </button>
                  <button
                    onClick={() => setChecked(new Set())}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div className="space-y-0.5">
                {events.map(ev => {
                  const s            = parseDate(ev.start)
                  const e            = parseDate(ev.end)
                  const sameDay      = ev.start === ev.end
                  const wasExported  = exportedIds.has(ev.id)
                  return (
                    <label
                      key={ev.id}
                      className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(ev.id)}
                        onChange={() => toggle(ev.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-brand-600 flex-shrink-0"
                      />
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: ev.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{ev.title}</p>
                          {wasExported && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-600 flex-shrink-0 border border-emerald-100">
                              <Check size={8} strokeWidth={2.5} />
                              Exportado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {s.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                          {!sameDay && ` → ${e.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`}
                          {' · '}{TYPE_LABELS[ev.type] ?? ev.type}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Instrucción de importación */}
        {justDownloaded && (
          <div className="mx-5 mb-2 flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex-shrink-0">
            <Check size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 leading-relaxed">
              <span className="font-semibold">Archivo descargado.</span> En Google Calendar: Configuración → Importar → selecciona el archivo .ics descargado.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-400">
            {!profile
              ? 'Selecciona un perfil para continuar'
              : `${selected.length} evento${selected.length !== 1 ? 's' : ''} en el archivo`}
          </p>
          <button
            onClick={handleDownload}
            disabled={!profile || selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CalendarPlus size={14} />
            Descargar .ics
          </button>
        </div>
      </div>
    </div>
  )
}
