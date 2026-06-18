import { useState } from 'react'
import { X, Save, Check, FileText, ShoppingCart, Pencil } from 'lucide-react'
import { useSmartProveedor, usePatchProveedor } from '@/hooks/useSmart'
import { useWorkCenters } from '@/hooks/useWorkCenters'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { SmartDocument } from '@/types'

// ── Formatting ────────────────────────────────────────────────────────────────

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fmt = (n: number | null | undefined) =>
  n == null || n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtPeriodo(p: string | null | undefined): string {
  if (!p || p.length < 6) return p ?? '—'
  const M: Record<string, string> = { '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic' }
  return `${M[p.slice(4)] ?? p.slice(4)} ${p.slice(0, 4)}`
}

function initials(s: string) {
  return s.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

const ENTITY_COLOR: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}
const ENTITY_LABEL: Record<string, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  )
}

// ── Documento row ─────────────────────────────────────────────────────────────

function DocRow({ d }: { d: SmartDocument }) {
  const isHon = d.category === 'HONORARIO'
  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <td className="px-3 py-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ENTITY_COLOR[d.legalEntity]}`}>
          {ENTITY_LABEL[d.legalEntity]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">{fmtPeriodo(d.periodoTributario)}</td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{d.clasificacion || '—'}</td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-[100px] truncate">{d.documento}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(d.fechaEmision)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(d.fechaPago)}</td>
      <td className="px-3 py-2 text-xs text-right tabular-nums">{fmt(d.montoNeto)}</td>
      <td className="px-3 py-2 text-xs text-right tabular-nums text-gray-500">
        {fmt(isHon ? d.retencion : d.iva)}
      </td>
      <td className="px-3 py-2 text-xs text-right tabular-nums font-medium">{fmt(d.montoTotal)}</td>
      <td className="px-3 py-2 text-center">
        {d.pagado ? <Check size={12} className="text-green-500 mx-auto" /> : <span className="text-gray-200 text-[10px]">—</span>}
      </td>
    </tr>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface Props { proveedorId: string; onClose: () => void }

export default function ProveedorDrawer({ proveedorId, onClose }: Props) {
  useEscapeKey(onClose)
  const { data: prov, isLoading } = useSmartProveedor(proveedorId)
  const { data: centers = [] }    = useWorkCenters()
  const patch = usePatchProveedor()

  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({ area: '', categoria: '', workCenterId: '', notes: '' })
  const [docTab,  setDocTab]  = useState<'todos' | 'honorarios' | 'compras'>('todos')

  function startEdit() {
    if (!prov) return
    setForm({
      area:         prov.area         ?? '',
      categoria:    prov.categoria    ?? '',
      workCenterId: prov.workCenterId ?? '',
      notes:        prov.notes        ?? '',
    })
    setEditing(true)
  }

  async function save() {
    if (!prov) return
    await patch.mutateAsync({
      id:           prov.id,
      area:         form.area         || null,
      categoria:    form.categoria    || null,
      workCenterId: form.workCenterId || null,
      notes:        form.notes        || null,
    })
    setEditing(false)
  }

  const docs     = prov?.documents ?? []
  const honDocs  = docs.filter(d => d.category === 'HONORARIO')
  const cmpDocs  = docs.filter(d => d.category === 'COMPRA')
  const shownDocs = docTab === 'honorarios' ? honDocs : docTab === 'compras' ? cmpDocs : docs

  const totalHon = honDocs.reduce((s, d) => s + d.montoTotal, 0)
  const totalCmp = cmpDocs.reduce((s, d) => s + d.montoTotal, 0)
  const totalAll = totalHon + totalCmp

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 inset-y-0 w-[780px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {prov ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {initials(prov.razonSocial)}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 truncate text-base">{prov.razonSocial}</h2>
                <p className="text-xs text-gray-400 font-mono">{prov.rut}</p>
              </div>
            </div>
          ) : (
            <div className="h-10 w-40 bg-gray-100 rounded animate-pulse" />
          )}
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <button onClick={startEdit}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg">
                <Pencil size={13} /> Editar
              </button>
            )}
            {editing && (
              <>
                <button onClick={() => setEditing(false)}
                  className="text-sm text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300">
                  Cancelar
                </button>
                <button onClick={save} disabled={patch.isPending}
                  className="flex items-center gap-1.5 text-sm text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <Save size={13} /> Guardar
                </button>
              </>
            )}
            <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Cargando…
          </div>
        )}

        {prov && (
          <div className="flex-1 overflow-y-auto">
            {/* Info section */}
            <div className="px-6 py-5 border-b border-gray-100">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Área</label>
                    <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                      placeholder="Ej: Tecnología, Marketing…"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Categoría</label>
                    <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                      placeholder="Ej: Freelance, Proveedor…"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Centro de Trabajo</label>
                    <select value={form.workCenterId} onChange={e => setForm(f => ({ ...f, workCenterId: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400">
                      <option value="">Sin asignar</option>
                      {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notas</label>
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Observaciones…"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  <Field label="Área">{prov.area || <span className="text-gray-300">—</span>}</Field>
                  <Field label="Categoría">{prov.categoria || <span className="text-gray-300">—</span>}</Field>
                  <Field label="Centro de Trabajo">{prov.workCenter?.name || <span className="text-gray-300">—</span>}</Field>
                  <Field label="Notas">{prov.notes || <span className="text-gray-300">—</span>}</Field>
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-gray-100">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-[11px] text-gray-400 mb-0.5">Honorarios</p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums">{CLP.format(totalHon)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                  <FileText size={10} className="text-amber-500" /> {honDocs.length} documentos
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-[11px] text-gray-400 mb-0.5">Compras</p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums">{CLP.format(totalCmp)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                  <ShoppingCart size={10} className="text-brand-500" /> {cmpDocs.length} documentos
                </p>
              </div>
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
                <p className="text-[11px] text-brand-500 mb-0.5">Total</p>
                <p className="text-sm font-semibold text-brand-700 tabular-nums">{CLP.format(totalAll)}</p>
                <p className="text-[10px] text-brand-400 mt-0.5">{docs.length} documentos</p>
              </div>
            </div>

            {/* Documents */}
            <div className="px-6 pt-4">
              <div className="flex border-b border-gray-200 mb-3">
                {([
                  ['todos',       `Todos (${docs.length})`],
                  ['honorarios',  `Honorarios (${honDocs.length})`],
                  ['compras',     `Compras (${cmpDocs.length})`],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDocTab(key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${docTab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Empresa</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Período</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Clasificación</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Documento</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Emisión</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pago</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Neto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Imp.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Pag.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownDocs.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">
                          Sin documentos
                        </td>
                      </tr>
                    ) : (
                      shownDocs.map(d => <DocRow key={d.id} d={d} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
