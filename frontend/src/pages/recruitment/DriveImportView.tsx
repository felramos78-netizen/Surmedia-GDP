import { useMemo, useState } from 'react'
import { FolderSearch, Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, UserCheck, MoveRight, RefreshCw } from 'lucide-react'
import {
  useDriveImportPreview, useApplyDriveImport, useLastDriveImport,
  STAGES, STAGE_META, SOURCE_LABEL, type ImportRow, type ApplyRow, type RecruitmentStage,
} from '@/hooks/useRecruitment'

type Edit = Partial<Pick<ApplyRow, 'fullName' | 'email' | 'phone' | 'linkedinUrl' | 'stage'>>

const cellInput = 'w-full px-1.5 py-1 text-xs border border-transparent hover:border-gray-200 focus:border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 bg-transparent'

const MATCH_REASON: Record<string, string> = {
  email: 'mismo email', rut: 'mismo RUT', linkedin: 'mismo LinkedIn', nombre: 'mismo nombre', 'mismo archivo': 'mismo archivo',
}

export default function DriveImportView({ onDone }: { onDone: () => void }) {
  const [started, setStarted] = useState(false)
  const { data: preview, isFetching, error, refetch } = useDriveImportPreview(started)
  const { data: last } = useLastDriveImport()
  const apply = useApplyDriveImport()

  const [edits, setEdits]       = useState<Record<string, Edit>>({})
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [removeIds, setRemoveIds] = useState<Set<string> | null>(null)
  const [open, setOpen]         = useState<Set<string>>(new Set())
  const [result, setResult]     = useState<Record<string, number> | null>(null)

  const groups = useMemo(() => {
    const m = new Map<string, ImportRow[]>()
    for (const r of preview?.rows ?? []) m.set(r.openingFolder, [...(m.get(r.openingFolder) ?? []), r])
    return [...m]
  }, [preview])

  const rows = preview?.rows ?? []
  const selected = rows.filter(r => !excluded.has(r.drivePath))
  const missingName = selected.filter(r => !(edits[r.drivePath]?.fullName ?? r.data.fullName ?? '').trim())
  const removedSel = removeIds ?? new Set(preview?.removed.map(r => r.id) ?? [])

  const val = (r: ImportRow, k: keyof Edit) => (edits[r.drivePath]?.[k] ?? (k === 'stage' ? r.stage : r.data[k as keyof ImportRow['data']]) ?? '') as string
  const setVal = (r: ImportRow, k: keyof Edit, v: string) => setEdits(e => ({ ...e, [r.drivePath]: { ...e[r.drivePath], [k]: v } }))
  const toggleRows = (paths: string[], include: boolean) => setExcluded(prev => {
    const n = new Set(prev); paths.forEach(p => include ? n.delete(p) : n.add(p)); return n
  })

  const doApply = async () => {
    const payload: ApplyRow[] = selected.map(r => ({
      drivePath:   r.drivePath,
      stage:       val(r, 'stage') as RecruitmentStage,
      fullName:    val(r, 'fullName').trim() || r.fileName,
      email:       val(r, 'email').trim() || null,
      phone:       val(r, 'phone').trim() || null,
      rut:         r.data.rut,
      linkedinUrl: val(r, 'linkedinUrl').trim() || null,
    }))
    const res = await apply.mutateAsync({ rows: payload, removedIds: [...removedSel] })
    setResult(res.stats)
    setStarted(false); setEdits({}); setExcluded(new Set()); setRemoveIds(null)
  }

  // ── Estado inicial / resultado ──────────────────────────────────────────────

  if (result) return (
    <div className="max-w-lg mx-auto py-12 text-center space-y-3">
      <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
      <p className="text-sm font-medium text-gray-800">Importación lista</p>
      <p className="text-sm text-gray-500">
        {result.candidatesCreated} candidatos nuevos · {result.files} archivos · {result.applications} postulaciones
        {result.candidatesUpdated > 0 && ` · ${result.candidatesUpdated} candidatos completados`}
        {result.moved > 0 && ` · ${result.moved} archivos movidos`}
        {result.removed > 0 && ` · ${result.removed} archivos ya no están en Drive`}
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button onClick={() => setResult(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Volver</button>
        <button onClick={onDone} className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700">Ver candidatos</button>
      </div>
    </div>
  )

  if (!started || (isFetching && !preview) || error) return (
    <div className="max-w-xl mx-auto py-12 text-center space-y-3">
      <FolderSearch size={32} className="text-gray-300 mx-auto" />
      <p className="text-sm text-gray-700">
        GDP revisa la carpeta de Reclutamiento en Drive, lee los CVs nuevos y te muestra lo que encontró antes de guardar nada.
      </p>
      <p className="text-xs text-gray-400">
        Cada carpeta principal es una vacante. Las subcarpetas definen la etapa ("No aplica" / "Descartados" → Descartado,
        "Aplica" / "Idóneos" / "Preseleccionados" → Preseleccionado, "Dudas" → En revisión) y "old" marca la postulación como histórica.
      </p>
      {last && (
        <p className="text-xs text-gray-400">Última importación: {new Date(last.at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</p>
      )}
      {error && (
        <p className="flex items-start justify-center gap-1.5 text-xs text-red-600">
          <AlertTriangle size={13} className="mt-0.5" />{(error as any)?.response?.data?.message ?? 'No se pudo leer la carpeta de Drive'}
        </p>
      )}
      <button
        onClick={() => { if (started) refetch(); else setStarted(true) }}
        disabled={isFetching}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-60"
      >
        {isFetching ? <><Loader2 size={14} className="animate-spin" /> Leyendo CVs… (unos 20 segundos)</> : 'Buscar CVs nuevos en Drive'}
      </button>
    </div>
  )

  if (!preview) return null

  // ── Revisión ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{rows.length}</span> archivos nuevos en {groups.length} vacantes
          {preview.unchanged > 0 && <span className="text-gray-400"> · {preview.unchanged} ya importados</span>}
        </p>
        <button onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Volver a leer Drive
        </button>
      </div>

      {rows.length === 0 && preview.removed.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">No hay CVs nuevos en la carpeta. Todo está al día.</div>
      )}

      {groups.map(([folder, gRows]) => {
        const isOpen = open.has(folder)
        const included = gRows.filter(r => !excluded.has(r.drivePath)).length
        const isNewOpening = !preview.openings.find(o => o.folder === folder)?.exists
        return (
          <div key={folder} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50/70">
              <input
                type="checkbox"
                checked={included === gRows.length}
                ref={el => { if (el) el.indeterminate = included > 0 && included < gRows.length }}
                onChange={e => toggleRows(gRows.map(r => r.drivePath), e.target.checked)}
                aria-label={`Incluir todos los archivos de ${folder}`}
                className="w-4 h-4 accent-brand-600"
              />
              <button onClick={() => setOpen(o => { const n = new Set(o); n.has(folder) ? n.delete(folder) : n.add(folder); return n })}
                aria-expanded={isOpen} className="flex-1 flex items-center gap-2 text-left">
                {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                <span className="text-sm font-medium text-gray-800">{folder}</span>
                {isNewOpening && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">VACANTE NUEVA</span>}
                <span className="text-xs text-gray-400 ml-auto">{included}/{gRows.length} seleccionados</span>
              </button>
            </div>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-gray-400">
                    <tr className="border-b border-gray-100">
                      <th className="w-8" />
                      <th className="text-left font-medium px-1.5 py-1.5 min-w-[180px]">Nombre</th>
                      <th className="text-left font-medium px-1.5 py-1.5 min-w-[170px]">Email</th>
                      <th className="text-left font-medium px-1.5 py-1.5 min-w-[120px]">Teléfono</th>
                      <th className="text-left font-medium px-1.5 py-1.5 min-w-[170px]">LinkedIn</th>
                      <th className="text-left font-medium px-1.5 py-1.5">Etapa</th>
                      <th className="text-left font-medium px-1.5 py-1.5 min-w-[200px]">Archivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gRows.map(r => {
                      const inc = !excluded.has(r.drivePath)
                      const noName = inc && !val(r, 'fullName').trim()
                      return (
                        <tr key={r.drivePath} className={inc ? '' : 'opacity-40'}>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" checked={inc} onChange={e => toggleRows([r.drivePath], e.target.checked)}
                              aria-label={`Incluir ${r.fileName}`} className="w-3.5 h-3.5 accent-brand-600" />
                          </td>
                          <td className="px-0.5 py-1">
                            <input className={`${cellInput} ${noName ? 'border-amber-300 bg-amber-50' : ''}`} value={val(r, 'fullName')}
                              onChange={e => setVal(r, 'fullName', e.target.value)} placeholder="Nombre…" aria-label="Nombre" disabled={!!r.movedFrom} />
                            {r.match && (
                              <span className="flex items-center gap-1 px-1.5 text-[10px] text-emerald-700">
                                {r.movedFrom ? <MoveRight size={10} /> : <UserCheck size={10} />}
                                {r.movedFrom ? `Movido desde ${r.movedFrom.split('/').slice(1, -1).join(' / ') || 'la carpeta raíz de la vacante'}` : `Se suma a ${r.match.fullName} (${MATCH_REASON[r.match.reason] ?? r.match.reason})`}
                              </span>
                            )}
                          </td>
                          <td className="px-0.5 py-1"><input className={cellInput} value={val(r, 'email')} onChange={e => setVal(r, 'email', e.target.value)} aria-label="Email" disabled={!!r.movedFrom} /></td>
                          <td className="px-0.5 py-1"><input className={cellInput} value={val(r, 'phone')} onChange={e => setVal(r, 'phone', e.target.value)} aria-label="Teléfono" disabled={!!r.movedFrom} /></td>
                          <td className="px-0.5 py-1"><input className={cellInput} value={val(r, 'linkedinUrl')} onChange={e => setVal(r, 'linkedinUrl', e.target.value)} placeholder="—" aria-label="LinkedIn" disabled={!!r.movedFrom} /></td>
                          <td className="px-0.5 py-1">
                            <select value={val(r, 'stage')} onChange={e => setVal(r, 'stage', e.target.value)} aria-label="Etapa"
                              className={`text-[11px] px-1.5 py-0.5 rounded-full border-0 ${STAGE_META[val(r, 'stage') as RecruitmentStage].cls}`}>
                              {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                            </select>
                            {r.isArchived && <span className="block px-1.5 text-[10px] text-gray-400">histórico</span>}
                          </td>
                          <td className="px-1.5 py-1 text-gray-500">
                            <span className="block truncate max-w-[260px]" title={r.drivePath}>{r.fileName}</span>
                            <span className="block text-[10px] text-gray-400">
                              {SOURCE_LABEL[r.source]}{r.folderPath && ` · ${r.folderPath}`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {preview.removed.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-medium text-amber-800">
            {preview.removed.length} archivo{preview.removed.length !== 1 && 's'} importado{preview.removed.length !== 1 && 's'} ya no está{preview.removed.length !== 1 && 'n'} en Drive
            <span className="font-normal"> — se marcarán como eliminados (el candidato se conserva)</span>
          </p>
          {preview.removed.map(r => (
            <label key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={removedSel.has(r.id)} className="w-3.5 h-3.5 accent-amber-600"
                onChange={e => { const n = new Set(removedSel); e.target.checked ? n.add(r.id) : n.delete(r.id); setRemoveIds(n) }} />
              {r.candidateName} — <span className="text-gray-400 truncate">{r.drivePath}</span>
            </label>
          ))}
        </div>
      )}

      {(rows.length > 0 || preview.removed.length > 0) && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 -mx-6 px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {selected.length} archivos seleccionados
            {missingName.length > 0 && <span className="text-amber-700"> · {missingName.length} sin nombre (se usará el nombre del archivo)</span>}
          </p>
          <div className="flex items-center gap-3">
            {apply.isError && <span className="text-xs text-red-600">{(apply.error as any)?.response?.data?.message ?? 'Error al importar'}</span>}
            <button onClick={doApply} disabled={apply.isPending || (selected.length === 0 && removedSel.size === 0)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {apply.isPending && <Loader2 size={14} className="animate-spin" />}
              Importar {selected.length} archivo{selected.length !== 1 && 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
