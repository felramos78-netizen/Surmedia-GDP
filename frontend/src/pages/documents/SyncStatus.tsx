import { RefreshCw } from 'lucide-react'
import { useDocSummary, useStartDocSync } from '@/hooks/useBukDocuments'
import { timeAgo } from './EmployeeDocuments'

// Estado de la sincronización total BUK → GDP, con botón para lanzarla
export default function SyncStatus() {
  const { data } = useDocSummary()
  const start = useStartDocSync()
  const syncing = data?.syncing

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      {syncing ? (
        <span className="flex items-center gap-2 text-gray-600">
          Sincronizando con BUK… {syncing.total ? `${syncing.done}/${syncing.total} fichas` : 'preparando'}
          <span className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
            <span
              className="block h-full bg-brand-600 rounded-full transition-all"
              style={{ width: `${syncing.total ? Math.round((syncing.done / syncing.total) * 100) : 5}%` }}
            />
          </span>
        </span>
      ) : data?.lastSync?.at ? (
        <span title={`+${data.lastSync.filesAdded} nuevos · ${data.lastSync.filesRemoved} ya no están en BUK`}>
          Sincronizado con BUK {timeAgo(data.lastSync.at)}
        </span>
      ) : (
        <span>Sin sincronizar</span>
      )}
      <button
        onClick={() => start.mutate()}
        disabled={!!syncing || start.isPending}
        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        Sincronizar
      </button>
    </div>
  )
}
