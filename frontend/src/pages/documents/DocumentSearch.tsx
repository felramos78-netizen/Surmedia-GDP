import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Download, Search, UserCircle2, X } from 'lucide-react'
import {
  useBukDocSearch, useDocSummary, useSetFilesCategory, downloadFilesZip,
  type BukDocSearchPerson, type SignatureStatus,
} from '@/hooks/useBukDocuments'
import { FileRow, FileListHeader, ENTITY_LABEL, ENTITY_COLOR, SIGN_META } from './EmployeeDocuments'
import SyncStatus from './SyncStatus'

const ZIP_MAX_FILES = 300  // mismo tope que el backend (POST /documents/download-zip)

const ENTITY_FILTERS = [
  { value: '',                        label: 'Todas' },
  { value: 'COMUNICACIONES_SURMEDIA', label: 'Comunicaciones' },
  { value: 'SURMEDIA_CONSULTORIA',    label: 'Consultoría' },
]

function PersonRow({ person, selected, onToggleFile, onTogglePerson, onOpenEmployee }: {
  person:         BukDocSearchPerson
  selected:       Set<string>
  onToggleFile:   (id: string) => void
  onTogglePerson: (person: BukDocSearchPerson) => void
  onOpenEmployee: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const picked = person.files.filter(f => selected.has(f.id)).length
  return (
    <li className="border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={picked === person.files.length}
          ref={el => { if (el) el.indeterminate = picked > 0 && picked < person.files.length }}
          onChange={() => onTogglePerson(person)}
          aria-label={`Seleccionar los documentos de ${person.fullName}`}
          className="w-4 h-4 flex-shrink-0 accent-brand-600"
        />
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={`${open ? 'Ocultar' : 'Ver'} documentos de ${person.fullName}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-gray-800 truncate">{person.fullName}</span>
            <span className="block text-xs text-gray-400">
              {person.rut}{person.bukStatus && person.bukStatus !== 'activo' ? ` · ${person.bukStatus}` : ''}
            </span>
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_COLOR[person.legalEntity]}`}>
            {ENTITY_LABEL[person.legalEntity]}
          </span>
          <span className="text-xs text-gray-500 w-24 text-right">
            {person.files.length} {person.files.length === 1 ? 'documento' : 'documentos'}
          </span>
        </button>
        {person.employeeId ? (
          <button
            onClick={() => onOpenEmployee(person.employeeId!)}
            title="Ver todos sus documentos"
            aria-label={`Ver todos los documentos de ${person.fullName}`}
            className="p-1.5 text-gray-400 hover:text-brand-600 rounded"
          >
            <UserCircle2 size={15} />
          </button>
        ) : (
          <span className="w-7" title="No está registrado en GDP" />
        )}
      </div>
      {open && (
        <ul className="ml-9 mr-3 mb-2 border-l border-gray-100 pl-2">
          <FileListHeader selectable />
          {person.files.map(f => (
            <FileRow
              key={f.fileId} file={f} entity={person.legalEntity} bukEmployeeId={person.bukEmployeeId}
              selected={selected.has(f.id)} onToggle={() => onToggleFile(f.id)}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// Buscador de documentos por nombre y/o categoría: cuántos hay y quiénes los tienen
export default function DocumentSearch({ categoryId, onCategoryChange, onOpenEmployee }: {
  categoryId:       string
  onCategoryChange: (id: string) => void
  onOpenEmployee:   (id: string) => void
}) {
  const [input,  setInput]  = useState('')
  const [q,      setQ]      = useState('')
  const [entity, setEntity] = useState('')
  const [status, setStatus] = useState('')
  const [employeeSign, setEmployeeSign] = useState('')
  const [companySign,  setCompanySign]  = useState('')

  // Debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  const { data, isLoading, isError, isFetching } = useBukDocSearch({ q, categoryId, legalEntity: entity, status, employeeSign, companySign })
  const { data: summary } = useDocSummary()
  const setCategory = useSetFilesCategory()

  // Selección para acciones masivas (ids de buk_documents)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [zipBusy,  setZipBusy]  = useState(false)
  const [zipMsg,   setZipMsg]   = useState('')
  const allIds = (data?.people ?? []).flatMap(p => p.files.map(f => f.id))
  const picked = allIds.filter(id => selected.has(id))   // solo lo visible en los resultados actuales

  const toggleFile = (id: string) =>
    setSelected(prev => { const n = new Set(prev); if (!n.delete(id)) n.add(id); return n })
  const togglePerson = (p: BukDocSearchPerson) =>
    setSelected(prev => {
      const n = new Set(prev), ids = p.files.map(f => f.id)
      if (ids.every(id => n.has(id))) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id))
      return n
    })
  const toggleAll = () => setSelected(picked.length === allIds.length ? new Set() : new Set(allIds))

  async function downloadZip() {
    setZipBusy(true); setZipMsg('')
    try {
      const failed = await downloadFilesZip(picked)
      setZipMsg(failed ? `Descargado; ${failed} archivo(s) no se pudieron obtener de BUK.` : 'Descarga lista.')
    } catch (err: unknown) {
      // El error llega como blob (responseType: 'blob'); se intenta leer el mensaje del backend
      const blob = (err as { response?: { data?: Blob } }).response?.data
      let msg = 'No se pudo generar el ZIP.'
      try { if (blob) msg = JSON.parse(await blob.text()).message ?? msg } catch { /* mensaje genérico */ }
      setZipMsg(msg)
    } finally {
      setZipBusy(false)
    }
  }

  // Categorías agrupadas para el selector
  const groups = new Map<string, { id: string; name: string }[]>()
  for (const c of summary?.categories ?? []) groups.set(c.group, [...(groups.get(c.group) ?? []), c])

  const searching = q.length >= 2 || !!categoryId || !!employeeSign || !!companySign

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Documento o carpeta (ej. RIOHS, anexo)…"
            aria-label="Buscar documento por nombre"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={categoryId}
          onChange={e => onCategoryChange(e.target.value)}
          aria-label="Categoría de documento"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-60"
        >
          <option value="">Todas las categorías</option>
          {[...groups.entries()].map(([group, cats]) => (
            <optgroup key={group} label={group}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
          <option value="none">Otros (sin clasificar)</option>
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {ENTITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setEntity(f.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                entity === f.value ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Estado en BUK"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos los estados BUK</option>
          {(data?.statuses ?? []).map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        {([['Firma trabajador', employeeSign, setEmployeeSign], ['Firma empresa', companySign, setCompanySign]] as const).map(([label, value, set]) => (
          <select
            key={label}
            value={value}
            onChange={e => set(e.target.value)}
            aria-label={label}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{label}: todas</option>
            {(Object.keys(SIGN_META) as SignatureStatus[]).map(st => <option key={st} value={st}>{label}: {SIGN_META[st].label.toLowerCase()}</option>)}
          </select>
        ))}
        <div className="ml-auto"><SyncStatus /></div>
      </div>

      {/* Resultados */}
      {isError ? (
        <div className="py-16 text-center">
          <AlertTriangle size={24} className="text-red-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Error consultando el buscador de documentos.</p>
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
      ) : !searching ? (
        <div className="py-16 text-center text-sm text-gray-400">
          Escribe al menos 2 letras o elige una categoría para buscar entre los documentos de todas las fichas BUK.
        </div>
      ) : data && (
        <div className={`space-y-3 ${isFetching ? 'opacity-70' : ''}`}>
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">{data.totalFiles.toLocaleString('es-CL')}</strong> documentos en{' '}
            <strong className="text-gray-900">{data.totalPeople}</strong> de {data.scopePeople} fichas BUK
          </p>
          {allIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox" checked={picked.length === allIds.length} onChange={toggleAll} className="w-4 h-4 accent-brand-600" />
                Seleccionar los {allIds.length.toLocaleString('es-CL')} resultados
              </label>
              {picked.length > 0 && (
                <>
                  <span className="text-gray-500">{picked.length.toLocaleString('es-CL')} seleccionados</span>
                  <button
                    onClick={downloadZip}
                    disabled={zipBusy || picked.length > ZIP_MAX_FILES}
                    title={picked.length > ZIP_MAX_FILES ? `Máximo ${ZIP_MAX_FILES} archivos por descarga; filtra más` : 'Descargar los archivos en un ZIP, en carpetas por categoría'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Download size={14} className={zipBusy ? 'animate-pulse' : ''} />
                    {zipBusy ? 'Armando ZIP…' : 'Descargar ZIP'}
                  </button>
                  <select
                    value=""
                    disabled={setCategory.isPending}
                    onChange={e => e.target.value && setCategory.mutate({ ids: picked, categoryId: e.target.value === '__auto' ? null : e.target.value })}
                    aria-label="Cambiar la categoría de los seleccionados"
                    className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-60"
                  >
                    <option value="">Cambiar categoría a…</option>
                    <option value="__auto">↺ Volver a automática</option>
                    {[...groups.entries()].map(([group, cats]) => (
                      <optgroup key={group} label={group}>
                        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </optgroup>
                    ))}
                    {summary?.fallbackCategory && <option value={summary.fallbackCategory.id}>{summary.fallbackCategory.name}</option>}
                  </select>
                  <button onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-gray-400 hover:text-gray-600">
                    <X size={13} /> Limpiar
                  </button>
                </>
              )}
              {zipMsg && <span className="text-xs text-gray-500" role="status">{zipMsg}</span>}
            </div>
          )}
          {data.people.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Ningún documento coincide con la búsqueda.</div>
          ) : (
            <ul className="bg-white border border-gray-100 rounded-xl">
              {data.people.map(p => (
                <PersonRow
                  key={`${p.legalEntity}-${p.bukEmployeeId}`} person={p} selected={selected}
                  onToggleFile={toggleFile} onTogglePerson={togglePerson} onOpenEmployee={onOpenEmployee}
                />

              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
