import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Folder, RefreshCw, Search } from 'lucide-react'
import {
  useBukDocuments, useSyncEmployeeDocuments, openBukFile, downloadBukFile,
  type BukEntityDocs, type BukFile,
} from '@/hooks/useBukDocuments'
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
const UNCATEGORIZED = 'none'

export function timeAgo(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1)  return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 48)   return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

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

export function CategoryChip({ category }: { category: BukFile['category'] }) {
  return category
    ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">{category.name}</span>
    : <span className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-gray-200 text-gray-400 whitespace-nowrap">Sin clasificar</span>
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
      <CategoryChip category={file.category} />
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

function EntitySection({ docs, query, categoryId }: { docs: BukEntityDocs; query: string; categoryId: string }) {
  const q = query.trim().toLowerCase()
  const filtering = !!q || !!categoryId
  const files = docs.files.filter(f =>
    (!q || f.filename.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q)) &&
    (!categoryId || (categoryId === UNCATEGORIZED ? !f.category : f.category?.id === categoryId)))
  const groups = groupByFolder(files)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[docs.legalEntity]}`}>
          {ENTITY_LABEL[docs.legalEntity]}
        </span>
        <span className="text-xs text-gray-400">
          {filtering ? `${files.length} de ${docs.files.length}` : docs.files.length} documentos · ficha BUK #{docs.bukEmployeeId}
          {docs.bukStatus && docs.bukStatus !== 'activo' && ` (${docs.bukStatus})`}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400">{filtering ? 'Sin resultados para el filtro.' : 'Sin documentos.'}</p>
      ) : (
        <div className="space-y-0.5">
          {groups.map(([name, list]) => (
            <FolderGroup
              key={name}
              name={name}
              files={list}
              entity={docs.legalEntity}
              bukEmployeeId={docs.bukEmployeeId}
              forceOpen={filtering}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Documentos del colaborador registrados en GDP (sincronizados desde BUK),
// agrupados por razón social y carpeta
export default function EmployeeDocuments({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useBukDocuments(employeeId)
  const sync = useSyncEmployeeDocuments(employeeId)
  const [query,      setQuery]      = useState('')
  const [categoryId, setCategoryId] = useState('')

  if (isLoading) return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-gray-400">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      Cargando documentos…
    </div>
  )
  if (isError || !data) return (
    <div className="py-16 text-center">
      <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">No se pudieron cargar los documentos.</p>
    </div>
  )

  // Categorías presentes en los documentos del colaborador, para el filtro
  const categories = new Map<string, { name: string; count: number }>()
  let uncategorized = 0
  for (const f of data.entities.flatMap(e => e.files)) {
    if (!f.category) { uncategorized++; continue }
    const c = categories.get(f.category.id) ?? { name: f.category.name, count: 0 }
    c.count++
    categories.set(f.category.id, c)
  }
  const categoryOptions = [...categories.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name, 'es'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          aria-label="Filtrar por categoría"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map(([id, c]) => <option key={id} value={id}>{c.name} ({c.count})</option>)}
          {uncategorized > 0 && <option value={UNCATEGORIZED}>Sin clasificar ({uncategorized})</option>}
        </select>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          {sync.isError && <span className="text-red-500">No se pudo consultar BUK</span>}
          {data.syncedAt && <span>Actualizado desde BUK {timeAgo(data.syncedAt)}</span>}
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={sync.isPending ? 'animate-spin' : ''} />
            {sync.isPending ? 'Consultando BUK…' : 'Actualizar desde BUK'}
          </button>
        </div>
      </div>

      {data.entities.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No hay documentos registrados en BUK para este colaborador.
        </div>
      ) : (
        data.entities.map(d => (
          <EntitySection key={`${d.legalEntity}-${d.bukEmployeeId}`} docs={d} query={query} categoryId={categoryId} />
        ))
      )}
    </div>
  )
}
