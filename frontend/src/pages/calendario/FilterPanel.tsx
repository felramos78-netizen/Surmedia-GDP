import { FILTER_GROUPS } from './calendarUtils'

export interface OnboardingProcessSummary { id: string; collaboratorName: string }

export function FilterPanel({
  active, onToggle,
  onboardingProcesses, hiddenProcessIds, onToggleProcess,
}: {
  active: Set<string>
  onToggle: (k: string) => void
  onboardingProcesses: OnboardingProcessSummary[]
  hiddenProcessIds: Set<string>
  onToggleProcess: (id: string) => void
}) {
  return (
    <aside className="w-52 flex-shrink-0 border-l border-gray-100 bg-white p-4 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtros</p>
      <div className="space-y-0.5">
        {FILTER_GROUPS.map(g => (
          <div key={g.key}>
            <button
              onClick={() => onToggle(g.key)}
              className="w-full flex items-center gap-2.5 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div
                className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: active.has(g.key) ? g.color : 'white',
                  borderColor:     active.has(g.key) ? g.color : '#d1d5db',
                }}
              >
                {active.has(g.key) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <polyline points="1,3 3,5 7,1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-700">{g.label}</span>
            </button>

            {/* Sub-checks por proceso de onboarding */}
            {g.key === 'onboarding' && active.has('onboarding') && onboardingProcesses.length > 0 && (
              <div className="ml-5 mt-0.5 mb-1 space-y-0.5">
                {onboardingProcesses.map(proc => {
                  const visible = !hiddenProcessIds.has(proc.id)
                  return (
                    <button
                      key={proc.id}
                      onClick={() => onToggleProcess(proc.id)}
                      className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-md px-1.5 py-0.5 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          backgroundColor: visible ? g.color : 'white',
                          borderColor:     visible ? g.color : '#d1d5db',
                        }}
                      >
                        {visible && (
                          <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                            <polyline points="0.5,2.5 2,4 5.5,0.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 truncate leading-tight">{proc.collaboratorName}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Referencia</p>
        <div className="space-y-1.5">
          {FILTER_GROUPS.filter(g => active.has(g.key)).map(g => (
            <div key={g.key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="text-[11px] text-gray-500">{g.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
