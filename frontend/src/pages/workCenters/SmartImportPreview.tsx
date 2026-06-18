import { useState } from 'react'
import { RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchSmartPreview, useSmartApply } from '@/hooks/useSmart'
import type { SmartPreviewData, SmartPreviewRow } from '@/types'
import { ENTITY_LABEL, ENTITY_COLOR, fmtN, fmtPeriodo, type SmartCategory } from './SmartShared'

// ── Preview section (used in SmartImportTab) ──────────────────────────────────

function PreviewSection({
  title, rows, selected, onToggle, onToggleAll, color, taxLabel,
}: {
  title:       string
  rows:        SmartPreviewRow[]
  selected:    Set<string>
  onToggle:    (id: string) => void
  onToggleAll: (on: boolean) => void
  color:       string
  taxLabel:    string
}) {
  const [open, setOpen] = useState(true)
  if (rows.length === 0) return null
  const allSel = rows.every(r => selected.has(r.smartId))

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-sm font-medium text-gray-800">{title}</span>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            {rows.length}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={allSel} onChange={e => onToggleAll(e.target.checked)}
                    className="rounded border-gray-300" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">RUT</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Razón Social</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Empresa</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Período</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Clasificación</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Documento</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Neto</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">{taxLabel}</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.smartId} className={`hover:bg-gray-50 ${selected.has(r.smartId) ? 'bg-brand-50/30' : ''}`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selected.has(r.smartId)} onChange={() => onToggle(r.smartId)}
                      className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-gray-600">{r.rut}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-[180px] truncate">{r.razonSocial}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[r.legalEntity]}`}>
                      {ENTITY_LABEL[r.legalEntity]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtPeriodo(r.periodoTributario)}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{r.clasificacion || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{r.documento}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{fmtN(r.montoNeto)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {fmtN(r.category === 'HONORARIO' ? r.retencion : r.iva)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-800">{fmtN(r.montoTotal)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.pagado
                      ? <Check size={12} className="text-green-500 mx-auto" />
                      : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Category preview (Honorarios o Compras) ───────────────────────────────────

function CategoryPreview({
  data, category,
}: {
  data:     SmartPreviewData
  category: SmartCategory
}) {
  const section  = data[category]
  const taxLabel = category === 'honorarios' ? 'Retención' : 'IVA'
  const isHon    = category === 'honorarios'

  const [selNew,  setSelNew]  = useState<Set<string>>(() => new Set(section.nuevos.map(r => r.smartId)))
  const [selChg,  setSelChg]  = useState<Set<string>>(() => new Set(section.cambios.map(r => r.smartId)))
  const [selSync, setSelSync] = useState<Set<string>>(new Set())

  const apply     = useSmartApply()
  const isPending = apply.isPending
  const total     = selNew.size + selChg.size + selSync.size

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setFn(n)
  }
  function toggleAll(rows: SmartPreviewRow[], set: Set<string>, setFn: (s: Set<string>) => void, on: boolean) {
    setFn(on ? new Set(rows.map(r => r.smartId)) : new Set())
  }

  const hasAny = section.nuevos.length + section.cambios.length + section.sincronizados.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {section.nuevos.length} nuevo{section.nuevos.length !== 1 ? 's' : ''} ·{' '}
          {section.cambios.length} con cambio{section.cambios.length !== 1 ? 's' : ''} ·{' '}
          {section.sincronizados.length} sincronizado{section.sincronizados.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => apply.mutate(isHon ? { honorariosKeys: [...selNew, ...selChg, ...selSync] } : { comprasKeys: [...selNew, ...selChg, ...selSync] })}
          disabled={isPending || total === 0}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs px-4 py-2.5 rounded font-medium transition-colors"
        >
          {isPending && <RefreshCw size={11} className="animate-spin" />}
          Importar{total > 0 ? ` (${total})` : ''}
        </button>
      </div>

      {apply.isError && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle size={12} /> Error al importar. Intenta de nuevo.
        </div>
      )}
      {apply.isSuccess && (
        <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 border border-green-200 rounded px-3 py-2">
          <Check size={12} /> Importado correctamente.
        </div>
      )}

      {!hasAny && (
        <p className="text-sm text-gray-400 text-center py-6">Sin archivos en reportes/Smart</p>
      )}

      <PreviewSection title="Nuevos"           rows={section.nuevos}        selected={selNew}  onToggle={id => toggleSet(selNew,  setSelNew,  id)} onToggleAll={(on) => toggleAll(section.nuevos,        selNew,  setSelNew,  on)} color="bg-green-400"  taxLabel={taxLabel} />
      <PreviewSection title="Cambios"          rows={section.cambios}       selected={selChg}  onToggle={id => toggleSet(selChg,  setSelChg,  id)} onToggleAll={(on) => toggleAll(section.cambios,       selChg,  setSelChg,  on)} color="bg-yellow-400" taxLabel={taxLabel} />
      <PreviewSection title="Ya sincronizados" rows={section.sincronizados} selected={selSync} onToggle={id => toggleSet(selSync, setSelSync, id)} onToggleAll={(on) => toggleAll(section.sincronizados, selSync, setSelSync, on)} color="bg-gray-300"   taxLabel={taxLabel} />
    </div>
  )
}

// ── SmartImportTab — for BukPage (Importables Excel > Smart CTO) ──────────────

export function SmartImportTab() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [preview, setPreview] = useState<SmartPreviewData | null>(null)
  const [subTab,  setSubTab]  = useState<SmartCategory>('honorarios')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await fetchSmartPreview()
      setPreview(data)
    } catch {
      setError('No se pudo leer los archivos. Verifica que estén en reportes/Smart/Comunicaciones y reportes/Smart/Consultoría.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Lee los archivos Excel de <code className="text-xs bg-gray-100 px-1 rounded">reportes/Smart/</code>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Comunicaciones y Consultoría · Honorarios y Libro de Compras
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Leyendo archivos…' : preview ? 'Recargar' : 'Cargar y previsualizar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          {/* Sub-tabs: Honorarios / Compras */}
          <div className="flex border-b border-gray-200">
            {(['honorarios', 'compras'] as SmartCategory[]).map(key => {
              const section = preview[key]
              const pending = section.nuevos.length + section.cambios.length
              return (
                <button key={key} onClick={() => setSubTab(key)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {key === 'honorarios' ? 'Honorarios' : 'Compras'}
                  {pending > 0 && (
                    <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 rounded-full px-1.5 py-0.5 font-semibold">
                      {pending}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <CategoryPreview data={preview} category={subTab} />
        </div>
      )}
    </div>
  )
}
