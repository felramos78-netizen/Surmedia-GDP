import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Folder, Search } from 'lucide-react'
import { useBukDocuments, openBukFile, downloadBukFile, type BukEntityDocs, type BukFile } from '@/hooks/useBukDocuments'
import { formatDate } from '@/lib/utils'
import type { LegalEntity } from '@/types'

export const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
export const ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const NO_FOLDER = 'Sin carpeta'

function groupByFolder(files: BukFile[]) {
  const groups = new Map<string, BukFile[]>()
  for (const f of files) {
    const key = f.folder || NO_FOLDER
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
}

export function FileRow({ file, entity, bukEmployeeId }: { file: BukFile; entity: LegalEntity; bukEmployeeId: number }) {
  const [busy,  setBusy]  = useState<'open' | 'download' | null>(null)
  const [error, setError] = useState(false)

  async function run(kind: 'open' | 'download') {
    setBusy(kind); setError(false)
    try {
      if (kind === 'open') await openBukFile(entity, bukEmployeeId, file)
      else                 await downloadBukFile(entity, bukEmployeeId, file)
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg group">
      <FileText size={15} className="text-gray-400 flex-shrink-0" />
      <span className="flex-1 min-w-0 text-sm text-gray-700 truncate" title={file.filename}>{file.filename}</span>
      {error && <span className="text-xs text-red-500">Error al obtener el archivo</span>}
      <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
        {file.createdAt ? formatDate(file.createdAt) : '—'}
      </span>
      <button
        onClick={() => run('open')}
        disabled={!!busy}
        aria-label={`Ver ${file.filename}`}
        title="Ver"
        className="p-1.5 text-gray-400 hover:text-brand-600 rounded disabled:opacity-40"
      >
        <ExternalLink size={14} className={busy === 'open' ? 'animate-pulse' : ''} />
      </button>
      <button
        onClick={() => run('download')}
        disabled={!!busy}
        aria-label={`Descargar ${file.filename}`}
        title="Descargar"
        className="p-1.5 text-gray-400 hover:text-brand-600 rounded disabled:opacity-40"
      >
        <Download size={14} className={busy === 'download' ? 'animate-pulse' : ''} />
      </button>
    </li>
  )
}

function FolderGroup({ name, files, entity, bukEmployeeId, forceOpen }: {
  name: string; files: BukFile[]; entity: LegalEntity; bukEmployeeId: number; forceOpen: boolean
}) {
  const [open, setOpen] = useState(false)
  const expanded = open || forceOpen
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
      >
        {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        <Folder size={15} className="text-amber-500" />
        <span className="flex-1 text-left">{name}</span>
        <span className="text-xs text-gray-400">{files.length}</span>
      </button>
      {expanded && (
        <ul className="ml-6 border-l border-gray-100 pl-2">
          {files.map(f => <FileRow key={f.fileId} file={f} entity={entity} bukEmployeeId={bukEmployeeId} />)}
        </ul>
      )}
    </div>
  )
}

function EntitySection({ docs, query }: { docs: BukEntityDocs; query: string }) {
  const q = query.trim().toLowerCase()
  const files = q
    ? docs.files.filter(f => f.filename.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q))
    : docs.files
  const groups = groupByFolder(files)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[docs.legalEntity]}`}>
          {ENTITY_LABEL[docs.legalEntity]}
        </span>
        {docs.bukEmployeeId != null && (
          <span className="text-xs text-gray-400">
            {docs.files.length} documentos · ficha BUK #{docs.bukEmployeeId}
            {docs.bukStatus && docs.bukStatus !== 'activo' && ` (${docs.bukStatus})`}
          </span>
        )}
      </div>

      {docs.error ? (
        <p className="text-sm text-red-500 flex items-center gap-2"><AlertTriangle size={14} /> {docs.error}</p>
      ) : docs.bukEmployeeId == null ? (
        <p className="text-sm text-gray-400">No registrado en BUK de esta razón social.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400">{q ? 'Sin resultados para la búsqueda.' : 'Sin documentos.'}</p>
      ) : (
        <div className="space-y-0.5">
          {groups.map(([name, list]) => (
            <FolderGroup
              key={name}
              name={name}
              files={list}
              entity={docs.legalEntity}
              bukEmployeeId={docs.bukEmployeeId!}
              forceOpen={!!q}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Documentos del colaborador en BUK, agrupados por razón social y carpeta
export default function EmployeeDocuments({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useBukDocuments(employeeId)
  const [query, setQuery] = useState('')

  if (isLoading) return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-400">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      Consultando BUK…
    </div>
  )
  if (isError || !data) return (
    <div className="py-16 text-center">
      <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No se pudieron cargar los documentos desde BUK.</p>
    </div>
  )

  // Si el colaborador existe en una sola razón social, esa va primero
  const entities = [...data.entities].sort((a, b) => Number(b.bukEmployeeId != null) - Number(a.bukEmployeeId != null))

  return (
    <div className="space-y-4">
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar documento o carpeta…"
          aria-label="Buscar documento"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {entities.map(d => <EntitySection key={`${d.legalEntity}-${d.bukEmployeeId}`} docs={d} query={query} />)}
    </div>
  )
}
